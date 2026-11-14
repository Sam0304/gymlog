// Gymlog – Trainer: Fragebogen → Planvorschlag; danach Übersicht mit Steigerungs-Tipps,
// Umfang-Check und Tipps zum Ziel.
import { getSetting, setSetting } from '../db.js';
import { getWorkouts } from '../workouts.js';
import { getAllExercises } from '../exercises.js';
import { getActivePlan, createPlan, setActivePlan, fmtTarget } from '../plans.js';
import { setsPerMuscle, sessionsFor } from '../progress.js';
import { num } from '../workouts.js';
import {
  GOALS, LEVELS, EQUIPMENT, FOCUS, GOAL_TIPS,
  buildPlan, progressionAdvice, lastSession, volumeHints, plateau, alternativeFor
} from '../coach-rules.js';
import { esc, toast } from '../ui.js';

export const title = 'Trainer';

const STEPS = [
  { key: 'goal', q: 'Was ist dein Hauptziel?', options: [
    ['aufbau', 'Muskelaufbau', 'Sichtbar mehr Muskeln'],
    ['kraft', 'Kraft', 'Schwerere Gewichte bewegen'],
    ['abnehmen', 'Abnehmen & Definition', 'Fett verlieren, Muskeln halten'],
    ['fitness', 'Fitness & Gesundheit', 'Fit, beweglich, belastbar']] },
  { key: 'level', q: 'Wie lange trainierst du schon?', options: [
    ['einsteiger', 'Einsteiger', 'Weniger als 6 Monate'],
    ['fortgeschritten', 'Fortgeschritten', '6 Monate bis 2 Jahre'],
    ['erfahren', 'Erfahren', 'Mehr als 2 Jahre']] },
  { key: 'days', q: 'Wie oft pro Woche willst du trainieren?', options: [
    [2, '2×', ''], [3, '3×', ''], [4, '4×', ''], [5, '5×', ''], [6, '6×', '']], compact: true },
  { key: 'minutes', q: 'Wie viel Zeit hast du pro Training?', options: [
    [30, '30 min', ''], [45, '45 min', ''], [60, '60 min', ''], [90, '90 min', '']], compact: true },
  { key: 'equipment', q: 'Wo trainierst du?', options: [
    ['studio', 'Fitnessstudio', 'Hanteln, Kabelzug, Maschinen'],
    ['kurzhantel', 'Zuhause mit Kurzhanteln', 'Kurzhanteln und eine Bank'],
    ['koerper', 'Nur Körpergewicht', 'Ohne Geräte']] },
  { key: 'focus', q: 'Gibt es Muskelgruppen, die du besonders stärken willst?', multi: true,
    options: FOCUS.map(f => [f, f, '']) }
];

export async function render(host, param) {
  // Eigenes Wurzelelement, damit sich Listener auf #view nicht stapeln
  const el = document.createElement('div');
  host.append(el);
  const profile = await getSetting('coachProfile', null);
  if (param === 'fragen') return questionnaire(el, profile);
  if (!profile) return intro(el);
  if (param === 'vorschlag') return proposal(el, profile);
  return dashboard(el, profile);
}

// ================= Einstieg =================
function intro(el) {
  el.innerHTML = `
    <p class="subtitle">Dein persönlicher Coach</p>
    <div class="card coach-hero">
      <div class="big">🧑‍🏫</div>
      <h2>Hi! Ich erstelle dir einen Plan.</h2>
      <p>Beantworte 6 kurze Fragen zu Ziel, Erfahrung und Zeit. Danach schlage ich dir einen passenden Plan vor und sage dir nach jedem Training, wann du steigern solltest.</p>
    </div>
    <a class="btn" href="#trainer/fragen">Los geht's</a>`;
}

