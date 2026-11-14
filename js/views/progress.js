// Gymlog – Fortschritt: Streak, Körpergewicht, Übungen mit Diagrammen und Rekorden.
// Routen: #fortschritt                → Übersicht
//         #fortschritt/koerpergewicht → Körpergewicht
//         #fortschritt/<übungs-id>    → Übungsdetails
import { getWorkouts, fmtSet } from '../workouts.js';
import { getAllExercises, MUSCLES, NON_STRENGTH } from '../exercises.js';
import {
  sessionsFor, series, best, bestSet, METRICS, fmtVal, streak, getWeeklyGoal, setWeeklyGoal,
  getBodyweight, saveBodyweight, deleteBodyweight, dayKey, RANGES, inRange, setsPerMuscle
} from '../progress.js';
import { lineChart, sparkline } from '../chart.js';
import { openSheet, esc, toast, ask } from '../ui.js';

export const title = 'Fortschritt';

const setTitle = (t) => { document.getElementById('view-title').textContent = t; };
const dateLong = (t) => new Date(t).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const back = `<a class="back" href="#fortschritt">‹ Fortschritt</a>`;

// Gewählter Zeitraum gilt für alle Diagramme, solange die App offen ist
let range = '3m';
const rangeChips = () => `<div class="seg range" role="tablist">${RANGES.map(r =>
  `<button class="seg-btn${r.k === range ? ' active' : ''}" data-r="${r.k}">${r.label}</button>`).join('')}</div>`;
const tooFew = `<p class="row-sub chart-note">Zu wenige Einträge in diesem Zeitraum. Wähle einen längeren Zeitraum.</p>`;

export async function render(el, param) {
  if (param === 'koerpergewicht') return renderBodyweight(el);
  if (param) return renderExercise(el, param);
  return renderOverview(el);
}

