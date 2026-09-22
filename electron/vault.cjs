const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const fm = require('./frontmatter.cjs');

const STASH_DIR = '.stash';
const HISTORY_DIR = '.stash/history';
const TRASH_DIR = '.stash/trash';
const MAX_SNAPSHOTS = 200;
const SNAPSHOT_THROTTLE_MS = 60 * 1000;

let root = null;

function defaultRoot() {
  return path.join(os.homedir(), 'Documents', 'Stash');
}

function getRoot() {
  return root;
}

async function setRoot(dir) {
  root = path.resolve(dir);
  await fsp.mkdir(root, { recursive: true });
  await fsp.mkdir(path.join(root, 'Inbox'), { recursive: true });
  await fsp.mkdir(path.join(root, '.stash', 'history'), { recursive: true });
  await fsp.mkdir(path.join(root, '.stash', 'trash'), { recursive: true });
  return root;
}

function normalizeRel(p) {
  return String(p).split(path.sep).join('/');
}

/**
 * Path containment check. Everything the renderer hands us is a vault-relative
 * path; we resolve it and refuse anything that escapes the vault root (via
 * "..", a drive-absolute path, and so on). Called by every read and write.
 */
function resolveInVault(relPath, opts) {
  const allowStash = !!(opts && opts.allowStash);
  if (!root) throw new Error('Vault not open');
  if (typeof relPath !== 'string') throw new Error('Bad path');
  const rel = normalizeRel(relPath).replace(/^\/+/, '');
  const abs = path.resolve(root, rel);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (abs !== root && !abs.startsWith(prefix)) throw new Error('Path escapes vault: ' + relPath);
  if (!allowStash) {
    const inner = normalizeRel(path.relative(root, abs));
    if (inner === STASH_DIR || inner.startsWith(STASH_DIR + '/')) {
      throw new Error('Path is inside .stash: ' + relPath);
    }
  }
  return abs;
}

/**
 * Atomic write: write a temp file in the *same directory* (so the rename stays
 * on one volume and is therefore atomic), flush it to disk, then rename over
 * the target. A crash mid-write leaves either the old file or an orphan temp
 * file, never a truncated or zero-byte prompt.
 */
async function atomicWrite(abs, contents) {
  const dir = path.dirname(abs);
  await fsp.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, '.' + path.basename(abs) + '.' + process.pid + '.' + Date.now() + '.tmp');
  let fh;
  try {
    fh = await fsp.open(tmp, 'w');
    await fh.writeFile(contents, 'utf8');
    await fh.sync();
  } finally {
    if (fh) await fh.close();
  }
  await fsp.rename(tmp, abs);
}

function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

// ---------------------------------------------------------------- tree + index

const IGNORED_DIRS = new Set([STASH_DIR, '.git', 'node_modules']);

async function walk(absDir, relDir, out) {
  let entries;
  try {
    entries = await fsp.readdir(absDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const nodes = [];
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    if (e.isDirectory()) {
      if (IGNORED_DIRS.has(e.name)) continue;
      const rel = relDir ? relDir + '/' + e.name : e.name;
      const children = await walk(path.join(absDir, e.name), rel, out);
      nodes.push({ type: 'folder', name: e.name, path: rel, children });
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
      const rel = relDir ? relDir + '/' + e.name : e.name;
      const abs = path.join(absDir, e.name);
      let raw = '';
      let stat = null;
      try {
        raw = await fsp.readFile(abs, 'utf8');
        stat = await fsp.stat(abs);
      } catch {
        continue;
      }
      const doc = fm.parse(raw, rel, e.name);
      const entry = {
        path: rel,
        name: e.name,
        id: doc.id,
        title: doc.title,
        tags: doc.tags,
        created: doc.created,
        updated: doc.updated || (stat ? stat.mtime.toISOString() : null),
        mtimeMs: stat ? stat.mtimeMs : 0,
        size: stat ? stat.size : 0,
        hash: hashString(raw),
      };
      out.set(rel, Object.assign({}, entry, { body: doc.body }));
      nodes.push({
        type: 'file', name: e.name, path: rel, id: doc.id,
        title: doc.title, tags: doc.tags, updated: entry.updated,
      });
    }
  }
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return String(a.title || a.name).localeCompare(String(b.title || b.name), undefined, { sensitivity: 'base' });
  });
  return nodes;
}