// ================= Fragebogen =================
function questionnaire(el, old) {
  const a = { focus: [], ...(old || {}) };
  let i = 0;

  function draw() {
    const s = STEPS[i];
    const chosen = (v) => s.multi ? a.focus.includes(v) : a[s.key] === v;
    el.innerHTML = `
      <div class="q-progress"><span style="width:${((i + 1) / STEPS.length * 100).toFixed(0)}%"></span></div>
      <p class="row-sub">Frage ${i + 1} von ${STEPS.length}</p>
      <h2 class="q-title">${s.q}</h2>
      ${s.multi ? '<p class="row-sub">Optional – mehrere möglich.</p>' : ''}
      <div class="q-options${s.compact ? ' compact' : ''}">
        ${s.options.map(([v, label, desc]) => `
          <button class="q-opt${chosen(v) ? ' on' : ''}" data-v="${v}">
            <span class="row-title">${label}</span>${desc ? `<span class="row-sub">${desc}</span>` : ''}
          </button>`).join('')}
      </div>
      ${s.multi ? `<button class="btn q-next">${a.focus.length ? 'Weiter' : 'Kein Schwerpunkt – weiter'}</button>` : ''}
      ${i > 0 ? '<button class="btn plain q-back">‹ Zurück</button>' : ''}`;
  }

  el.addEventListener('click', async e => {
    const s = STEPS[i];
    if (e.target.closest('.q-back')) { i--; draw(); return; }
    const opt = e.target.closest('.q-opt');
    if (opt) {
      const raw = opt.dataset.v;
      const v = typeof s.options[0][0] === 'number' ? +raw : raw;
      if (s.multi) {
        a.focus = a.focus.includes(v) ? a.focus.filter(x => x !== v) : [...a.focus, v];
        draw();
        return;
      }
      a[s.key] = v;
    } else if (!e.target.closest('.q-next')) return;

    if (i < STEPS.length - 1) { i++; draw(); window.scrollTo(0, 0); return; }
    await setSetting('coachProfile', a);
    location.hash = '#trainer/vorschlag';
  });

  draw();
}

// ================= Planvorschlag =================
async function proposal(el, profile) {
  const exMap = Object.fromEntries((await getAllExercises()).map(e => [e.id, e]));
  const plan = buildPlan(profile);

  el.innerHTML = `
    <a class="back" href="#trainer">‹ Trainer</a>
    <p class="subtitle">Mein Vorschlag für dich</p>
    <div class="card">
      <h2>${esc(plan.name)}</h2>
      <p>${plan.days.length} Trainingstage im Wechsel · ${profile.days}× pro Woche</p>
    </div>
    <div class="section-label">Warum dieser Plan?</div>
    <div class="card reasons">${plan.reasons.map(r => `<p>• ${esc(r)}</p>`).join('')}</div>
    ${plan.days.map(d => `
      <div class="card">
        <h2>${esc(d.name)}</h2>
        ${d.exercises.map(x => `
          <div class="tpl-ex"><span>${esc(exMap[x.exId]?.name || x.exId)}</span>
          <span class="target">${fmtTarget(x, exMap[x.exId]?.log)}</span></div>`).join('')}
      </div>`).join('')}
    <button class="btn take">Plan übernehmen & aktivieren</button>
    <a class="btn plain" href="#trainer/fragen">Antworten ändern</a>`;

  el.querySelector('.take').addEventListener('click', async () => {
    const created = await createPlan(plan.name, plan.days);
    await setActivePlan(created.id); // explizit: es kann schon ein anderer Plan aktiv sein
    toast('✓ Plan übernommen und aktiviert');
    location.hash = `#plan/${created.id}`;
  });
}

