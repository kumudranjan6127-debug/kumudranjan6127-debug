// Regenerates assets/stats.svg and assets/langs.svg from live GitHub data.
// Run: GITHUB_TOKEN=<token> LOGIN=<user> node scripts/gen-stats.mjs
import { writeFileSync, mkdirSync } from "node:fs";

const LOGIN = process.env.LOGIN || "kumudranjan6127-debug";
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) throw new Error("GITHUB_TOKEN is required");

const QUERY = `
{ user(login: "${LOGIN}") {
    followers { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
      totalCount
      nodes {
        stargazerCount
        languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
          edges { size node { name color } }
        }
      }
    }
    contributionsCollection {
      totalCommitContributions
      contributionCalendar { totalContributions }
    }
    pullRequests { totalCount }
} }`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: QUERY }),
});
if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
const { data, errors } = await res.json();
if (errors) throw new Error(JSON.stringify(errors));

const u = data.user;
const repos = u.repositories.nodes;

const stats = {
  stars: repos.reduce((n, r) => n + r.stargazerCount, 0),
  repos: u.repositories.totalCount,
  commits: u.contributionsCollection.totalCommitContributions,
  contributions: u.contributionsCollection.contributionCalendar.totalContributions,
  prs: u.pullRequests.totalCount,
  followers: u.followers.totalCount,
};

// Aggregate language bytes across all owned, non-fork repos
const bytes = new Map();
for (const r of repos) {
  for (const { size, node } of r.languages.edges) {
    const prev = bytes.get(node.name) || { size: 0, color: node.color || "#8A7A5C" };
    prev.size += size;
    bytes.set(node.name, prev);
  }
}
const total = [...bytes.values()].reduce((n, v) => n + v.size, 0) || 1;
const langs = [...bytes.entries()]
  .map(([name, v]) => ({ name, color: v.color, pct: (v.size / total) * 100 }))
  .sort((a, b) => b.pct - a.pct)
  .slice(0, 6);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const YEAR = new Date().getUTCFullYear();

