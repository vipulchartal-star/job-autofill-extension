// Dev-only live reload: watches this extension's own files and tells the running extension
// (via WebSocket, see the dev block in background.js) to reload itself — no manual visit to
// chrome://extensions, no reload-helper extension needed.
const fs = require('fs');
const os = require('os');
const http = require('http');
const path = require('path');
const { execFile } = require('child_process');
const { WebSocketServer } = require('ws');

const PORT = 8787;
const HTTP_PORT = 8788;
const ROOT = __dirname;
const IGNORE = new Set(['node_modules', '.git']);
const REPO = 'vipulchartal-star/job-autofill-extension';
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

const wss = new WebSocketServer({ port: PORT });
console.log(`Job Autofill dev-reload server on ws://localhost:${PORT}`);
console.log('Watching', ROOT, '— edit any extension file, the loaded extension reloads itself.');

// POST /send-whatsapp {"phone":"919309555464","text":"hello","autoSend":false}
// Forwards to the extension over the same WebSocket connection; it opens WhatsApp Web's own
// deep link for that number with the text prefilled (autoSend only clicks Send if true).
const httpServer = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/check-update') {
    checkForUpdate();
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ checking: true }));
    return;
  }
  if (req.method !== 'POST' || req.url !== '/send-whatsapp') {
    res.writeHead(404).end();
    return;
  }
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'invalid JSON' }));
      return;
    }
    if (!payload.phone || !payload.text) {
      res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'phone and text required' }));
      return;
    }
    const msg = JSON.stringify({ type: 'send_whatsapp', phone: payload.phone, text: payload.text, autoSend: !!payload.autoSend });
    let sent = 0;
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) { client.send(msg); sent++; }
    }
    res.writeHead(sent ? 200 : 503, { 'Content-Type': 'application/json' }).end(JSON.stringify({ sentToClients: sent }));
  });
});
httpServer.listen(HTTP_PORT, () => console.log(`WhatsApp bridge on http://localhost:${HTTP_PORT}/send-whatsapp`));

// --- Auto-update from GitHub releases -----------------------------------------------------
// Polls `gh release view` (reuses your already-authenticated gh CLI, no token handling here).
// On a newer tag: downloads the release zip, extracts it over this folder, and lets the
// existing file-watcher below push the reload (same path as a normal local edit). Uses `gh`
// and `unzip` from PATH.
function getLocalVersion() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (path.basename(src) === 'node_modules' || path.basename(src) === '.git') return;
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) copyRecursive(path.join(src, entry), path.join(dest, entry));
  } else {
    fs.copyFileSync(src, dest);
  }
}

function applyUpdate(tag) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaf-update-'));
  execFile('gh', ['release', 'download', tag, '--repo', REPO, '--pattern', '*.zip', '--dir', tmpDir, '--clobber'], (err) => {
    if (err) { console.log('Update download failed:', err.message); fs.rmSync(tmpDir, { recursive: true, force: true }); return; }
    const zipFile = fs.readdirSync(tmpDir).find((f) => f.endsWith('.zip'));
    if (!zipFile) { console.log('Update: no zip asset found in release', tag); fs.rmSync(tmpDir, { recursive: true, force: true }); return; }
    execFile('unzip', ['-o', path.join(tmpDir, zipFile), '-d', tmpDir], (err2) => {
      if (err2) { console.log('Update unzip failed:', err2.message); fs.rmSync(tmpDir, { recursive: true, force: true }); return; }
      const extracted = fs.readdirSync(tmpDir).find((f) => f !== zipFile && fs.statSync(path.join(tmpDir, f)).isDirectory());
      if (!extracted) { console.log('Update: extracted folder not found'); fs.rmSync(tmpDir, { recursive: true, force: true }); return; }
      for (const entry of fs.readdirSync(path.join(tmpDir, extracted))) {
        copyRecursive(path.join(tmpDir, extracted, entry), path.join(ROOT, entry));
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
      console.log(`Updated to ${tag}. Extension will reload automatically.`);
    });
  });
}

function checkForUpdate() {
  execFile('gh', ['release', 'view', '--repo', REPO, '--json', 'tagName', '-q', '.tagName'], (err, stdout) => {
    if (err) { console.log('Update check failed:', err.message); return; }
    const latestTag = stdout.trim();
    const latestVersion = latestTag.replace(/^v/, '');
    const localVersion = getLocalVersion();
    if (latestVersion && latestVersion !== localVersion) {
      console.log(`New release ${latestTag} available (local v${localVersion}) — updating...`);
      applyUpdate(latestTag);
    } else {
      console.log(`Up to date (v${localVersion}).`);
    }
  });
}

setTimeout(checkForUpdate, 3000);
setInterval(checkForUpdate, CHECK_INTERVAL_MS);
// --------------------------------------------------------------------------------------------

let debounceTimer = null;
function broadcastReload(changedFile) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    console.log('Changed:', changedFile, '-> reloading extension (' + wss.clients.size + ' connected)');
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) client.send(JSON.stringify({ type: 'reload' }));
    }
  }, 150);
}

fs.watch(ROOT, { recursive: true }, (eventType, filename) => {
  if (!filename) return;
  const top = filename.split(path.sep)[0];
  if (IGNORE.has(top)) return;
  broadcastReload(filename);
});

wss.on('connection', (ws) => {
  console.log('Extension connected.');
  ws.on('close', () => console.log('Extension disconnected.'));
});
