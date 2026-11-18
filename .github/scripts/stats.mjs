// Keeps the profile live from public data. Runs in GitHub Actions with the built-in GITHUB_TOKEN; no third-party services.
//   assets/activity-{light,dark}.svg   12-month contribution heatmap, totals and languages
//   assets/racecraft-{light,dark}.svg  Racecraft's held-out 2026 accuracy, read from that repo's README, plus its latest release
//   README.md, between the RECENT markers: the most recently pushed public repos with their latest commit
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const LOGIN = process.env.GH_LOGIN || 'Adityavalaki';
const TOKEN = process.env.GITHUB_TOKEN;
const RACECRAFT = `${LOGIN}/racecraft`;

const query = `query($login:String!){ user(login:$login){
  repositories(ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, first: 100, orderBy: {field: PUSHED_AT, direction: DESC}) {
    totalCount
    nodes {
      name url description pushedAt
      primaryLanguage { name }
      languages(first: 10, orderBy: {field: SIZE, direction: DESC}) { edges { size node { name } } }
      defaultBranchRef { target { ... on Commit { messageHeadline committedDate } } }
    }
  }
  contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } }
}}`;

// ---------- data ----------

export function summarise(user, today = new Date().toISOString().slice(0, 10)) {
  const repos = user.repositories.nodes;
  const bytes = {};
  for (const r of repos) for (const e of r.languages.edges) bytes[e.node.name] = (bytes[e.node.name] || 0) + e.size;
  const total = Object.values(bytes).reduce((a, b) => a + b, 0) || 1;
  const sorted = Object.entries(bytes).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 5).map(([name, b]) => ({ name, pct: (b / total) * 100 }));
  const otherPct = 100 - top.reduce((n, l) => n + l.pct, 0);
  if (sorted.length > 5 && otherPct > 0.05) top.push({ name: 'Other', pct: otherPct });

  const weeks = user.contributionsCollection.contributionCalendar.weeks.map((w) => w.contributionDays.filter((d) => d.date <= today));
  const days = weeks.flat();
  return {
    repos: user.repositories.totalCount,
    contributions: user.contributionsCollection.contributionCalendar.totalContributions,
    activeDays: days.filter((d) => d.contributionCount > 0).length,
    busiest: days.reduce((m, d) => Math.max(m, d.contributionCount), 0),
    weeks, top, updated: today,
  };
}

export function recent(user, n = 4) {
  return user.repositories.nodes
    .filter((r) => r.name.toLowerCase() !== LOGIN.toLowerCase())
    .slice(0, n)
    .map((r) => ({
      name: r.name, url: r.url, lang: r.primaryLanguage?.name || '',
      date: (r.defaultBranchRef?.target?.committedDate || r.pushedAt).slice(0, 10),
      commit: r.defaultBranchRef?.target?.messageHeadline || '',
    }));
}

// Reads the "2026, never tuned on" row of Racecraft's race-prediction table. Returns null if the table changed shape.
export function parseRacecraft(md) {
  const row = md.split('\n').find((l) => /^\|\s*2026[^|]*never tuned/i.test(l));
  if (!row) return null;
  const cells = row.split('|').slice(1, -1).map((c) => c.trim());
  if (cells.length < 5) return null;
  const num = (s) => { const m = s.match(/\*\*([\d.]+)%?/); return m ? Number(m[1]) : NaN; };
  const base = (s) => { const m = s.match(/\((?:grid|pole)\s+([\d.]+)%?\)/); return m ? Number(m[1]) : NaN; };
  const races = Number((cells[0].match(/(\d+)\s+races/) || [])[1]);
  const metric = (k, label, baseLabel, max, opts = {}) => ({ label, baseLabel, max, value: num(cells[k]), base: base(cells[k]), ...opts });
  const m = [
    metric(1, 'Finishing order', 'grid', 1, { fmt: (v) => v.toFixed(2), note: 'rank correlation' }),
    metric(2, 'Winner named', 'pole', 100, { fmt: (v) => `${Math.round(v)}%` }),
    metric(3, 'Podium places named', 'grid', 3, { fmt: (v) => `${v.toFixed(2)} / 3` }),
    metric(4, 'Win-chance error', 'grid', 1, { fmt: (v) => v.toFixed(2), lowerBetter: true, note: 'Brier, lower is better' }),
  ];
  if (!races || m.some((x) => Number.isNaN(x.value) || Number.isNaN(x.base))) return null;
  return { races, metrics: m };
}

