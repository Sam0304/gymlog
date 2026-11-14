// Gymlog – Hash-Router zwischen den Ansichten.
// Eine Ansicht ist ein Objekt { title, tab?, render(el, param) } aus js/views/*.js.
import * as exercises from './views/exercises.js';
import * as training from './views/training.js';
import * as active from './views/active.js';
import * as progress from './views/progress.js';
import * as plan from './views/plan.js';
import * as coach from './views/coach.js';
import * as more from './views/more.js';
import * as hiit from './views/hiit.js';
import { getSetting, setSetting } from './db.js';
import { openSheet, esc } from './ui.js';
import { APP_VERSION, CHANGES } from './version.js';

const views = {
  training,
  aktiv: active,
  plan,
  fortschritt: progress,
  trainer: coach,
  mehr: more,
  hiit,
  uebungen: exercises
};

let cleanup = null; // eine Ansicht darf eine Aufräumfunktion zurückgeben (z. B. Timer stoppen)

async function show() {
  if (cleanup) { cleanup(); cleanup = null; }
  // „#fortschritt/bench“ → Ansicht „fortschritt“, Parameter „bench“
  const [first, ...rest] = location.hash.slice(1).split('/');
  const key = views[first] ? first : 'training';
  const param = rest.join('/');
  const view = views[key];
  const tab = view.tab || key;
  const el = document.getElementById('view');

  document.getElementById('view-title').textContent = view.title;
  document.querySelectorAll('.tabbar a').forEach(a =>
    a.classList.toggle('active', a.dataset.tab === tab));
  el.innerHTML = '';
  window.scrollTo(0, 0);
  const result = await view.render(el, param);
  if (typeof result === 'function') cleanup = result;
}

window.addEventListener('hashchange', show);
show().then(announceUpdate);

/** Einmaliger Hinweis „Neue Version“, wenn sich APP_VERSION seit dem letzten Start geändert hat. */
async function announceUpdate() {
  const seen = await getSetting('seenVersion', null);
  if (seen === APP_VERSION) return;
  await setSetting('seenVersion', APP_VERSION);
  if (!seen) return; // allererster Start: keine Update-Meldung
  const notes = CHANGES[APP_VERSION] || [];
  openSheet(`
    <h2 class="sheet-title">✨ Neue Version ${esc(APP_VERSION)}</h2>
    <p class="subtitle">Gymlog wurde aktualisiert. Das ist neu:</p>
    ${notes.length ? `<ul class="card whats-new">${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    <button class="btn" data-close>Super!</button>`);
}

// Offline-Unterstützung (Service Worker) – nur über http(s) möglich
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(err => console.warn('Service Worker nicht registriert:', err));
}
