// Gymlog – Backup: alle Daten als JSON-Datei sichern und wiederherstellen.
import { STORES, getAll, replaceAll, clear, getSetting, setSetting } from './db.js';
import { MUSCLES, LOG_LABELS } from './exercises.js';
import { GOALS, LEVELS, EQUIPMENT as COACH_EQUIPMENT, FOCUS } from './coach-rules.js';

const FORMAT = 'gymlog-backup';

/** Sammelt alle Daten (inkl. Einstellungen) in ein Objekt. */
export async function exportData() {
  const data = {};
  for (const s of [...STORES, 'settings']) data[s] = await getAll(s);
  return { format: FORMAT, version: 1, exported: new Date().toISOString(), data };
}

/** Kurzer Überblick über ein Backup, z. B. für die Bestätigung vor dem Import. */
export function summarize(backup) {
  const d = backup.data;
  return {
    workouts: d.workouts?.length || 0,
    plans: d.plans?.length || 0,
    bodyweight: d.bodyweight?.length || 0,
    exercises: d.exercises?.length || 0,
    exported: backup.exported ? new Date(backup.exported) : null
  };
}

// ================= Prüfung der Backup-Inhalte =================
// Ein Backup ist eine Datei von außen: Sie kann beschädigt oder verändert sein.
// Grundsatz:
//  - Was die App so nie schreiben würde und nicht reparierbar ist (fehlende ID, falsche
//    Struktur), lehnt den ganzen Import ab – die vorhandenen Daten bleiben unangetastet.
//  - Kleinigkeiten werden repariert: ungültige Zahlen fallen weg, Texte werden zu Text,
//    unbrauchbare Einstellungen werden verworfen (die App nutzt dann den Standard).
// IDs werden auf ein sicheres Zeichenmuster begrenzt, weil sie ungefiltert in HTML landen.

const ID = /^[\w.:-]{1,80}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SET_FIELDS = ['w', 'r', 's', 'min', 'km'];

class BadBackup extends Error {}
const fail = (what) => { throw new BadBackup(`Backup beschädigt (${what}). Es wurde nichts verändert.`); };

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isId = (v) => typeof v === 'string' && ID.test(v);
const str = (v) => typeof v === 'string' ? v : '';
const intIn = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

/** Ein Satz: nur gültige Zahlen behalten; done/pr nur in passender Form. */
function cleanSet(s, where) {
  if (!isObj(s)) fail(where);
  const out = { ...s };
  for (const k of SET_FIELDS) if (k in out && !isNum(out[k])) delete out[k];
  if ('done' in out && typeof out.done !== 'boolean') delete out.done;
  if ('pr' in out && typeof out.pr !== 'string') delete out.pr;
  return out;
}

/** Ein Training (gespeichert oder laufend). */
function cleanWorkout(w, where) {
  if (!isObj(w) || !isId(w.id) || !isNum(w.start) || !Array.isArray(w.exercises)) fail(where);
  const out = { ...w, name: str(w.name) };
  if ('end' in out && !isNum(out.end)) delete out.end;
  for (const k of ['planId', 'dayId']) if (k in out && !isId(out[k])) delete out[k];
  out.exercises = w.exercises.map(x => {
    if (!isObj(x) || !isId(x.exId) || !Array.isArray(x.sets)) fail(where);
    const ex = { ...x, sets: x.sets.map(s => cleanSet(s, where)) };
    const t = x.target;
    if ('target' in ex && !(isObj(t) && [t.sets, t.repsMin, t.repsMax].every(isNum))) delete ex.target;
    return ex;
  });
  return out;
}

function cleanPlan(p) {
  if (!isObj(p) || !isId(p.id) || !Array.isArray(p.days)) fail('Pläne');
  return {
    ...p, name: str(p.name), created: isNum(p.created) ? p.created : 0,
    days: p.days.map(d => {
      if (!isObj(d) || !isId(d.id) || !Array.isArray(d.exercises)) fail('Pläne');
      return {
        ...d, name: str(d.name),
        exercises: d.exercises.map(e => {
          if (!isObj(e) || !isId(e.exId)) fail('Pläne');
          // Ungültige Zielwerte → Standardziel 3 × 8–12
          return { ...e, sets: isNum(e.sets) ? e.sets : 3, repsMin: isNum(e.repsMin) ? e.repsMin : 8, repsMax: isNum(e.repsMax) ? e.repsMax : 12 };
        })
      };
    })
  };
}

