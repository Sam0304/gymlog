// Gymlog – kleine, selbst gezeichnete SVG-Diagramme (keine Bibliothek nötig).
// Farben kommen aus CSS-Klassen, damit Hell/Dunkel automatisch passt.

const dm = (t) => new Date(t).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' });

/**
 * Liniendiagramm mit Fläche, Gitterlinien und Achsenbeschriftung.
 * points: [{ x: Zeitstempel, y: Wert }]
 */
export function lineChart(points, { unit = '' } = {}) {
  if (!points.length) return '';
  const W = 340, H = 180, L = 40, R = 14, T = 14, B = 26;
  const ys = points.map(p => p.y), xs = points.map(p => p.x);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (lo === hi) { lo -= Math.max(1, lo * 0.05); hi += Math.max(1, hi * 0.05); }
  const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const sx = (x) => x1 === x0 ? (L + W - R) / 2 : L + (x - x0) / (x1 - x0) * (W - L - R);
  const sy = (y) => T + (1 - (y - lo) / (hi - lo)) * (H - T - B);
  const digits = hi - lo < 10 ? 1 : 0;
  const fmt = (v) => v.toLocaleString('de-DE', { maximumFractionDigits: digits });

  const ticks = [0, 0.5, 1].map(f => lo + f * (hi - lo));
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
  const area = points.length > 1
    ? `${line}L${sx(x1).toFixed(1)},${H - B}L${sx(x0).toFixed(1)},${H - B}Z` : '';
  const lastP = points[points.length - 1];

  return `
  <svg class="chart" viewBox="0 0 ${W} ${H}" role="img"
       aria-label="Verlauf von ${fmt(ys[0])} auf ${fmt(lastP.y)} ${unit}">
    ${ticks.map(t => `
      <line class="chart-grid" x1="${L}" x2="${W - R}" y1="${sy(t)}" y2="${sy(t)}"/>
      <text class="chart-label" x="${L - 6}" y="${sy(t) + 3}" text-anchor="end">${fmt(t)}</text>`).join('')}
    ${area ? `<path class="chart-area" d="${area}"/>` : ''}
    <path class="chart-line" d="${line}"/>
    ${points.map(p => `<circle class="chart-dot" cx="${sx(p.x)}" cy="${sy(p.y)}" r="3"><title>${dm(p.x)}: ${fmt(p.y)} ${unit}</title></circle>`).join('')}
    <circle class="chart-dot last" cx="${sx(lastP.x)}" cy="${sy(lastP.y)}" r="5"/>
    <text class="chart-label" x="${L}" y="${H - 8}">${dm(x0)}</text>
    ${x1 !== x0 ? `<text class="chart-label" x="${W - R}" y="${H - 8}" text-anchor="end">${dm(x1)}</text>` : ''}
  </svg>`;
}

/** Mini-Verlaufslinie für Listen (ohne Achsen). */
export function sparkline(values) {
  if (values.length < 2) return '';
  const W = 64, H = 24, lo = Math.min(...values), hi = Math.max(...values);
  const sy = (v) => hi === lo ? H / 2 : 2 + (1 - (v - lo) / (hi - lo)) * (H - 4);
  const sx = (i) => 2 + i / (values.length - 1) * (W - 4);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join('');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${d}"/></svg>`;
}
