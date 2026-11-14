// Gymlog – Pausentimer als Leiste über der Tab-Leiste.
// Läuft über Seitenwechsel hinweg weiter, weil er am <body> hängt.
import { clock } from './ui.js';

let endAt = 0;
let interval = null;
let bar = null;

export function startRest(seconds = 90) {
  endAt = Date.now() + seconds * 1000;
  ensureBar();
  delete bar.dataset.buzzed;
  clearInterval(interval);
  interval = setInterval(tick, 250);
  tick();
}

export function stopRest() {
  clearInterval(interval);
  bar?.remove();
  bar = null;
}

function ensureBar() {
  if (bar) return;
  bar = document.createElement('div');
  bar.className = 'rest-bar';
  bar.innerHTML = `
    <span class="rest-label">Pause</span>
    <b class="rest-time"></b>
    <button data-a="minus" aria-label="15 Sekunden weniger">−15</button>
    <button data-a="plus" aria-label="15 Sekunden mehr">+15</button>
    <button data-a="skip" aria-label="Pause beenden">✕</button>`;
  bar.addEventListener('click', e => {
    const a = e.target.dataset.a;
    if (a === 'plus') endAt += 15000;
    if (a === 'minus') endAt -= 15000;
    if (a === 'skip') return stopRest();
    tick();
  });
  document.body.append(bar);
}

function tick() {
  if (!bar) return;
  const left = Math.ceil((endAt - Date.now()) / 1000);
  const over = left <= 0;
  bar.classList.toggle('over', over);
  bar.querySelector('.rest-label').textContent = over ? 'Pause vorbei' : 'Pause';
  bar.querySelector('.rest-time').textContent = over ? 'Los! 💪' : clock(left);
  if (over && !bar.dataset.buzzed) {
    bar.dataset.buzzed = '1';
    navigator.vibrate?.(300); // auf Android; iOS-Safari ignoriert das
  }
  if (left < -8) stopRest();
}
