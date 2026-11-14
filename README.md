# Gymlog

Trainingstagebuch als Web-App (PWA) fürs iPhone – kostenlos, offline nutzbar, ohne Konto.

- Übungen mit Sätzen, Gewicht und Wiederholungen loggen (über 90 Übungen inkl. Dehnen)
- Trainingspläne mit Vorlagen und Rotation
- Fortschritt: Diagramme, Rekorde, Körpergewicht, Sätze pro Muskelgruppe, Streak
- Regelbasierter Trainer: Plan nach Ziel, Steigerungs-Tipps, Stillstand-Erkennung
- HIIT-Timer mit Signaltönen
- Backup als JSON-Datei

Alle Trainingsdaten bleiben lokal auf dem Gerät (IndexedDB). Es wird nichts hochgeladen.

## Installation auf dem iPhone

1. Die Seite in **Safari** öffnen.
2. **Teilen** → **„Zum Home-Bildschirm“** → **Hinzufügen**.

## Technik

Reines HTML/CSS/JavaScript ohne Build-Schritt. Lokal testen mit einem beliebigen statischen Server, z. B.:

```bash
python -m http.server 8080
```

Neue Version: `APP_VERSION` in `js/version.js` und `VERSION` in `sw.js` erhöhen.