// ================= Übersicht =================
async function dashboard(el, profile) {
  const [workouts, exercises, plan] = await Promise.all([getWorkouts(), getAllExercises(), getActivePlan()]);
  const exMap = Object.fromEntries(exercises.map(e => [e.id, e]));
  const goal = GOALS[profile.goal];

  // Steigerungs-Tipps für alle Übungen des aktiven Plans
  const advice = [];
  const planMuscles = new Set();
  for (const d of plan?.days || []) for (const pe of d.exercises) {
    const ex = exMap[pe.exId];
    if (!ex) continue;
    planMuscles.add(ex.muscle);
    if (advice.some(a => a.ex.id === ex.id)) continue;
    const last = lastSession(workouts, ex.id, pe);
    const tip = last && progressionAdvice(last.sets, last.target, ex);
    if (tip) advice.push({ ex, tip });
  }
  // Stillstand: Übungen mit Gewicht, bei denen 3 Trainings lang kein Bestwert übertroffen wurde
  const stuck = [];
  for (const id of new Set((plan?.days || []).flatMap(d => d.exercises.map(e => e.exId)))) {
    const ex = exMap[id];
    if (ex?.log !== 'kg') continue;
    const p = plateau(sessionsFor(workouts, id));
    if (!p) continue;
    const deload = Math.round(p.best.w * 0.9 / 2.5) * 2.5;
    stuck.push({ ex, best: p.best, deload, alt: alternativeFor(ex, exercises) });
  }

  const recent = workouts.some(w => w.start > Date.now() - 7 * 864e5);
  const hints = recent ? volumeHints(planMuscles, setsPerMuscle(workouts, exMap, 7)) : [];
  const icon = { up: '⬆️', keep: '➡️', down: '⬇️' };

  el.innerHTML = `
    <p class="subtitle">Dein persönlicher Coach</p>
    <div class="card">
      <span class="row-sub">Dein Profil</span>
      <h2>${goal.label}</h2>
      <div class="tpl-tags wrap">
        <span class="badge">${LEVELS[profile.level]}</span>
        <span class="badge">${profile.days}× pro Woche</span>
        <span class="badge">${profile.minutes} min</span>
        <span class="badge">${EQUIPMENT[profile.equipment]}</span>
        ${profile.focus.map(f => `<span class="badge">★ ${f}</span>`).join('')}
      </div>
      <p class="top-gap">⏱ Pausentimer: ${goal.rest}</p>
      <div class="plan-actions top-gap">
        <a class="btn small" href="#trainer/vorschlag">Plan vorschlagen</a>
        <a class="btn small secondary" href="#trainer/fragen">Ziele ändern</a>
      </div>
    </div>

    <div class="section-label">Nächste Steigerungen</div>
    ${advice.length ? `<div class="group">${advice.map(({ ex, tip }) => `
      <div class="row advice ${tip.kind}">
        <span class="adv-icon" aria-hidden="true">${icon[tip.kind]}</span>
        <span class="row-main"><span class="row-title">${esc(ex.name)}</span><span class="row-sub">${esc(tip.text)}</span></span>
      </div>`).join('')}</div>`
    : `<div class="card empty">${plan
        ? 'Sobald du Trainings aus deinem Plan absolvierst, sage ich dir hier, wann du steigern solltest.'
        : 'Aktiviere einen Plan (oder lass mich einen vorschlagen), dann bekommst du hier Steigerungs-Tipps.'}</div>`}

    ${stuck.length ? `
      <div class="section-label">Stillstand erkannt</div>
      ${stuck.map(s => `
        <div class="card stuck">
          <h2>⚠️ ${esc(s.ex.name)}</h2>
          <p>Seit 3 Trainings kein Fortschritt über deinen Bestwert ${num(s.best.w)} kg × ${s.best.r} hinaus.</p>
          <p class="stuck-tip"><b>Option 1 – Entlastung:</b> eine Woche mit ca. ${String(s.deload).replace('.', ',')} kg (−10 %) trainieren, danach wieder angreifen.</p>
          ${s.alt ? `<p class="stuck-tip"><b>Option 2 – Wechsel:</b> für 4–6 Wochen ${esc(s.alt.name)} statt ${esc(s.ex.name)}.</p>` : ''}
        </div>`).join('')}` : ''}

    ${hints.length ? `
      <div class="section-label">Umfang der letzten 7 Tage</div>
      <div class="card">
        <p>Diese Muskelgruppen aus deinem Plan liegen unter 10 Sätzen pro Woche:</p>
        <div class="tpl-tags wrap top-gap">${hints.map(h => `<span class="badge">${h.muscle}: ${h.sets}</span>`).join('')}</div>
      </div>` : ''}

    <div class="section-label">Tipps für „${goal.label}“</div>
    <div class="card reasons">${GOAL_TIPS[profile.goal].map(t => `<p>💡 ${esc(t)}</p>`).join('')}</div>`;
}
