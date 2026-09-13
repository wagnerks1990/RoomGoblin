/* Keyboard behavior for the legacy Veyon modal containers. Native dialogs
   retain their built-in Escape and focus behavior. */
(() => {
  'use strict';
  const focusable = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]';
  const returnFocus = new WeakMap();
  document.querySelectorAll('.modal[role="dialog"]').forEach(modal => {
    new MutationObserver(records => {
      if (!records.some(record => record.attributeName === 'class')) return;
      const wasOpen = records[0].oldValue?.split(' ').includes('open');
      const isOpen = modal.classList.contains('open');
      if (isOpen && !wasOpen) {
        returnFocus.set(modal, document.activeElement);
        modal.querySelector(focusable)?.focus();
      } else if (!isOpen && wasOpen) {
        const previous = returnFocus.get(modal);
        if (previous?.isConnected) previous.focus();
      }
    }).observe(modal, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        modal.querySelector('#closeLive,#closeInfo')?.click();
      } else if (event.key === 'Tab') {
        const controls = [...modal.querySelectorAll(focusable)].filter(node => node.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
  });
})();
