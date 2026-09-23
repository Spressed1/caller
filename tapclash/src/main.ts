import './shell/styles.css';
import { Engine } from './core/engine';
import { App } from './shell/app';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;
new App(new Engine(canvas), ui);

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
