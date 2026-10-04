(function () {
  // Only acts when the tab was opened by us via web.whatsapp.com/send?phone=...&text=...
  // (WhatsApp's own official deep link — it prefills that chat's compose box itself; we don't
  // type anything). If we also appended ?_autosend=1, wait for the compose box to actually
  // contain the prefilled text, then click WhatsApp's own Send button once.
  const params = new URLSearchParams(location.search);
  if (!params.has('phone') || !params.get('text')) return;
  if (params.get('_autosend') !== '1') return;

  function findComposeBox() {
    return document.querySelector('footer div[contenteditable="true"][data-tab]')
      || document.querySelector('div[contenteditable="true"][aria-label="Type a message"]');
  }

  function findSendButton() {
    return document.querySelector('button[aria-label="Send"]')
      || document.querySelector('span[data-icon="send"]')?.closest('button');
  }

  let attempts = 0;
  const maxAttempts = 40; // ~20s at 500ms
  const poll = setInterval(() => {
    attempts++;
    const box = findComposeBox();
    const btn = findSendButton();
    if (box && box.textContent.trim().length > 0 && btn) {
      clearInterval(poll);
      // small human-like pause before sending, same spirit as the job-form typing delay
      setTimeout(() => btn.click(), 400 + Math.random() * 600);
    } else if (attempts >= maxAttempts) {
      clearInterval(poll);
    }
  }, 500);
})();
