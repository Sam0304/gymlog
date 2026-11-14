// Gymlog – Trainer-Logik (regelbasiert, offline).
// Alles hier ist „pur“: Eingaben rein, Ergebnis raus, kein Speicher, keine Anzeige.
//
// 1) buildPlan(profil)            → Plan passend zu Ziel, Level, Tagen, Zeit, Ausstattung, Schwerpunkt
// 2) progressionAdvice(...)        → Steigerungs-Tipp pro Übung (Double Progression)
// 3) volumeHints(...)              → Muskelgruppen mit zu wenig Sätzen
import { TEMPLATES } from './templates.js';
import { BUILTIN, NON_STRENGTH } from './exercises.js';

const exById = Object.fromEntries(BUILTIN.map(e => [e.id, e]));

// ================= Profil-Optionen =================
export const GOALS = {
  aufbau:   { label: 'Muskelaufbau', compound: [6, 10], iso: [10, 15], cSets: 3, iSets: 3, rest: '2 min bei Grundübungen, 75 s bei Isolation' },
  kraft:    { label: 'Kraft', compound: [3, 6], iso: [8, 12], cSets: 4, iSets: 3, rest: '3 min bei Grundübungen, 90 s bei Isolation' },
  abnehmen: { label: 'Abnehmen & Definition', compound: [8, 12], iso: [12, 15], cSets: 3, iSets: 3, rest: '60 s', cardio: true },
  fitness:  { label: 'Fitness & Gesundheit', compound: [10, 15], iso: [12, 15], cSets: 2, iSets: 2, rest: '60 s', cardio: true }
};
export const LEVELS = { einsteiger: 'Einsteiger', fortgeschritten: 'Fortgeschritten', erfahren: 'Erfahren' };
export const EQUIPMENT = { studio: 'Fitnessstudio', kurzhantel: 'Kurzhanteln zuhause', koerper: 'Nur Körpergewicht' };
export const FOCUS = ['Brust', 'Rücken', 'Schultern', 'Arme', 'Beine', 'Po', 'Bauch'];
const MAX_EXERCISES = { 30: 4, 45: 5, 60: 6, 90: 8 };

// Ersatz, wenn nur Kurzhanteln da sind (null = weglassen)
const DUMBBELL_SWAP = {
  squat: 'goblet', 'front-squat': 'goblet', 'leg-press': 'lunges', 'hack-squat': 'bulgarian',
  bench: 'db-bench', 'incline-bench': 'db-incline', 'chest-press': 'db-bench', 'close-bench': 'bench-dips',
  butterfly: 'db-fly', 'cable-cross': 'db-fly',
  deadlift: 'db-rdl', rdl: 'db-rdl', 'bb-row': 'db-row', 'tbar-row': 'db-row', 'cable-row': 'db-row',
  'machine-row': 'db-row', 'lat-pulldown': 'pullup', 'straight-pulldown': null,
  ohp: 'db-shoulder', 'shoulder-press-m': 'db-shoulder', 'cable-lateral': 'lateral-raise',
  'face-pull': null, 'reverse-fly': null, 'upright-row': 'lateral-raise',
  'bb-curl': 'db-curl', 'preacher-curl': 'hammer-curl', 'cable-curl': 'db-curl',
  pushdown: 'kickback', 'overhead-ext': 'kickback', skullcrusher: 'kickback',
  'leg-ext': 'bulgarian', 'leg-curl-lying': 'glute-bridge', 'leg-curl-seated': 'glute-bridge',
  'hip-thrust': 'glute-bridge', abductor: null, 'cable-kickback': null,
  'calf-standing': 'db-calf', 'calf-seated': 'db-calf', 'cable-crunch': 'crunch'
};
const NEEDS_GYM = new Set(['Langhantel', 'SZ-Stange', 'Kabelzug', 'Maschine', 'Cardio-Gerät']);

