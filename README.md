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

## Known limits

- **Resume/file upload fields can't be auto-filled** — browsers block scripts from setting
  `<input type="file">` values (security). If a site has a "paste resume as text" fallback field,
  save your resume text under "Resume (plain text...)" in the profile and that gets filled.
- AI fallback for unmatched fields is a stubbed-out hook, not wired up (no API key configured yet).
  Pattern + label matching + training covers the common cases without needing one.
