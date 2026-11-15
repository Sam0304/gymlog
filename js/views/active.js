// Gymlog – laufendes Training: Übungen, Sätze Satz für Satz abhaken.
import { getActive, saveActive, finishWorkout, discardActive, getWorkouts, lastSetsFrom, allSetsFrom, recordType, fmtSet, num } from '../workouts.js';
import { getAllExercises } from '../exercises.js';
import { mountExerciseBrowser } from './exercises.js';
import { openSheet, esc, clock, toast, confetti, ask } from '../ui.js';
import { startRest, stopRest } from '../rest-timer.js';
import { fmtTarget } from '../plans.js';
import { progressionAdvice, restSeconds } from '../coach-rules.js';
import { getSetting } from '../db.js';

export const title = 'Training';
export const tab = 'training';

// Welche Eingabefelder je Erfassungsart; req = muss zum Abhaken gefüllt sein
const FIELDS = {
  kg:     [{ k: 'w', label: 'kg', req: true }, { k: 'r', label: 'Wdh', req: true }],
  bw:     [{ k: 'w', label: '+kg' }, { k: 'r', label: 'Wdh', req: true }],
  time:   [{ k: 's', label: 'Sek', req: true }],
  cardio: [{ k: 'min', label: 'Min', req: true }, { k: 'km', label: 'km' }]
};
const TARGET_FIELD = { kg: 'r', bw: 'r', time: 's', cardio: 'min' };
const targetHint = (t, log) => t ? { [TARGET_FIELD[log]]: t.repsMin } : {};
const parse = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? undefined : n; };