const CARD = (title, body, label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 220" width="480" height="220" role="img" aria-label="${esc(label)}">
  <title>${esc(label)}</title>
  <defs>
    <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0F0C08"/><stop offset="100%" stop-color="#15110B"/>
    </linearGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#C9A24B" stop-opacity=".45"/>
      <stop offset="50%" stop-color="#C9A24B" stop-opacity=".14"/>
      <stop offset="100%" stop-color="#C9A24B" stop-opacity=".45"/>
    </linearGradient>
    <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#C9A24B" stop-opacity=".8"/>
      <stop offset="100%" stop-color="#C9A24B" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="barclip"><rect x="28" y="66" width="424" height="16" rx="8"/></clipPath>
    <clipPath id="wipeclip"><rect class="wipe" x="28" y="60" width="0" height="30"/></clipPath>
  </defs>
  <style>
    .mono { font-family: "JetBrains Mono","SF Mono","Fira Code",ui-monospace,Consolas,monospace; }
    .lbl { font-size: 10.5px; letter-spacing: 1.4px; fill: #8A7A5C; }
    .val { font-size: 24px; font-weight: 700; fill: #E8C874; }
    .hdr { font-size: 12px; letter-spacing: 2.6px; fill: #C9A24B; }
    .nm  { font-size: 11.5px; fill: #D6C9A8; }
    .pc  { font-size: 11.5px; fill: #8A7A5C; }
    .item, .leg { opacity: 0; animation: pop .7s cubic-bezier(.2,.7,.3,1) forwards; }
    @keyframes pop { from { opacity:0; transform: translateY(8px);} to { opacity:1; transform: translateY(0);} }
    .ruleIn { transform-origin: 0 0; transform: scaleX(0); animation: rin 1s ease .1s forwards; }
    @keyframes rin { to { transform: scaleX(1); } }
    .wipe { animation: fill 1.5s cubic-bezier(.55,.05,.2,1) .25s forwards; }
    @keyframes fill { to { width: 424px; } }
    .spark, .dot { animation: glow 3.8s ease-in-out infinite; }
    @keyframes glow { 0%,100%{opacity:.4} 50%{opacity:1} }
    @media (prefers-reduced-motion: reduce) {
      .item,.leg { opacity:1; animation:none; }
      .ruleIn { transform: scaleX(1); animation:none; }
      .wipe { width: 424px; animation:none; }
      .spark,.dot { animation:none; }
    }
  </style>
  <rect x=".8" y=".8" width="478.4" height="218.4" rx="11" fill="url(#card)" stroke="url(#edge)" stroke-width="1.2"/>
  <text class="mono hdr" x="28" y="36">${title}</text>
  <rect class="ruleIn" x="28" y="46" width="424" height="1.2" fill="url(#rule)"/>
${body}
</svg>
`;

const tile = (x, y, label, value, delay, small) => `  <g class="item" style="animation-delay:${delay}s">
    <text class="mono lbl" x="${x}" y="${y}">${label}</text>
    <text class="mono val" x="${small ? x + 112 : x}" y="${small ? y : y + 26}"${small ? ' font-size="17"' : ""}>${value}</text>
  </g>`;

const statsBody = [
  `  <circle class="spark" cx="440" cy="32" r="3" fill="#E8C874"/>`,
  tile(28, 82, "TOTAL STARS", stats.stars, 0.10),
  tile(262, 82, "REPOSITORIES", stats.repos, 0.18),
  tile(28, 140, `COMMITS (${YEAR})`, stats.commits, 0.26),
  tile(262, 140, "CONTRIBUTIONS", stats.contributions, 0.34),
  tile(28, 196, "PULL REQUESTS", stats.prs, 0.42, true),
  tile(262, 196, "FOLLOWERS", stats.followers, 0.50, true),
].join("\n");

let cursor = 28;
const segs = langs.map((l) => {
  const w = (l.pct / 100) * 424;
  const s = `    <rect x="${cursor.toFixed(1)}" y="66" width="${w.toFixed(1)}" height="16" fill="${l.color}"/>`;
  cursor += w;
  return s;
});

const legend = langs.map((l, i) => {
  const col = i < 3 ? 0 : 1;
  const row = i % 3;
  const cx = col ? 266 : 34;
  const tx = col ? 278 : 46;
  const px = col ? 452 : 180;
  const y = 118 + row * 30;
  return `  <g class="leg" style="animation-delay:${(0.9 + i * 0.08).toFixed(2)}s">
    <circle class="dot" cx="${cx}" cy="${y}" r="5" fill="${l.color}"/>
    <text class="mono nm" x="${tx}" y="${y + 4}">${esc(l.name)}</text>
    <text class="mono pc" x="${px}" y="${y + 4}" text-anchor="end">${l.pct.toFixed(1)}%</text>
  </g>`;
}).join("\n");

const langsBody = `  <rect x="28" y="66" width="424" height="16" rx="8" fill="#241D12"/>
  <g clip-path="url(#wipeclip)"><g clip-path="url(#barclip)">
${segs.join("\n")}
  </g></g>
${legend}`;

mkdirSync("assets", { recursive: true });
writeFileSync("assets/stats.svg", CARD("◢ GITHUB STATS", statsBody,
  `GitHub Stats — ${stats.stars} stars, ${stats.commits} commits, ${stats.prs} pull requests`));
writeFileSync("assets/langs.svg", CARD("◢ TOP LANGUAGES", langsBody,
  `Top Languages — ${langs.map((l) => `${l.name} ${l.pct.toFixed(1)}%`).join(", ")}`));

console.log("stats:", stats);
console.log("langs:", langs.map((l) => `${l.name} ${l.pct.toFixed(1)}%`).join(" · "));
