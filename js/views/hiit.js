// Gymlog – HIIT-Timer: Einheiten mit eigener Übungs- und Pausenzeit, Durchgänge, Signaltöne.
// Route: #hiit (unter „Mehr“)
import { getSetting, setSetting } from '../db.js';
import { esc, clock, ask } from '../ui.js';
import { unlockAudio, SIGNALS } from '../beep.js';

export const title = 'HIIT-Timer';
export const tab = 'mehr';

const PREP = 5; // Sekunden „Bereit machen“ vor dem Start
const DEFAULT = {
  rounds: 1,
  units: [
    { name: 'Burpees', work: 40, rest: 20 },
    { name: 'Mountain Climbers', work: 40, rest: 20 },
    { name: 'Kniebeugen', work: 40, rest: 20 },
    { name: 'Plank', work: 30, rest: 30 }
  ]
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(v) || 0));

/** Ablauf aus der Konfiguration: Bereit → (Übung, Pause)… – nach der allerletzten Übung keine Pause. */
export function buildSteps(cfg) {
  const steps = [{ phase: 'prep', sec: PREP, name: cfg.units[0]?.name || 'Übung 1', unit: 0, round: 0 }];
  for (let r = 0; r < cfg.rounds; r++) {
    cfg.units.forEach((u, i) => {
      const name = u.name.trim() || `Übung ${i + 1}`;
      steps.push({ phase: 'work', sec: u.work, name, unit: i, round: r });
      const isLast = r === cfg.rounds - 1 && i === cfg.units.length - 1;
      if (!isLast && u.rest > 0) steps.push({ phase: 'rest', sec: u.rest, name, unit: i, round: r });
    });
  }
  return steps;
}

export async function render(host) {
  const el = document.createElement('div');
  host.append(el);
  const cfg = structuredClone(await getSetting('hiit', DEFAULT));
  const save = () => setSetting('hiit', cfg);
  let run = null; // laufender Timer (für Aufräumen beim Seitenwechsel)

  function total() {
    return buildSteps(cfg).reduce((s, x) => s + x.sec, 0) - PREP;
  }

  function draw() {
    el.innerHTML = `
      <a class="back" href="#mehr">‹ Mehr</a>
      <p class="subtitle">Lege Einheiten mit eigener Übungs- und Pausenzeit an.</p>
      <div class="hiit-units">
        ${cfg.units.map((u, i) => `
          <div class="card hiit-unit" data-i="${i}">
            <div class="hiit-unit-head">
              <span class="hiit-no">${i + 1}</span>
              <input class="hiit-name" data-k="name" value="${esc(u.name)}" placeholder="Übung ${i + 1}" maxlength="30" aria-label="Name der Einheit ${i + 1}">
              <button class="icon-btn del-unit" aria-label="Einheit ${i + 1} entfernen" ${cfg.units.length <= 1 ? 'disabled' : ''}>✕</button>
            </div>
            <div class="hiit-times">
              ${timeField(i, 'work', '🔥 Übung', u.work)}
              ${timeField(i, 'rest', '😮‍💨 Pause', u.rest)}
            </div>
          </div>`).join('')}
      </div>
      <button class="btn secondary add-unit">＋ Einheit hinzufügen</button>

      <div class="card hiit-rounds">
        <div class="stepper">
          <span>Durchgänge</span>
          <button class="icon-btn" data-rounds="-1" aria-label="Weniger Durchgänge">−</button>
          <b>${cfg.rounds}</b>
          <button class="icon-btn" data-rounds="1" aria-label="Mehr Durchgänge">＋</button>
        </div>
        <p class="row-sub">Gesamtdauer: <b>${clock(total())}</b> · ${cfg.units.length} ${cfg.units.length === 1 ? 'Einheit' : 'Einheiten'} × ${cfg.rounds}</p>
      </div>

      <button class="btn hiit-start">▶ Timer starten</button>
      <button class="btn plain reset">Auf Beispiel zurücksetzen</button>`;
  }

  // ---------- Bearbeiten ----------
  el.addEventListener('input', e => {
    const unitEl = e.target.closest('.hiit-unit');
    if (!unitEl) return;
    const u = cfg.units[unitEl.dataset.i];
    const k = e.target.dataset.k;
    if (k === 'name') u.name = e.target.value;
    if (k === 'work') u.work = clamp(e.target.value, 5, 600);
    if (k === 'rest') u.rest = clamp(e.target.value, 0, 600);
    save();
    el.querySelector('.hiit-rounds .row-sub b').textContent = clock(total());
  });
  // Beim Verlassen eines Zeitfelds den gültigen (begrenzten) Wert anzeigen
  el.addEventListener('change', e => { if (e.target.dataset.k && e.target.dataset.k !== 'name') draw(); });

  el.addEventListener('click', async e => {
    const t = e.target;
    const unitEl = t.closest('.hiit-unit');
    const step = t.closest('[data-step]');
    if (step && unitEl) {
      const u = cfg.units[unitEl.dataset.i];
      const [k, d] = step.dataset.step.split(',');
      u[k] = k === 'work' ? clamp(u[k] + +d, 5, 600) : clamp(u[k] + +d, 0, 600);
      save(); draw();
      return;
    }
    if (t.closest('.del-unit')) { cfg.units.splice(unitEl.dataset.i, 1); save(); draw(); return; }
    if (t.closest('.add-unit')) {
      const last = cfg.units[cfg.units.length - 1] || { work: 40, rest: 20 };
      cfg.units.push({ name: '', work: last.work, rest: last.rest });
      save(); draw();
      el.querySelector(`.hiit-unit[data-i="${cfg.units.length - 1}"] .hiit-name`)?.focus();
      return;
    }
    const r = t.closest('[data-rounds]');
    if (r) { cfg.rounds = clamp(cfg.rounds + +r.dataset.rounds, 1, 20); save(); draw(); return; }
    if (t.closest('.reset')) {
      if (await ask({ title: 'Zurücksetzen?', text: 'Deine Einheiten werden durch das Beispiel ersetzt.', ok: 'Zurücksetzen' })) {
        Object.assign(cfg, structuredClone(DEFAULT)); save(); draw();
      }
      return;
    }
    if (t.closest('.hiit-start')) {
      unlockAudio(); // muss direkt im Tipp passieren (iPhone)
      run = startRun(buildSteps(cfg), () => { run = null; });
    }
  });

  draw();
  return () => run?.stop(); // Seitenwechsel: Timer beenden
}

