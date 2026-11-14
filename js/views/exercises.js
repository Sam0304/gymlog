// Gymlog – Übungskatalog: Suche, Filter, Details, eigene Übungen.
import { getAllExercises, MUSCLES, EQUIPMENT, LOG_LABELS, addCustomExercise, deleteCustomExercise } from '../exercises.js';
import { getSetting, setSetting } from '../db.js';
import { openSheet, esc, normalize, ask } from '../ui.js';

export const title = 'Übungen';
export const tab = 'mehr';

/**
 * Wiederverwendbarer Übungs-Browser (Suche + Muskel-Filter + Liste).
 * Wird hier im Katalog genutzt und später in Etappe 3 beim Auswählen fürs Training.
 */
export async function mountExerciseBrowser(container, { onSelect }) {
  let all = await getAllExercises();
  let favs = new Set(await getSetting('favorites', []));
  let query = '';
  let muscle = 'Alle';

  container.innerHTML = `
    <input class="search" type="search" placeholder="Übung suchen …" aria-label="Übung suchen">
    <div class="chips" role="tablist">
      ${['Alle', ...MUSCLES].map(m => `<button class="chip" data-m="${m}">${m}</button>`).join('')}
    </div>
    <div class="ex-list"></div>`;

  const list = container.querySelector('.ex-list');

  function draw() {
    const q = normalize(query.trim());
    const hits = all.filter(e =>
      (muscle === 'Alle' || e.muscle === muscle) &&
      (!q || normalize(`${e.name} ${e.equipment} ${e.muscle}`).includes(q)));

    container.querySelectorAll('.chip').forEach(c =>
      c.classList.toggle('active', c.dataset.m === muscle));

    if (!hits.length) {
      list.innerHTML = `<div class="card empty">Keine Übung gefunden.<br>Leg sie unten als eigene Übung an.</div>`;
      return;
    }
    // Favoriten zuerst als eigene Gruppe, danach nach Muskelgruppe
    const groups = {};
    const favHits = hits.filter(e => favs.has(e.id));
    if (favHits.length) groups['★ Favoriten'] = favHits;
    for (const e of hits) if (!favs.has(e.id)) (groups[e.muscle] ||= []).push(e);

    list.innerHTML = Object.entries(groups).map(([m, items]) => `
      <div class="section-label">${m} <small>${items.length}</small></div>
      <div class="group">
        ${items.map(e => {
          const fav = favs.has(e.id);
          return `
          <div class="row" data-id="${esc(e.id)}">
            <button class="row-main pick">
              <span class="row-title">${esc(e.name)}${e.custom ? ' <span class="badge">Eigene</span>' : ''}</span>
              <span class="row-sub">${esc(e.muscle)} · ${esc(e.equipment)}</span>
            </button>
            <button class="star${fav ? ' on' : ''}" aria-label="${fav ? 'Favorit entfernen' : 'Als Favorit markieren'}" aria-pressed="${fav}">${fav ? '★' : '☆'}</button>
          </div>`;
        }).join('')}
      </div>`).join('');
  }

  async function toggleFav(id) {
    favs.has(id) ? favs.delete(id) : favs.add(id);
    await setSetting('favorites', [...favs]);
    draw();
  }

  container.querySelector('.search').addEventListener('input', e => { query = e.target.value; draw(); });
  container.querySelector('.chips').addEventListener('click', e => {
    const c = e.target.closest('.chip');
    if (c) { muscle = c.dataset.m; draw(); }
  });
  list.addEventListener('click', e => {
    const row = e.target.closest('.row');
    if (!row) return;
    if (e.target.closest('.star')) toggleFav(row.dataset.id);
    else if (e.target.closest('.pick')) onSelect(all.find(x => x.id === row.dataset.id));
  });

  draw();
  return { refresh: async () => { all = await getAllExercises(); draw(); } };
}

export async function render(el) {
  el.innerHTML = `
    <p class="subtitle">Wähle eine Übung für Details oder leg eigene an.</p>
    <div class="browser"></div>
    <button class="btn secondary add-ex">＋ Eigene Übung</button>`;

  const browser = await mountExerciseBrowser(el.querySelector('.browser'), {
    onSelect: ex => showDetails(ex, browser)
  });
  el.querySelector('.add-ex').addEventListener('click', () => showAddForm(browser));
}

function showDetails(ex, browser) {
  const { el, close } = openSheet(`
    <h2 class="sheet-title">${esc(ex.name)}</h2>
    <dl class="facts">
      <dt>Muskelgruppe</dt><dd>${esc(ex.muscle)}</dd>
      <dt>Gerät</dt><dd>${esc(ex.equipment)}</dd>
      <dt>Typ</dt><dd>${esc(ex.type)}</dd>
      <dt>Erfassung</dt><dd>${LOG_LABELS[ex.log]}</dd>
    </dl>
    ${ex.custom ? '<button class="btn danger del">Übung löschen</button>' : ''}
    <button class="btn secondary" data-close>Schließen</button>`);

  el.querySelector('.del')?.addEventListener('click', async () => {
    close();
    const yes = await ask({ title: 'Übung löschen?', text: `„${ex.name}“ wird aus dem Katalog entfernt.`, ok: 'Löschen', danger: true });
    if (!yes) return;
    await deleteCustomExercise(ex.id);
    browser.refresh();
  });
}

function showAddForm(browser) {
  const { el, close } = openSheet(`
    <h2 class="sheet-title">Eigene Übung</h2>
    <form class="form">
      <label>Name<input name="name" required maxlength="60" placeholder="z. B. Landmine Press"></label>
      <label>Muskelgruppe<select name="muscle">${MUSCLES.map(m => `<option>${m}</option>`).join('')}</select></label>
      <label>Gerät<select name="equipment">${EQUIPMENT.map(m => `<option>${m}</option>`).join('')}</select></label>
      <label>Erfassung<select name="log">
        ${Object.entries(LOG_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
      </select></label>
      <button class="btn" type="submit">Speichern</button>
      <button class="btn secondary" type="button" data-close>Abbrechen</button>
    </form>`);

  el.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    if (!data.name.trim()) return;
    await addCustomExercise(data);
    close();
    browser.refresh();
  });
}
