// --- Dev-only live reload -----------------------------------------------------------------
// Connects to `node dev-server.js` on localhost. On any file change it reloads this extension
// (chrome.runtime.reload()) and refreshes the active tab, so edits show up without touching
// chrome://extensions. Harmless if the dev server isn't running — it just retries quietly.
// Remove this block before publishing to the Chrome Web Store.
function connectDevReload() {
  let ws;
  try {
    // Dev server runs on the Termux phone at 192.168.1.7 — change this if that IP changes,
    // or back to 'ws://localhost:8787' if running the dev server on the same machine as Chrome.
    ws = new WebSocket('ws://192.168.1.7:8787');
  } catch {
    setTimeout(connectDevReload, 2000);
    return;
  }
  ws.addEventListener('message', (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.type === 'reload') {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        if (tabs[0]) chrome.tabs.reload(tabs[0].id);
      });
      chrome.runtime.reload();
    } else if (msg.type === 'send_whatsapp') {
      openWhatsappChat(msg.phone, msg.text, !!msg.autoSend);
    }
  });
  ws.addEventListener('close', () => setTimeout(connectDevReload, 2000));
  ws.addEventListener('error', () => ws.close());
}
connectDevReload();
// --------------------------------------------------------------------------------------------

// Opens WhatsApp Web's own official "click to chat" deep link for a specific phone number —
// it prefills that chat's message box itself; whatsapp.js only clicks Send, and only if
// autoSend was explicitly requested. Phone must be full international format, digits only
// (e.g. "919309555464"), no "+" or spaces.
function openWhatsappChat(phone, text, autoSend) {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits || !text) return;
  let url = `https://web.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(text)}`;
  if (autoSend) url += '&_autosend=1';
  chrome.tabs.create({ url });
}

// Pre-filled with what's actually known (name/email from local git config, GitHub profile
// confirmed via api.github.com) — everything unverified (phone, address, company, etc.) is
// left blank rather than guessed. Edit/complete these in the popup.
const DEFAULT_PROFILE = {
  firstName: 'Vipul',
  lastName: 'Chartal',
  fullName: 'Vipul Chartal',
  email: 'vipulchartal@gmail.com',
  github: 'https://github.com/vipulchartal-star',
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['jobAutofillProfile', 'jobAutofillOverrides', 'jobAutofillSites'], (data) => {
    const updates = {};
    if (!data.jobAutofillProfile) updates.jobAutofillProfile = DEFAULT_PROFILE;
    if (!data.jobAutofillOverrides) updates.jobAutofillOverrides = {};
    if (!data.jobAutofillSites) updates.jobAutofillSites = [];
    if (Object.keys(updates).length) chrome.storage.local.set(updates);
  });
});

// Opens each saved site in its own background tab, waits for it to finish loading (plus a
// settle delay for SPA forms that render late), then asks that tab's content script to
// autofill. Never submits anything — you review and click submit yourself on each tab.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  if (msg.type === 'OPEN_AND_FILL_ALL') {
    chrome.storage.local.get(['jobAutofillSites'], (data) => {
      const sites = data.jobAutofillSites || [];
      sites.forEach((url, idx) => {
        setTimeout(() => {
          chrome.tabs.create({ url, active: false }, (tab) => {
            const listener = (tabId, changeInfo) => {
              if (tabId !== tab.id || changeInfo.status !== 'complete') return;
              chrome.tabs.onUpdated.removeListener(listener);
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, { type: 'RUN_AUTOFILL' }, () => {
                  // ignore errors (e.g. page blocks content scripts) — best effort per tab
                  void chrome.runtime.lastError;
                });
              }, 1800);
            };
            chrome.tabs.onUpdated.addListener(listener);
          });
        }, idx * 700);
      });
    });
    return;
  }

  if (msg.type === 'ATTACH_FILE') {
    const tabId = sender.tab && sender.tab.id;
    if (!tabId) { sendResponse({ ok: false }); return; }
    attachFileToInput(tabId, msg.selector, msg.filePath).then((ok) => sendResponse({ ok }));
    return true; // keep the message channel open for the async response
  }
});

// Uses the Chrome DevTools Protocol (chrome.debugger) to set a real file on an
// <input type=file> — the only way to do this at all, since plain JS can never set a file
// input's value (browser security). Shows Chrome's own "is debugging this browser" banner
// while attached; detaches immediately after. filePath must be an absolute path on THIS
// computer (desktop Chrome) — unsupported on most mobile browsers.
function attachFileToInput(tabId, selector, filePath) {
  return new Promise((resolve) => {
    chrome.debugger.attach({ tabId }, '1.3', () => {
      if (chrome.runtime.lastError) { resolve(false); return; }
      const fail = () => { chrome.debugger.detach({ tabId }, () => {}); resolve(false); };
      chrome.debugger.sendCommand({ tabId }, 'DOM.enable', {}, () => {
        if (chrome.runtime.lastError) return fail();
        chrome.debugger.sendCommand({ tabId }, 'DOM.getDocument', {}, (doc) => {
          if (chrome.runtime.lastError || !doc) return fail();
          chrome.debugger.sendCommand({ tabId }, 'DOM.querySelector', { nodeId: doc.root.nodeId, selector }, (res) => {
            if (chrome.runtime.lastError || !res || !res.nodeId) return fail();
            chrome.debugger.sendCommand({ tabId }, 'DOM.setFileInputFiles', { files: [filePath], nodeId: res.nodeId }, () => {
              const ok = !chrome.runtime.lastError;
              chrome.debugger.detach({ tabId }, () => {});
              resolve(ok);
            });
          });
        });
      });
    });
  });
}
