document.addEventListener('click', async (event) => {
  const target = event.target;
  const button = target instanceof Element ? target.closest('[data-copy]') : null;
  if (!(button instanceof HTMLElement)) return;
  try {
    await navigator.clipboard.writeText(button.dataset.copy || location.href);
    const original = button.textContent;
    button.textContent = 'Link copied';
    setTimeout(() => { button.textContent = original; }, 1800);
  } catch { /* Clipboard unavailable. */ }
});
