// Gymlog – „Mehr“: Übungskatalog, Backup, App installieren, Daten löschen.
import { exportData, parseBackup, summarize, importData, deleteAll, shareOrDownload, getLastBackup } from '../backup.js';
import { esc, toast, ask } from '../ui.js';
import { APP_VERSION } from '../version.js';

export const title = 'Mehr';

const isInstalled = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const daysSince = (t) => Math.floor((Date.now() - t) / 864e5);

export async function render(el) {
  // Backup schon jetzt vorbereiten: iOS erlaubt das Teilen-Menü nur direkt nach dem Tippen
  let prepared = await exportData();
  const last = await getLastBackup();
  const s = summarize(prepared);
  const hasData = s.workouts + s.plans + s.bodyweight > 0;
  const stale = hasData && (!last || daysSince(last) >= 14);

  el.innerHTML = `
    ${isInstalled() ? '' : `
      <div class="card install">
        <h2>📲 Als App installieren</h2>
        <ol>
          <li>Öffne diese Seite in <b>Safari</b>.</li>
          <li>Tippe unten auf <b>Teilen</b> <span class="ios-share" aria-hidden="true">⬆︎</span>.</li>
          <li>Wähle <b>„Zum Home-Bildschirm“</b> und tippe auf <b>Hinzufügen</b>.</li>
        </ol>
        <p>Danach startet Gymlog im Vollbild wie eine App – auch offline.</p>
      </div>`}

    <div class="group">
      <a class="row" href="#hiit">
        <span class="row-main"><span class="row-title">⏱ HIIT-Timer</span>
        <span class="row-sub">Intervalle mit eigener Übungs- und Pausenzeit, mit Signalton</span></span>
        <span class="chev" aria-hidden="true">›</span>
      </a>
      <a class="row" href="#uebungen">
        <span class="row-main"><span class="row-title">📚 Übungskatalog</span>
        <span class="row-sub">Alle Übungen ansehen und eigene anlegen</span></span>
        <span class="chev" aria-hidden="true">›</span>
      </a>
    </div>

    <div class="section-label">Backup</div>
    <div class="card backup${stale ? ' stale' : ''}">
      <p class="backup-status">${last
        ? `Letztes Backup: ${new Date(last).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}${daysSince(last) ? ` (vor ${daysSince(last)} ${daysSince(last) === 1 ? 'Tag' : 'Tagen'})` : ' (heute)'}`
        : 'Noch kein Backup gespeichert.'}</p>
      ${stale ? '<p class="backup-warn">⚠️ Zeit für ein Backup! Deine Daten liegen nur auf diesem Gerät.</p>' : ''}
      <p class="row-sub">Enthält ${s.workouts} Trainings, ${s.plans} Pläne, ${s.bodyweight} Gewichtseinträge und ${s.exercises} eigene Übungen.</p>
      <button class="btn export">⬇︎ Backup speichern</button>
      <button class="btn secondary import">⬆︎ Backup wiederherstellen</button>
      <input type="file" accept="application/json,.json" class="file" hidden>
      <p class="row-sub hint">Tipp: Auf dem iPhone „In Dateien sichern“ wählen – z. B. in iCloud Drive. So bleibt das Backup auch erhalten, wenn du das Handy wechselst.</p>
    </div>

    <div class="section-label">Daten</div>
    <button class="btn plain danger-text wipe">Alle Daten löschen</button>

    <p class="about">Gymlog · Version ${APP_VERSION}<br>Alle Daten bleiben auf diesem Gerät. Nichts wird hochgeladen.</p>`;

  // ---------- Export ----------
  el.querySelector('.export').addEventListener('click', async () => {
    const ok = await shareOrDownload(prepared);
    if (ok) { toast('✓ Backup erstellt'); render(rerender(el)); }
  });

  // ---------- Import ----------
  const fileInput = el.querySelector('.file');
  el.querySelector('.import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    let backup;
    try {
      backup = parseBackup(await file.text());
    } catch (e) {
      await ask({ title: 'Import nicht möglich', text: e.message, ok: 'OK', cancel: null });
      return;
    }
    const b = summarize(backup);
    const yes = await ask({
      title: 'Backup wiederherstellen?',
      text: `Backup vom ${b.exported ? b.exported.toLocaleDateString('de-DE') : 'unbekannten Datum'}: ${b.workouts} Trainings, ${b.plans} Pläne, ${b.bodyweight} Gewichtseinträge. Deine aktuellen Daten auf diesem Gerät werden dabei komplett ersetzt.`,
      ok: 'Wiederherstellen', danger: true
    });
    if (!yes) return;
    await importData(backup);
    toast('✓ Backup wiederhergestellt');
    render(rerender(el));
  });

  // ---------- Alles löschen ----------
  el.querySelector('.wipe').addEventListener('click', async () => {
    const first = await ask({
      title: 'Alle Daten löschen?',
      text: `${s.workouts} Trainings, ${s.plans} Pläne, ${s.bodyweight} Gewichtseinträge, eigene Übungen und Einstellungen werden gelöscht.`,
      ok: 'Weiter', danger: true
    });
    if (!first) return;
    const second = await ask({
      title: 'Wirklich sicher?',
      text: 'Das kann nicht rückgängig gemacht werden. Tipp: Vorher ein Backup speichern.',
      ok: 'Endgültig löschen', danger: true
    });
    if (!second) return;
    await deleteAll();
    toast('Alle Daten gelöscht');
    location.hash = '#training';
  });
}

/** Leert den Bereich für eine neue Darstellung (Listener hängen an den Kindelementen). */
function rerender(el) {
  el.innerHTML = '';
  return el;
}
