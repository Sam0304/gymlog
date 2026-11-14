// Gymlog – Versionsnummer und „Was ist neu“.
//
// Bei jeder neuen Version:
//  1. APP_VERSION erhöhen und oben in CHANGES eintragen, was neu ist
//  2. VERSION in sw.js anpassen (damit der Offline-Speicher erneuert wird)
// Beim nächsten Start sieht man dann einmalig den Hinweis „Neue Version“.

export const APP_VERSION = '1.0';

export const CHANGES = {
  '1.0': [
    'Training loggen mit Rekorden, Plänen und Fortschritt',
    'Über 90 Übungen inkl. 17 Dehnübungen und Vorlage „Dehnen & Mobilität“',
    'Persönlicher Trainer mit Steigerungs-Tipps',
    'HIIT-Timer mit Signaltönen (unter „Mehr“)',
    'Offline nutzbar, Backup & Erinnerung'
  ]
};