// ================= Übersicht =================
async function renderOverview(el) {
  const [workouts, exercises, bw, goal] =
    await Promise.all([getWorkouts(), getAllExercises(), getBodyweight(), getWeeklyGoal()]);
  const exMap = Object.fromEntries(exercises.map(e => [e.id, e]));
  const st = streak(workouts, goal);

  // Trainierte Übungen, zuletzt trainierte zuerst
  const lastDate = {};
  for (const w of workouts) for (const x of w.exercises) lastDate[x.exId] = Math.max(lastDate[x.exId] || 0, w.start);
  const trained = Object.keys(lastDate).sort((a, b) => lastDate[b] - lastDate[a]);

  const bwLast = bw[bw.length - 1];
  const bwMonthAgo = bw.find(e => e.date >= Date.now() - 30 * 864e5);
  const bwDelta = bwLast && bwMonthAgo && bwLast !== bwMonthAgo ? bwLast.kg - bwMonthAgo.kg : null;

  el.innerHTML = `
    <p class="subtitle">Rekorde und Entwicklung</p>

    <div class="card streak">
      <div class="streak-top">
        <span class="flame" aria-hidden="true">🔥</span>
        <div class="streak-main">
          <b>${st.weeks ? `${st.weeks} ${st.weeks === 1 ? 'Woche' : 'Wochen'} in Folge` : 'Starte deine Serie'}</b>
          <span>Ziel: ${goal}× pro Woche trainieren</span>
        </div>
        <button class="icon-btn goal" aria-label="Wochenziel ändern">⚙︎</button>
      </div>
      <div class="week-dots">
        ${Array.from({ length: goal }, (_, i) => `<span class="dot${i < st.thisWeek ? ' on' : ''}"></span>`).join('')}
        <span class="week-txt">${st.thisWeek} / ${goal} diese Woche${st.thisWeek >= goal ? ' ✓' : ''}</span>
      </div>
    </div>

    <div class="section-label">Sätze pro Muskelgruppe</div>
    <div class="card muscles">
      <div class="seg mus-range">
        <button class="seg-btn active" data-d="7">Letzte 7 Tage</button>
        <button class="seg-btn" data-d="28">Ø der letzten 4 Wochen</button>
      </div>
      <div class="bars"></div>
      <p class="legend">
        <span class="lg low"></span>unter 10 <span class="lg ok"></span>10–20 <span class="lg high"></span>über 20
        <br>Richtwert für Muskelaufbau: ca. 10–20 Sätze pro Muskelgruppe und Woche.
      </p>
    </div>

    <div class="section-label">Körpergewicht</div>
    <div class="card bw-card">
      <a class="bw-link" href="#fortschritt/koerpergewicht">
        <span class="row-main">
          <span class="bw-now">${bwLast ? fmtVal(bwLast.kg, 'kg') : 'Noch kein Eintrag'}</span>
          <span class="row-sub">${bwDelta != null ? `${bwDelta > 0 ? '+' : ''}${fmtVal(bwDelta, 'kg')} in 30 Tagen` : bwLast ? 'Seit ' + dateLong(bwLast.date) : 'Trag dein Gewicht ein, um den Verlauf zu sehen'}</span>
        </span>
        ${sparkline(bw.slice(-20).map(e => e.kg))}
        <span class="chev" aria-hidden="true">›</span>
      </a>
      <button class="btn secondary bw-add">＋ Gewicht eintragen</button>
    </div>

    <div class="section-label">Übungen</div>
    ${trained.length ? `<div class="group">${trained.map(id => {
      const ex = exMap[id] || { name: 'Gelöschte Übung', log: 'kg' };
      const sessions = sessionsFor(workouts, id);
      const m = METRICS[ex.log][0];
      const top = best(sessions, m.k);
      return `
        <a class="row" href="#fortschritt/${encodeURIComponent(id)}">
          <span class="row-main">
            <span class="row-title">${esc(ex.name)}</span>
            <span class="row-sub">${sessions.length}× · Bestwert ${fmtVal(top.y, m.unit)}</span>
          </span>
          ${sparkline(series(sessions, m.k).map(p => p.y))}
          <span class="chev" aria-hidden="true">›</span>
        </a>`;
    }).join('')}</div>`
    : `<div class="card empty"><div class="big">📈</div>Sobald du Trainings speicherst, erscheinen hier deine Übungen mit Diagrammen und Rekorden.</div>`}`;

  // Balken je Muskelgruppe (ohne Cardio). Bei 4 Wochen: Durchschnitt pro Woche.
  function drawBars(days) {
    const counts = setsPerMuscle(workouts, exMap, days);
    const perWeek = (m) => (counts[m] || 0) / (days / 7);
    const scale = Math.max(20, ...MUSCLES.map(perWeek));
    el.querySelector('.bars').innerHTML = MUSCLES.filter(m => !NON_STRENGTH.has(m)).map(m => {
      const v = perWeek(m);
      const cls = v < 10 ? 'low' : v <= 20 ? 'ok' : 'high';
      return `
        <div class="bar-row">
          <span class="bar-name">${m}</span>
          <span class="bar-track"><span class="bar-fill ${cls}" style="width:${(v / scale * 100).toFixed(1)}%"></span></span>
          <span class="bar-val${v ? '' : ' zero'}">${fmtVal(v, '')}</span>
        </div>`;
    }).join('');
    el.querySelectorAll('.mus-range .seg-btn').forEach(b => b.classList.toggle('active', +b.dataset.d === days));
  }
  el.querySelector('.mus-range').addEventListener('click', e => {
    const d = +e.target.closest('[data-d]')?.dataset.d;
    if (d) drawBars(d);
  });
  drawBars(7);

  el.querySelector('.goal').addEventListener('click', () => goalSheet(goal, () => renderOverview(el)));
  el.querySelector('.bw-add').addEventListener('click', () => bodyweightSheet(bwLast, () => renderOverview(el)));
}

