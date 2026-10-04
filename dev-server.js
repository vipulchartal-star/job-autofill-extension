// Dev-only live reload: watches this extension's own files and tells the running extension
// (via WebSocket, see the dev block in background.js) to reload itself — no manual visit to
// chrome://extensions, no reload-helper extension needed.
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = 8787;
const ROOT = __dirname;
const IGNORE = new Set(['node_modules', '.git']);

const wss = new WebSocketServer({ port: PORT });
console.log(`Job Autofill dev-reload server on ws://localhost:${PORT}`);
console.log('Watching', ROOT, '— edit any extension file, the loaded extension reloads itself.');

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
