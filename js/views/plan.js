// Gymlog – Trainingspläne: Übersicht (#plan) und Editor (#plan/<id>).
import {
  getPlans, getPlan, savePlan, deletePlan, createPlan, newDay, newPlanExercise,
  getActivePlanId, setActivePlan, nextDay, startFromPlan, fmtTarget
} from '../plans.js';
import { getWorkouts, getActive } from '../workouts.js';
import { getAllExercises } from '../exercises.js';
import { mountExerciseBrowser } from './exercises.js';
import { TEMPLATES } from '../templates.js';
import { openSheet, esc, toast, ask, promptText } from '../ui.js';

export const title = 'Plan';

const DAY_NAMES = ['Push', 'Pull', 'Beine', 'Oberkörper', 'Unterkörper', 'Ganzkörper', 'Tag A', 'Tag B', 'Tag C'];
const PLAN_NAMES = ['Push · Pull · Beine', 'Oberkörper / Unterkörper', 'Ganzkörper', 'Mein Plan'];

export async function render(el, param) {
  return param ? renderEditor(el, param) : renderList(el);
}

/** Startet einen Plan-Tag, warnt aber, wenn schon ein Training läuft. */
async function startDay(plan, day) {
  if (!day.exercises.length) { toast('Dieser Tag hat noch keine Übungen'); return; }
  if (await getActive()) {
    const yes = await ask({ title: 'Es läuft schon ein Training', text: 'Zum laufenden Training wechseln?', ok: 'Zum Training' });
    if (yes) location.hash = '#aktiv';
    return;
  }
  await startFromPlan(plan, day);
  location.hash = '#aktiv';
}

// ================= Übersicht =================
async function renderList(el) {
  const [plans, activeId, workouts] = await Promise.all([getPlans(), getActivePlanId(), getWorkouts()]);
  const active = plans.find(p => p.id === activeId);
  const next = active && nextDay(active, workouts);

  el.innerHTML = `
    <p class="subtitle">Deine Trainingspläne</p>
    ${next ? `
      <div class="card next-card">
        <span class="row-sub">Als Nächstes in „${esc(active.name)}“</span>
        <h2>${esc(next.name)}</h2>
        <p>${next.exercises.length} ${next.exercises.length === 1 ? 'Übung' : 'Übungen'}</p>
        <button class="btn start-next">▶ ${esc(next.name)} starten</button>
      </div>` : ''}
    ${plans.length ? `<div class="group">${plans.map(p => `
      <a class="row" href="#plan/${p.id}">
        <span class="row-main">
          <span class="row-title">${esc(p.name)}${p.id === activeId ? ' <span class="badge">Aktiv</span>' : ''}</span>
          <span class="row-sub">${p.days.length} ${p.days.length === 1 ? 'Tag' : 'Tage'} · ${p.days.map(d => esc(d.name)).join(' · ')}</span>
        </span>
        <span class="chev" aria-hidden="true">›</span>
      </a>`).join('')}</div>`
    : `<div class="card empty"><div class="big">📋</div>Noch kein Plan. Leg deinen ersten an – oder lass dir später vom Trainer einen erstellen.</div>`}
    <button class="btn ${plans.length ? 'secondary' : ''} from-template">📋 Aus Vorlage wählen</button>
    <button class="btn secondary new-plan">＋ Leerer Plan</button>`;

  el.querySelector('.start-next')?.addEventListener('click', () => startDay(active, next));
  el.querySelector('.from-template').addEventListener('click', templatePicker);
  el.querySelector('.new-plan').addEventListener('click', async () => {
    const name = await promptText({ title: 'Neuer Plan', placeholder: 'Name des Plans', ok: 'Anlegen', suggestions: PLAN_NAMES });
    if (!name) return;
    const plan = await createPlan(name);
    location.hash = `#plan/${plan.id}`;
  });
}

// ================= Vorlagen =================
async function templatePicker() {
  const exMap = Object.fromEntries((await getAllExercises()).map(e => [e.id, e]));
  const { el, close } = openSheet(`
    <h2 class="sheet-title">Vorlage wählen</h2>
    <p class="subtitle">Bewährte Pläne zum Übernehmen. Danach kannst du alles anpassen.</p>
    ${TEMPLATES.map(t => `
      <button class="card tpl" data-t="${t.id}">
        <span class="row-title">${esc(t.name)}</span>
        <span class="tpl-tags"><span class="badge">${t.level}</span> <span class="badge">${t.perWeek}</span></span>
        <span class="row-sub">${esc(t.text)}</span>
      </button>`).join('')}
    <button class="btn plain" data-close>Abbrechen</button>`);

  el.addEventListener('click', e => {
    const t = TEMPLATES.find(x => x.id === e.target.closest('[data-t]')?.dataset.t);
    if (!t) return;
    close();
    templateDetails(t, exMap);
  });
}

