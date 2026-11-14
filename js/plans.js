// Gymlog – Trainingspläne.
//
// Datenmodell:
// { id, name, created, days: [ { id, name, exercises: [ { exId, sets, repsMin, repsMax } ] } ] }
// Der aktive Plan steht in den Einstellungen ('activePlan').
import { getAll, get, put, remove, uid, getSetting, setSetting } from './db.js';
import { startWorkout } from './workouts.js';

export async function getPlans() {
  return (await getAll('plans')).sort((a, b) => a.created - b.created);
}
export const getPlan = (id) => get('plans', id);
export const savePlan = (plan) => put('plans', plan);

export async function deletePlan(id) {
  await remove('plans', id);
  if (await getActivePlanId() === id) await setActivePlan(null);
}

export async function createPlan(name, days = [{ name: 'Tag A', exercises: [] }]) {
  const plan = {
    id: uid(), name, created: Date.now(),
    days: days.map(d => ({ id: uid(), name: d.name, exercises: d.exercises || [] }))
  };
  await savePlan(plan);
  // Der erste Plan wird automatisch aktiv
  if (!await getActivePlanId()) await setActivePlan(plan.id);
  return plan;
}

export const newDay = (name) => ({ id: uid(), name, exercises: [] });
/** Startziel je nach Erfassungsart: Kraft 3 × 8–12 Wdh, Zeit 2 × 30–45 s, Cardio 1 × 15–20 min. */
export function newPlanExercise(ex) {
  if (ex.log === 'time') return { exId: ex.id, sets: 2, repsMin: 30, repsMax: 45 };
  if (ex.log === 'cardio') return { exId: ex.id, sets: 1, repsMin: 15, repsMax: 20 };
  return { exId: ex.id, sets: 3, repsMin: 8, repsMax: 12 };
}

export const getActivePlanId = () => getSetting('activePlan', null);
export const setActivePlan = (id) => setSetting('activePlan', id);

export async function getActivePlan() {
  const id = await getActivePlanId();
  return id ? (await getPlan(id)) || null : null;
}

/** Nächster Tag im Plan: der nach dem zuletzt trainierten Tag (rotierend). */
export function nextDay(plan, workouts) {
  if (!plan?.days.length) return null;
  const last = workouts.find(w => w.planId === plan.id); // workouts sind neueste zuerst
  const idx = last ? plan.days.findIndex(d => d.id === last.dayId) : -1;
  return plan.days[(idx + 1) % plan.days.length];
}

/** Startet ein Training mit allen Übungen des Tages und den Zielen aus dem Plan. */
export function startFromPlan(plan, day) {
  return startWorkout({
    name: day.name,
    planId: plan.id,
    dayId: day.id,
    exercises: day.exercises.map(e => ({
      exId: e.exId,
      target: { sets: e.sets, repsMin: e.repsMin, repsMax: e.repsMax },
      sets: Array.from({ length: e.sets }, () => ({}))
    }))
  });
}

/** „3 × 8–12“ bzw. „3 × 10“; mit log zusätzlich die Einheit bei Zeit/Cardio („3 × 30–60 s“). */
export const fmtTarget = (t, log) =>
  `${t.sets} × ${t.repsMin === t.repsMax ? t.repsMin : `${t.repsMin}–${t.repsMax}`}` +
  (log === 'time' ? ' s' : log === 'cardio' ? ' min' : '');