// relPath -> { ...meta, body }. Rebuilt on scan, patched on save.
let index = new Map();

async function scan() {
  const out = new Map();
  const tree = await walk(root, '', out);
  index = out;
  return tree;
}

// What the renderer gets: metadata only. Bodies stay in main, where full text
// search runs.
function indexMeta() {
  return [...index.values()].map((e) => {
    const copy = Object.assign({}, e);
    delete copy.body;
    return copy;
  });
}

function tagCounts() {
  const counts = new Map();
  for (const e of index.values()) {
    for (const t of e.tags) counts.set(t, (counts.get(t) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

// ------------------------------------------------------------------- prompts

async function readPrompt(relPath) {
  const abs = resolveInVault(relPath);
  const raw = await fsp.readFile(abs, 'utf8');
  const stat = await fsp.stat(abs);
  const doc = fm.parse(raw, relPath, path.basename(relPath));
  return {
    path: relPath,
    id: doc.id,
    title: doc.title,
    tags: doc.tags,
    created: doc.created,
    updated: doc.updated,
    body: doc.body,
    hadFrontmatter: doc.hadFrontmatter,
    extra: doc.extra,
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    hash: hashString(raw),
  };
}

async function exists(rel) {
  try {
    await fsp.access(resolveInVault(rel));
    return true;
  } catch {
    return false;
  }
}

async function uniquePath(dirRel, baseName) {
  const stem = baseName.replace(/\.md$/i, '');
  for (let n = 1; ; n++) {
    const name = n === 1 ? stem + '.md' : stem + '-' + n + '.md';
    const rel = dirRel ? dirRel + '/' + name : name;
    if (!(await exists(rel))) return rel;
  }
}

async function savePrompt(payload) {
  const relPath = payload.path;
  const abs = resolveInVault(relPath);
  const now = new Date().toISOString();

  // A file that arrived without frontmatter keeps its shape until the user
  // actually edits metadata (title or tags); only then do we start writing a
  // header into it.
  const emitFrontmatter = payload.hadFrontmatter !== false || payload.writeFrontmatter === true;
  const contents = emitFrontmatter
    ? fm.serialize({
        id: payload.id,
        title: payload.title,
        tags: payload.tags,
        created: payload.created || now,
        updated: now,
        extra: payload.extra,
        body: payload.body,
      })
    : payload.body;

  await atomicWrite(abs, contents);
  const snapshotWritten = await maybeSnapshot(payload.id, contents);

  const stat = await fsp.stat(abs);
  const entry = {
    path: relPath,
    name: path.basename(relPath),
    id: payload.id,
    title: payload.title,
    tags: payload.tags,
    created: payload.created || now,
    updated: now,
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    hash: hashString(contents),
  };
  index.set(relPath, Object.assign({}, entry, { body: payload.body }));
  return {
    updated: now,
    hash: entry.hash,
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    snapshotWritten,
    hadFrontmatter: emitFrontmatter,
  };
}

async function createPrompt(dirRel, title) {
  const t = title || 'Untitled';
  const rel = await uniquePath(dirRel || '', fm.slugify(t));
  const now = new Date().toISOString();
  const id = fm.newId();
  await atomicWrite(
    resolveInVault(rel),
    fm.serialize({ id, title: t, tags: [], created: now, updated: now, body: '' })
  );
  return rel;
}

function cleanName(name, fallback) {
  const clean = String(name || '').replace(/[\\/:*?"<>|]/g, '-').trim();
  return clean || fallback;
}

// Make sure a folder exists, without the uniquifying that createFolder does.
async function ensureFolder(relDir) {
  await fsp.mkdir(resolveInVault(relDir), { recursive: true });
  return relDir;
}

async function createFolder(dirRel, name) {
  const base = cleanName(name, 'New folder');
  for (let n = 1; ; n++) {
    const leaf = n === 1 ? base : base + ' ' + n;
    const rel = dirRel ? dirRel + '/' + leaf : leaf;
    const abs = resolveInVault(rel);
    try {
      await fsp.access(abs);
    } catch {
      await fsp.mkdir(abs, { recursive: true });
      return rel;
    }
  }
}

// Renaming a prompt means a new title in frontmatter plus a filename derived
// from it. Renaming a folder is a plain directory rename.
async function renameEntry(relPath, newName, isFolder) {
  const abs = resolveInVault(relPath);
  const dir = path.dirname(relPath);
  const parent = dir === '.' ? '' : normalizeRel(dir);
  if (isFolder) {
    const clean = cleanName(newName, '');
    if (!clean) return relPath;
    const rel = parent ? parent + '/' + clean : clean;
    if (rel === relPath) return relPath;
    await fsp.rename(abs, resolveInVault(rel));
    return rel;
  }
  const doc = await readPrompt(relPath);
  const wanted = fm.slugify(newName) + '.md';
  const rel = path.basename(relPath) === wanted ? relPath : await uniquePath(parent, wanted);
  const now = new Date().toISOString();
  const contents = fm.serialize({
    id: doc.id,
    title: newName,
    tags: doc.tags,
    created: doc.created || now,
    updated: now,
    extra: doc.extra,
    body: doc.body,
  });
  await atomicWrite(resolveInVault(rel), contents);
  if (rel !== relPath) {
    await fsp.unlink(abs);
    index.delete(relPath);
  }
  return rel;
}

async function duplicatePrompt(relPath) {
  const doc = await readPrompt(relPath);
  const dir = path.dirname(relPath);
  const parent = dir === '.' ? '' : normalizeRel(dir);
  const title = doc.title + ' copy';
  const rel = await uniquePath(parent, fm.slugify(title));
  const now = new Date().toISOString();
  await atomicWrite(
    resolveInVault(rel),
    fm.serialize({
      id: fm.newId(), title, tags: doc.tags, created: now, updated: now, extra: doc.extra, body: doc.body,
    })
  );
  return rel;
}

async function movePrompt(relPath, destDirRel) {
  const abs = resolveInVault(relPath);
  const dest = destDirRel || '';
  const dir = path.dirname(relPath);
  const parent = dir === '.' ? '' : normalizeRel(dir);
  if (parent === dest) return relPath;
  const stat = await fsp.stat(abs);
  if (stat.isDirectory()) {
    const leaf = path.basename(relPath);
    const rel = dest ? dest + '/' + leaf : leaf;
    if (rel === relPath || rel.startsWith(relPath + '/')) return relPath;
    await fsp.rename(abs, resolveInVault(rel));
    return rel;
  }
  const rel = await uniquePath(dest, path.basename(relPath));
  await fsp.mkdir(path.dirname(resolveInVault(rel)), { recursive: true });
  await fsp.rename(abs, resolveInVault(rel));
  index.delete(relPath);
  return rel;
}

// Delete moves into .stash/trash with a timestamp suffix, so the undo toast has
// something to put back and the app never truly unlinks a prompt.
async function deletePrompt(relPath) {
  const abs = resolveInVault(relPath);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const stat = await fsp.stat(abs);
  const isFolder = stat.isDirectory();
  const base = path.basename(relPath).replace(/\.md$/i, '');
  const trashRel = TRASH_DIR + '/' + base + '.' + stamp + (isFolder ? '' : '.md');
  const trashAbs = resolveInVault(trashRel, { allowStash: true });
  await fsp.mkdir(path.dirname(trashAbs), { recursive: true });
  await fsp.rename(abs, trashAbs);
  index.delete(relPath);
  return { trashPath: trashRel, isFolder };
}

async function restoreFromTrash(trashRel, originalRel) {
  const src = resolveInVault(trashRel, { allowStash: true });
  const dest = resolveInVault(originalRel);
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.rename(src, dest);
  return originalRel;
}

// ------------------------------------------------------------------- history

function historyDirFor(id) {
  const safe = String(id).replace(/[^A-Za-z0-9_-]/g, '');
  if (!safe) throw new Error('Bad prompt id');
  return resolveInVault(HISTORY_DIR + '/' + safe, { allowStash: true });
}

// 2026-09-22T14-31-02-123Z.md  <->  2026-09-22T14:31:02.123Z
function fileNameToIso(name) {
  const s = name.replace(/\.md$/, '');
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/.exec(s);
  return m ? m[1] + 'T' + m[2] + ':' + m[3] + ':' + m[4] + '.' + m[5] + 'Z' : s;
}

function isoToFileName(iso) {
  return iso.replace(/[:.]/g, '-') + '.md';
}

async function listSnapshots(id) {
  let names = [];
  try {
    names = await fsp.readdir(historyDirFor(id));
  } catch {
    return [];
  }
  return names
    .filter((n) => n.endsWith('.md'))
    .sort()
    .reverse()
    .map((n) => ({ file: n, time: fileNameToIso(n) }));
}

/**
 * Snapshot throttle: at most one snapshot per prompt per 60 seconds, and only
 * when the content actually differs from the newest snapshot. Without this,
 * autosave would write a snapshot for every typing pause.
 */
async function maybeSnapshot(id, contents, opts) {
  const force = !!(opts && opts.force);
  const dir = historyDirFor(id);
  const snaps = await listSnapshots(id);
  if (snaps.length) {
    const newest = snaps[0];
    let prev = null;
    try {
      prev = await fsp.readFile(path.join(dir, newest.file), 'utf8');
    } catch { /* unreadable snapshot: treat as different */ }
    if (prev === contents) return false;
    const age = Date.now() - new Date(newest.time).getTime();
    if (!force && age >= 0 && age < SNAPSHOT_THROTTLE_MS) return false;
  }
  await fsp.mkdir(dir, { recursive: true });
  await atomicWrite(path.join(dir, isoToFileName(new Date().toISOString())), contents);
  await pruneSnapshots(id);
  return true;
}

async function pruneSnapshots(id) {
  const snaps = await listSnapshots(id);
  if (snaps.length <= MAX_SNAPSHOTS) return;
  const dir = historyDirFor(id);
  for (const s of snaps.slice(MAX_SNAPSHOTS)) {
    try { await fsp.unlink(path.join(dir, s.file)); } catch { /* already gone */ }
  }
}

async function readSnapshot(id, file) {
  if (!/^[0-9A-Za-z._-]+\.md$/.test(file)) throw new Error('Bad snapshot name');
  return fsp.readFile(path.join(historyDirFor(id), file), 'utf8');
}

// -------------------------------------------------------------------- search

function fullTextSearch(query, limit) {
  const max = limit || 300;
  const q = String(query || '').trim();
  if (!q) return [];
  const needle = q.toLowerCase();
  const results = [];
  for (const entry of index.values()) {
    const lines = entry.body.split('\n');
    const matches = [];
    for (let i = 0; i < lines.length; i++) {
      const at = lines[i].toLowerCase().indexOf(needle);
      if (at !== -1) {
        matches.push({ line: i, col: at, text: lines[i].length > 400 ? lines[i].slice(0, 400) : lines[i] });
        if (matches.length >= 20) break;
      }
    }
    if (matches.length) {
      results.push({
        path: entry.path, title: entry.title, id: entry.id, matches, updated: entry.updated,
      });
      if (results.length >= max) break;
    }
  }
  results.sort((a, b) => b.matches.length - a.matches.length || String(b.updated).localeCompare(String(a.updated)));
  return results;
}

module.exports = {
  STASH_DIR, TRASH_DIR, HISTORY_DIR, SNAPSHOT_THROTTLE_MS, MAX_SNAPSHOTS,
  defaultRoot, getRoot, setRoot, resolveInVault, atomicWrite, hashString,
  scan, indexMeta, tagCounts,
  readPrompt, savePrompt, createPrompt, createFolder, ensureFolder, renameEntry, duplicatePrompt,
  movePrompt, deletePrompt, restoreFromTrash,
  listSnapshots, maybeSnapshot, readSnapshot, historyDirFor, fileNameToIso,
  fullTextSearch,
};
