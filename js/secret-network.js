(() => {
  'use strict';
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const skip = document.querySelector('.skip');
  let bootTimer;
  function finishBoot() {
    document.body.classList.remove('is-booting');
    skip.hidden = true;
    clearTimeout(bootTimer);
    document.removeEventListener('pointerdown', finishBoot);
  }
  if (!motion.matches) {
    document.body.classList.add('is-booting');
    skip.hidden = false;
    skip.addEventListener('click', finishBoot);
    document.addEventListener('pointerdown', finishBoot, { once: true });
    bootTimer = setTimeout(finishBoot, 1600);
  }
  motion.addEventListener('change', finishBoot);

  const coordinates = document.querySelector('.coordinates');
  if (coordinates) {
    coordinates.addEventListener('click', async () => {
      const status = document.querySelector('#copy-status');
      const value = '34.4269095, 135.5117641';
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(value);
        } else {
          // Compatibility for older Safari / non-HTTPS local previews.
          const input = document.createElement('textarea');
          input.value = value;
          input.setAttribute('readonly', '');
          input.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
          document.body.append(input);
          input.select();
          input.setSelectionRange(0, value.length);
          let copied;
          try { copied = document.execCommand('copy'); }
          finally { input.remove(); coordinates.focus({ preventScroll: true }); }
          if (!copied) throw new Error('Copy unavailable');
        }
        status.textContent = 'コピーしました';
      } catch {
        status.textContent = 'コピーできませんでした。次の座標を選択してコピーしてください：' + value;
      }
    });
  }

})();