// ================= 1) Plan erstellen =================
function pickSplit(p) {
  const t = (id) => TEMPLATES.find(x => x.id === id);
  if (p.equipment === 'koerper') return {
    days: t('home').days,
    why: 'Zwei abwechselnde Körpergewichts-Tage – du brauchst nur Platz auf dem Boden (und für Klimmzüge eine Stange).'
  };
  if (p.days <= 2) return {
    days: t('fullbody').days,
    why: 'Bei 2 Trainings pro Woche trainierst du jedes Mal den ganzen Körper. So wird jede Muskelgruppe 2× pro Woche belastet.'
  };
  if (p.days === 3) return p.level === 'erfahren'
    ? { days: t('ppl').days, why: 'Push · Pull · Beine: Jeder Tag hat ein klares Thema mit viel Umfang pro Muskelgruppe.' }
    : { days: t('fullbody').days, why: 'Ganzkörper A/B im Wechsel: Bei 3 Trainings pro Woche trifft jede Muskelgruppe 1–2× pro Woche – ideal, um sauber Technik und Kraft aufzubauen.' };
  if (p.days === 4) return {
    days: t('upper-lower').days,
    why: 'Oberkörper/Unterkörper: Jede Muskelgruppe 2× pro Woche, mit genug Erholung dazwischen.'
  };
  if (p.days === 5) {
    const ul = t('upper-lower').days;
    return {
      days: [...t('ppl').days, ul[2], ul[3]].map(d => ({ ...d, name: d.name.replace(' B', '') })),
      why: 'Push · Pull · Beine plus je ein Ober- und Unterkörpertag: Jede Muskelgruppe knapp 2× pro Woche.'
    };
  }
  return {
    days: t('ppl').days,
    why: 'Push · Pull · Beine, zweimal pro Woche durchlaufen: Jede Muskelgruppe 2× pro Woche mit hohem Umfang.'
  };
}

/** Sätze und Wiederholungen einer Übung an Ziel, Level und Schwerpunkt anpassen. */
function adjust(x, ex, goal, p, focus) {
  if (ex.log === 'time' || ex.log === 'cardio') return x; // Zeiten aus der Vorlage passen
  const compound = ex.type === 'Grundübung';
  let [repsMin, repsMax] = compound ? goal.compound : goal.iso;
  if (ex.log === 'bw' && p.goal !== 'kraft') [repsMin, repsMax] = [x.repsMin, x.repsMax]; // Körpergewicht: Vorlage behalten
  let sets = compound ? goal.cSets : goal.iSets;
  if (p.level === 'einsteiger') sets -= 1;
  if (p.level === 'erfahren' && compound) sets += 1;
  if (focus.has(ex.muscle)) sets += 1;
  return { ...x, sets: Math.min(5, Math.max(2, sets)), repsMin, repsMax };
}

/**
 * Erstellt einen Plan aus dem Profil.
 * profil: { goal, level, days, minutes, equipment, focus: [] }
 * Rückgabe: { name, days: [{ name, exercises }], reasons: [Text] } – passend für createPlan()
 */
export function buildPlan(p) {
  const goal = GOALS[p.goal];
  const split = pickSplit(p);
  const cap = MAX_EXERCISES[p.minutes] || 6;
  const focus = new Set(p.focus.flatMap(f => f === 'Arme' ? ['Bizeps', 'Trizeps'] : [f]));
  let cut = 0;

  const days = split.days.map(d => {
    let list = d.exercises.map(x => ({ ...x }));
    if (p.equipment === 'kurzhantel') {
      list = list
        .map(x => ({ ...x, exId: x.exId in DUMBBELL_SWAP ? DUMBBELL_SWAP[x.exId] : x.exId }))
        .filter(x => x.exId && !NEEDS_GYM.has(exById[x.exId]?.equipment));
    }
    list = list.filter((x, i) => list.findIndex(y => y.exId === x.exId) === i); // Doppelte nach Tausch entfernen
    list = list.map(x => adjust(x, exById[x.exId], goal, p, focus));
    if (list.length > cap) { cut += list.length - cap; list = list.slice(0, cap); } // Grundübungen stehen vorn
    if (goal.cardio && !list.some(x => exById[x.exId]?.log === 'cardio')) { // nur wenn noch kein Cardio drin ist
      list.push(p.equipment === 'studio'
        ? { exId: 'crosstrainer', sets: 1, repsMin: 15, repsMax: 20 }
        : { exId: 'jump-rope', sets: 1, repsMin: 10, repsMax: 15 });
    }
    return { name: d.name, exercises: list };
  });

  const reasons = [
    split.why,
    `Für „${goal.label}“: Grundübungen ${goal.compound.join('–')} Wdh, Isolationsübungen ${goal.iso.join('–')} Wdh. Pausen: ${goal.rest}.`,
    p.level === 'einsteiger'
      ? 'Als Einsteiger startest du mit etwas weniger Sätzen – Technik geht vor Gewicht.'
      : p.level === 'erfahren' ? 'Als Erfahrener bekommst du einen Satz mehr bei den Grundübungen.' : null,
    cut ? `Damit du in ~${p.minutes} Minuten fertig bist, habe ich ${cut} Übung${cut > 1 ? 'en' : ''} gestrichen (die wichtigsten Grundübungen bleiben).` : null,
    focus.size ? `Schwerpunkt ${p.focus.join(', ')}: dafür je 1 Satz mehr.` : null,
    goal.cardio ? 'Am Ende jedes Trainings kommt eine kurze Cardio-Einheit dazu.' : null,
    p.equipment === 'kurzhantel' ? 'Langhantel- und Maschinenübungen habe ich durch Kurzhantel-Varianten ersetzt.' : null
  ].filter(Boolean);

  return { name: `Trainer: ${goal.label}`, days, reasons };
}

