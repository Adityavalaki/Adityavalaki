// Draws the designed panels of the profile README, each in a light and a dark version.
//   heroSvg()     name, line, portrait and a weekly-contribution trace (drawn hourly by stats.mjs, which has the data)
//   timelineSvg() experience as a Gantt chart              -> assets/experience-{light,dark}.svg
//   tileSvg()     one card per secondary project            -> assets/project-<slug>-{light,dark}.svg
// Run `node .github/scripts/cards.mjs` after editing the data below; the workflow also runs it.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { esc, F, theme } from './stats.mjs';

const MONO = "font-family=\"ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,monospace\"";
const svgOpen = (W, H, label, t) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">\n<rect width="${W}" height="${H}" fill="${t.bg}"/>\n`;
const mono = (x, y, text, t, o = {}) => `<text x="${x}" y="${y}" ${MONO} font-size="${o.size || 10.5}" letter-spacing="${o.ls ?? 1.4}" fill="${o.fill || t.mute}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.weight ? ` font-weight="${o.weight}"` : ''}>${esc(text)}</text>`;

// ---------- data: edit here ----------

export const EXPERIENCE = [
  { role: 'Summer Research Intern', org: 'Dhirubhai Ambani University', from: '2026-05', to: '2026-07', kind: 'data' },
  { role: 'Marketing & Sales Head', org: 'Zeeniith Technology', from: '2025-12', to: '2026-08', kind: 'lead' },
  { role: 'Business Analyst Intern', org: 'Cognifyz Technologies', from: '2025-05', to: '2025-07', kind: 'data' },
  { role: 'Entrepreneurship Ambassador', org: 'IEEE Region 10 · ACEI', from: '2025-05', to: '2025-07', kind: 'lead' },
  { role: 'Joint Treasurer & Branch Coordinator', org: 'IEEE GCET Student Branch', from: '2025-01', to: '2025-06', kind: 'lead' },
  { role: 'Business Administrator Intern', org: 'Euro Foods Industries, Mahuva', from: '2024-12', to: '2025-01', kind: 'lead' },
];

export const PROJECTS = [
  { slug: 'medication-ai', kicker: 'MULTIMODAL LLM · HEALTH', title: 'Medication AI',
    lines: ['Reads handwritten prescriptions,', 'matches each medicine to a known', 'list, and sends doubtful ones', 'to a human check.'],
    stack: 'FastAPI · RapidFuzz · React Native', motif: 'rx' },
  { slug: 'visual-malware', kicker: 'COMPUTER VISION · SECURITY', title: 'Visual Malware v3',
    lines: ['Turns binaries into grayscale images', 'and fuses a CNN, a PE-header', 'Random Forest and an entropy filter.', '25 malware families.'],
    stack: 'TensorFlow · EfficientNetB0 · Streamlit', motif: 'bytes' },
  { slug: 'fakeshield', kicker: 'NLP · MISINFORMATION', title: 'FakeShield',
    lines: ['Scores how credible an article is,', 'and sends borderline ones to a', 'human instead of guessing.'],
    stack: 'TF-IDF · scikit-learn', motif: 'gauge' },
  { slug: 'smartspend', kicker: 'PERSONAL FINANCE', title: 'SmartSpend',
    lines: ['Tracks income and spending by', 'category and flags budgets that', 'are about to break.'],
    stack: 'JavaScript · Python', motif: 'budget' },
];

// ---------- hero ----------

