/**
 * Dev launcher: build the preload bundle, start Vite, wait for the dev server
 * to answer, then launch Electron pointed at it. The renderer hot-reloads
 * through Vite; changing anything under electron/ means restarting this script.
 *
 * Forty lines of our own instead of concurrently + wait-on.
 */
const { spawn, spawnSync } = require('child_process');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = 5183;
const URL = 'http://localhost:' + PORT;
// Run Vite's JS entry with this Node, rather than the .cmd shim through a
// shell: no quoting surprises and no shell process in the middle.
const VITE = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

const built = spawnSync(process.execPath, [VITE, 'build', '--config', 'vite.preload.config.mjs'], {
  cwd: ROOT, stdio: 'inherit',
});
if (built.status !== 0) process.exit(built.status || 1);

const vite = spawn(process.execPath, [VITE, '--port', String(PORT), '--strictPort'], {
  cwd: ROOT, stdio: 'inherit',
});

let electron = null;
const stop = () => {
  if (electron && !electron.killed) electron.kill();
  if (vite && !vite.killed) vite.kill();
};
process.on('SIGINT', () => { stop(); process.exit(0); });
process.on('exit', stop);
vite.on('exit', (code) => { stop(); process.exit(code || 0); });

waitForServer(URL, 20000)
  .then(() => {
    electron = spawn(require('electron'), ['.'], {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, STASH_DEV_SERVER_URL: URL },
    });
    electron.on('exit', (code) => { stop(); process.exit(code || 0); });
  })
  .catch((err) => { console.error(err.message); stop(); process.exit(1); });

function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => { res.resume(); resolve(); });
      req.on('error', () => {
        if (Date.now() > deadline) reject(new Error('Vite did not start within ' + timeoutMs + 'ms'));
        else setTimeout(attempt, 200);
      });
    };
    attempt();
  });
}