function templateDetails(t, exMap) {
  const { el, close } = openSheet(`
    <h2 class="sheet-title">${esc(t.name)}</h2>
    <p class="subtitle">${t.goal} · ${t.perWeek} · ${t.level}</p>
    ${t.days.map(d => `
      <div class="card">
        <h2>${esc(d.name)}</h2>
        ${d.exercises.map(x => `
          <div class="tpl-ex"><span>${esc(exMap[x.exId]?.name || x.exId)}</span><span class="target">${fmtTarget(x, exMap[x.exId]?.log)}</span></div>`).join('')}
      </div>`).join('')}
    <button class="btn take">Plan übernehmen</button>
    <button class="btn plain" data-close>Zurück</button>`);

  el.querySelector('.take').addEventListener('click', async () => {
    const plan = await createPlan(t.name, t.days);
    close();
    toast(`✓ „${t.name}“ übernommen`);
    location.hash = `#plan/${plan.id}`;
  });
}

// ================= Editor =================
async function renderEditor(host, id) {
  // Eigenes Wurzelelement: #view bleibt bestehen, ein Listener darauf würde sich sonst bei jedem Öffnen stapeln
  const el = document.createElement('div');
  host.append(el);
  const plan = await getPlan(id);
  if (!plan) { location.hash = '#plan'; return; }
  const [exercises, activeId] = await Promise.all([getAllExercises(), getActivePlanId()]);
  const exMap = Object.fromEntries(exercises.map(e => [e.id, e]));
  let isActive = activeId === plan.id;
  const save = () => savePlan(plan);

  function draw() {
    document.getElementById('view-title').textContent = plan.name;
    el.innerHTML = `
      <a class="back" href="#plan">‹ Pläne</a>
      <div class="plan-actions">
        <button class="btn small secondary rename-plan">✎ Umbenennen</button>
        ${isActive ? `<span class="badge big-badge">✓ Aktiver Plan</span>`
                   : `<button class="btn small make-active">Als aktiven Plan setzen</button>`}
      </div>

      ${plan.days.map((d, di) => `
        <div class="card day" data-di="${di}">
          <div class="day-head">
            <h2>${esc(d.name)}</h2>
            <button class="icon-btn day-menu" aria-label="Optionen für ${esc(d.name)}">⋯</button>
          </div>
          ${d.exercises.length ? `<div class="day-list">${d.exercises.map((e, ei) => `
            <button class="day-ex" data-ei="${ei}">
              <span class="row-main">
                <span class="row-title">${esc(exMap[e.exId]?.name || 'Gelöschte Übung')}</span>
                <span class="row-sub">${exMap[e.exId]?.muscle || ''}</span>
              </span>
              <span class="target">${fmtTarget(e, exMap[e.exId]?.log)}</span>
            </button>`).join('')}</div>`
          : `<p class="row-sub day-empty">Noch keine Übungen</p>`}
          <div class="day-foot">
            <button class="link add-ex">＋ Übung</button>
            ${d.exercises.length ? `<button class="btn small start-day">▶ Starten</button>` : ''}
          </div>
        </div>`).join('')}

      <button class="btn secondary add-day">＋ Trainingstag hinzufügen</button>
      <button class="btn plain danger-text del-plan">Plan löschen</button>`;
  }

  // ---------- Plan-Aktionen ----------
  el.addEventListener('click', async e => {
    const t = e.target;
    if (t.closest('.rename-plan')) {
      const name = await promptText({ title: 'Plan umbenennen', value: plan.name, suggestions: PLAN_NAMES });
      if (name) { plan.name = name; await save(); draw(); }
      return;
    }
    if (t.closest('.make-active')) {
      await setActivePlan(plan.id); isActive = true; draw(); toast('✓ Aktiver Plan');
      return;
    }
    if (t.closest('.add-day')) {
      const name = await promptText({ title: 'Neuer Trainingstag', suggestions: DAY_NAMES, ok: 'Hinzufügen',
        placeholder: 'z. B. Push' });
      if (name) { plan.days.push(newDay(name)); await save(); draw(); }
      return;
    }
    if (t.closest('.del-plan')) {
      if (await ask({ title: 'Plan löschen?', text: `„${plan.name}“ wird gelöscht. Deine gespeicherten Trainings bleiben erhalten.`, ok: 'Löschen', danger: true })) {
        await deletePlan(plan.id);
        location.hash = '#plan';
      }
      return;
    }

    // ---------- Tag-Aktionen ----------
    const dayEl = t.closest('.day');
    if (!dayEl) return;
    const di = +dayEl.dataset.di;
    const day = plan.days[di];

    if (t.closest('.start-day')) return startDay(plan, day);
    if (t.closest('.day-menu')) return dayMenu(di);
    if (t.closest('.add-ex')) return addExercises(day);
    const exBtn = t.closest('.day-ex');
    if (exBtn) return editExercise(day, +exBtn.dataset.ei);
  });

  function dayMenu(di) {
    const day = plan.days[di];
    const { el: sheet, close } = openSheet(`
      <h2 class="sheet-title">${esc(day.name)}</h2>
      <button class="btn secondary" data-a="rename">✎ Umbenennen</button>
      <button class="btn secondary" data-a="up" ${di === 0 ? 'disabled' : ''}>↑ Nach oben</button>
      <button class="btn secondary" data-a="copy">⧉ Duplizieren</button>
      <button class="btn danger" data-a="delete">Tag löschen</button>
      <button class="btn plain" data-close>Abbrechen</button>`);
    sheet.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (!a) return;
      close();
      if (a === 'rename') {
        const name = await promptText({ title: 'Tag umbenennen', value: day.name, suggestions: DAY_NAMES });
        if (!name) return;
        day.name = name;
      }
      if (a === 'up') plan.days.splice(di - 1, 0, plan.days.splice(di, 1)[0]);
      if (a === 'copy') plan.days.splice(di + 1, 0, { ...newDay(day.name + ' (Kopie)'), exercises: day.exercises.map(x => ({ ...x })) });
      if (a === 'delete') {
        if (!await ask({ title: `„${day.name}“ löschen?`, ok: 'Löschen', danger: true })) return;
        plan.days.splice(di, 1);
      }
      await save(); draw();
    });
  }

  async function addExercises(day) {
    const { el: sheet } = openSheet(`
      <div class="sheet-bar"><h2 class="sheet-title">Zu „${esc(day.name)}“ hinzufügen</h2><button class="btn small" data-close>Fertig</button></div>
      <div class="picker"></div>`, { onClose: draw });
    await mountExerciseBrowser(sheet.querySelector('.picker'), {
      onSelect: async ex => {
        day.exercises.push(newPlanExercise(ex));
        await save();
        toast(`✓ ${ex.name} hinzugefügt`);
      }
    });
  }

  function editExercise(day, ei) {
    const pe = day.exercises[ei];
    const ex = exMap[pe.exId] || { name: 'Gelöschte Übung', log: 'kg' };
    const repsLabel = ex.log === 'time' ? 'Sekunden' : ex.log === 'cardio' ? 'Minuten' : 'Wiederholungen';
    const { el: sheet, close } = openSheet(`
      <h2 class="sheet-title">${esc(ex.name)}</h2>
      <div class="card steppers">
        ${stepper('sets', 'Sätze', pe.sets, 1, 10)}
        ${stepper('repsMin', `${repsLabel} von`, pe.repsMin, 1, 300)}
        ${stepper('repsMax', `${repsLabel} bis`, pe.repsMax, 1, 300)}
      </div>
      <div class="quick-names presets">
        ${(ex.log === 'time'
          ? [['2,20,30', 'Kurz 2 × 20–30 s'], ['2,30,45', 'Normal 2 × 30–45 s'], ['3,45,60', 'Lang 3 × 45–60 s']]
          : [['5,3,5', 'Kraft 5 × 3–5'], ['3,8,12', 'Aufbau 3 × 8–12'], ['3,12,15', 'Ausdauer 3 × 12–15']]
        ).map(([p, label]) => `<button class="chip" data-p="${p}">${label}</button>`).join('')}
      </div>
      <button class="btn" data-close>Fertig</button>
      <button class="btn secondary" data-a="up" ${ei === 0 ? 'disabled' : ''}>↑ Nach oben</button>
      <button class="btn danger" data-a="remove">Aus dem Tag entfernen</button>`, { onClose: () => { save(); draw(); } });

    const refresh = () => {
      for (const k of ['sets', 'repsMin', 'repsMax']) sheet.querySelector(`[data-v="${k}"]`).textContent = pe[k];
    };
    sheet.addEventListener('click', e => {
      const step = e.target.closest('[data-step]');
      if (step) {
        const [k, d, lo, hi] = step.dataset.step.split(',');
        pe[k] = Math.min(+hi, Math.max(+lo, pe[k] + +d));
        // „von“ darf nie größer als „bis“ sein
        if (k === 'repsMin' && pe.repsMin > pe.repsMax) pe.repsMax = pe.repsMin;
        if (k === 'repsMax' && pe.repsMax < pe.repsMin) pe.repsMin = pe.repsMax;
        refresh();
        return;
      }
      const p = e.target.closest('[data-p]')?.dataset.p;
      if (p) { [pe.sets, pe.repsMin, pe.repsMax] = p.split(',').map(Number); refresh(); return; }
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'up') { day.exercises.splice(ei - 1, 0, day.exercises.splice(ei, 1)[0]); close(); }
      if (a === 'remove') { day.exercises.splice(ei, 1); close(); }
    });
  }

  draw();
}

const stepper = (k, label, v, lo, hi) => `
  <div class="stepper">
    <span>${label}</span>
    <button class="icon-btn" data-step="${k},-1,${lo},${hi}" aria-label="${label} verringern">−</button>
    <b data-v="${k}">${v}</b>
    <button class="icon-btn" data-step="${k},1,${lo},${hi}" aria-label="${label} erhöhen">＋</button>
  </div>`;
