/**
 * Bring a row into view inside its own scroll container only. Unlike `scrollIntoView`, this never
 * scrolls the page and never moves the browser's Tab starting point (which would skip the skip link).
 */
export function scrollIntoList(el: HTMLElement | null) {
  if (!el) return;
  let box = el.parentElement;
  while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
  if (!box) return;
  const row = el.getBoundingClientRect();
  const view = box.getBoundingClientRect();
  if (row.top < view.top) box.scrollTop -= view.top - row.top;
  else if (row.bottom > view.bottom) box.scrollTop += row.bottom - view.bottom;
}
