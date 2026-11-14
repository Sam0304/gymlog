// Gymlog – Übungskatalog.
// log: wie die Übung erfasst wird
//   'kg'     → Gewicht × Wiederholungen
//   'bw'     → Körpergewicht × Wiederholungen (optional Zusatzgewicht)
//   'time'   → Dauer in Sekunden (z. B. Plank)
//   'cardio' → Minuten + optional Distanz
import { getAll, put, remove, uid } from './db.js';

export const MUSCLES = ['Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps', 'Beine', 'Po', 'Waden', 'Bauch', 'Cardio', 'Dehnen'];
/** Gruppen, die kein Krafttraining sind (zählen nicht für Muskel-Umfang). */
export const NON_STRENGTH = new Set(['Cardio', 'Dehnen']);
export const EQUIPMENT = ['Langhantel', 'Kurzhantel', 'SZ-Stange', 'Kabelzug', 'Maschine', 'Körpergewicht', 'Cardio-Gerät', 'Sonstiges'];

// Kurzschreibweise: [id, Name, Muskel, Gerät, Typ, log]
const RAW = [
  // Brust
  ['bench', 'Bankdrücken', 'Brust', 'Langhantel', 'Grundübung', 'kg'],
  ['incline-bench', 'Schrägbankdrücken', 'Brust', 'Langhantel', 'Grundübung', 'kg'],
  ['db-bench', 'Kurzhantel-Bankdrücken', 'Brust', 'Kurzhantel', 'Grundübung', 'kg'],
  ['db-incline', 'Schrägbankdrücken Kurzhantel', 'Brust', 'Kurzhantel', 'Grundübung', 'kg'],
  ['chest-press', 'Brustpresse', 'Brust', 'Maschine', 'Grundübung', 'kg'],
  ['butterfly', 'Butterfly', 'Brust', 'Maschine', 'Isolation', 'kg'],
  ['cable-cross', 'Kabel-Crossover', 'Brust', 'Kabelzug', 'Isolation', 'kg'],
  ['db-fly', 'Fliegende Kurzhantel', 'Brust', 'Kurzhantel', 'Isolation', 'kg'],
  ['dips', 'Dips', 'Brust', 'Körpergewicht', 'Grundübung', 'bw'],
  ['pushup', 'Liegestütze', 'Brust', 'Körpergewicht', 'Grundübung', 'bw'],
  // Rücken
  ['deadlift', 'Kreuzheben', 'Rücken', 'Langhantel', 'Grundübung', 'kg'],
  ['pullup', 'Klimmzüge', 'Rücken', 'Körpergewicht', 'Grundübung', 'bw'],
  ['chinup', 'Klimmzüge Untergriff', 'Rücken', 'Körpergewicht', 'Grundübung', 'bw'],
  ['lat-pulldown', 'Latzug', 'Rücken', 'Kabelzug', 'Grundübung', 'kg'],
  ['bb-row', 'Langhantelrudern', 'Rücken', 'Langhantel', 'Grundübung', 'kg'],
  ['db-row', 'Kurzhantelrudern einarmig', 'Rücken', 'Kurzhantel', 'Grundübung', 'kg'],
  ['cable-row', 'Kabelrudern sitzend', 'Rücken', 'Kabelzug', 'Grundübung', 'kg'],
  ['tbar-row', 'T-Bar-Rudern', 'Rücken', 'Langhantel', 'Grundübung', 'kg'],
  ['machine-row', 'Rudermaschine', 'Rücken', 'Maschine', 'Grundübung', 'kg'],
  ['straight-pulldown', 'Überzüge am Kabel', 'Rücken', 'Kabelzug', 'Isolation', 'kg'],
  ['hyperext', 'Hyperextensions', 'Rücken', 'Körpergewicht', 'Isolation', 'bw'],
  // Schultern
  ['ohp', 'Schulterdrücken stehend', 'Schultern', 'Langhantel', 'Grundübung', 'kg'],
  ['db-shoulder', 'Kurzhantel-Schulterdrücken', 'Schultern', 'Kurzhantel', 'Grundübung', 'kg'],
  ['arnold', 'Arnold Press', 'Schultern', 'Kurzhantel', 'Grundübung', 'kg'],
  ['shoulder-press-m', 'Schulterpresse', 'Schultern', 'Maschine', 'Grundübung', 'kg'],
  ['lateral-raise', 'Seitheben', 'Schultern', 'Kurzhantel', 'Isolation', 'kg'],
  ['cable-lateral', 'Seitheben am Kabel', 'Schultern', 'Kabelzug', 'Isolation', 'kg'],
  ['front-raise', 'Frontheben', 'Schultern', 'Kurzhantel', 'Isolation', 'kg'],
  ['reverse-fly', 'Reverse Butterfly', 'Schultern', 'Maschine', 'Isolation', 'kg'],
  ['face-pull', 'Face Pulls', 'Schultern', 'Kabelzug', 'Isolation', 'kg'],
  ['upright-row', 'Aufrechtes Rudern', 'Schultern', 'SZ-Stange', 'Grundübung', 'kg'],
  // Bizeps
  ['bb-curl', 'Langhantel-Curls', 'Bizeps', 'Langhantel', 'Isolation', 'kg'],
  ['db-curl', 'Kurzhantel-Curls', 'Bizeps', 'Kurzhantel', 'Isolation', 'kg'],
  ['hammer-curl', 'Hammercurls', 'Bizeps', 'Kurzhantel', 'Isolation', 'kg'],
  ['preacher-curl', 'Scottcurls', 'Bizeps', 'SZ-Stange', 'Isolation', 'kg'],
  ['cable-curl', 'Kabelcurls', 'Bizeps', 'Kabelzug', 'Isolation', 'kg'],
  ['conc-curl', 'Konzentrationscurls', 'Bizeps', 'Kurzhantel', 'Isolation', 'kg'],
  ['incline-curl', 'Schrägbank-Curls', 'Bizeps', 'Kurzhantel', 'Isolation', 'kg'],
  // Trizeps
  ['pushdown', 'Trizepsdrücken am Kabel', 'Trizeps', 'Kabelzug', 'Isolation', 'kg'],
  ['overhead-ext', 'Überkopf-Trizepsstrecken', 'Trizeps', 'Kabelzug', 'Isolation', 'kg'],
  ['skullcrusher', 'French Press', 'Trizeps', 'SZ-Stange', 'Isolation', 'kg'],
  ['close-bench', 'Enges Bankdrücken', 'Trizeps', 'Langhantel', 'Grundübung', 'kg'],
  ['bench-dips', 'Bankdips', 'Trizeps', 'Körpergewicht', 'Isolation', 'bw'],
  ['kickback', 'Trizeps-Kickbacks', 'Trizeps', 'Kurzhantel', 'Isolation', 'kg'],
  // Beine
  ['squat', 'Kniebeuge', 'Beine', 'Langhantel', 'Grundübung', 'kg'],
  ['front-squat', 'Frontkniebeuge', 'Beine', 'Langhantel', 'Grundübung', 'kg'],
  ['leg-press', 'Beinpresse', 'Beine', 'Maschine', 'Grundübung', 'kg'],
  ['hack-squat', 'Hackenschmidt-Kniebeuge', 'Beine', 'Maschine', 'Grundübung', 'kg'],
  ['goblet', 'Goblet Squat', 'Beine', 'Kurzhantel', 'Grundübung', 'kg'],
  ['lunges', 'Ausfallschritte', 'Beine', 'Kurzhantel', 'Grundübung', 'kg'],
  ['bulgarian', 'Bulgarian Split Squat', 'Beine', 'Kurzhantel', 'Grundübung', 'kg'],
  ['rdl', 'Rumänisches Kreuzheben', 'Beine', 'Langhantel', 'Grundübung', 'kg'],
  ['db-rdl', 'Rumänisches Kreuzheben Kurzhantel', 'Beine', 'Kurzhantel', 'Grundübung', 'kg'],
  ['bw-squat', 'Kniebeuge ohne Gewicht', 'Beine', 'Körpergewicht', 'Grundübung', 'bw'],
  ['bw-lunges', 'Ausfallschritte ohne Gewicht', 'Beine', 'Körpergewicht', 'Grundübung', 'bw'],
  ['leg-ext', 'Beinstrecker', 'Beine', 'Maschine', 'Isolation', 'kg'],
  ['leg-curl-lying', 'Beinbeuger liegend', 'Beine', 'Maschine', 'Isolation', 'kg'],
  ['leg-curl-seated', 'Beinbeuger sitzend', 'Beine', 'Maschine', 'Isolation', 'kg'],
  // Po
  ['hip-thrust', 'Hip Thrust', 'Po', 'Langhantel', 'Grundübung', 'kg'],
  ['glute-bridge', 'Glute Bridge', 'Po', 'Körpergewicht', 'Isolation', 'bw'],
  ['abductor', 'Abduktoren-Maschine', 'Po', 'Maschine', 'Isolation', 'kg'],
  ['cable-kickback', 'Kabel-Kickbacks', 'Po', 'Kabelzug', 'Isolation', 'kg'],
  // Waden
  ['calf-standing', 'Wadenheben stehend', 'Waden', 'Maschine', 'Isolation', 'kg'],
  ['calf-seated', 'Wadenheben sitzend', 'Waden', 'Maschine', 'Isolation', 'kg'],
  ['db-calf', 'Wadenheben mit Kurzhantel', 'Waden', 'Kurzhantel', 'Isolation', 'kg'],
  // Bauch
  ['crunch', 'Crunches', 'Bauch', 'Körpergewicht', 'Isolation', 'bw'],
  ['cable-crunch', 'Kabel-Crunches', 'Bauch', 'Kabelzug', 'Isolation', 'kg'],
  ['hanging-leg-raise', 'Beinheben hängend', 'Bauch', 'Körpergewicht', 'Isolation', 'bw'],
  ['russian-twist', 'Russian Twist', 'Bauch', 'Körpergewicht', 'Isolation', 'bw'],
  ['ab-roller', 'Ab-Roller', 'Bauch', 'Sonstiges', 'Isolation', 'bw'],
  ['plank', 'Plank', 'Bauch', 'Körpergewicht', 'Isolation', 'time'],
  // Cardio
  ['treadmill', 'Laufband', 'Cardio', 'Cardio-Gerät', 'Ausdauer', 'cardio'],
  ['crosstrainer', 'Crosstrainer', 'Cardio', 'Cardio-Gerät', 'Ausdauer', 'cardio'],
  ['rower', 'Rudergerät', 'Cardio', 'Cardio-Gerät', 'Ausdauer', 'cardio'],
  ['bike', 'Fahrrad-Ergometer', 'Cardio', 'Cardio-Gerät', 'Ausdauer', 'cardio'],
  ['jump-rope', 'Seilspringen', 'Cardio', 'Sonstiges', 'Ausdauer', 'cardio'],
  // Dehnen & Mobilität (Haltezeit in Sekunden)
  ['stretch-neck', 'Nackendehnung seitlich', 'Dehnen', 'Körpergewicht', 'Dehnung', 'time'],
  ['stretch-chest', 'Brustdehnung am Türrahmen', 'Dehnen', 'Sonstiges', 'Dehnung', 'time'],
  ['stretch-shoulder', 'Schulterdehnung (Arm vor der Brust)', 'Dehnen', 'Körpergewicht', 'Dehnung', 'time'],
  ['stretch-triceps', 'Trizepsdehnung über Kopf', 'Dehnen', 'Körpergewicht', 'Dehnung', 'time'],
  ['stretch-forearm', 'Unterarmdehnung', 'Dehnen', 'Körpergewicht', 'Dehnung', 'time'],
  ['stretch-lats', 'Latissimus-Dehnung', 'Dehnen', 'Körpergewicht', 'Dehnung', 'time'],
  ['stretch-child', 'Kindhaltung', 'Dehnen', 'Körpergewicht', 'Dehnung', 'time'],
  ['stretch-cat-cow', 'Katze-Kuh (Mobilisation)', 'Dehnen', 'Körpergewicht', 'Dehnung', 'time'],
  ['stretch-cobra', 'Kobra', 'Dehnen', 'Körpergewicht', 'Dehnung', 'time'],
  ['stretch-twist', 'Wirbelsäulen-Drehung liegend', 'Dehnen', 'Körpergewicht', 'Dehnung', 'time'],
  ['stretch-hipflexor', 'Hüftbeuger-Dehnung (Kniestand)', 'Dehnen', 'Körpergewicht', 'Dehnung', 'time'],
  ['stretch-quads', 'Oberschenkel vorne (stehend)', 'Dehnen', 'Körpergewicht', 'Dehnung', 'time'],
  ['stretch-hamstrings', 'Oberschenkel hinten (sitzend)', 'Dehnen', 'Körpergewicht', 'Dehnung', 'time'],
  ['stretch-pigeon', 'Taube (Gesäß & Hüfte)', 'Dehnen', 'Körpergewicht', 'Dehnung', 'time'],
  ['stretch-butterfly', 'Schmetterling (Adduktoren)', 'Dehnen', 'Körpergewicht', 'Dehnung', 'time'],
  ['stretch-calves', 'Wadendehnung an der Wand', 'Dehnen', 'Körpergewicht', 'Dehnung', 'time'],
  ['stretch-worlds-greatest', 'Ausfallschritt mit Rotation (Mobilität)', 'Dehnen', 'Körpergewicht', 'Dehnung', 'time'],
];

export const BUILTIN = RAW.map(([id, name, muscle, equipment, type, log]) =>
  ({ id, name, muscle, equipment, type, log, custom: false }));

/** Alle Übungen: Katalog + eigene, alphabetisch je Muskelgruppe. */
export async function getAllExercises() {
  const custom = await getAll('exercises');
  return [...BUILTIN, ...custom].sort((a, b) =>
    MUSCLES.indexOf(a.muscle) - MUSCLES.indexOf(b.muscle) || a.name.localeCompare(b.name, 'de'));
}

export async function findExercise(id) {
  return (await getAllExercises()).find(e => e.id === id);
}

export async function addCustomExercise({ name, muscle, equipment, log }) {
  const ex = {
    id: 'c-' + uid(), name: name.trim(), muscle, equipment,
    type: equipment === 'Cardio-Gerät' ? 'Ausdauer' : 'Eigene', log, custom: true
  };
  await put('exercises', ex);
  return ex;
}

export const deleteCustomExercise = (id) => remove('exercises', id);

export const LOG_LABELS = {
  kg: 'Gewicht × Wdh.',
  bw: 'Körpergewicht × Wdh.',
  time: 'Dauer (Sekunden)',
  cardio: 'Minuten + Distanz'
};
