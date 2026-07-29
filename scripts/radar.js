import fs from "fs";

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_PAT;
const USER = "1919-14";
const BASE = "https://api.github.com";

const headers = {
  Accept: "application/vnd.github+json",
  ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }),
};

async function get(url, h = headers) {
  const res = await fetch(url, { headers: h });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function paginate(url) {
  const items = [];
  for (let p = 1; ; p++) {
    const data = await get(`${url}&per_page=100&page=${p}`);
    if (!data.length) break;
    items.push(...data);
  }
  return items;
}

// Order: top → top-right → bottom-right → bottom → bottom-left → top-left (clockwise)
const LABELS = ["Reviews", "Issues", "Commits", "Pull Requests", "Repos", "Stars"];

// Angles for 6 axes (clockwise from top)
const ANGLES = [-Math.PI / 2, -Math.PI / 6, Math.PI / 6, Math.PI / 2, (5 * Math.PI) / 6, (7 * Math.PI) / 6];

function point(r, i) {
  return {
    x: 250 + r * Math.cos(ANGLES[i]),
    y: 250 + r * Math.sin(ANGLES[i]),
  };
}

function fmt(n) {
  return Math.round(n * 10) / 10;
}

function buildSVG(stats, theme) {
  const values = [stats.reviews, stats.issues, stats.commits, stats.pullRequests, stats.repoCount, stats.stars];
  const logged = values.map((v) => Math.log10(v + 1));
  const maxLog = Math.max(...logged);
  const norm = logged.map((l) => Math.max((l / (maxLog || 1)) * 100, 3));

  const W = 500, H = 500, CX = 250, CY = 250, R = 170;

  const bg = theme === "dark" ? "#0A101F" : "#FFFFFF";
  const tc = theme === "dark" ? "#E5E9F5" : "#111827";
  const gc = theme === "dark" ? "#2B3245" : "#D1D5DB";
  const ac = "#7C3AED";

  const lines = [];

  lines.push(`  <rect width="${W}" height="${H}" rx="20" fill="${bg}"/>`);

  lines.push(
    `<text x="${CX}" y="40" font-size="22" font-family="system-ui,-apple-system,sans-serif" font-weight="700" text-anchor="middle" fill="${tc}">Activity Radar</text>`
  );

  for (const pct of [0.25, 0.5, 0.75]) {
    const r = R * pct;
    lines.push(`  <circle cx="${CX}" cy="${CY}" r="${r}" stroke="${gc}" stroke-width="1.5" fill="none"/>`);
  }

  for (let i = 0; i < 6; i++) {
    const p = point(R, i);
    lines.push(`  <line x1="${CX}" y1="${CY}" x2="${fmt(p.x)}" y2="${fmt(p.y)}" stroke="${gc}" stroke-width="1.5"/>`);
  }

  const pts = norm
    .map((v, i) => {
      const p = point((v / 100) * R, i);
      return `${fmt(p.x)},${fmt(p.y)}`;
    })
    .join(" ");
  lines.push(`  <polygon points="${pts}" fill="${ac}" fill-opacity="0.35" stroke="${ac}" stroke-width="3"/>`);

  for (let i = 0; i < 6; i++) {
    const p = point((norm[i] / 100) * R, i);
    lines.push(`  <circle cx="${fmt(p.x)}" cy="${fmt(p.y)}" r="5" fill="${ac}"/>`);
  }

  const labelAnchor = ["middle", "start", "start", "middle", "end", "end"];
  const labelDx = [0, 14, 14, 0, -14, -14];
  const labelDy = [-14, 4, 4, 18, 4, 4];

  for (let i = 0; i < 6; i++) {
    const p = point(R + 22, i);
    lines.push(
      `<text x="${fmt(p.x)}" y="${fmt(p.y)}" dx="${labelDx[i]}" dy="${labelDy[i]}" font-size="13" font-family="system-ui,-apple-system,sans-serif" font-weight="600" text-anchor="${labelAnchor[i]}" fill="${tc}">${LABELS[i]}</text>`
    );
  }

  for (let i = 0; i < 6; i++) {
    const p = point((norm[i] / 100) * R, i);
    const ox = Math.cos(ANGLES[i]) * 12;
    const oy = Math.sin(ANGLES[i]) * 12 + 4;
    lines.push(
      `<text x="${fmt(p.x)}" y="${fmt(p.y)}" dx="${fmt(ox)}" dy="${fmt(oy)}" font-size="11" font-family="system-ui,-apple-system,sans-serif" font-weight="500" text-anchor="middle" fill="${ac}">${values[i]}</text>`
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n${lines.join("\n")}\n</svg>`;
}

async function main() {
  console.log("Fetching repos...");
  const repos = await paginate(`${BASE}/users/${USER}/repos?type=public`);
  const repoCount = repos.length;
  const stars = repos.reduce((s, r) => s + r.stargazers_count, 0);

  console.log("Fetching issues...");
  const issues = (await get(`${BASE}/search/issues?q=author:${USER}+type:issue`)).total_count;

  console.log("Fetching PRs...");
  const prs = (await get(`${BASE}/search/issues?q=author:${USER}+type:pr`)).total_count;

  console.log("Fetching reviews...");
  const reviews = (await get(`${BASE}/search/issues?q=reviewed-by:${USER}+type:pr`)).total_count;

  console.log("Fetching commits...");
  let commits = 0;
  try {
    const previewHeaders = { ...headers, Accept: "application/vnd.github.cloak-preview" };
    const { total_count } = await get(`${BASE}/search/commits?q=author:${USER}`, previewHeaders);
    commits = total_count;
  } catch (e) {
    console.warn("search/commits failed, trying per-repo fallback:", e.message);
    for (const r of repos) {
      try {
        const previewHeaders = { ...headers, Accept: "application/vnd.github.cloak-preview" };
        const { total_count } = await get(
          `${BASE}/search/commits?q=repo:${USER}/${r.name}+author:${USER}`,
          previewHeaders
        );
        commits += total_count;
      } catch {
        // skip repos without accessible commit data
      }
    }
  }

  const stats = { reviews, stars, issues, repoCount, commits, pullRequests: prs };
  console.log("Stats:", JSON.stringify(stats));

  fs.mkdirSync("assets", { recursive: true });
  for (const theme of ["dark", "light"]) {
    const svg = buildSVG(stats, theme);
    fs.writeFileSync(`assets/radar-${theme}.svg`, svg);
  }
  console.log("Radar SVGs generated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
