// Gymlog – Startseite: Training starten/fortsetzen, Wochenstatistik, letzte Trainings.
import { getActive, startWorkout, getWorkouts, weekStats, setCount, volume, fmtSet, deleteWorkout } from '../workouts.js';
import { getAllExercises } from '../exercises.js';
import { openSheet, esc, toast, ask } from '../ui.js';
import { streak, getWeeklyGoal } from '../progress.js';
import { getActivePlan, nextDay, startFromPlan } from '../plans.js';
import { getSetting, setSetting } from '../db.js';

const DAY = 864e5;
/** Erinnerung, wenn ≥3 Trainings existieren und das letzte Backup ≥14 Tage alt ist (oder fehlt). */
async function needsBackupReminder(workouts) {
  if (workouts.length < 3) return false;
  const [last, snooze] = await Promise.all([getSetting('lastBackup', null), getSetting('backupSnooze', 0)]);
  if (Date.now() < snooze) return false;
  return !last || Date.now() - last >= 14 * DAY;
}

export const title = 'Training';

const kg = (v) => v >= 1000 ? (v / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' t' : Math.round(v) + ' kg';
const minutes = (w) => Math.max(1, Math.round(((w.end || Date.now()) - w.start) / 60000));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const dateLabel =(t) => new Date(t).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });

export async function render(el) {
  const [active, workouts, exercises, goal, plan] =
    await Promise.all([getActive(), getWorkouts(), getAllExercises(), getWeeklyGoal(), getActivePlan()]);
  const next = !active && plan ? nextDay(plan, workouts) : null;
  const remind = !active && await needsBackupReminder(workouts);
  const exMap = Object.fromEntries(exercises.map(e => [e.id, e]));
  const st = weekStats(workouts);
  const sk = streak(workouts, goal);

  el.innerHTML = `
    <p class="subtitle">${new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    ${active ? `
      <a class="card live" href="#aktiv">
        <span class="live-dot"></span>
        <span class="row-main">
          <span class="row-title">${esc(active.name)} läuft</span>
          <span class="row-sub">${minutes(active)} min · ${plural(active.exercises.length, 'Übung', 'Übungen')}</span>
        </span>
        <span class="btn small">Fortsetzen</span>
      </a>` : next && next.exercises.length ? `
      <div class="card next-card">
        <span class="row-sub">Als Nächstes in „${esc(plan.name)}“ · <a href="#plan/${plan.id}">anderer Tag</a></span>
        <h2>${esc(next.name)}</h2>
        <p>${next.exercises.map(e => esc(exMap[e.exId]?.name || '')).filter(Boolean).slice(0, 4).join(' · ')}${next.exercises.length > 4 ? ' …' : ''}</p>
        <button class="btn start-plan">▶ ${esc(next.name)} starten</button>
      </div>
      <button class="btn plain start">＋ Freies Training starten</button>`
    : `<button class="btn start">＋ Training starten</button>`}

    ${remind ? `
      <div class="card notice backup-reminder">
        <span class="big-ico" aria-hidden="true">💾</span>
        <div class="row-main">
          <span class="row-title">Zeit für ein Backup</span>
          <span class="row-sub">Deine ${workouts.length} Trainings liegen nur auf diesem Gerät. Sichere sie in „Dateien“ oder iCloud.</span>
          <div class="notice-actions">
            <a class="btn small" href="#mehr">Jetzt sichern</a>
            <button class="btn small secondary snooze">Später</button>
          </div>
        </div>
      </div>` : ''}

    <div class="section-label">Diese Woche</div>
    <div class="stats">
      <div class="stat"><b>${st.count}</b><span>Trainings</span></div>
      <div class="stat"><b>${st.sets}</b><span>Sätze</span></div>
      <div class="stat"><b>${kg(st.volume)}</b><span>Volumen</span></div>
    </div>
    <a class="card streak-mini" href="#fortschritt">
      <span class="flame" aria-hidden="true">🔥</span>
      <span class="row-main">
        <span class="row-title">${sk.weeks ? `${plural(sk.weeks, 'Woche', 'Wochen')} in Folge` : 'Starte deine Serie'}</span>
        <span class="row-sub">${sk.thisWeek} von ${goal} Trainings diese Woche${sk.thisWeek >= goal ? ' – Ziel erreicht! ✓' : ''}</span>
      </span>
      <span class="week-dots">${Array.from({ length: goal }, (_, i) => `<span class="dot${i < sk.thisWeek ? ' on' : ''}"></span>`).join('')}</span>
    </a>

    <div class="section-label">Letzte Trainings</div>
    ${workouts.length ? `<div class="group">${workouts.slice(0, 10).map(w => `
      <button class="row" data-id="${w.id}">
        <span class="row-main">
          <span class="row-title">${esc(w.name)}</span>
          <span class="row-sub">${dateLabel(w.start)} · ${minutes(w)} min · ${plural(w.exercises.length, 'Übung', 'Übungen')} · ${plural(setCount(w), 'Satz', 'Sätze')}</span>
        </span>
        <span class="chev" aria-hidden="true">›</span>
      </button>`).join('')}</div>`
      : `<div class="card empty"><div class="big">🏋️</div>Noch keine Trainings. Starte dein erstes!</div>`}`;

  el.querySelector('.snooze')?.addEventListener('click', async () => {
    await setSetting('backupSnooze', Date.now() + 7 * DAY); // eine Woche Ruhe
    el.querySelector('.backup-reminder').remove();
  });
  el.querySelector('.start-plan')?.addEventListener('click', async () => {
    await startFromPlan(plan, next);
    location.hash = '#aktiv';
  });
  el.querySelector('.start')?.addEventListener('click', async () => {
    await startWorkout();
    location.hash = '#aktiv';
  });

  el.querySelector('.group')?.addEventListener('click', e => {
    const row = e.target.closest('.row');
    if (row) showWorkout(workouts.find(w => w.id === row.dataset.id), exMap, el);
  });
}

function showWorkout(w, exMap, el) {
  const { el: sheet, close } = openSheet(`
    <h2 class="sheet-title">${esc(w.name)}</h2>
    <p class="subtitle">${dateLabel(w.start)} · ${minutes(w)} min · ${kg(volume(w))} Volumen</p>
    ${w.exercises.map(x => {
      const ex = exMap[x.exId] || { name: 'Unbekannte Übung', log: 'kg' };
      return `<div class="card"><h2>${esc(ex.name)}</h2>
        <p>${x.sets.map((s, j) => `<span class="set-pill">${j + 1}. ${fmtSet(s, ex.log)}</span>`).join(' ')}</p></div>`;
    }).join('')}
    <button class="btn danger del">Training löschen</button>
    <button class="btn plain" data-close>Schließen</button>`);

  sheet.querySelector('.del').addEventListener('click', async () => {
    close();
    const yes = await ask({ title: 'Training löschen?', text: `„${w.name}“ wird endgültig gelöscht.`, ok: 'Löschen', danger: true });
    if (!yes) return;
    await deleteWorkout(w.id);
    toast('Training gelöscht');
    render(el);
  });
}