function goalSheet(current, done) {
  const { el, close } = openSheet(`
    <h2 class="sheet-title">Wochenziel</h2>
    <p class="subtitle">Wie oft willst du pro Woche trainieren?</p>
    <div class="goal-grid">
      ${[1, 2, 3, 4, 5, 6, 7].map(n => `<button class="chip${n === current ? ' active' : ''}" data-n="${n}">${n}×</button>`).join('')}
    </div>
    <button class="btn plain" data-close>Schließen</button>`);
  el.querySelector('.goal-grid').addEventListener('click', async e => {
    const n = +e.target.closest('[data-n]')?.dataset.n;
    if (!n) return;
    await setWeeklyGoal(n);
    close();
    done();
  });
}

function bodyweightSheet(last, done) {
  const { el, close } = openSheet(`
    <h2 class="sheet-title">Körpergewicht</h2>
    <form class="form">
      <label>Gewicht (kg)<input name="kg" inputmode="decimal" required autocomplete="off"
        placeholder="${last ? String(last.kg).replace('.', ',') : 'z. B. 78,5'}"></label>
      <label>Datum<input name="day" type="date" value="${dayKey()}" max="${dayKey()}"></label>
      <button class="btn" type="submit">Speichern</button>
      <button class="btn plain" type="button" data-close>Abbrechen</button>
    </form>`);
  const form = el.querySelector('form');
  setTimeout(() => form.kg.focus(), 300);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const kg = parseFloat(form.kg.value.replace(',', '.'));
    if (!(kg > 20 && kg < 400)) { form.kg.classList.add('shake'); setTimeout(() => form.kg.classList.remove('shake'), 400); return; }
    await saveBodyweight(form.day.value || dayKey(), Math.round(kg * 10) / 10);
    close();
    toast('✓ Gewicht gespeichert');
    done();
  });
}