// ---------- drawing ----------

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const F = "font-family=\"-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif\"";
const theme = (dark) => dark
  ? { bg: '#0d1117', ink: '#e6edf3', mute: '#8b949e', rule: '#30363d', red: '#e5533d', base: '#6e7681',
      heat: ['#161b22', '#4a1d17', '#7a2a1f', '#b03b28', '#e5533d'],
      shades: ['#e5533d', '#e6edf3', '#a4abb3', '#6e7681', '#484f58', '#30363d'] }
  : { bg: '#f4f5f2', ink: '#111214', mute: '#5b6067', rule: '#c5c8c2', red: '#c62d17', base: '#a9adb2',
      heat: ['#e3e5e0', '#f2c4bb', '#e38a78', '#d4553d', '#c62d17'],
      shades: ['#c62d17', '#111214', '#4b4f55', '#7c8187', '#a9adb2', '#cfd2cc'] };
const kicker = (x, y, text, t) => `<text x="${x}" y="${y}" ${F} font-size="12" font-weight="700" letter-spacing="1.6" fill="${t.ink}">${esc(text)}</text>`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Levels by quartile of non-zero days, so one huge day doesn't wash out the rest.
function levels(days) {
  const nz = days.map((d) => d.contributionCount).filter((c) => c > 0).sort((a, b) => a - b);
  const q = (p) => nz[Math.min(nz.length - 1, Math.floor(p * nz.length))] || 1;
  const cuts = [q(0.25), q(0.5), q(0.75)];
  return (c) => (c === 0 ? 0 : c <= cuts[0] ? 1 : c <= cuts[1] ? 2 : c <= cuts[2] ? 3 : 4);
}