export async function render(el) {
  const w = await getActive();
  if (!w) { location.hash = '#training'; return; }

  const exMap = Object.fromEntries((await getAllExercises()).map(e => [e.id, e]));
  const history = await getWorkouts();
  const profile = await getSetting('coachProfile', null); // Pausenlänge richtet sich nach dem Ziel
  const last = (exId) => lastSetsFrom(history, exId);
  const exOf = (x) => exMap[x.exId] || { name: 'Unbekannte Übung', log: 'kg' };
  const save = () => saveActive(w);

  el.innerHTML = `
    <div class="wo-head">
      <div>
        <button class="wo-name rename" aria-label="Training umbenennen">${esc(w.name)} <span class="pen" aria-hidden="true">✎</span></button>
        <div class="wo-time">⏱ <span id="wo-time"></span></div>
      </div>
      <button class="btn small finish">Beenden</button>
    </div>
    <div class="wo-list"></div>
    <button class="btn secondary add-ex">＋ Übung hinzufügen</button>
    <button class="btn plain discard">Training verwerfen</button>`;

  const list = el.querySelector('.wo-list');
  const timeEl = el.querySelector('#wo-time');
  const tickClock = () => { timeEl.textContent = clock((Date.now() - w.start) / 1000); };
  tickClock();
  const iv = setInterval(tickClock, 1000);

  // ---------- Darstellung ----------
  function draw() {
    if (!w.exercises.length) {
      list.innerHTML = `<div class="card empty"><div class="big">🏋️</div>Füge deine erste Übung hinzu.</div>`;
      return;
    }
    list.innerHTML = w.exercises.map(card).join('');
  }

  function card(x, i) {
    const ex = exOf(x);
    const f = FIELDS[ex.log];
    const prev = last(x.exId);
    const doneCount = x.sets.filter(s => s.done).length;
    const tip = x.target && progressionAdvice(prev, x.target, ex); // Trainer-Tipp aus dem letzten Mal
    return `
      <div class="card wo-ex" data-i="${i}">
        <div class="wo-ex-head">
          <div>
            <h2>${esc(ex.name)}</h2>
            ${x.target ? `<p class="wo-target">🎯 Ziel: ${fmtTarget(x.target)}${ex.log === 'time' ? ' s' : ex.log === 'cardio' ? ' min' : ' Wdh'}</p>` : ''}
            ${tip ? `<p class="wo-advice ${tip.kind}">💡 ${esc(tip.text)}</p>` : ''}
            <p class="wo-last">${prev.length ? 'Letztes Mal: ' + prev.map(s => fmtSet(s, ex.log)).join(' · ') : 'Zum ersten Mal 🎉'}</p>
          </div>
          <span class="wo-count">${doneCount}/${x.sets.length}</span>
          <button class="icon-btn menu" aria-label="Optionen für ${esc(ex.name)}">⋯</button>
        </div>
        <div class="set-grid" style="--cols:${f.length}">
          <span class="set-h">Satz</span>${f.map(c => `<span class="set-h">${c.label}</span>`).join('')}<span></span>
          ${x.sets.map((s, j) => {
            // Vorschlag: Werte vom letzten Mal, sonst das untere Plan-Ziel
            const ph = prev[j] || prev[prev.length - 1] || targetHint(x.target, ex.log);
            return `<span class="set-no${s.done ? ' done' : ''}"${s.pr ? ` title="Rekord: ${esc(s.pr)}"` : ''}>${s.pr ? '🏆' : j + 1}</span>` +
              f.map(c => `<input class="set-in${s.done ? ' done' : ''}" data-j="${j}" data-k="${c.k}"
                 inputmode="decimal" autocomplete="off" aria-label="Satz ${j + 1} ${c.label}"
                 value="${num(s[c.k])}" placeholder="${num(ph[c.k])}">`).join('') +
              `<button class="check${s.done ? ' on' : ''}" data-j="${j}" aria-label="Satz ${j + 1} abhaken" aria-pressed="${!!s.done}">✓</button>`;
          }).join('')}
        </div>
        <button class="link add-set">＋ Satz</button>
      </div>`;
  }

  // ---------- Eingaben ----------
  list.addEventListener('input', e => {
    const inp = e.target.closest('.set-in');
    if (!inp) return;
    const x = w.exercises[inp.closest('.wo-ex').dataset.i];
    const v = parse(inp.value);
    const set = x.sets[inp.dataset.j];
    if (v === undefined) delete set[inp.dataset.k]; else set[inp.dataset.k] = v;
    save();
  });

  list.addEventListener('click', e => {
    const cardEl = e.target.closest('.wo-ex');
    if (!cardEl) return;
    const i = +cardEl.dataset.i;
    const x = w.exercises[i];
    const ex = exOf(x);

    // Satz abhaken: leere Felder übernehmen den Wert vom letzten Mal (Platzhalter)
    const check = e.target.closest('.check');
    if (check) {
      const j = +check.dataset.j;
      const set = x.sets[j];
      if (set.done) { set.done = false; delete set.pr; save(); draw(); return; }
      for (const c of FIELDS[ex.log]) {
        const inp = cardEl.querySelector(`.set-in[data-j="${j}"][data-k="${c.k}"]`);
        if (set[c.k] === undefined && parse(inp.placeholder) !== undefined) set[c.k] = parse(inp.placeholder);
        if (c.req && set[c.k] === undefined) { inp.focus(); inp.classList.add('shake'); setTimeout(() => inp.classList.remove('shake'), 400); return; }
      }
      set.done = true;

      // Rekord? Vergleich mit allen früheren Trainings + schon erledigten Sätzen von heute
      const prior = [
        ...allSetsFrom(history, x.exId),
        ...w.exercises.filter(o => o.exId === x.exId).flatMap(o => o.sets).filter(s => s.done && s !== set)
      ];
      const rec = ex.muscle === 'Dehnen' ? null : recordType(set, prior, ex.log); // Dehnen ist kein Wettkampf
      if (rec) {
        set.pr = rec;
        confetti();
        toast(`🏆 ${rec}: ${fmtSet(set, ex.log)}`);
      }
      save(); draw();
      if (ex.log === 'kg' || ex.log === 'bw') startRest(restSeconds(profile?.goal, ex));
      return;
    }

    if (e.target.closest('.add-set')) {
      const prevSet = x.sets[x.sets.length - 1] || {};
      const { done, pr, ...copy } = prevSet; // nur Werte übernehmen, nicht Status/Rekord
      x.sets.push(copy);
      save(); draw();
      return;
    }

    if (e.target.closest('.menu')) exerciseMenu(i);
  });

  function exerciseMenu(i) {
    const x = w.exercises[i];
    const { el: sheet, close } = openSheet(`
      <h2 class="sheet-title">${esc(exOf(x).name)}</h2>
      <button class="btn secondary" data-a="up" ${i === 0 ? 'disabled' : ''}>↑ Nach oben schieben</button>
      <button class="btn secondary" data-a="pop" ${x.sets.length <= 1 ? 'disabled' : ''}>Letzten Satz entfernen</button>
      <button class="btn danger" data-a="remove">Übung entfernen</button>
      <button class="btn plain" data-close>Abbrechen</button>`);
    sheet.addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (!a) return;
      if (a === 'up') w.exercises.splice(i - 1, 0, w.exercises.splice(i, 1)[0]);
      if (a === 'pop') x.sets.pop();
      if (a === 'remove') w.exercises.splice(i, 1);
      save(); draw(); close();
    });
  }

  // ---------- Übung hinzufügen (Sheet bleibt offen) ----------
  el.querySelector('.add-ex').addEventListener('click', async () => {
    const { el: sheet } = openSheet(`
      <div class="sheet-bar"><h2 class="sheet-title">Übung hinzufügen</h2><button class="btn small" data-close>Fertig</button></div>
      <div class="picker"></div>`);
    await mountExerciseBrowser(sheet.querySelector('.picker'), {
      onSelect: ex => {
        const prev = last(ex.id);
        const n = prev.length || 3;
        w.exercises.push({ exId: ex.id, sets: Array.from({ length: n }, () => ({})) });
        save(); draw();
        toast(`✓ ${ex.name} hinzugefügt`);
      }
    });
  });

  // ---------- Umbenennen ----------
  el.querySelector('.rename').addEventListener('click', () => {
    const { el: sheet, close } = openSheet(`
      <h2 class="sheet-title">Training umbenennen</h2>
      <form class="form">
        <label>Name<input name="name" required maxlength="40" value="${esc(w.name)}"></label>
        <div class="quick-names">
          ${['Push', 'Pull', 'Beine', 'Oberkörper', 'Unterkörper', 'Ganzkörper', 'Brust & Trizeps', 'Rücken & Bizeps'].map(n =>
            `<button type="button" class="chip" data-n="${n}">${n}</button>`).join('')}
        </div>
        <button class="btn" type="submit">Speichern</button>
        <button class="btn plain" type="button" data-close>Abbrechen</button>
      </form>`);
    const input = sheet.querySelector('input');
    sheet.querySelector('.quick-names').addEventListener('click', e => {
      const n = e.target.closest('[data-n]')?.dataset.n;
      if (n) input.value = n;
    });
    sheet.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name) return;
      w.name = name;
      save();
      el.querySelector('.rename').innerHTML = `${esc(name)} <span class="pen" aria-hidden="true">✎</span>`;
      close();
    });
  });

  // ---------- Beenden / Verwerfen ----------
  el.querySelector('.finish').addEventListener('click', async () => {
    const done = w.exercises.reduce((n, x) => n + x.sets.filter(s => s.done).length, 0);
    if (!done) {
      const yes = await ask({
        title: 'Noch kein Satz abgehakt',
        text: 'Ohne abgehakte Sätze gibt es nichts zu speichern. Training verwerfen?',
        ok: 'Training verwerfen', cancel: 'Weiter trainieren', danger: true
      });
      if (yes) { await discardActive(); stopRest(); location.hash = '#training'; }
      return;
    }
    const yes = await ask({
      title: 'Training beenden?',
      text: `${done} ${done === 1 ? 'Satz wird' : 'Sätze werden'} gespeichert. Nicht abgehakte Sätze fallen weg.`,
      ok: 'Beenden & speichern', cancel: 'Weiter trainieren'
    });
    if (!yes) return;
    await finishWorkout(w);
    stopRest();
    toast('💪 Training gespeichert');
    location.hash = '#training';
  });

  el.querySelector('.discard').addEventListener('click', async () => {
    const yes = await ask({
      title: 'Training verwerfen?',
      text: 'Alle Einträge dieses Trainings gehen verloren.',
      ok: 'Verwerfen', cancel: 'Behalten', danger: true
    });
    if (!yes) return;
    await discardActive();
    stopRest();
    location.hash = '#training';
  });

  draw();
  return () => clearInterval(iv); // Aufräumen beim Verlassen der Ansicht
}