// ================= Körpergewicht =================
async function renderBodyweight(el) {
  setTitle('Körpergewicht');
  const bw = await getBodyweight();
  const first = bw[0], last = bw[bw.length - 1];

  el.innerHTML = `
    ${back}
    ${bw.length ? `
      <div class="stats">
        <div class="stat"><b>${fmtVal(last.kg, '')}</b><span>Aktuell (kg)</span></div>
        <div class="stat"><b>${fmtVal(first.kg, '')}</b><span>Start (kg)</span></div>
        <div class="stat"><b>${last.kg - first.kg > 0 ? '+' : ''}${fmtVal(last.kg - first.kg, '')}</b><span>Veränderung (kg)</span></div>
      </div>
      ${rangeChips()}
      <div class="card chart-card"><div class="chart-box"></div></div>`
    : `<div class="card empty"><div class="big">⚖️</div>Noch keine Einträge.</div>`}
    <button class="btn bw-add">＋ Gewicht eintragen</button>
    ${bw.length ? `
      <div class="section-label">Einträge</div>
      <div class="group">${[...bw].reverse().map(e => `
        <div class="row">
          <span class="row-main"><span class="row-title">${fmtVal(e.kg, 'kg')}</span><span class="row-sub">${dateLong(e.date)}</span></span>
          <button class="icon-btn del" data-id="${e.id}" aria-label="Eintrag löschen">✕</button>
        </div>`).join('')}
      </div>` : ''}`;

  function drawChart() {
    const pts = bw.filter(e => inRange(e.date, range)).map(e => ({ x: e.date, y: e.kg }));
    el.querySelector('.chart-box').innerHTML = pts.length > 1 ? lineChart(pts, { unit: 'kg' }) : tooFew;
    el.querySelectorAll('.range .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.r === range));
  }
  if (bw.length) {
    el.querySelector('.range').addEventListener('click', e => {
      const r = e.target.closest('[data-r]')?.dataset.r;
      if (r) { range = r; drawChart(); }
    });
    drawChart();
  }

  el.querySelector('.bw-add').addEventListener('click', () => bodyweightSheet(last, () => renderBodyweight(el)));
  el.querySelector('.group')?.addEventListener('click', async e => {
    const id = e.target.closest('.del')?.dataset.id;
    if (!id) return;
    if (!await ask({ title: 'Eintrag löschen?', ok: 'Löschen', danger: true })) return;
    await deleteBodyweight(id);
    renderBodyweight(el);
  });
}

// ================= Übungsdetails =================
async function renderExercise(el, id) {
  id = decodeURIComponent(id);
  const [workouts, exercises] = await Promise.all([getWorkouts(), getAllExercises()]);
  const ex = exercises.find(e => e.id === id) || { name: 'Gelöschte Übung', log: 'kg' };
  const sessions = sessionsFor(workouts, id);
  const metrics = METRICS[ex.log];
  let metric = metrics[0];
  setTitle(ex.name);

  if (!sessions.length) {
    el.innerHTML = `${back}<div class="card empty">Für diese Übung gibt es noch keine Daten.</div>`;
    return;
  }

  el.innerHTML = `
    ${back}
    ${metrics.length > 1 ? `<div class="chips metric-chips">${metrics.map(m =>
      `<button class="chip" data-k="${m.k}">${m.label}</button>`).join('')}</div>` : ''}
    ${rangeChips()}
    <div class="card chart-card">
      <div class="chart-head"></div>
      <div class="chart-box"></div>
    </div>

    <div class="section-label">Rekorde (gesamt)</div>
    <div class="records">
      ${metrics.map(m => {
        // Höchstgewicht mit dazugehörigen Wiederholungen, z. B. „65 kg × 6“
        if (m.k === 'maxW' && ex.log === 'kg') {
          const top = bestSet(sessions);
          return `<div class="stat"><b>${fmtVal(top.set.w, 'kg')} × ${top.set.r}</b><span>${m.label}<br><small>${new Date(top.date).toLocaleDateString('de-DE')}</small></span></div>`;
        }
        const top = best(sessions, m.k);
        return `<div class="stat"><b>${fmtVal(top.y, m.unit)}</b><span>${m.label}<br><small>${new Date(top.x).toLocaleDateString('de-DE')}</small></span></div>`;
      }).join('')}
      <div class="stat"><b>${sessions.length}</b><span>Trainings<br><small>seit ${new Date(sessions[0].date).toLocaleDateString('de-DE')}</small></span></div>
    </div>

    <div class="section-label">Verlauf</div>
    ${[...sessions].reverse().map(s => `
      <div class="card">
        <p class="row-sub">${dateLong(s.date)}</p>
        <p>${s.sets.map((set, j) => `<span class="set-pill${set.pr ? ' pr' : ''}">${set.pr ? '🏆' : j + 1 + '.'} ${fmtSet(set, ex.log)}</span>`).join(' ')}</p>
      </div>`).join('')}`;

  function drawChart() {
    const all = series(sessions, metric.k);
    const pts = all.filter(p => inRange(p.x, range));
    const lastV = all[all.length - 1].y;
    const diff = pts.length > 1 ? lastV - pts[0].y : 0;
    const rangeLabel = RANGES.find(r => r.k === range).label;
    el.querySelector('.chart-head').innerHTML = `
      <span class="chart-value">${fmtVal(lastV, metric.unit)}</span>
      ${pts.length > 1 ? `<span class="trend ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}">${diff > 0 ? '▲ +' : diff < 0 ? '▼ ' : '± '}${fmtVal(diff, metric.unit)}${range === 'all' ? '' : ' in ' + rangeLabel}</span>` : ''}
      <span class="row-sub">${metric.hint || metric.label}</span>`;
    el.querySelector('.chart-box').innerHTML = pts.length > 1
      ? lineChart(pts, { unit: metric.unit })
      : all.length < 2
        ? `<p class="row-sub chart-note">Nach dem nächsten Training siehst du hier deine Entwicklung.</p>`
        : tooFew;
    el.querySelectorAll('.metric-chips .chip').forEach(c => c.classList.toggle('active', c.dataset.k === metric.k));
    el.querySelectorAll('.range .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.r === range));
  }

  el.querySelector('.metric-chips')?.addEventListener('click', e => {
    const k = e.target.closest('[data-k]')?.dataset.k;
    if (k) { metric = metrics.find(m => m.k === k); drawChart(); }
  });
  el.querySelector('.range').addEventListener('click', e => {
    const r = e.target.closest('[data-r]')?.dataset.r;
    if (r) { range = r; drawChart(); }
  });
  drawChart();
}
