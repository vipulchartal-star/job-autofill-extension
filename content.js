(function () {
  const PROFILE_KEY = 'jobAutofillProfile';
  const OVERRIDES_KEY = 'jobAutofillOverrides';
  const FILLABLE_TYPES = ['text', 'email', 'tel', 'url', 'number', 'search', ''];
  const SKIP_TYPES = ['file', 'submit', 'button', 'hidden', 'image', 'reset', 'password'];

  let trainingActive = false;
  let activeChooser = null;

  function normalize(str) {
    return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function labelTextFor(el) {
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) return lbl.textContent;
    }
    const wrapping = el.closest('label');
    if (wrapping) return wrapping.textContent;
    return '';
  }

  function getSignal(el) {
    const parts = [
      el.name,
      el.id,
      el.placeholder,
      el.getAttribute('aria-label'),
      el.getAttribute('data-automation-id'),
      labelTextFor(el),
    ];
    return normalize(parts.filter(Boolean).join(' '));
  }

  function fieldSignature(el) {
    const base = el.name || el.id;
    if (base) return 'k:' + normalize(base);
    const all = Array.from(document.querySelectorAll('input, textarea, select'));
    return 'i:' + all.indexOf(el);
  }

  function matchByKeywords(signal) {
    let best = null;
    let bestLen = 0;
    for (const def of FIELD_DEFS) {
      for (const kw of def.keywords) {
        const nkw = normalize(kw);
        if (nkw && signal.includes(nkw) && nkw.length > bestLen) {
          best = def;
          bestLen = nkw.length;
        }
      }
    }
    return best;
  }

  function setValueOnly(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
      : el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
      : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(el, value);
    } else {
      el.value = value;
    }
  }

  function setNativeValue(el, value) {
    setValueOnly(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Types one character at a time with keydown/keypress/input/keyup per char and a small
  // randomized delay — some sites' live-validation only reacts to real keystroke events, not
  // an instant value+change. Not an anti-bot-detection measure, just realistic input events.
  function typeHumanLike(el, fullValue, onDone) {
    setValueOnly(el, '');
    el.focus();
    let i = 0;
    function step() {
      if (i >= fullValue.length) {
        el.dispatchEvent(new Event('change', { bubbles: true }));
        if (onDone) onDone();
        return;
      }
      const ch = fullValue[i];
      setValueOnly(el, fullValue.slice(0, i + 1));
      el.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keypress', { key: ch, bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', { key: ch, bubbles: true }));
      i++;
      setTimeout(step, 35 + Math.random() * 70);
    }
    step();
  }

  function fillSelect(el, boolValue) {
    const wantYes = !!boolValue;
    const options = Array.from(el.options || []);
    const match = options.find((o) => {
      const t = normalize(o.textContent);
      return wantYes ? /^(yes|y|true)/.test(t) : /^(no|n|false)/.test(t);
    });
    if (match) {
      setNativeValue(el, match.value);
      return true;
    }
    return false;
  }

  function fillRadioGroup(name, boolValue) {
    const radios = Array.from(document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`));
    if (!radios.length) return false;
    const wantYes = !!boolValue;
    const target = radios.find((r) => {
      const sig = normalize((r.value || '') + ' ' + labelTextFor(r));
      return wantYes ? /^(yes|y|true)/.test(sig) : /^(no|n|false)/.test(sig);
    });
    if (target) {
      target.checked = true;
      target.dispatchEvent(new Event('change', { bubbles: true }));
      target.dispatchEvent(new Event('click', { bubbles: true }));
      return true;
    }
    return false;
  }

  function highlight(el) {
    el.classList.add('jaf-filled');
    setTimeout(() => el.classList.remove('jaf-filled'), 1500);
  }

  function showToast(msg) {
    const existing = document.querySelector('.jaf-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'jaf-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  function getFieldDef(key) {
    return FIELD_DEFS.find((d) => d.key === key);
  }

  function scanAndFill(profile, overrides) {
    const hostname = location.hostname;
    const siteOverrides = (overrides && overrides[hostname]) || {};
    const elements = Array.from(document.querySelectorAll('input, textarea, select'));
    const handledRadioNames = new Set();
    let count = 0;

    for (const el of elements) {
      const type = (el.type || '').toLowerCase();
      if (SKIP_TYPES.includes(type)) continue;
      if (el.disabled || el.readOnly) continue;

      if (type === 'radio') {
        if (!el.name || handledRadioNames.has(el.name)) continue;
        const sig = fieldSignature(el);
        const overrideKey = siteOverrides[sig];
        const def = overrideKey ? getFieldDef(overrideKey) : matchByKeywords(getSignal(el));
        if (!def || def.type !== 'boolean') continue;
        const value = profile[def.key];
        if (value === undefined || value === '') continue;
        handledRadioNames.add(el.name);
        if (fillRadioGroup(el.name, value === true || value === 'yes')) {
          highlight(el);
          count++;
        }
        continue;
      }

      if (type === 'checkbox') continue; // left for manual review, too varied in meaning

      if (el.value && String(el.value).trim() !== '') continue; // don't overwrite filled fields

      const sig = fieldSignature(el);
      const overrideKey = siteOverrides[sig];
      const def = overrideKey ? getFieldDef(overrideKey) : matchByKeywords(getSignal(el));
      if (!def) continue;
      const value = profile[def.key];
      if (value === undefined || value === '') continue;

      if (el.tagName === 'SELECT') {
        if (def.type === 'boolean') {
          if (fillSelect(el, value === true || value === 'yes')) { highlight(el); count++; }
        } else {
          const opt = Array.from(el.options).find((o) => normalize(o.textContent) === normalize(value) || normalize(o.value) === normalize(value));
          if (opt) { setNativeValue(el, opt.value); highlight(el); count++; }
        }
        continue;
      }

      typeHumanLike(el, String(value), () => highlight(el));
      count++;
    }

    showToast(count ? `Filled ${count} field(s)` : 'No matching fields found on this page');
    return count;
  }

  function closeChooser() {
    if (activeChooser) {
      activeChooser.remove();
      activeChooser = null;
    }
  }

  function openChooser(el, overrides) {
    closeChooser();
    const rect = el.getBoundingClientRect();
    const box = document.createElement('div');
    box.className = 'jaf-chooser';
    box.style.top = `${window.scrollY + rect.bottom + 4}px`;
    box.style.left = `${window.scrollX + rect.left}px`;

    FIELD_DEFS.forEach((def) => {
      const btn = document.createElement('button');
      btn.textContent = def.label;
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        saveOverride(el, def.key, overrides);
        closeChooser();
      });
      box.appendChild(btn);
    });

    const ignoreBtn = document.createElement('button');
    ignoreBtn.textContent = 'Ignore this field';
    ignoreBtn.className = 'jaf-ignore';
    ignoreBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      saveOverride(el, '__ignore__', overrides);
      closeChooser();
    });
    box.appendChild(ignoreBtn);

    document.body.appendChild(box);
    activeChooser = box;
  }

  function saveOverride(el, key, overrides) {
    const hostname = location.hostname;
    const sig = fieldSignature(el);
    overrides[hostname] = overrides[hostname] || {};
    overrides[hostname][sig] = key;
    chrome.storage.local.set({ [OVERRIDES_KEY]: overrides }, () => {
      showToast(`Trained: this field → ${key === '__ignore__' ? 'ignored' : key}`);
      chrome.storage.local.get([PROFILE_KEY], (data) => {
        const profile = data[PROFILE_KEY] || {};
        if (key !== '__ignore__' && profile[key]) {
          if (el.tagName === 'SELECT') {
            const def = getFieldDef(key);
            if (def && def.type === 'boolean') fillSelect(el, profile[key] === true || profile[key] === 'yes');
          } else {
            setNativeValue(el, profile[key]);
          }
          highlight(el);
        }
      });
    });
  }

  function trainingClickHandler(ev) {
    const el = ev.target;
    if (!(el instanceof HTMLElement)) return;
    if (el.closest('#jobAutofillWidget') || el.closest('.jaf-chooser')) return;
    const tag = el.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
      closeChooser();
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    chrome.storage.local.get([OVERRIDES_KEY], (data) => {
      openChooser(el, data[OVERRIDES_KEY] || {});
    });
  }

  function setTrainingActive(active, trainBtn) {
    trainingActive = active;
    trainBtn.classList.toggle('active', active);
    trainBtn.textContent = active ? 'Training... (click a field)' : 'Train';
    if (active) {
      document.addEventListener('click', trainingClickHandler, true);
    } else {
      document.removeEventListener('click', trainingClickHandler, true);
      closeChooser();
    }
  }

  function injectWidget() {
    if (document.getElementById('jobAutofillWidget')) return;
    const widget = document.createElement('div');
    widget.id = 'jobAutofillWidget';

    const fillBtn = document.createElement('button');
    fillBtn.textContent = '⚡ Autofill';
    fillBtn.addEventListener('click', () => {
      chrome.storage.local.get([PROFILE_KEY, OVERRIDES_KEY], (data) => {
        const profile = data[PROFILE_KEY] || {};
        if (Object.keys(profile).length === 0) {
          showToast('No profile saved yet — click the extension icon in the toolbar to set one up');
          return;
        }
        scanAndFill(profile, data[OVERRIDES_KEY] || {});
      });
    });

    const trainBtn = document.createElement('button');
    trainBtn.className = 'jaf-train';
    trainBtn.textContent = 'Train';
    trainBtn.addEventListener('click', () => setTrainingActive(!trainingActive, trainBtn));

    widget.appendChild(fillBtn);
    widget.appendChild(trainBtn);
    document.body.appendChild(widget);
  }

  function looksLikeFormPage() {
    return document.querySelectorAll('input, textarea, select').length >= 3;
  }

  function init() {
    if (!document.body) return;
    injectWidget();
    if (looksLikeFormPage()) {
      setTimeout(() => {
        chrome.storage.local.get([PROFILE_KEY, OVERRIDES_KEY], (data) => {
          const profile = data[PROFILE_KEY] || {};
          if (Object.keys(profile).length > 0) {
            scanAndFill(profile, data[OVERRIDES_KEY] || {});
          }
        });
      }, 1200);
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'RUN_AUTOFILL') {
      chrome.storage.local.get([PROFILE_KEY, OVERRIDES_KEY], (data) => {
        const n = scanAndFill(data[PROFILE_KEY] || {}, data[OVERRIDES_KEY] || {});
        sendResponse({ filled: n });
      });
      return true;
    }
  });

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

  // SPA forms (LinkedIn Easy Apply, Workday steps, etc.) render after initial load.
  let mutationTimer = null;
  new MutationObserver(() => {
    clearTimeout(mutationTimer);
    mutationTimer = setTimeout(() => {
      if (!document.getElementById('jobAutofillWidget')) injectWidget();
    }, 800);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
