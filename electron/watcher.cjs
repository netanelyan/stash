const fs = require('fs');
const path = require('path');

// Recursive fs.watch on the vault, debounced. Windows supports { recursive:
// true } natively. Anything under .stash is our own bookkeeping and must not
// trigger a refresh, or saving a snapshot would loop forever.
let watcher = null;
let timer = null;
let pending = new Set();

function start(root, onChange, debounceMs) {
  stop();
  const wait = debounceMs || 300;
  try {
    watcher = fs.watch(root, { recursive: true }, (eventType, filename) => {
      if (!filename) {
        pending.add('');
      } else {
        const rel = String(filename).split(path.sep).join('/');
        if (rel === '.stash' || rel.startsWith('.stash/')) return;
        if (path.basename(rel).startsWith('.')) return; // our atomic-write temp files
        pending.add(rel);
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        const changed = [...pending];
        pending = new Set();
        onChange(changed);
      }, wait);
    });
    watcher.on('error', (err) => console.error('vault watcher error', err));
  } catch (err) {
    console.error('could not watch vault', err);
  }
}

function stop() {
  clearTimeout(timer);
  timer = null;
  pending = new Set();
  if (watcher) {
    try { watcher.close(); } catch { /* already closed */ }
    watcher = null;
  }
}

module.exports = { start, stop };
