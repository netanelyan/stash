const { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, shell, dialog, nativeImage, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

const CH = require('./channels.cjs');
const vault = require('./vault.cjs');
const config = require('./config.cjs');
const watcher = require('./watcher.cjs');
const fm = require('./frontmatter.cjs');

const DEV_URL = process.env.STASH_DEV_SERVER_URL || null;
const RENDERER_FILE = path.join(__dirname, '..', 'dist', 'index.html');

let win = null;
let captureWin = null;
let tray = null;
let quitting = false;
let shortcutState = { accelerator: null, registered: false, error: null };

// A single instance keeps the tray icon and the global shortcut unambiguous.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showMain());
  app.whenReady().then(start);
}

function iconPath() {
  const candidates = [
    path.join(__dirname, '..', 'dist', 'icon.ico'),
    path.join(__dirname, '..', 'build', 'icon.ico'),
    path.join(process.resourcesPath || '', 'icon.ico'),
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch { /* ignore */ }
  }
  return null;
}

async function start() {
  config.init(app.getPath('userData'));
  const cfg = config.get();
  const root = cfg.vaultRoot || vault.defaultRoot();
  await vault.setRoot(root);
  config.patch({ vaultRoot: vault.getRoot() });
  await vault.scan();

  registerIpc();
  createWindow();
  createTray();
  registerGlobalShortcut(cfg.globalShortcut);
  startWatching();

  app.on('activate', () => { if (!win) createWindow(); else showMain(); });
}

// Closing the window parks Stash in the tray; only the tray's Quit (or an OS
// shutdown) actually exits.
app.on('window-all-closed', () => { /* stay alive in the tray */ });
app.on('before-quit', () => { quitting = true; });
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  watcher.stop();
  config.flush();
});

// ------------------------------------------------------------------- windows

