// Gymlog – kurze Signaltöne über die Web-Audio-API (keine Audiodateien nötig).
//
// iPhone-Besonderheiten:
//  - Ton geht erst, nachdem der Nutzer getippt hat → unlockAudio() im Klick auf „Start“ aufrufen
//  - audioSession 'playback' (Safari 16.4+) lässt den Ton auch bei Stummschalter erklingen

let ctx = null;

export function unlockAudio() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch { /* ältere Safari-Versionen */ }
  ctx ||= new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  // Ein unhörbarer Mini-Ton „entsperrt“ die Audioausgabe auf iOS
  const o = ctx.createOscillator(), g = ctx.createGain();
  g.gain.value = 0;
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + 0.01);
}

/** Spielt `times` kurze Töne mit Frequenz `freq` (Hz). */
export function beep({ freq = 880, duration = 0.18, times = 1, gap = 0.1, volume = 0.6 } = {}) {
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  let t = ctx.currentTime + 0.02;
  for (let i = 0; i < times; i++) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    // Weiches Ein-/Ausblenden, damit es nicht knackt
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + duration + 0.02);
    t += duration + gap;
  }
}

// Die drei Signale des HIIT-Timers
export const SIGNALS = {
  workEnd: () => beep({ freq: 523, duration: 0.3 }),            // tiefer Ton: Pause beginnt
  restEnd: () => beep({ freq: 988, duration: 0.18, times: 2 }), // zwei hohe Töne: los geht's
  finish:  () => beep({ freq: 1175, duration: 0.2, times: 3 })  // drei Töne: geschafft
};
