const { contextBridge, ipcRenderer } = require('electron');
const CH = require('./channels.cjs');

// One narrow surface, no ipcRenderer leak. Every path argument is a
// vault-relative string that main re-resolves and containment-checks.
const api = {
  vault: {
    info: () => ipcRenderer.invoke(CH.VAULT_INFO),
    tree: () => ipcRenderer.invoke(CH.VAULT_TREE),
    pickRoot: () => ipcRenderer.invoke(CH.VAULT_PICK_ROOT),
    setRoot: (dir) => ipcRenderer.invoke(CH.VAULT_SET_ROOT, dir),
    reveal: (relPath) => ipcRenderer.invoke(CH.VAULT_REVEAL, relPath),
  },
  prompt: {
    read: (relPath) => ipcRenderer.invoke(CH.PROMPT_READ, relPath),
    save: (payload) => ipcRenderer.invoke(CH.PROMPT_SAVE, payload),
    create: (dirRel, title) => ipcRenderer.invoke(CH.PROMPT_CREATE, dirRel, title),
    createFolder: (dirRel, name) => ipcRenderer.invoke(CH.PROMPT_CREATE_FOLDER, dirRel, name),
    rename: (relPath, name, isFolder) => ipcRenderer.invoke(CH.PROMPT_RENAME, relPath, name, isFolder),
    duplicate: (relPath) => ipcRenderer.invoke(CH.PROMPT_DUPLICATE, relPath),
    move: (relPath, destDir) => ipcRenderer.invoke(CH.PROMPT_MOVE, relPath, destDir),
    remove: (relPath) => ipcRenderer.invoke(CH.PROMPT_DELETE, relPath),
    restoreTrash: (trashRel, originalRel) => ipcRenderer.invoke(CH.PROMPT_RESTORE_TRASH, trashRel, originalRel),
  },
  search: {
    fullText: (query) => ipcRenderer.invoke(CH.SEARCH_FULLTEXT, query),
  },
  history: {
    list: (id) => ipcRenderer.invoke(CH.HISTORY_LIST, id),
    read: (id, file) => ipcRenderer.invoke(CH.HISTORY_READ, id, file),
    restore: (relPath, id, file) => ipcRenderer.invoke(CH.HISTORY_RESTORE, relPath, id, file),
  },
  config: {
    get: () => ipcRenderer.invoke(CH.CONFIG_GET),
    patch: (partial) => ipcRenderer.invoke(CH.CONFIG_PATCH, partial),
  },
  clipboard: {
    write: (text) => ipcRenderer.invoke(CH.CLIPBOARD_WRITE, text),
  },
  win: {
    minimize: () => ipcRenderer.invoke(CH.WIN_MINIMIZE),
    toggleMaximize: () => ipcRenderer.invoke(CH.WIN_MAXIMIZE),
    close: () => ipcRenderer.invoke(CH.WIN_CLOSE),
    isMaximized: () => ipcRenderer.invoke(CH.WIN_IS_MAXIMIZED),
  },
  capture: {
    save: (payload) => ipcRenderer.invoke(CH.CAPTURE_SAVE, payload),
    close: () => ipcRenderer.invoke(CH.CAPTURE_CLOSE),
  },
  shortcut: {
    status: () => ipcRenderer.invoke(CH.SHORTCUT_STATUS),
    set: (accel) => ipcRenderer.invoke(CH.SHORTCUT_SET, accel),
  },
  on: {
    vaultChanged: (cb) => subscribe(CH.EV_VAULT_CHANGED, cb),
    maximizeChanged: (cb) => subscribe(CH.EV_MAXIMIZE_CHANGED, cb),
    flush: (cb) => subscribe(CH.EV_FLUSH, cb),
    menu: (cb) => subscribe(CH.EV_MENU, cb),
  },
  flushDone: () => ipcRenderer.send(CH.EV_FLUSH_DONE),
};

function subscribe(channel, cb) {
  const listener = (_e, payload) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('stash', api);
