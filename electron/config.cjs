const fs = require('fs');
const path = require('path');

// config.json lives in Electron's userData dir, not in the vault, so the vault
// stays a clean folder of Markdown you could hand to git or Dropbox.
let file = null;
let data = null;

const DEFAULTS = {
  vaultRoot: null,
  openTabs: [],          // [{ path, cursor }]
  activeTab: null,
  treeExpanded: [],
  sidebarFilter: '',
  rightPanelOpen: false,
  rightPanelTab: 'variables',
  fontSize: 14,
  variableValues: {},    // promptId -> { varName: value }
  globalShortcut: 'Control+Alt+S',
  window: { width: 1180, height: 780, x: null, y: null, maximized: false },
};

function init(userDataDir) {
  file = path.join(userDataDir, 'config.json');
  try {
    data = Object.assign({}, DEFAULTS, JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    data = Object.assign({}, DEFAULTS);
  }
  return data;
}

function get() {
  return data;
}

function patch(partial) {
  data = Object.assign({}, data, partial || {});
  write();
  return data;
}

let writeTimer = null;
function write() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(flush, 250);
}

function flush() {
  clearTimeout(writeTimer);
  writeTimer = null;
  if (!file || !data) return;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  } catch (err) {
    console.error('config write failed', err);
  }
}

module.exports = { init, get, patch, flush, DEFAULTS };
