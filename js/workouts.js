// Gymlog – Trainings: laufendes Training, gespeicherte Trainings, Auswertungen.
//
// Datenmodell eines Trainings:
// { id, name, start, end?, exercises: [ { exId, sets: [ { w?, r?, s?, min?, km?, done? } ] } ] }
//   w = Gewicht (kg), r = Wiederholungen, s = Sekunden, min/km = Cardio
//
// Das laufende Training liegt in den Einstellungen ('activeWorkout'). So überlebt es,
// wenn iOS die App im Hintergrund beendet.
import { getAll, put, remove, getSetting, setSetting, uid } from './db.js';
import { esc } from './ui.js';

export const getActive = () => getSetting('activeWorkout', null);
export const saveActive = (w) => setSetting('activeWorkout', w);
export const discardActive = () => setSetting('activeWorkout', null);

export async function startWorkout({ name, exercises = [], planId, dayId } = {}) {
  const weekday = new Date().toLocaleDateString('de-DE', { weekday: 'long' });
  const w = { id: uid(), name: name || `${weekday}straining`, start: Date.now(), exercises };
  if (planId) Object.assign(w, { planId, dayId }); // merkt sich, aus welchem Plan-Tag es stammt
  await saveActive(w);
  return w;
}

/** Speichert nur abgehakte Sätze; Übungen ohne erledigte Sätze fallen weg. */
export async function finishWorkout(w) {
  const exercises = w.exercises
    // target (Plan-Ziel) bleibt erhalten: der Trainer braucht es für Steigerungs-Tipps
    .map(x => ({ exId: x.exId, ...(x.target && { target: x.target }), sets: x.sets.filter(s => s.done).map(({ done, ...s }) => s) }))
    .filter(x => x.sets.length);
  const saved = { ...w, exercises, end: Date.now() };
  await put('workouts', saved);
  await discardActive();
  return saved;
}

export async function getWorkouts() {
  return (await getAll('workouts')).sort((a, b) => b.start - a.start);
}

export const deleteWorkout = (id) => remove('workouts', id);

/** Sätze der Übung aus dem letzten Training, in dem sie vorkam. */
export function lastSetsFrom(workouts, exId) {
  for (const w of workouts) {
    const x = w.exercises.find(e => e.exId === exId);
    if (x) return x.sets;
  }
  return [];
}

/** Alle bisher gespeicherten Sätze einer Übung (über alle Trainings). */
export function allSetsFrom(workouts, exId) {
  return workouts.flatMap(w => w.exercises.filter(x => x.exId === exId).flatMap(x => x.sets));
}

// ===== Rekorde =====
const maxOf = (arr) => arr.length ? Math.max(...arr) : -Infinity;

/**
 * Prüft, ob ein Satz ein neuer Rekord ist, verglichen mit allen früheren Sätzen.
 * Gibt eine Beschreibung zurück (z. B. „Höchstgewicht“) oder null.
 * Beim allerersten Mal gibt es keinen Rekord, sonst wäre jeder Satz einer.
 */
export function recordType(set, prior, log) {
  if (!prior.length) return null;
  switch (log) {
    // Gewicht: neues Höchstgewicht, oder mehr Wdh als je zuvor bei gleichem/höherem Gewicht
    case 'kg': {
      if (set.w > maxOf(prior.map(p => p.w || 0))) return 'Höchstgewicht';
      const sameOrHeavier = prior.filter(p => (p.w || 0) >= set.w);
      return set.r > maxOf(sameOrHeavier.map(p => p.r || 0)) ? `Wdh-Rekord bei ${num(set.w)} kg` : null;
    }
    case 'bw': {
      if ((set.w || 0) > maxOf(prior.map(p => p.w || 0))) return 'Zusatzgewicht';
      const sameOrHeavier = prior.filter(p => (p.w || 0) >= (set.w || 0));
      return set.r > maxOf(sameOrHeavier.map(p => p.r || 0)) ? 'Wiederholungen' : null;
    }
    case 'time':
      return set.s > maxOf(prior.map(p => p.s || 0)) ? 'Längste Zeit' : null;
    case 'cardio':
      return set.km > maxOf(prior.map(p => p.km || 0)) ? 'Weiteste Distanz' : null;
  }
  return null;
}

// ===== Auswertungen =====
export const setCount = (w) => w.exercises.reduce((n, x) => n + x.sets.length, 0);
export const volume = (w) => w.exercises.reduce((v, x) =>
  v + x.sets.reduce((s, set) => s + (set.w || 0) * (set.r || 0), 0), 0);

export function startOfWeek(d = new Date()) {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); // Montag
  return m.getTime();
}

export function weekStats(workouts) {
  const from = startOfWeek();
  const week = workouts.filter(w => w.start >= from);
  return {
    count: week.length,
    sets: week.reduce((n, w) => n + setCount(w), 0),
    volume: week.reduce((v, w) => v + volume(w), 0)
  };
}

// ===== Formatierung =====
export const num = (n) => (n == null || n === '') ? '' : String(n).replace('.', ',');

/** Kurzform eines Satzes, z. B. „60 × 10“, „+10 × 8“, „45 s“, „20 min · 3,5 km“. */
// Ergebnis landet in innerHTML → escapen (Werte können aus einem importierten Backup stammen)
export const fmtSet = (s, log) => esc(fmtSetRaw(s, log));
function fmtSetRaw(s, log) {
  switch (log) {
    case 'bw': return (s.w ? `+${num(s.w)} kg × ` : '') + `${s.r ?? '–'}`;
    case 'time': return `${s.s ?? '–'} s`;
    case 'cardio': return `${num(s.min) || '–'} min` + (s.km ? ` · ${num(s.km)} km` : '');
    default: return `${num(s.w) || '–'} × ${s.r ?? '–'}`;
  }
}