function cleanExercise(e) {
  if (!isObj(e) || !isId(e.id) || typeof e.name !== 'string' ||
      !MUSCLES.includes(e.muscle) || !(e.log in LOG_LABELS)) fail('eigene Übungen');
  return { ...e, equipment: str(e.equipment), type: str(e.type) };
}

/** Körpergewicht: unbrauchbare Einträge werden einfach weggelassen. */
const validBodyweight = (b) => isObj(b) && typeof b.id === 'string' && DAY.test(b.id) && isNum(b.date) && isNum(b.kg) && b.kg > 0;

/** Prüft je Einstellung den Wert. true = behalten, false = verwerfen (Standard wird genutzt). */
const SETTING_CHECKS = {
  weeklyGoal: (v) => intIn(v, 1, 7),
  activePlan: (v) => v === null || isId(v),
  activeWorkout: (v) => v === null || isObj(v), // Inhalt wird unten gesondert geprüft
  favorites: (v) => Array.isArray(v),
  lastBackup: isNum,
  backupSnooze: isNum,
  seenVersion: (v) => typeof v === 'string',
  coachProfile: (v) => isObj(v) && v.goal in GOALS && v.level in LEVELS && v.equipment in COACH_EQUIPMENT &&
    intIn(v.days, 1, 7) && [30, 45, 60, 90].includes(v.minutes) &&
    Array.isArray(v.focus) && v.focus.every(f => FOCUS.includes(f)),
  hiit: (v) => isObj(v) && intIn(v.rounds, 1, 50) && Array.isArray(v.units) && v.units.length >= 1 && v.units.length <= 30 &&
    v.units.every(u => isObj(u) && typeof u.name === 'string' && intIn(u.work, 1, 3600) && intIn(u.rest, 0, 3600))
};

function cleanSettings(rows) {
  const out = [];
  for (const row of rows) {
    if (!isObj(row) || typeof row.key !== 'string') fail('Einstellungen');
    const check = SETTING_CHECKS[row.key];
    if (!check || !check(row.value)) continue; // Unbekanntes oder Unbrauchbares verwerfen
    let value = row.value;
    if (row.key === 'favorites') value = value.filter(isId);
    if (row.key === 'activeWorkout' && value) value = cleanWorkout(value, 'laufendes Training');
    out.push({ key: row.key, value });
  }
  return out;
}

/** Prüft eine eingelesene Datei. Wirft einen verständlichen Fehler, wenn sie nicht passt. */
export function parseBackup(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error('Die Datei ist kein gültiges Backup (kein JSON).'); }
  if (obj?.format !== FORMAT || !isObj(obj.data)) throw new Error('Das ist kein Gymlog-Backup.');
  for (const s of [...STORES, 'settings']) {
    if (obj.data[s] !== undefined && !Array.isArray(obj.data[s])) fail(s);
  }
  const d = obj.data;
  const data = {
    exercises: (d.exercises || []).map(cleanExercise),
    workouts: (d.workouts || []).map(w => cleanWorkout(w, 'Trainings')),
    plans: (d.plans || []).map(cleanPlan),
    bodyweight: (d.bodyweight || []).filter(validBodyweight),
    settings: cleanSettings(d.settings || [])
  };
  return { ...obj, exported: typeof obj.exported === 'string' ? obj.exported : null, data };
}

/** Ersetzt ALLE vorhandenen Daten durch das (geprüfte) Backup – alles oder nichts. */
export async function importData(backup) {
  const data = {};
  for (const s of STORES) data[s] = backup.data[s] || [];
  // gerade wiederhergestellt = gesichert (in derselben Transaktion)
  data.settings = [...backup.data.settings.filter(r => r.key !== 'lastBackup'), { key: 'lastBackup', value: Date.now() }];
  await replaceAll(data);
}

/** Löscht alle Daten (Trainings, Pläne, Gewicht, eigene Übungen, Einstellungen). */
export async function deleteAll() {
  for (const s of [...STORES, 'settings']) await clear(s);
}

/**
 * Gibt die Datei an den Nutzer. Auf dem iPhone öffnet sich das Teilen-Menü
 * („In Dateien sichern“, AirDrop, Mail …), sonst ein normaler Download.
 */
export async function shareOrDownload(backup) {
  const name = `gymlog-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([JSON.stringify(backup, null, 1)], name, { type: 'application/json' });
  let shared = false;
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Gymlog-Backup' });
      shared = true;
    } catch (e) {
      if (e.name === 'AbortError') return false; // Nutzer hat abgebrochen
    }
  }
  if (!shared) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  await setSetting('lastBackup', Date.now());
  return true;
}

export const getLastBackup = () => getSetting('lastBackup', null);
