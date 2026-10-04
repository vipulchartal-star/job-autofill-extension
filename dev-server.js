// Dev-only live reload: watches this extension's own files and tells the running extension
// (via WebSocket, see the dev block in background.js) to reload itself — no manual visit to
// chrome://extensions, no reload-helper extension needed.
const fs = require('fs');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = 8787;
const HTTP_PORT = 8788;
const ROOT = __dirname;
const IGNORE = new Set(['node_modules', '.git']);

const wss = new WebSocketServer({ port: PORT });
console.log(`Job Autofill dev-reload server on ws://localhost:${PORT}`);
console.log('Watching', ROOT, '— edit any extension file, the loaded extension reloads itself.');

// POST /send-whatsapp {"phone":"919309555464","text":"hello","autoSend":false}
// Forwards to the extension over the same WebSocket connection; it opens WhatsApp Web's own
// deep link for that number with the text prefilled (autoSend only clicks Send if true).
const httpServer = http.createServer((req, res) => {
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
