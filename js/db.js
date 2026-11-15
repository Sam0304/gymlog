// Gymlog – kleiner Wrapper um IndexedDB.
// Alle Daten bleiben lokal auf dem Gerät.
// Stores werden schon jetzt alle angelegt, damit spätere Etappen keine Migration brauchen.

const DB_NAME = 'gymlog';
const VERSION = 1;
export const STORES = ['exercises', 'workouts', 'plans', 'bodyweight'];

let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
  });
}

export const getAll = (store) => run(store, 'readonly', s => s.getAll());
export const get = (store, id) => run(store, 'readonly', s => s.get(id));
export const put = (store, value) => run(store, 'readwrite', s => s.put(value));
export const remove = (store, id) => run(store, 'readwrite', s => s.delete(id));
export const clear = (store) => run(store, 'readwrite', s => s.clear());

/**
 * Ersetzt den Inhalt mehrerer Stores in EINER Transaktion: Entweder wird alles
 * geschrieben oder gar nichts (bei einem Fehler bleiben die alten Daten unverändert).
 * data: { storeName: [Zeilen] } – jeder genannte Store wird zuerst geleert.
 */
export async function replaceAll(data) {
  const db = await open();
  const names = Object.keys(data);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    // abort() (auch von uns selbst ausgelöst) feuert kein onerror – sonst hinge das Promise ewig
    tx.onabort = () => reject(tx.error || new Error('Speichern abgebrochen.'));
    try {
      for (const name of names) {
        const store = tx.objectStore(name);
        store.clear();
        for (const row of data[name]) store.put(row);
      }
    } catch (e) {
      tx.abort();
      reject(e);
    }
  });
}

/** Einstellungen (Schlüssel/Wert), z. B. Favoriten. */
export async function getSetting(key, fallback) {
  const row = await run('settings', 'readonly', s => s.get(key));
  return row ? row.value : fallback;
}
export const setSetting = (key, value) => run('settings', 'readwrite', s => s.put({ key, value }));

/** Kurze, eindeutige ID für neue Einträge. */
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
