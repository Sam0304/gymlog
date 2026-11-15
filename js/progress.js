// Gymlog – Auswertungen für den Fortschritt: Kennzahlen pro Training, Rekorde, Streak.
import { startOfWeek } from './workouts.js';
import { getAll, put, remove, getSetting, setSetting } from './db.js';

const max = (a) => a.length ? Math.max(...a) : 0;
const sum = (a) => a.reduce((s, v) => s + v, 0);

/** Alle Trainingseinheiten einer Übung, älteste zuerst: [{ date, sets }]. */
export function sessionsFor(workouts, exId) {
  const out = [];
  for (const w of workouts) {
    const sets = w.exercises.filter(x => x.exId === exId).flatMap(x => x.sets);
    if (sets.length) out.push({ date: w.start, sets });
  }
  return out.sort((a, b) => a.date - b.date);
}

/** Kennzahlen einer Einheit (alle Sätze einer Übung an einem Tag). */
export function sessionMetrics(sets) {
  return {
    maxW: max(sets.map(s => s.w || 0)),
    volume: sum(sets.map(s => (s.w || 0) * (s.r || 0))),
    maxR: max(sets.map(s => s.r || 0)),
    reps: sum(sets.map(s => s.r || 0)),
    maxS: max(sets.map(s => s.s || 0)),
    km: sum(sets.map(s => s.km || 0)),
    min: sum(sets.map(s => s.min || 0))
  };
}

/** Welche Kennzahlen pro Erfassungsart sinnvoll sind. Die erste ist die Hauptkennzahl. */
export const METRICS = {
  kg: [
    { k: 'maxW', label: 'Höchstgewicht', unit: 'kg', hint: 'Schwerster Satz pro Training' },
    { k: 'volume', label: 'Volumen', unit: 'kg', hint: 'Gewicht × Wiederholungen, alle Sätze zusammen' }
  ],
  bw: [
    { k: 'maxR', label: 'Max. Wdh', unit: 'Wdh' },
    { k: 'reps', label: 'Wdh gesamt', unit: 'Wdh' },
    { k: 'maxW', label: 'Zusatzgewicht', unit: 'kg' }
  ],
  time: [{ k: 'maxS', label: 'Längste Zeit', unit: 's' }],
  cardio: [
    { k: 'km', label: 'Distanz', unit: 'km' },
    { k: 'min', label: 'Dauer', unit: 'min' }
  ]
};

export const series = (sessions, k) => sessions.map(s => ({ x: s.date, y: sessionMetrics(s.sets)[k] }));

/** Bestwert einer Kennzahl samt Datum. */
export function best(sessions, k) {
  let top = null;
  for (const p of series(sessions, k)) if (!top || p.y > top.y) top = p;
  return top;
}

/** Bester Satz (schwerstes Gewicht, bei Gleichstand meiste Wdh) samt Datum. */
export function bestSet(sessions) {
  let top = null;
  for (const s of sessions) for (const set of s.sets) {
    if (!top || (set.w || 0) > (top.set.w || 0) || ((set.w || 0) === (top.set.w || 0) && (set.r || 0) > (top.set.r || 0)))
      top = { set, date: s.date };
  }
  return top;
}

// ===== Zeitraum-Filter =====
export const RANGES = [
  { k: '1m', label: '1 Monat', days: 30 },
  { k: '3m', label: '3 Monate', days: 91 },
  { k: '1j', label: '1 Jahr', days: 365 },
  { k: 'all', label: 'Alles', days: Infinity }
];
export const inRange = (t, rangeKey) =>
  t >= Date.now() - RANGES.find(r => r.k === rangeKey).days * 864e5;

// ===== Sätze pro Muskelgruppe =====
/** Zählt erledigte Sätze je Muskelgruppe in den letzten `days` Tagen. */
export function setsPerMuscle(workouts, exMap, days) {
  const from = Date.now() - days * 864e5;
  const counts = {};
  for (const w of workouts) {
    if (w.start < from) continue;
    for (const x of w.exercises) {
      const muscle = exMap[x.exId]?.muscle;
      if (muscle) counts[muscle] = (counts[muscle] || 0) + x.sets.length;
    }
  }
  return counts;
}

export const fmtVal =(v, unit) =>
  `${(Math.round(v * 10) / 10).toLocaleString('de-DE')}${unit ? ' ' + unit : ''}`;

// ===== Wochenziel & Streak =====
// Auf 1–7 begrenzt: Ein unsinniger Wert würde sonst die Anzeige (Punkte pro Ziel) sprengen
export const getWeeklyGoal = async () => Math.min(7, Math.max(1, Math.floor(+await getSetting('weeklyGoal', 3)) || 3));
export const setWeeklyGoal = (n) => setSetting('weeklyGoal', n);

const prevWeek = (t) => startOfWeek(new Date(t - 3 * 864e5)); // robust gegen Zeitumstellung

/**
 * Streak = Wochen in Folge, in denen das Wochenziel erreicht wurde.
 * Die laufende Woche zählt erst, wenn das Ziel erreicht ist. Bis dahin
 * bleibt die Serie der Vorwochen bestehen (sie „bricht“ erst nach Wochenende).
 */
export function streak(workouts, goal) {
  // Absicherung: Ein Ziel von 0 (z. B. aus einem kaputten Backup) ließe die Schleife unten nie enden
  goal = Math.max(1, Math.floor(+goal) || 3);
  const counts = new Map();
  for (const w of workouts) {
    const k = startOfWeek(new Date(w.start));
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const thisWeek = startOfWeek();
  const thisCount = counts.get(thisWeek) || 0;
  let weeks = 0;
  let wk = thisCount >= goal ? thisWeek : prevWeek(thisWeek);
  while ((counts.get(wk) || 0) >= goal) { weeks++; wk = prevWeek(wk); }
  return { weeks, thisWeek: thisCount, goal };
}

// ===== Körpergewicht =====
// Ein Eintrag pro Tag: id = 'JJJJ-MM-TT', erneutes Eintragen überschreibt.
export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function getBodyweight() {
  return (await getAll('bodyweight')).sort((a, b) => a.date - b.date);
}
export function saveBodyweight(day, kg) {
  const [y, m, d] = day.split('-').map(Number);
  return put('bodyweight', { id: day, date: new Date(y, m - 1, d, 12).getTime(), kg });
}
export const deleteBodyweight = (id) => remove('bodyweight', id);
