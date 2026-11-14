// Gymlog – fertige Planvorlagen.
// Kurzschreibweise je Übung: [Übungs-ID, Sätze, Wdh von, Wdh bis]
// (bei Zeit-Übungen wie Plank sind „Wdh“ Sekunden)

const ex = ([exId, sets, repsMin, repsMax]) => ({ exId, sets, repsMin, repsMax });
const day = (name, list) => ({ name, exercises: list.map(ex) });

export const TEMPLATES = [
  {
    id: 'fullbody',
    name: 'Ganzkörper',
    level: 'Einsteiger',
    perWeek: '2–3× pro Woche',
    goal: 'Muskelaufbau & Grundkraft',
    text: 'Zwei abwechselnde Ganzkörper-Tage. Ideal für den Einstieg oder wenig Zeit.',
    days: [
      day('Ganzkörper A', [
        ['squat', 3, 8, 10], ['bench', 3, 8, 10], ['bb-row', 3, 8, 10],
        ['db-shoulder', 2, 10, 12], ['plank', 3, 30, 60]
      ]),
      day('Ganzkörper B', [
        ['deadlift', 3, 5, 8], ['db-incline', 3, 8, 12], ['lat-pulldown', 3, 8, 12],
        ['lunges', 2, 10, 12], ['hanging-leg-raise', 3, 10, 15]
      ])
    ]
  },
  {
    id: 'upper-lower',
    name: 'Oberkörper / Unterkörper',
    level: 'Fortgeschritten',
    perWeek: '4× pro Woche',
    goal: 'Muskelaufbau',
    text: 'Jede Muskelgruppe zweimal pro Woche, mit einem schweren und einem leichteren Tag.',
    days: [
      day('Oberkörper A', [
        ['bench', 4, 5, 8], ['bb-row', 4, 6, 10], ['ohp', 3, 6, 10],
        ['lat-pulldown', 3, 8, 12], ['skullcrusher', 3, 10, 12], ['bb-curl', 3, 10, 12]
      ]),
      day('Unterkörper A', [
        ['squat', 4, 5, 8], ['rdl', 3, 8, 10], ['leg-press', 3, 10, 12],
        ['leg-curl-lying', 3, 10, 12], ['calf-standing', 4, 10, 15]
      ]),
      day('Oberkörper B', [
        ['db-incline', 3, 8, 12], ['pullup', 3, 6, 10], ['db-shoulder', 3, 8, 12],
        ['cable-row', 3, 10, 12], ['lateral-raise', 3, 12, 15], ['pushdown', 3, 10, 15]
      ]),
      day('Unterkörper B', [
        ['deadlift', 3, 4, 6], ['bulgarian', 3, 8, 12], ['leg-ext', 3, 12, 15],
        ['hip-thrust', 3, 8, 12], ['calf-seated', 3, 12, 15]
      ])
    ]
  },
  {
    id: 'ppl',
    name: 'Push · Pull · Beine',
    level: 'Fortgeschritten',
    perWeek: '3× oder 6× pro Woche',
    goal: 'Muskelaufbau',
    text: 'Drücken, Ziehen und Beine an getrennten Tagen. Bei 6× pro Woche einfach zweimal durchlaufen.',
    days: [
      day('Push', [
        ['bench', 4, 6, 10], ['ohp', 3, 8, 10], ['db-incline', 3, 8, 12],
        ['lateral-raise', 3, 12, 15], ['pushdown', 3, 10, 12], ['overhead-ext', 2, 10, 12]
      ]),
      day('Pull', [
        ['pullup', 4, 6, 10], ['bb-row', 3, 8, 10], ['cable-row', 3, 10, 12],
        ['face-pull', 3, 12, 15], ['hammer-curl', 3, 10, 12], ['bb-curl', 2, 10, 12]
      ]),
      day('Beine', [
        ['squat', 4, 6, 10], ['rdl', 3, 8, 10], ['leg-press', 3, 10, 12],
        ['leg-curl-seated', 3, 10, 12], ['calf-standing', 4, 10, 15], ['cable-crunch', 3, 12, 15]
      ])
    ]
  },
  {
    id: 'stretch',
    name: 'Dehnen & Mobilität',
    level: 'Alle Level',
    perWeek: 'täglich oder nach dem Training',
    goal: 'Beweglichkeit & Entspannung',
    text: 'Ganzkörper-Dehnroutine in ca. 15 Minuten. Jede Position ruhig halten und weiteratmen.',
    days: [
      day('Dehnroutine', [
        ['stretch-cat-cow', 1, 45, 60], ['stretch-worlds-greatest', 2, 30, 45], ['stretch-hipflexor', 2, 30, 45],
        ['stretch-hamstrings', 2, 30, 45], ['stretch-pigeon', 2, 30, 45], ['stretch-chest', 2, 30, 45],
        ['stretch-lats', 2, 30, 45], ['stretch-child', 1, 45, 60]
      ])
    ]
  },
  {
    id: 'home',
    name: 'Zuhause mit Körpergewicht',
    level: 'Einsteiger',
    perWeek: '3× pro Woche',
    goal: 'Fitness & Kraftausdauer',
    text: 'Fast nur mit dem eigenen Körpergewicht, für zuhause oder unterwegs. Für Klimmzüge brauchst du eine Stange.',
    days: [
      day('Körpergewicht A', [
        ['bw-squat', 3, 15, 25], ['pushup', 3, 8, 15], ['glute-bridge', 3, 12, 20],
        ['bench-dips', 3, 8, 15], ['crunch', 3, 15, 20], ['plank', 3, 30, 60]
      ]),
      day('Körpergewicht B', [
        ['bw-lunges', 3, 10, 15], ['pullup', 3, 3, 8], ['hyperext', 3, 12, 15], ['pushup', 3, 8, 15],
        ['russian-twist', 3, 15, 20], ['jump-rope', 1, 10, 15]
      ])
    ]
  }
];
