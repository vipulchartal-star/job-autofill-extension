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
    }
  });
  ws.addEventListener('close', () => setTimeout(connectDevReload, 2000));
  ws.addEventListener('error', () => ws.close());
}
connectDevReload();
// --------------------------------------------------------------------------------------------

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
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== 'OPEN_AND_FILL_ALL') return;
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
});