export function activitySvg(s, dark) {
  const t = theme(dark);
  const W = 840, H = 322, X0 = 28, Y0 = 84, C = 11, G = 3, P = C + G;
  const lvl = levels(s.weeks.flat());
  let cells = '', months = '', lastMonth = -1;
  s.weeks.forEach((w, wi) => {
    w.forEach((d) => {
      const dow = new Date(`${d.date}T00:00:00Z`).getUTCDay();
      cells += `<rect x="${X0 + wi * P}" y="${Y0 + dow * P}" width="${C}" height="${C}" rx="2" fill="${t.heat[lvl(d.contributionCount)]}"><title>${d.date}: ${d.contributionCount}</title></rect>`;
    });
    const m = w[0] && Number(w[0].date.slice(5, 7)) - 1;
    if (w[0] && m !== lastMonth && wi < s.weeks.length - 2) {
      if (lastMonth !== -1 || Number(w[0].date.slice(8)) <= 7) months += `<text x="${X0 + wi * P}" y="${Y0 - 8}" ${F} font-size="11" fill="${t.mute}">${MONTHS[m]}</text>`;
      lastMonth = m;
    }
  });
  const gridR = X0 + s.weeks.length * P - G;
  const key = t.heat.map((c, k) => `<rect x="${gridR - (5 - k) * P + G}" y="${Y0 + 7 * P + 6}" width="${C}" height="${C}" rx="2" fill="${c}"/>`).join('');

  const figs = [[s.contributions, 'Contributions'], [s.activeDays, 'Days with commits'], [s.repos, 'Public repositories']];
  const fy = 246;
  const figSvg = figs.map(([v, l], k) => `<text x="${X0 + k * 140}" y="${fy + 30}" ${F} font-size="30" font-weight="700" fill="${k === 0 ? t.red : t.ink}">${esc(v)}</text><text x="${X0 + k * 140}" y="${fy + 50}" ${F} font-size="12" fill="${t.mute}">${esc(l)}</text>`).join('');

  const barX = 470, barW = W - 28 - barX, barY = 236;
  let acc = 0;
  const segs = s.top.map((l, k) => { const w = Math.max(2, (l.pct / 100) * barW); const r = `<rect x="${(barX + acc).toFixed(1)}" y="${barY}" width="${w.toFixed(1)}" height="8" fill="${t.shades[k]}"/>`; acc += (l.pct / 100) * barW; return r; }).join('');
  const legend = s.top.map((l, k) => { const x = barX + (k % 3) * 116, y = barY + 32 + Math.floor(k / 3) * 22;
    return `<rect x="${x}" y="${y - 9}" width="10" height="10" fill="${t.shades[k]}"/><text x="${x + 16}" y="${y}" ${F} font-size="12" fill="${t.ink}">${esc(l.name)}<tspan dx="6" fill="${t.mute}">${l.pct.toFixed(0)}%</tspan></text>`; }).join('');

  const label = `GitHub activity for ${LOGIN}: ${s.contributions} contributions in the last 12 months on ${s.activeDays} different days, ${s.repos} public repositories. Top languages: ${s.top.map((l) => `${l.name} ${l.pct.toFixed(0)}%`).join(', ')}.`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
<rect width="${W}" height="${H}" fill="${t.bg}"/>
<rect x="${X0}" y="24" width="32" height="3" fill="${t.red}"/>
${kicker(X0, 48, 'CONTRIBUTIONS, LAST 12 MONTHS', t)}
${months}
${cells}
<text x="${gridR - 5 * P - 4}" y="${Y0 + 7 * P + 15}" ${F} font-size="11" fill="${t.mute}" text-anchor="end">Less</text>${key}<text x="${gridR + 6}" y="${Y0 + 7 * P + 15}" ${F} font-size="11" fill="${t.mute}">More</text>
<line x1="${X0}" y1="222" x2="${W - 28}" y2="222" stroke="${t.rule}"/>
${figSvg}
${segs}
${legend}
<text x="${W - 28}" y="${H - 10}" ${F} font-size="11" fill="${t.mute}" text-anchor="end">Public GitHub data, updated ${s.updated}</text>
</svg>
`;
}

export function racecraftSvg(r, rel, dark, today) {
  const t = theme(dark);
  const W = 840, H = 300, X0 = 28;
  const rows = r.metrics.map((m, k) => {
    const y = 104 + k * 42, bx = 300, bw = 400;
    const vw = (Math.min(m.value, m.max) / m.max) * bw, gw = (Math.min(m.base, m.max) / m.max) * bw;
    const better = m.lowerBetter ? m.value < m.base : m.value > m.base;
    const tie = m.value === m.base;
    const verdict = tie ? 'level' : better ? 'ahead' : 'behind';
    return `<text x="${X0}" y="${y + 4}" ${F} font-size="14" font-weight="600" fill="${t.ink}">${esc(m.label)}</text>`
      + (m.note ? `<text x="${X0}" y="${y + 20}" ${F} font-size="11" fill="${t.mute}">${esc(m.note)}</text>` : '')
      + `<rect x="${bx}" y="${y - 8}" width="${vw.toFixed(1)}" height="9" fill="${t.red}"/>`
      + `<rect x="${bx}" y="${y + 4}" width="${gw.toFixed(1)}" height="9" fill="${t.base}"/>`
      + `<text x="${W - 28}" y="${y + 1}" ${F} font-size="14" font-weight="700" fill="${t.ink}" text-anchor="end">${esc(m.fmt(m.value))}</text>`
      + `<text x="${W - 28}" y="${y + 15}" ${F} font-size="11" fill="${t.mute}" text-anchor="end">${esc(m.baseLabel)} ${esc(m.fmt(m.base))} · ${verdict}</text>`;
  }).join('\n');
  const relText = rel ? `Latest release ${rel.tag}, ${rel.date}` : '';
  const label = `Racecraft race predictions on the 2026 season, ${r.races} races never used for tuning: ${r.metrics.map((m) => `${m.label} ${m.fmt(m.value)} against ${m.baseLabel} ${m.fmt(m.base)}`).join('; ')}. ${relText}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
<rect width="${W}" height="${H}" fill="${t.bg}"/>
<rect x="${X0}" y="24" width="32" height="3" fill="${t.red}"/>
${kicker(X0, 48, `RACECRAFT · RACE PREDICTIONS ON ${r.races} RACES OF 2026, NEVER TUNED ON`, t)}
<rect x="300" y="62" width="10" height="9" fill="${t.red}"/><text x="316" y="71" ${F} font-size="11" fill="${t.mute}">Racecraft</text>
<rect x="390" y="62" width="10" height="9" fill="${t.base}"/><text x="406" y="71" ${F} font-size="11" fill="${t.mute}">Baseline: the grid or pole decides</text>
${rows}
<text x="${X0}" y="${H - 10}" ${F} font-size="11" fill="${t.mute}">${esc(relText)}</text>
<text x="${W - 28}" y="${H - 10}" ${F} font-size="11" fill="${t.mute}" text-anchor="end">From the Racecraft README, updated ${today}</text>
</svg>
`;
}

export function recentMd(items) {
  const rows = items.map((r) => `| [**${esc(r.name)}**](${r.url}) | ${esc(r.commit).replace(/\|/g, '\\|')} | ${r.lang} | ${r.date} |`);
  return ['| Repository | Latest commit | Language | Date |', '|:--|:--|:--|:--|', ...rows].join('\n');
}

export function replaceBetween(text, tag, body) {
  const re = new RegExp(`(<!-- ${tag}:START -->)[\\s\\S]*?(<!-- ${tag}:END -->)`);
  return re.test(text) ? text.replace(re, `$1\n${body}\n$2`) : text;
}

// ---------- main ----------

async function gh(path, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, { ...init, headers: { Authorization: `bearer ${TOKEN}`, 'User-Agent': 'profile-stats', 'Content-Type': 'application/json', ...init.headers } });
  return res;
}

async function main() {
  if (!TOKEN) throw new Error('GITHUB_TOKEN is not set');
  const today = new Date().toISOString().slice(0, 10);
  const res = await gh('/graphql', { method: 'POST', body: JSON.stringify({ query, variables: { login: LOGIN } }) });
  const json = await res.json();
  if (!res.ok || json.errors || !json.data?.user) throw new Error(`GitHub API error: ${res.status} ${JSON.stringify(json.errors || json)}`);
  const user = json.data.user;
  mkdirSync('assets', { recursive: true });

  const s = summarise(user, today);
  writeFileSync('assets/activity-light.svg', activitySvg(s, false));
  writeFileSync('assets/activity-dark.svg', activitySvg(s, true));

  // Racecraft: a failure here keeps the last good card instead of failing the run.
  try {
    const md = await (await gh(`/repos/${RACECRAFT}/readme`, { headers: { Accept: 'application/vnd.github.raw+json' } })).text();
    const r = parseRacecraft(md);
    const relRes = await gh(`/repos/${RACECRAFT}/releases/latest`);
    const relJson = relRes.ok ? await relRes.json() : null;
    const rel = relJson?.tag_name ? { tag: relJson.tag_name, date: relJson.published_at.slice(0, 10) } : null;
    if (r) {
      writeFileSync('assets/racecraft-light.svg', racecraftSvg(r, rel, false, today));
      writeFileSync('assets/racecraft-dark.svg', racecraftSvg(r, rel, true, today));
    } else console.warn('Racecraft README table not found; keeping the previous card');
  } catch (e) { console.warn(`Racecraft card skipped: ${e.message}`); }

  if (existsSync('README.md')) {
    const before = readFileSync('README.md', 'utf8');
    const after = replaceBetween(before, 'RECENT', recentMd(recent(user)));
    if (after !== before) writeFileSync('README.md', after);
  }
  console.log(JSON.stringify({ contributions: s.contributions, activeDays: s.activeDays, repos: s.repos }));
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
