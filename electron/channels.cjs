// Every IPC channel name lives here so main, preload and renderer cannot drift.
// Naming: "<area>:<verb>". Channels under EVENTS are main -> renderer pushes.
const CH = {
  // vault / tree / index
  VAULT_INFO: 'vault:info',
  VAULT_TREE: 'vault:tree',
  VAULT_PICK_ROOT: 'vault:pick-root',
  VAULT_SET_ROOT: 'vault:set-root',
  VAULT_REVEAL: 'vault:reveal',

  // prompts
  PROMPT_READ: 'prompt:read',
  PROMPT_SAVE: 'prompt:save',
  PROMPT_CREATE: 'prompt:create',
  PROMPT_CREATE_FOLDER: 'prompt:create-folder',
  PROMPT_RENAME: 'prompt:rename',
  PROMPT_DUPLICATE: 'prompt:duplicate',
  PROMPT_MOVE: 'prompt:move',
  PROMPT_DELETE: 'prompt:delete',
  PROMPT_RESTORE_TRASH: 'prompt:restore-trash',

  // search
  SEARCH_FULLTEXT: 'search:fulltext',

  // history
  HISTORY_LIST: 'history:list',
  HISTORY_READ: 'history:read',
  HISTORY_RESTORE: 'history:restore',

  // clipboard (done in main: file:// is not a secure context, so the renderer's
  // navigator.clipboard is not available in the packaged app)
  CLIPBOARD_WRITE: 'clipboard:write',

  // config
  CONFIG_GET: 'config:get',
  CONFIG_PATCH: 'config:patch',

  // window chrome (frameless title bar)
  WIN_MINIMIZE: 'win:minimize',
  WIN_MAXIMIZE: 'win:maximize',
  WIN_CLOSE: 'win:close',
  WIN_IS_MAXIMIZED: 'win:is-maximized',

  // quick capture window
  CAPTURE_SAVE: 'capture:save',
  CAPTURE_CLOSE: 'capture:close',

  // global shortcut registration state
  SHORTCUT_STATUS: 'shortcut:status',
  SHORTCUT_SET: 'shortcut:set',

  // main -> renderer
  EV_VAULT_CHANGED: 'ev:vault-changed',
  EV_MAXIMIZE_CHANGED: 'ev:maximize-changed',
  EV_FLUSH: 'ev:flush',            // "save everything now, we are closing"
  EV_FLUSH_DONE: 'ev:flush-done',  // renderer -> main ack (one-way send)
  EV_MENU: 'ev:menu',              // tray / accelerator driven commands
};
module.exports = CH;
