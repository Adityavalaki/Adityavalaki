// Draws assets/stats-light.svg and assets/stats-dark.svg from public GitHub data.
// Runs in GitHub Actions with the built-in GITHUB_TOKEN. No third-party services.
import { writeFileSync, mkdirSync } from 'node:fs';

const LOGIN = process.env.GH_LOGIN || 'Adityavalaki';
const TOKEN = process.env.GITHUB_TOKEN;

const query = `query($login:String!){ user(login:$login){
  createdAt
  repositories(ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, first: 100) {
    totalCount
    nodes { stargazerCount languages(first: 10, orderBy: {field: SIZE, direction: DESC}) { edges { size node { name } } } }
  }
  contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } }
}}`;

export function summarise(user, today = new Date().toISOString().slice(0, 10)) {
  const repos = user.repositories.nodes;
  const stars = repos.reduce((n, r) => n + r.stargazerCount, 0);
  const bytes = {};
  for (const r of repos) for (const e of r.languages.edges) bytes[e.node.name] = (bytes[e.node.name] || 0) + e.size;
  const total = Object.values(bytes).reduce((a, b) => a + b, 0) || 1;
  const sorted = Object.entries(bytes).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 5).map(([name, b]) => ({ name, pct: (b / total) * 100 }));
  const otherPct = 100 - top.reduce((n, l) => n + l.pct, 0);
  if (sorted.length > 5 && otherPct > 0.05) top.push({ name: 'Other', pct: otherPct });

  const days = user.contributionsCollection.contributionCalendar.weeks.flatMap((w) => w.contributionDays).filter((d) => d.date <= today);
  let longest = 0, run = 0;
  for (const d of days) { run = d.contributionCount > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
  // Current streak: today may still be empty, so start counting from yesterday in that case.
  let i = days.length - 1, current = 0;
  if (i >= 0 && days[i].contributionCount === 0) i -= 1;
  for (; i >= 0 && days[i].contributionCount > 0; i -= 1) current += 1;

  return {
    repos: user.repositories.totalCount,
    stars,
    contributions: user.contributionsCollection.contributionCalendar.totalContributions,
    current, longest, top,
    since: user.createdAt.slice(0, 4),
    updated: today,
  };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function svg(s, dark) {
  const t = dark
    ? { bg: '#0d1117', ink: '#e6edf3', mute: '#8b949e', rule: '#30363d', red: '#e5533d', shades: ['#e5533d', '#e6edf3', '#a4abb3', '#6e7681', '#484f58', '#30363d'] }
    : { bg: '#f4f5f2', ink: '#111214', mute: '#5b6067', rule: '#c5c8c2', red: '#c62d17', shades: ['#c62d17', '#111214', '#4b4f55', '#7c8187', '#a9adb2', '#cfd2cc'] };
  const W = 840, H = 252, F = "font-family=\"-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif\"";
  const figs = [
    [s.contributions, 'Contributions, last 12 months'],
    [s.repos, 'Public repositories'],
    [`${s.current} / ${s.longest}`, 'Current / longest streak (days)'],
    [s.stars, 'Stars earned'],
  ];
  const fx = (k) => 28 + (k % 2) * 200, fy = (k) => 74 + Math.floor(k / 2) * 80;
  const barX = 470, barW = 342;
  let acc = 0;
  const segs = s.top.map((l, k) => { const w = Math.max(2, (l.pct / 100) * barW); const r = `<rect x="${(barX + acc).toFixed(1)}" y="70" width="${w.toFixed(1)}" height="10" fill="${t.shades[k]}"/>`; acc += (l.pct / 100) * barW; return r; }).join('');
  const legend = s.top.map((l, k) => { const x = barX, y = 108 + k * 22;
    return `<rect x="${x}" y="${y - 9}" width="10" height="10" fill="${t.shades[k]}"/><text x="${x + 18}" y="${y}" ${F} font-size="13" fill="${t.ink}">${esc(l.name)}<tspan dx="8" fill="${t.mute}">${l.pct.toFixed(1)}%</tspan></text>`; }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="GitHub activity for ${esc(LOGIN)}: ${s.contributions} contributions in the last 12 months, ${s.repos} public repositories, current streak ${s.current} days, longest ${s.longest} days, ${s.stars} stars. Top languages: ${s.top.map((l) => `${esc(l.name)} ${l.pct.toFixed(1)}%`).join(', ')}.">
<rect width="${W}" height="${H}" fill="${t.bg}"/>
<rect x="28" y="24" width="32" height="3" fill="${t.red}"/>
<text x="28" y="48" ${F} font-size="12" font-weight="700" letter-spacing="1.6" fill="${t.ink}">GITHUB ACTIVITY</text>
<text x="${barX}" y="48" ${F} font-size="12" font-weight="700" letter-spacing="1.6" fill="${t.ink}">LANGUAGES BY CODE VOLUME</text>
<line x1="440" y1="24" x2="440" y2="${H - 24}" stroke="${t.rule}"/>
${figs.map(([v, l], k) => `<text x="${fx(k)}" y="${fy(k) + 30}" ${F} font-size="30" font-weight="700" fill="${t.ink}">${esc(v)}</text><text x="${fx(k)}" y="${fy(k) + 50}" ${F} font-size="12" fill="${t.mute}">${esc(l)}</text>`).join('\n')}
${segs}
${legend}
<text x="${W - 28}" y="${H - 14}" ${F} font-size="11" fill="${t.mute}" text-anchor="end">Public data from GitHub, updated ${s.updated}</text>
</svg>
`;
}

async function main() {
  if (!TOKEN) throw new Error('GITHUB_TOKEN is not set');
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-stats' },
    body: JSON.stringify({ query, variables: { login: LOGIN } }),
  });
  const json = await res.json();
  if (!res.ok || json.errors || !json.data?.user) throw new Error(`GitHub API error: ${res.status} ${JSON.stringify(json.errors || json)}`);
  const s = summarise(json.data.user);
  console.log(JSON.stringify(s));
  mkdirSync('assets', { recursive: true });
  writeFileSync('assets/stats-light.svg', svg(s, false));
  writeFileSync('assets/stats-dark.svg', svg(s, true));
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
