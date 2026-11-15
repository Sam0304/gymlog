// Gymlog – Service Worker: macht die App offline nutzbar.
//
// Strategie „Netzwerk zuerst, Cache als Rückfall“:
//  - Online: immer die neueste Version (und der Cache wird nebenbei aufgefrischt)
//  - Offline oder schlechter Empfang (> 2,5 s): sofort die gespeicherte Version
// Bei neuen Dateien VERSION erhöhen, dann werden alte Caches aufgeräumt.

const VERSION = 'gymlog-v1.1'; // passend zu APP_VERSION in js/version.js erhöhen
const TIMEOUT_MS = 2500;

const FILES = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './icons/icon.svg', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png',
  './js/app.js', './js/db.js', './js/ui.js', './js/chart.js', './js/rest-timer.js',
  './js/exercises.js', './js/workouts.js', './js/progress.js', './js/plans.js',
  './js/templates.js', './js/coach-rules.js', './js/backup.js', './js/beep.js', './js/version.js',
  './js/views/training.js', './js/views/active.js', './js/views/exercises.js',
  './js/views/progress.js', './js/views/plan.js', './js/views/coach.js', './js/views/more.js', './js/views/hiit.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  // Seitenaufrufe (auch mit ?v=… oder #…) bekommen immer index.html
  const key = req.mode === 'navigate' ? './index.html' : req;

  const fromNetwork = fetch(req).then(res => {
    if (res.ok) cache.put(key, res.clone());
    return res;
  });
  fromNetwork.catch(() => {}); // Netzfehler werden unten über den Cache behandelt

  try {
    return await Promise.race([
      fromNetwork,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS))
    ]);
  } catch {
    const cached = await cache.match(key, { ignoreSearch: true });
    return cached || fromNetwork; // nichts im Cache → doch auf das Netz warten
  }
}
