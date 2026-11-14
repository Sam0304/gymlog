// Gymlog – Backup: alle Daten als JSON-Datei sichern und wiederherstellen.
import { STORES, getAll, put, clear, getSetting, setSetting } from './db.js';

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

/** Prüft eine eingelesene Datei. Wirft einen verständlichen Fehler, wenn sie nicht passt. */
export function parseBackup(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error('Die Datei ist kein gültiges Backup (kein JSON).'); }
  if (obj?.format !== FORMAT || typeof obj.data !== 'object') throw new Error('Das ist kein Gymlog-Backup.');
  for (const s of [...STORES, 'settings']) {
    if (obj.data[s] !== undefined && !Array.isArray(obj.data[s])) throw new Error(`Backup beschädigt (${s}).`);
  }
  return obj;
}

/** Ersetzt ALLE vorhandenen Daten durch das Backup. */
export async function importData(backup) {
  for (const s of [...STORES, 'settings']) {
    await clear(s);
    for (const row of backup.data[s] || []) await put(s, row);
  }
  await setSetting('lastBackup', Date.now()); // gerade wiederhergestellt = gesichert
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