function createWindow() {
  const cfg = config.get();
  const b = cfg.window || {};
  win = new BrowserWindow({
    width: b.width || 1180,
    height: b.height || 780,
    x: typeof b.x === 'number' ? b.x : undefined,
    y: typeof b.y === 'number' ? b.y : undefined,
    minWidth: 640,
    minHeight: 420,
    show: false,
    frame: false,                 // custom title bar: the tab strip is the chrome
    backgroundColor: '#1e1e1e',
    icon: iconPath() || undefined,
    webPreferences: {
      preload: path.join(__dirname, '..', 'dist-electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  if (b.maximized) win.maximize();
  loadRenderer(win, '');

  win.once('ready-to-show', () => win.show());
  win.on('maximize', () => sendMaximizeState());
  win.on('unmaximize', () => sendMaximizeState());
  win.on('blur', () => send(win, CH.EV_MENU, { command: 'window-blur' }));
  win.on('resize', saveBounds);
  win.on('move', saveBounds);

  // On close: ask the renderer to flush pending saves, wait briefly, then hide
  // (or really close if we are quitting).
  win.on('close', (e) => {
    if (win.__flushed) return;
    e.preventDefault();
    flushRenderer().then(() => {
      win.__flushed = true;
      saveBounds();
      config.flush();
      if (quitting) win.destroy();
      else { win.__flushed = false; win.hide(); }
    });
  });

  win.on('closed', () => { win = null; });

  // No remote navigation, ever. This app makes no network calls.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
  });
}

function loadRenderer(target, hash) {
  if (DEV_URL) target.loadURL(DEV_URL + (hash ? '#' + hash : ''));
  else target.loadFile(RENDERER_FILE, hash ? { hash } : undefined);
}

function saveBounds() {
  if (!win || win.isDestroyed()) return;
  const maximized = win.isMaximized();
  const bounds = maximized ? (config.get().window || {}) : win.getBounds();
  config.patch({
    window: {
      width: bounds.width || 1180,
      height: bounds.height || 780,
      x: typeof bounds.x === 'number' ? bounds.x : null,
      y: typeof bounds.y === 'number' ? bounds.y : null,
      maximized,
    },
  });
}

function sendMaximizeState() {
  send(win, CH.EV_MAXIMIZE_CHANGED, win && !win.isDestroyed() ? win.isMaximized() : false);
}

function send(target, channel, payload) {
  if (target && !target.isDestroyed()) target.webContents.send(channel, payload);
}

function showMain() {
  if (!win) { createWindow(); return; }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// Give the renderer a moment to write out any debounced edits before we hide or
// quit. Never block forever: if the renderer is wedged we continue anyway.
function flushRenderer() {
  return new Promise((resolve) => {
    if (!win || win.isDestroyed()) return resolve();
    let done = false;
    const finish = () => { if (!done) { done = true; ipcMain.removeListener(CH.EV_FLUSH_DONE, finish); resolve(); } };
    ipcMain.once(CH.EV_FLUSH_DONE, finish);
    send(win, CH.EV_FLUSH, null);
    setTimeout(finish, 1500);
  });
}

// -------------------------------------------------------------- quick capture

function openCapture() {
  if (captureWin && !captureWin.isDestroyed()) {
    captureWin.show();
    captureWin.focus();
    return;
  }
  captureWin = new BrowserWindow({
    width: 560,
    height: 220,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    center: true,
    show: false,
    backgroundColor: '#252526',
    webPreferences: {
      preload: path.join(__dirname, '..', 'dist-electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  loadRenderer(captureWin, 'capture');
  captureWin.once('ready-to-show', () => {
    captureWin.show();
    captureWin.focus();
  });
  captureWin.on('blur', () => closeCapture());
  captureWin.on('closed', () => { captureWin = null; });
  captureWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

function closeCapture() {
  if (captureWin && !captureWin.isDestroyed()) captureWin.close();
  captureWin = null;
}

// ------------------------------------------------------------------ tray

function createTray() {
  const icon = iconPath();
  tray = new Tray(icon ? nativeImage.createFromPath(icon) : nativeImage.createEmpty());
  tray.setToolTip('Stash');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Stash', click: () => showMain() },
    { label: 'Quick capture', click: () => openCapture() },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('double-click', () => showMain());
  Menu.setApplicationMenu(null);
}

// ------------------------------------------------------- global shortcut

function registerGlobalShortcut(accelerator) {
  globalShortcut.unregisterAll();
  const accel = accelerator || 'Control+Alt+S';
  shortcutState = { accelerator: accel, registered: false, error: null };
  try {
    const ok = globalShortcut.register(accel, () => openCapture());
    shortcutState.registered = ok && globalShortcut.isRegistered(accel);
    if (!shortcutState.registered) shortcutState.error = 'Already in use by another application';
  } catch (err) {
    shortcutState.error = String(err && err.message ? err.message : err);
  }
  return shortcutState;
}

// ------------------------------------------------------------------ watching

// Our own writes come straight back through fs.watch. Remembering them for a
// moment means a normal autosave does not trigger a full vault rescan.
const selfWrites = new Map();
function noteSelfWrite(relPath) {
  selfWrites.set(relPath, Date.now());
  if (selfWrites.size > 64) {
    for (const [k, t] of selfWrites) if (Date.now() - t > 5000) selfWrites.delete(k);
  }
}
function isAllSelfWrites(changed) {
  if (!changed.length) return false;
  return changed.every((p) => {
    const t = selfWrites.get(p);
    return t != null && Date.now() - t < 2500;
  });
}

function startWatching() {
  watcher.start(vault.getRoot(), async (changed) => {
    if (isAllSelfWrites(changed)) return;
    const tree = await vault.scan();
    send(win, CH.EV_VAULT_CHANGED, {
      tree,
      index: vault.indexMeta(),
      tags: vault.tagCounts(),
      changed,
    });
  }, 300);
}

async function vaultSnapshot() {
  const tree = await vault.scan();
  return { tree, index: vault.indexMeta(), tags: vault.tagCounts(), root: vault.getRoot() };
}

// ---------------------------------------------------------------------- IPC

function registerIpc() {
  const handle = (channel, fn) => ipcMain.handle(channel, async (_e, ...args) => fn(...args));

  handle(CH.VAULT_INFO, async () => ({
    root: vault.getRoot(),
    name: path.basename(vault.getRoot()),
    config: config.get(),
    shortcut: shortcutState,
    version: app.getVersion(),
  }));

  handle(CH.VAULT_TREE, () => vaultSnapshot());

  handle(CH.VAULT_PICK_ROOT, async () => {
    const res = await dialog.showOpenDialog(win, {
      title: 'Choose vault folder',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: vault.getRoot(),
    });
    if (res.canceled || !res.filePaths.length) return null;
    return res.filePaths[0];
  });

  handle(CH.VAULT_SET_ROOT, async (dir) => {
    await vault.setRoot(dir);
    config.patch({ vaultRoot: vault.getRoot(), openTabs: [], activeTab: null, treeExpanded: [] });
    startWatching();
    return vaultSnapshot();
  });

  handle(CH.VAULT_REVEAL, (relPath) => {
    shell.showItemInFolder(vault.resolveInVault(relPath));
    return true;
  });

  handle(CH.PROMPT_READ, (relPath) => vault.readPrompt(relPath));
  handle(CH.PROMPT_SAVE, (payload) => {
    noteSelfWrite(payload.path);
    return vault.savePrompt(payload);
  });
  handle(CH.PROMPT_CREATE, (dirRel, title) => vault.createPrompt(dirRel, title));
  handle(CH.PROMPT_CREATE_FOLDER, (dirRel, name) => vault.createFolder(dirRel, name));
  handle(CH.PROMPT_RENAME, (relPath, name, isFolder) => vault.renameEntry(relPath, name, isFolder));
  handle(CH.PROMPT_DUPLICATE, (relPath) => vault.duplicatePrompt(relPath));
  handle(CH.PROMPT_MOVE, (relPath, destDir) => vault.movePrompt(relPath, destDir));
  handle(CH.PROMPT_DELETE, (relPath) => vault.deletePrompt(relPath));
  handle(CH.PROMPT_RESTORE_TRASH, (trashRel, originalRel) => vault.restoreFromTrash(trashRel, originalRel));

  handle(CH.SEARCH_FULLTEXT, (query) => vault.fullTextSearch(query));

  handle(CH.HISTORY_LIST, (id) => vault.listSnapshots(id));
  handle(CH.HISTORY_READ, (id, file) => vault.readSnapshot(id, file));

  // Restore snapshots the *current* state first, so restore is itself undoable.
  handle(CH.HISTORY_RESTORE, async (relPath, id, file) => {
    const current = await vault.readPrompt(relPath);
    const currentRaw = fm.serialize({
      id: current.id, title: current.title, tags: current.tags,
      created: current.created, updated: current.updated, extra: current.extra, body: current.body,
    });
    await vault.maybeSnapshot(id, currentRaw, { force: true });
    const snapRaw = await vault.readSnapshot(id, file);
    const doc = fm.parse(snapRaw, relPath, path.basename(relPath));
    await vault.savePrompt({
      path: relPath, id: current.id, title: doc.title, tags: doc.tags,
      created: current.created, extra: doc.extra, body: doc.body, hadFrontmatter: true,
    });
    return vault.readPrompt(relPath);
  });

  handle(CH.CLIPBOARD_WRITE, (text) => { clipboard.writeText(String(text == null ? '' : text)); return true; });

  handle(CH.CONFIG_GET, () => config.get());
  handle(CH.CONFIG_PATCH, (partial) => config.patch(partial));

  handle(CH.WIN_MINIMIZE, () => { if (win) win.minimize(); });
  handle(CH.WIN_MAXIMIZE, () => {
    if (!win) return false;
    if (win.isMaximized()) win.unmaximize(); else win.maximize();
    return win.isMaximized();
  });
  handle(CH.WIN_CLOSE, () => { if (win) win.close(); });
  handle(CH.WIN_IS_MAXIMIZED, () => (win ? win.isMaximized() : false));

  handle(CH.CAPTURE_SAVE, async (payload) => {
    const body = String((payload && payload.body) || '');
    let title = String((payload && payload.title) || '').trim();
    if (!title) {
      const firstLine = body.split('\n').find((l) => l.trim()) || 'Quick capture';
      title = firstLine.trim().slice(0, 60);
    }
    await vault.ensureFolder('Inbox');
    const rel = await vault.createPrompt('Inbox', title);
    const doc = await vault.readPrompt(rel);
    await vault.savePrompt({
      path: rel, id: doc.id, title, tags: [], created: doc.created, body, hadFrontmatter: true,
    });
    const snap = await vaultSnapshot();
    send(win, CH.EV_VAULT_CHANGED, { tree: snap.tree, index: snap.index, tags: snap.tags, changed: [rel] });
    return rel;
  });

  handle(CH.CAPTURE_CLOSE, () => { closeCapture(); });

  handle(CH.SHORTCUT_STATUS, () => shortcutState);
  handle(CH.SHORTCUT_SET, (accel) => {
    const state = registerGlobalShortcut(accel);
    if (state.registered) config.patch({ globalShortcut: accel });
    return state;
  });

  // Renderer acknowledges a flush request (one-way, not a handle).
  ipcMain.on(CH.EV_FLUSH_DONE, () => { /* consumed by flushRenderer's once() */ });
}