// ================= 2) Steigerungs-Tipps =================
/**
 * Tipp für das nächste Training einer Übung (Double Progression).
 * sets:   Sätze vom letzten Mal, z. B. [{ w: 60, r: 10 }, ...]
 * target: Ziel aus dem Plan, z. B. { sets: 3, repsMin: 8, repsMax: 12 }
 * ex:     Übung aus dem Katalog (u. a. ex.log, ex.equipment)
 * Rückgabe: { kind: 'up' | 'keep' | 'down', text } oder null (kein Tipp)
 */
export function progressionAdvice(sets, target, ex) {
  if (!sets?.length || !target || ex.muscle === 'Dehnen') return null; // Dehnen: keine Steigerung nötig
  switch (ex.log) {
    case 'kg': return weightAdvice(sets, target, ex);
    case 'bw': {
      const done = sets.length >= target.sets && sets.every(s => (s.r || 0) >= target.repsMax);
      return done
        ? { kind: 'up', text: `Alle Sätze mit ${target.repsMax}+ Wdh – nimm Zusatzgewicht oder eine schwerere Variante.` }
        : { kind: 'keep', text: `Versuch 1 Wdh mehr pro Satz, bis du überall ${target.repsMax} schaffst.` };
    }
    case 'time': {
      const done = sets.every(s => (s.s || 0) >= target.repsMax);
      return done
        ? { kind: 'up', text: `Überall ${target.repsMax} s geschafft – halte nächstes Mal 10 s länger.` }
        : { kind: 'keep', text: `Arbeite dich auf ${target.repsMax} s pro Satz hoch.` };
    }
  }
  return null;
}

/**
 * Entscheidung für Übungen mit Gewicht.
 * Liefert { kind: 'up' | 'keep' | 'down', text } oder null.
 */
export function weightAdvice(sets, target, ex) {
  const top = Math.max(...sets.map(s => s.w || 0));        // schwerstes Gewicht vom letzten Mal
  const atTop = sets.filter(s => s.w === top);              // alle Sätze mit diesem Gewicht
  const kg = (v) => String(v).replace('.', ',');            // 62.5 → „62,5“

  // Steigern: alle Zielsätze haben die obere Wdh-Zahl erreicht (streng, aber sicher)
  if (atTop.length >= target.sets && atTop.every(s => (s.r || 0) >= target.repsMax)) {
    const step = STEP_KG[ex.equipment] ?? 2.5;
    return { kind: 'up', text: `Ziel geschafft – nächstes Mal ${kg(top + step)} kg.` };
  }

  // Zu schwer: mehr als die Hälfte der Sätze unter dem Ziel (ein müder letzter Satz zählt nicht)
  const below = atTop.filter(s => (s.r || 0) < target.repsMin).length;
  if (below > atTop.length / 2) {
    return { kind: 'down', text: `Meist unter ${target.repsMin} Wdh – bleib bei ${kg(top)} kg oder geh etwas runter.` };
  }

  // Sonst: Gewicht halten, Wiederholungen bis ${repsMax} hochholen
  return { kind: 'keep', text: `Bleib bei ${kg(top)} kg und arbeite dich auf ${target.repsMax} Wdh pro Satz hoch.` };
}

