const PROFILE_KEY = 'jobAutofillProfile';
const OVERRIDES_KEY = 'jobAutofillOverrides';
const SITES_KEY = 'jobAutofillSites';

function buildField(def, profile) {
  const wrap = document.createElement('div');
  wrap.className = 'field-group' + (def.type === 'textarea' ? ' wide' : '');

  const label = document.createElement('label');
  label.textContent = def.label;
  label.setAttribute('for', 'f_' + def.key);
  wrap.appendChild(label);

  let input;
  if (def.type === 'textarea') {
    input = document.createElement('textarea');
  } else if (def.type === 'boolean') {
    input = document.createElement('select');
    ['', 'yes', 'no'].forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v === '' ? '(blank)' : v;
      input.appendChild(opt);
    });
  } else {
    input = document.createElement('input');
    input.type = 'text';
  }
  input.id = 'f_' + def.key;
  input.value = profile[def.key] || '';
  wrap.appendChild(input);
  return wrap;
}

function fieldHasValue(def, profile) {
  return !!profile[def.key];
}

function buildForm(profile) {
  const form = document.getElementById('profileForm');
  form.innerHTML = '';
  FIELD_GROUPS.forEach((group) => {
    const defs = FIELD_DEFS.filter((d) => d.group === group.id);
    if (!defs.length) return;

    const details = document.createElement('details');
    details.className = 'fieldset';
    if (group.open || defs.some((d) => fieldHasValue(d, profile))) details.open = true;

    const summary = document.createElement('summary');
    summary.textContent = group.label;
    details.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'fieldset-body';
    defs.forEach((def) => body.appendChild(buildField(def, profile)));
    details.appendChild(body);

    form.appendChild(details);
  });
}

function readForm() {
  const profile = {};
  FIELD_DEFS.forEach((def) => {
    const el = document.getElementById('f_' + def.key);
    if (el.value !== '') profile[def.key] = el.value;
  });
  return profile;
}

function refreshTrainedInfo() {
  chrome.storage.local.get([OVERRIDES_KEY], (data) => {
    const overrides = data[OVERRIDES_KEY] || {};
    const sites = Object.keys(overrides);
    const total = sites.reduce((n, h) => n + Object.keys(overrides[h]).length, 0);
    document.getElementById('trainedInfo').textContent =
      total ? `Trained fields: ${total} across ${sites.length} site(s)` : 'No trained field mappings yet.';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get([PROFILE_KEY], (data) => {
    buildForm(data[PROFILE_KEY] || {});
  });
  chrome.storage.local.get([SITES_KEY], (data) => {
    document.getElementById('sitesList').value = (data[SITES_KEY] || []).join('\n');
  });
  refreshTrainedInfo();

  document.getElementById('save').addEventListener('click', () => {
    const profile = readForm();
    chrome.storage.local.set({ [PROFILE_KEY]: profile }, () => {
      const status = document.getElementById('saveStatus');
      status.textContent = 'Saved.';
      setTimeout(() => (status.textContent = ''), 1500);
    });
  });

  document.getElementById('runHere').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { type: 'RUN_AUTOFILL' }, (res) => {
        const status = document.getElementById('runStatus');
        if (chrome.runtime.lastError) {
          status.textContent = 'Could not reach this page (try reloading it).';
          return;
        }
        status.textContent = res && res.filled ? `Filled ${res.filled} field(s).` : 'No matching fields found.';
      });
    });
  });

  document.getElementById('clearTrained').addEventListener('click', () => {
    chrome.storage.local.set({ [OVERRIDES_KEY]: {} }, refreshTrainedInfo);
  });

  function parseSites() {
    return document.getElementById('sitesList').value
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (/^https?:\/\//i.test(s) ? s : 'https://' + s));
  }

  document.getElementById('saveSites').addEventListener('click', () => {
    const sites = parseSites();
    chrome.storage.local.set({ [SITES_KEY]: sites }, () => {
      const status = document.getElementById('saveSitesStatus');
      status.textContent = `Saved ${sites.length} site(s).`;
      setTimeout(() => (status.textContent = ''), 1500);
    });
  });

  document.getElementById('openAll').addEventListener('click', () => {
    const sites = parseSites();
    chrome.storage.local.set({ [SITES_KEY]: sites }, () => {
      chrome.runtime.sendMessage({ type: 'OPEN_AND_FILL_ALL' });
      const status = document.getElementById('saveSitesStatus');
      status.textContent = `Opening ${sites.length} tab(s)...`;
      setTimeout(() => (status.textContent = ''), 2000);
    });
  });
});
