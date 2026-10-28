import { useSyncExternalStore } from 'react';
import { tokens } from './tokens';

/**
 * Marks the page as landscape (`<html data-layout="landscape">`) while a phone is on its side: wider than tall and no
 * taller than layout.landscape_max_height. CSS media queries cannot read the size tokens, so the stylesheets key their
 * landscape layouts on this attribute instead. Tablets and desktop windows tall enough for the portrait layout keep it.
 */
export function watchLayout(win: Window = window): void {
  const maxHeight = (tokens.layout as Record<string, string>).landscape_max_height;
  const query = win.matchMedia(`(orientation: landscape) and (max-height: ${maxHeight})`);
  const apply = () => {
    if (query.matches) win.document.documentElement.dataset.layout = 'landscape';
    else delete win.document.documentElement.dataset.layout;
  };
  apply();
  query.addEventListener('change', apply);
}

const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-layout'] });
  return () => observer.disconnect();
};
const isLandscape = () => document.documentElement.dataset.layout === 'landscape';

/** Whether the landscape layout is on, for the few screens that arrange their parts differently in it. */
export function useLandscape(): boolean {
  return useSyncExternalStore(subscribe, isLandscape, () => false);
}