export function heroSvg({ weeks = [], contributions = 0, portrait = '' }, dark) {
  const t = theme(dark);
  const W = 840, H = 330;
  const sums = weeks.map((w) => w.reduce((n, d) => n + d.contributionCount, 0));
  const max = Math.max(1, ...sums);
  const tx0 = 28, tx1 = 580, ty0 = 214, ty1 = 254;
  const pts = sums.map((v, i) => [tx0 + (i / Math.max(1, sums.length - 1)) * (tx1 - tx0), ty1 - (v / max) * (ty1 - ty0)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  const trace = pts.length > 1
    ? `<path d="${line}L${tx1},${ty1}L${tx0},${ty1}Z" fill="${t.red}" fill-opacity="0.10"/><path d="${line}" fill="none" stroke="${t.red}" stroke-width="1.6" stroke-linejoin="round"/>`
    : '';
  const cell = (x, k, v) => `${mono(x, 288, k, t)}<text x="${x}" y="312" ${F} font-size="15" font-weight="600" fill="${t.ink}">${esc(v)}</text>`;
  const px = 628, py = 36, pw = 184, ph = 196;
  const photo = portrait
    ? `<clipPath id="pc"><rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="4"/></clipPath><image x="${px}" y="${py}" width="${pw}" height="${ph}" preserveAspectRatio="xMidYMid slice" clip-path="url(#pc)" xlink:href="data:image/jpeg;base64,${portrait}"/>`
    : '';
  const label = `Aditya Valaki. Data analytics, data science and machine learning. B.Tech Information Technology at G H Patel College of Engineering and Technology, class of 2027, Gujarat, India. ${contributions} GitHub contributions in the last 12 months.`;
  return svgOpen(W, H, label, t) + `<rect x="28" y="36" width="32" height="3" fill="${t.red}"/>
${mono(28, 62, 'DATA ANALYTICS · DATA SCIENCE · MACHINE LEARNING', t)}
<text x="26" y="122" ${F} font-size="56" font-weight="800" letter-spacing="-1.5" fill="${t.ink}">Aditya Valaki</text>
<text x="28" y="160" ${F} font-size="17" fill="${t.ink}">I turn messy data into decisions: dashboards, models,</text>
<text x="28" y="184" ${F} font-size="17" fill="${t.ink}">and an F1 strategy engine that grades its own predictions.</text>
${trace}
<line x1="${tx0}" y1="${ty1}" x2="${tx1}" y2="${ty1}" stroke="${t.rule}"/>
${mono(tx1, ty0 - 6, 'CONTRIBUTIONS PER WEEK, 12 MONTHS', t, { anchor: 'end', size: 9.5 })}
${photo}
<rect x="${px}" y="${py + ph + 8}" width="${pw}" height="3" fill="${t.red}"/>
<line x1="28" y1="268" x2="${W - 28}" y2="268" stroke="${t.rule}"/>
${cell(28, 'STUDYING', 'B.Tech IT, GCET · class of 2027')}
${cell(330, 'BASED IN', 'Gujarat, India')}
${cell(560, 'LAST 12 MONTHS', `${contributions} contributions`)}
</svg>
`;
}

// ---------- experience ----------

const ym = (s) => { const [y, m] = s.split('-').map(Number); return y * 12 + (m - 1); };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function timelineSvg(rows, dark) {
  const t = theme(dark);
  const W = 840, top = 78, RH = 42, H = top + rows.length * RH + 44;
  const start = Math.min(...rows.map((r) => ym(r.from))), end = Math.max(...rows.map((r) => ym(r.to))) + 1;
  const X0 = 330, X1 = W - 28, mx = (m) => X0 + ((m - start) / (end - start)) * (X1 - X0);
  let grid = '';
  for (let m = start; m <= end; m++) {
    const isYear = m % 12 === 0, isHalf = m % 6 === 0;
    if (isHalf) grid += `<line x1="${mx(m).toFixed(1)}" y1="${top - 8}" x2="${mx(m).toFixed(1)}" y2="${top + rows.length * RH}" stroke="${t.rule}" ${isYear ? '' : 'stroke-dasharray="2 3"'}/>`
      + mono(mx(m) + 4, top - 12, `${MON[m % 12]} ${Math.floor(m / 12)}`.toUpperCase(), t, { size: 9.5, ls: 1 });
  }
  const color = (k) => (k === 'data' ? t.red : t.ink);
  const body = rows.map((r, i) => {
    const y = top + i * RH, a = mx(ym(r.from)), b = mx(ym(r.to) + 1);
    return `<line x1="28" y1="${y + RH}" x2="${X1}" y2="${y + RH}" stroke="${t.rule}" stroke-opacity="0.5"/>`
      + `<text x="28" y="${y + 18}" ${F} font-size="13.5" font-weight="600" fill="${t.ink}">${esc(r.role)}</text>`
      + `<text x="28" y="${y + 34}" ${F} font-size="12" fill="${t.mute}">${esc(r.org)}</text>`
      + `<rect x="${a.toFixed(1)}" y="${y + 14}" width="${Math.max(6, b - a - 2).toFixed(1)}" height="14" rx="2" fill="${color(r.kind)}"/>`;
  }).join('\n');
  const ly = H - 16;
  const legend = `<rect x="28" y="${ly - 9}" width="10" height="10" rx="2" fill="${t.red}"/><text x="44" y="${ly}" ${F} font-size="12" fill="${t.mute}">Data and research</text>`
    + `<rect x="168" y="${ly - 9}" width="10" height="10" rx="2" fill="${t.ink}"/><text x="184" y="${ly}" ${F} font-size="12" fill="${t.mute}">Business and leadership</text>`;
  const label = `Experience timeline: ${rows.map((r) => `${r.role}, ${r.org}, ${r.from} to ${r.to}`).join('; ')}.`;
  return svgOpen(W, H, label, t) + `<rect x="28" y="24" width="32" height="3" fill="${t.red}"/>
${mono(28, 46, 'EXPERIENCE · DEC 2024 TO NOW', t, { fill: t.ink, weight: 700, size: 11.5, ls: 1.6 })}
${grid}
${body}
${legend}
</svg>
`;
}

// ---------- project tiles ----------

function motif(kind, t, x, y) { // a 120 x 110 picture of what the project does
  let r = 1;
  const rnd = () => ((r = (r * 48271) % 2147483647) / 2147483647);
  if (kind === 'bytes') {
    let s = '';
    for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) {
      const band = Math.sin(i * 0.9 + j * 0.3) * 0.5 + 0.5, g = Math.round((dark(t) ? 30 : 60) + (band * 0.6 + rnd() * 0.4) * (dark(t) ? 180 : 170));
      s += `<rect x="${x + j * 11}" y="${y + i * 11}" width="10" height="10" fill="rgb(${g},${g},${g})"/>`;
    }
    return s + `<rect x="${x + 43}" y="${y + 32}" width="34" height="34" fill="none" stroke="${t.red}" stroke-width="2"/>`;
  }
  if (kind === 'rx') {
    const items = [0.96, 0.91, 0.58, 0.88];
    return `<path d="M${x} ${y + 12}c8-10 14 8 22-2s12 6 20-1 10 4 16 0" fill="none" stroke="${t.mute}" stroke-width="1.6"/>`
      + `<path d="M${x} ${y + 26}c10-8 16 6 26-1s14 5 24 0" fill="none" stroke="${t.mute}" stroke-width="1.6"/>`
      + items.map((c, i) => { const yy = y + 46 + i * 16, low = c < 0.7;
        return `<rect x="${x}" y="${yy}" width="52" height="8" rx="2" fill="${t.rule}"/><rect x="${x + 60}" y="${yy}" width="${(c * 60).toFixed(0)}" height="8" rx="2" fill="${low ? t.red : t.ink}"/>`
          + (low ? `<circle cx="${x + 60 + c * 60 + 9}" cy="${yy + 4}" r="3.5" fill="${t.red}"/>` : ''); }).join('');
  }
  if (kind === 'gauge') {
    const cx = x + 60, cy = y + 76, R = 50, arc = (a0, a1, col, w) => {
      const p = (a) => [cx + R * Math.cos(Math.PI * (1 - a)), cy - R * Math.sin(Math.PI * (1 - a))];
      const [ax, ay] = p(a0), [bx, by] = p(a1);
      return `<path d="M${ax.toFixed(1)} ${ay.toFixed(1)}A${R} ${R} 0 0 1 ${bx.toFixed(1)} ${by.toFixed(1)}" fill="none" stroke="${col}" stroke-width="${w}"/>`;
    };
    const needle = 0.47, nx = cx + (R - 12) * Math.cos(Math.PI * (1 - needle)), ny = cy - (R - 12) * Math.sin(Math.PI * (1 - needle));
    return arc(0, 0.38, t.red, 10) + arc(0.4, 0.6, t.mute, 10) + arc(0.62, 1, t.ink, 10)
      + `<line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="${t.ink}" stroke-width="2.5"/><circle cx="${cx}" cy="${cy}" r="4" fill="${t.ink}"/>`
      + mono(cx, cy + 22, 'REVIEW', t, { anchor: 'middle', size: 9.5 });
  }
  if (kind === 'budget') {
    const v = [0.55, 0.8, 0.4, 1.08, 0.65], bw = 14, base = y + 100, lim = base - 70;
    return v.map((h, i) => `<rect x="${x + 2 + i * 21}" y="${(base - h * 70).toFixed(1)}" width="${bw}" height="${(h * 70).toFixed(1)}" fill="${h > 1 ? t.red : t.ink}"/>`).join('')
      + `<line x1="${x}" y1="${lim}" x2="${x + 106}" y2="${lim}" stroke="${t.red}" stroke-dasharray="4 3" stroke-width="1.5"/>${mono(x + 106, lim - 6, 'BUDGET', t, { anchor: 'end', size: 9.5 })}`
      + `<line x1="${x}" y1="${base}" x2="${x + 106}" y2="${base}" stroke="${t.rule}"/>`;
  }
  return '';
}
const dark = (t) => t.bg === '#0d1117';

export function tileSvg(p, isDark) {
  const t = theme(isDark);
  const W = 410, H = 210;
  return svgOpen(W, H, `${p.title}: ${p.lines.join(' ')} Built with ${p.stack}.`, t)
    + `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="none" stroke="${t.rule}"/>
<rect x="24" y="22" width="24" height="3" fill="${t.red}"/>
${mono(24, 44, p.kicker, t, { size: 9.5 })}
<text x="24" y="72" ${F} font-size="20" font-weight="700" fill="${t.ink}">${esc(p.title)}</text>
${p.lines.map((l, i) => `<text x="24" y="${98 + i * 18}" ${F} font-size="12.5" fill="${t.ink}" fill-opacity="0.85">${esc(l)}</text>`).join('')}
<text x="24" y="${H - 22}" ${F} font-size="11.5" fill="${t.mute}">${esc(p.stack)}</text>
${motif(p.motif, t, 278, 48)}
</svg>
`;
}

// ---------- main ----------

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync('assets', { recursive: true });
  for (const d of [false, true]) {
    const sfx = d ? 'dark' : 'light';
    writeFileSync(`assets/experience-${sfx}.svg`, timelineSvg(EXPERIENCE, d));
    for (const p of PROJECTS) writeFileSync(`assets/project-${p.slug}-${sfx}.svg`, tileSvg(p, d));
  }
  console.log('Drew experience and project panels');
}

export const portraitB64 = () => { try { return readFileSync('assets/portrait.jpg').toString('base64'); } catch { return ''; } };
