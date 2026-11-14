// Gymlog – kleine UI-Helfer, die alle Ansichten teilen.

/** Text sicher in HTML einsetzen (wichtig für selbst eingegebene Namen). */
export function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Für Suche: klein, ohne Akzente, ß → ss. */
export function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
}

/** Sekunden → „4:05“ bzw. „1:04:05“. */
export function clock(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
  const mm = h ? String(m).padStart(2, '0') : m;
  return (h ? h + ':' : '') + mm + ':' + String(s).padStart(2, '0');
}

/** Kurze Einblendung unten, z. B. „Bankdrücken hinzugefügt“. */
export function toast(msg) {
  document.querySelectorAll('.toast').forEach(old => old.remove()); // nur einer gleichzeitig
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 1600);
}

/** Kleiner Konfetti-Regen für Rekorde. */
export function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#ff5a1f', '#ffc83d', '#34c759', '#0a84ff', '#bf5af2'];
  const box = document.createElement('div');
  box.className = 'confetti';
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + '%';
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = Math.random() * 0.3 + 's';
    p.style.setProperty('--x', (Math.random() * 120 - 60) + 'px');
    p.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
    box.append(p);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 2200);
}

/**
 * Öffnet ein Bottom-Sheet (wie bei iOS). Elemente mit [data-close] schließen es.
 * Gibt { el, close } zurück.
 */
export function openSheet(html, { onClose } = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grabber"></div>${html}</div>`;
  document.body.append(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('open'));

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    backdrop.classList.remove('open');
    setTimeout(() => backdrop.remove(), 250);
    onClose?.();
  };
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop || e.target.closest('[data-close]')) close();
  });
  return { el: backdrop.querySelector('.sheet'), close };
}

/**
 * Eigenes Texteingabe-Fenster (ersetzt prompt()). Gibt Promise<string|null> zurück.
 * suggestions: optionale Schnellwahl-Chips.
 */
export function promptText({ title, value = '', placeholder = '', ok = 'Speichern', suggestions = [] }) {
  return new Promise(resolve => {
    let answer = null;
    const { el, close } = openSheet(`
      <h2 class="sheet-title">${esc(title)}</h2>
      <form class="form">
        <input name="t" required maxlength="40" autocomplete="off" value="${esc(value)}" placeholder="${esc(placeholder)}">
        ${suggestions.length ? `<div class="quick-names">${suggestions.map(s =>
          `<button type="button" class="chip" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
        <button class="btn" type="submit">${esc(ok)}</button>
        <button class="btn plain" type="button" data-close>Abbrechen</button>
      </form>`, { onClose: () => resolve(answer) });
    const input = el.querySelector('input');
    setTimeout(() => input.focus(), 300);
    el.querySelector('.quick-names')?.addEventListener('click', e => {
      const s = e.target.closest('[data-s]')?.dataset.s;
      if (s) input.value = s;
    });
    el.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v) return;
      answer = v;
      close();
    });
  });
}

/**
 * Eigener Bestätigungsdialog (ersetzt confirm(), das in iPhone-Web-Apps
 * und manchen Browsern blockiert ist). Gibt Promise<boolean> zurück.
 */
export function ask({ title, text = '', ok = 'OK', cancel = 'Abbrechen', danger = false }) {
  return new Promise(resolve => {
    let answer = false;
    const { el, close } = openSheet(`
      <h2 class="sheet-title">${esc(title)}</h2>
      ${text ? `<p class="subtitle">${esc(text)}</p>` : ''}
      <button class="btn${danger ? ' danger' : ''}" data-ok>${esc(ok)}</button>
      ${cancel ? `<button class="btn plain" data-close>${esc(cancel)}</button>` : ''}`,
      { onClose: () => resolve(answer) });
    el.querySelector('[data-ok]').addEventListener('click', () => { answer = true; close(); });
  });
}