/** Übliche Steigerung je Gerät: Hantelscheiben 2,5 kg, Kurzhantel-Sprünge 2 kg, Maschinen-Platten 5 kg. */
const STEP_KG = { Langhantel: 2.5, 'SZ-Stange': 2.5, Kurzhantel: 2, Kabelzug: 2.5, Maschine: 5 };

/** Letzte Einheit einer Übung samt Ziel (gespeichert im Training, sonst aus dem Plan). */
export function lastSession(workouts, exId, fallbackTarget) {
  for (const w of workouts) {
    const x = w.exercises.find(e => e.exId === exId);
    if (x) return { sets: x.sets, target: x.target || fallbackTarget, date: w.start };
  }
  return null;
}

// ================= Pausenlänge =================
/** Pause in Sekunden nach Ziel und Übungstyp. Ohne Profil: 90 s. */
export function restSeconds(goalKey, ex) {
  switch (goalKey) {
    case 'kraft': return ex.type === 'Grundübung' ? 180 : 90;
    case 'aufbau': return ex.type === 'Grundübung' ? 120 : 75;
    case 'abnehmen':
    case 'fitness': return 60;
    default: return 90;
  }
}

// ================= Stillstand =================
const heavier = (a, b) => (a.w || 0) > (b.w || 0) || ((a.w || 0) === (b.w || 0) && (a.r || 0) > (b.r || 0));
const bestOf = (sets) => sets.reduce((top, s) => (!top || heavier(s, top) ? s : top), null);

/**
 * Stillstand: In den letzten `n` Einheiten wurde der bisher beste Satz
 * (mehr Gewicht oder gleiches Gewicht mit mehr Wdh) kein einziges Mal übertroffen.
 * sessions: [{ date, sets }] älteste zuerst. Gibt { best, sessions: n } oder null zurück.
 */
export function plateau(sessions, n = 3) {
  if (sessions.length < n + 1) return null;
  const before = bestOf(sessions.slice(0, -n).flatMap(s => s.sets));
  const recent = sessions.slice(-n).map(s => bestOf(s.sets));
  return recent.some(s => heavier(s, before)) ? null : { best: before, sessions: n };
}

/** Variante für einen Übungswechsel: gleiche Muskelgruppe und gleicher Typ, möglichst anderes Gerät. */
export function alternativeFor(ex, allExercises) {
  const same = allExercises.filter(e => e.id !== ex.id && e.muscle === ex.muscle && e.type === ex.type && e.log === ex.log);
  return same.find(e => e.equipment !== ex.equipment) || same[0] || null;
}

// ================= 3) Umfang-Check =================
/** Muskelgruppen aus dem Plan, die in den letzten 7 Tagen unter 10 Sätzen lagen. */
export function volumeHints(planMuscles, counts) {
  return [...planMuscles]
    .filter(m => !NON_STRENGTH.has(m) && (counts[m] || 0) < 10)
    .map(m => ({ muscle: m, sets: counts[m] || 0 }));
}

export const GOAL_TIPS = {
  aufbau: [
    'Iss genug Eiweiß – grob 1,6–2 g pro kg Körpergewicht am Tag.',
    'Trainiere jeden Satz nah an die Grenze (1–2 Wdh „im Tank“).',
    'Schlaf ist Wachstum: 7–9 Stunden helfen mehr als jedes Supplement.'
  ],
  kraft: [
    'Längere Pausen (2–3 min) bei schweren Sätzen – Kraft braucht volle Erholung.',
    'Technik zuerst: Steigere nur, wenn alle Wiederholungen sauber waren.',
    'Wärm dich mit 2–3 leichten Sätzen auf, bevor du schwer gehst.'
  ],
  abnehmen: [
    'Abnehmen passiert in der Küche: ein moderates Kaloriendefizit ist der Schlüssel.',
    'Krafttraining hält deine Muskeln, während du Fett verlierst – bleib bei den Gewichten.',
    'Viel Alltagsbewegung (Schritte!) verbrennt oft mehr als extra Cardio.'
  ],
  fitness: [
    'Regelmäßigkeit schlägt Intensität – lieber 2× pro Woche dauerhaft als 5× für zwei Wochen.',
    'Kombiniere Kraft und Ausdauer, wie in deinem Plan.',
    'Hör auf deinen Körper: Schmerz in Gelenken ist ein Stoppsignal.'
  ]
};