const timeField = (i, k, label, v) => `
  <div class="hiit-time ${k}">
    <span class="hiit-label">${label}</span>
    <div class="hiit-field">
      <button class="icon-btn" data-step="${k},-5" aria-label="${label} 5 Sekunden weniger">−</button>
      <input inputmode="numeric" data-k="${k}" value="${v}" aria-label="${label} in Sekunden, Einheit ${i + 1}">
      <span class="unit">s</span>
      <button class="icon-btn" data-step="${k},5" aria-label="${label} 5 Sekunden mehr">＋</button>
    </div>
  </div>`;

// ================= Ablauf =================
function startRun(steps, onEnd) {
  const units = Math.max(...steps.map(s => s.unit)) + 1;
  const rounds = Math.max(...steps.map(s => s.round)) + 1;
  const startedAt = Date.now();
  let idx = 0;
  let endAt = Date.now() + steps[0].sec * 1000;
  let pausedLeft = null; // ms, wenn pausiert
  let wakeLock = null;

  const ov = document.createElement('div');
  ov.className = 'hiit-run';
  ov.innerHTML = `
    <div class="hiit-top"><span class="hiit-progress"></span><button class="hiit-x" aria-label="Timer beenden">✕</button></div>
    <div class="hiit-center">
      <div class="hiit-phase"></div>
      <div class="hiit-clock" aria-live="off"></div>
      <div class="hiit-current"></div>
      <div class="hiit-bar"><span></span></div>
      <div class="hiit-next"></div>
    </div>
    <div class="hiit-controls">
      <button class="hiit-btn pause" aria-label="Pause">⏸</button>
      <button class="hiit-btn skip" aria-label="Überspringen">⏭</button>
    </div>`;
  document.body.append(ov);

  // Bildschirm anlassen (iOS 16.4+), damit der Timer nicht durch die Sperre stoppt
  const lock = async () => { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* nicht verfügbar */ } };
  const onVisible = () => { if (document.visibilityState === 'visible' && !pausedLeft) lock(); };
  document.addEventListener('visibilitychange', onVisible);
  lock();

  const LABEL = { prep: 'Bereit machen', work: 'Übung', rest: 'Pause' };

  function show() {
    const s = steps[idx];
    const leftMs = pausedLeft ?? Math.max(0, endAt - Date.now());
    const left = Math.ceil(leftMs / 1000);
    ov.dataset.phase = s.phase;
    ov.querySelector('.hiit-phase').textContent = pausedLeft != null ? 'Pausiert' : LABEL[s.phase];
    ov.querySelector('.hiit-clock').textContent = clock(left);
    ov.querySelector('.hiit-current').textContent = s.phase === 'rest' ? `Gleich: ${steps[idx + 1]?.name || ''}` : s.name;
    ov.querySelector('.hiit-bar span').style.width = `${(1 - leftMs / (s.sec * 1000)) * 100}%`;
    const next = steps[idx + 1];
    ov.querySelector('.hiit-next').textContent = next
      ? `Danach: ${next.phase === 'rest' ? `Pause ${next.sec} s` : `${next.name} ${next.sec} s`}`
      : 'Letzte Runde – gib alles! 💪';
    ov.querySelector('.hiit-progress').textContent =
      s.phase === 'prep' ? 'Los geht’s gleich' : `Einheit ${s.unit + 1}/${units}${rounds > 1 ? ` · Durchgang ${s.round + 1}/${rounds}` : ''}`;
    ov.querySelector('.pause').textContent = pausedLeft != null ? '▶' : '⏸';
  }

  function advance(silent = false) {
    const ended = steps[idx];
    const isLast = idx === steps.length - 1; // am Ende nur das „Geschafft“-Signal, nicht zwei übereinander
    if (!silent && !isLast) (ended.phase === 'work' ? SIGNALS.workEnd : SIGNALS.restEnd)();
    idx++;
    if (idx >= steps.length) return finish();
    endAt += steps[idx].sec * 1000;
  }

  function tick() {
    if (pausedLeft != null) return;
    // Aufholen nach Bildschirmsperre: verpasste Phasen still überspringen, nur einmal piepen
    let jumped = 0;
    while (idx < steps.length && Date.now() >= endAt) {
      advance(jumped > 0);
      jumped++;
      if (idx >= steps.length) return;
    }
    show();
  }

  function finish() {
    clearInterval(iv);
    SIGNALS.finish();
    ov.dataset.phase = 'done';
    ov.querySelector('.hiit-center').innerHTML = `
      <div class="hiit-phase">Geschafft!</div>
      <div class="hiit-clock small">💪</div>
      <div class="hiit-current">${units} ${units === 1 ? 'Einheit' : 'Einheiten'} × ${rounds} in ${clock((Date.now() - startedAt) / 1000)}</div>`;
    ov.querySelector('.hiit-controls').innerHTML = `<button class="btn hiit-close">Fertig</button>`;
    ov.querySelector('.hiit-progress').textContent = '';
  }

  function stop() {
    clearInterval(iv);
    document.removeEventListener('visibilitychange', onVisible);
    wakeLock?.release().catch(() => {});
    ov.remove();
    onEnd();
  }

  ov.addEventListener('click', e => {
    if (e.target.closest('.hiit-x') || e.target.closest('.hiit-close')) return stop();
    if (e.target.closest('.pause')) {
      if (pausedLeft == null) { pausedLeft = Math.max(0, endAt - Date.now()); }
      else { endAt = Date.now() + pausedLeft; pausedLeft = null; }
      show();
    }
    if (e.target.closest('.skip')) {
      if (pausedLeft != null) { endAt = Date.now() + pausedLeft; pausedLeft = null; }
      endAt = Date.now(); // aktuelle Phase sofort beenden (mit Signal)
      tick();
    }
  });

  const iv = setInterval(tick, 200);
  show();
  return { stop };
}
