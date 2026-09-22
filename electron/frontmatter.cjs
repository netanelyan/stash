const yaml = require('js-yaml');

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/;

// Crockford base32, so ids sort lexicographically in the same order they were made.
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function newId() {
  let t = Date.now();
  let time = '';
  for (let i = 0; i < 10; i++) {
    time = B32[t % 32] + time;
    t = Math.floor(t / 32);
  }
  let rand = '';
  for (let i = 0; i < 6; i++) rand += B32[Math.floor(Math.random() * 32)];
  return time + rand;
}

// Stable fallback id for files that have no frontmatter yet. Derived from the
// path so history keeps working until the user edits metadata and we can write
// a real id into the file.
function derivedId(relPath) {
  let h = 0x811c9dc5;
  for (let i = 0; i < relPath.length; i++) {
    h ^= relPath.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return 'f' + h.toString(32).toUpperCase().padStart(7, '0');
}

function slugify(title) {
  const s = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0080-\uffff]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return s || 'untitled';
}

function titleFromFilename(name) {
  return name.replace(/\.md$/i, '').replace(/[-_]+/g, ' ').trim() || 'Untitled';
}

/**
 * Parse a prompt file. Never throws: malformed YAML degrades to "the whole file
 * is body", and we remember that with hadFrontmatter:false so a body-only save
 * does not stamp frontmatter onto a file the user never asked us to touch.
 */
function parse(raw, relPath, fileName) {
  const m = FM_RE.exec(raw);
  let data = null;
  let body = raw;
  let hadFrontmatter = false;
  if (m) {
    try {
      const parsed = yaml.load(m[1]);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        data = parsed;
        // FM_RE eats the newline that ends the closing "---"; drop the one
        // blank line we write after it so the body round-trips unchanged.
        body = raw.slice(m[0].length).replace(/^\r?\n/, '');
        hadFrontmatter = true;
      }
    } catch {
      // malformed YAML: fall through, treat everything as body
    }
  }
  const meta = data || {};
  const tags = Array.isArray(meta.tags)
    ? meta.tags.map((t) => String(t)).filter(Boolean)
    : typeof meta.tags === 'string'
      ? meta.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];
  return {
    id: typeof meta.id === 'string' && meta.id ? meta.id : derivedId(relPath),
    title: typeof meta.title === 'string' && meta.title ? meta.title : titleFromFilename(fileName),
    tags,
    created: asIso(meta.created),
    updated: asIso(meta.updated),
    body,
    hadFrontmatter,
    extra: omit(meta, ['id', 'title', 'tags', 'created', 'updated']),
  };
}

function asIso(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function omit(obj, keys) {
  const out = {};
  for (const k of Object.keys(obj)) if (!keys.includes(k)) out[k] = obj[k];
  return out;
}

function serialize(doc) {
  const head = {
    id: doc.id,
    title: doc.title,
    tags: doc.tags || [],
    created: doc.created || new Date().toISOString(),
    updated: doc.updated || new Date().toISOString(),
    ...(doc.extra || {}),
  };
  const fm = yaml.dump(head, { lineWidth: -1, flowLevel: 1, noRefs: true });
  let body = doc.body || '';
  if (body && !body.startsWith('\n')) body = '\n' + body;
  return `---\n${fm}---\n${body}`;
}

module.exports = { parse, serialize, newId, derivedId, slugify, titleFromFilename, FM_RE };
