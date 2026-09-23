import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './shell/styles.css';
import { Engine } from './core/engine';
import { App } from './shell/app';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;
new App(new Engine(canvas), ui);

// The canvas never triggers font loading on its own, so ask for the faces up front.
for (const f of ['24px "Lilita One"', '500 16px Fredoka', '700 16px Fredoka']) {
  document.fonts?.load(f).catch(() => undefined);
}

// Stop iOS pinch / double-tap zoom and rubber-band scrolling.
for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) {
  document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
}
document.addEventListener(
  'touchmove',
  (e) => {
    if (!(e.target as HTMLElement).closest('.scroll')) e.preventDefault();
  },
  { passive: false },
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => undefined);
  });
}
