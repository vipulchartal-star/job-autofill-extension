# Job Autofill

Chrome extension (Manifest V3). Fills common job-application fields from a profile you save once.

## Load it

1. `chrome://extensions` → enable **Developer mode** (top-right).
2. **Load unpacked** → select this folder.
3. Click the extension icon → fill your profile → **Save profile**.
4. Open any job application page. It auto-scans ~1.2s after load (if the page looks like a form)
   and fills matching fields. A floating **⚡ Autofill** / **Train** widget sits bottom-right for
   manual re-run (SPA forms like LinkedIn Easy Apply / Workday steps render late — re-click if needed).

## How detection works

For every `input`/`textarea`/`select`, it builds a signal string from `name`, `id`, `placeholder`,
`aria-label`, `data-automation-id`, and the associated `<label>` text — then matches it against a
keyword dictionary (`fieldMap.js`). Verified against a real Greenhouse application form
(first_name/last_name/email/phone, "LinkedIn Profile", "require visa sponsorship" etc. all matched
correctly by label text alone).

Already-filled fields are never overwritten. Checkbox groups are left alone (too ambiguous).
**EEO/voluntary self-ID fields (gender, race/ethnicity, disability, veteran/military status) are
intentionally never matched or filled** — too sensitive to guess at.

## Training mode (teach it a site)

Click **Train** on the widget, then click any field the auto-scan missed or got wrong. A small
menu lets you pick which profile field it is (or "Ignore this field"). That mapping is saved per
field + per site (`chrome.storage.local`) and applied automatically next time you're on that site —
it takes priority over the generic keyword matching. Clear all trained mappings from the popup.

## WhatsApp bridge (send info from here to a specific chat)

With `npm run dev` running, POST to the dev server and the extension opens that exact WhatsApp
Web chat with your text prefilled (via WhatsApp's own official `web.whatsapp.com/send?phone=&text=`
deep link — no DOM-scripting of WhatsApp's internals):

```bash
./send-whatsapp.sh 919309555464 "Hi, following up on my application"
```

By default it only prefills the message box — you press Send yourself. Pass `autosend` as a
third arg to have it click Send automatically after the text appears:

```bash
./send-whatsapp.sh 919309555464 "Hi, following up" autosend
```

Use autosend sparingly and only for messages you're sure about — it's a real send to a real
contact, same as if you'd typed and hit enter.

## Resume file upload (desktop Chrome only)

Set "Resume file path" in the popup to an absolute path on disk (e.g. `/home/you/resume.pdf`).
When a file input on the page looks like a resume/CV upload, the extension uses Chrome's
DevTools protocol (`chrome.debugger` + `DOM.setFileInputFiles`) to attach that exact file —
the only way to set a file input at all, since plain JS can never do it (browser security).
Chrome shows its own "is debugging this browser" banner while this runs; it detaches right
after. Needs a real local file path, so this only works on desktop Chrome, not Kiwi/Android.

If a site instead has a "paste resume as text" fallback field, save your resume text under
"Resume (plain text...)" in the profile and that gets typed in normally.

## Auto-update from GitHub releases

While `npm run dev` is running, the dev server checks this repo's latest release every 10
minutes (`gh release view`, reusing your logged-in `gh` CLI — no token stored in the code). A
newer tag is downloaded and extracted over this folder, then the existing live-reload path
reloads the extension — same mechanism as editing a file by hand. Trigger a check immediately:

```bash
curl -X POST http://localhost:8788/check-update
```

This only updates copies that share a filesystem with the running dev server (this phone's
Kiwi copy, if pointed at a folder here). A separate PC copy needs its own dev server pointed
at its own folder, or a manual re-pull — Chrome has no real silent auto-update path for
extensions outside the Chrome Web Store or enterprise policy.

## Known limits

- AI fallback for unmatched fields is a stubbed-out hook, not wired up (no API key configured yet).
  Pattern + label matching + training covers the common cases without needing one.
