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
const METRICS = [
  { label: "Reviews", key: "reviews", icon: "💬" },
  { label: "Issues", key: "issues", icon: "🎯" },
  { label: "Commits", key: "commits", icon: "⚡" },
  { label: "Pull Requests", key: "pullRequests", icon: "🔀" },
  { label: "Repos", key: "repoCount", icon: "📦" },
  { label: "Stars", key: "stars", icon: "⭐" },
];

const ANGLES = [
  -Math.PI / 2,
  -Math.PI / 6,
  Math.PI / 6,
  Math.PI / 2,
  (5 * Math.PI) / 6,
  (7 * Math.PI) / 6,
];

function fmt(n) {
  return Math.round(n * 10) / 10;
}

function formatVal(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toLocaleString();
}

function point(cx, cy, r, i) {
  return {
    x: cx + r * Math.cos(ANGLES[i]),
    y: cy + r * Math.sin(ANGLES[i]),
  };
}

function buildSVG(stats, theme) {
  const values = [
    stats.reviews,
    stats.issues,
    stats.commits,
    stats.pullRequests,
    stats.repoCount,
    stats.stars,
  ];

  const logged = values.map((v) => Math.log10(v + 1));
  const maxLog = Math.max(...logged);
  const norm = logged.map((l) => Math.max((l / (maxLog || 1)) * 100, 12));

  const W = 500;
  const H = 500;
  const CX = 250;
  const CY = 265;
  const R = 135;

  const isDark = theme === "dark";
  const bg = isDark ? "#0A101F" : "#FFFFFF";
  const headerBg = isDark ? "#131A2C" : "#F8FAFC";
  const borderColor = isDark ? "#1F293D" : "#E2E8F0";
  const tc = isDark ? "#E5E9F5" : "#0F172A";
  const subText = isDark ? "#7C8BA8" : "#64748B";
  const gc = isDark ? "#1E293B" : "#E2E8F0";
  const gcAccent = isDark ? "#2B3245" : "#CBD5E1";
  const pillBg = isDark ? "#131A2C" : "#F1F5F9";
  const pillBorder = isDark ? "#2B3245" : "#E2E8F0";

  const totalActivity = values.reduce((a, b) => a + b, 0);

  const lines = [];

  // Filter definitions, Gradients & Keyframe Animations
  lines.push(`  <defs>`);
  lines.push(`    <linearGradient id="radarGrad_${theme}" x1="0%" y1="0%" x2="100%" y2="100%">`);
  lines.push(`      <stop offset="0%" stop-color="#7C3AED" stop-opacity="${isDark ? "0.45" : "0.35"}"/>`);
  lines.push(`      <stop offset="100%" stop-color="#10B981" stop-opacity="${isDark ? "0.3" : "0.2"}"/>`);
  lines.push(`    </linearGradient>`);
  lines.push(`    <linearGradient id="radarStroke_${theme}" x1="0%" y1="0%" x2="100%" y2="100%">`);
  lines.push(`      <stop offset="0%" stop-color="#A78BFA"/>`);
  lines.push(`      <stop offset="50%" stop-color="#7C3AED"/>`);
  lines.push(`      <stop offset="100%" stop-color="#10B981"/>`);
  lines.push(`    </linearGradient>`);
  lines.push(`    <linearGradient id="sweepGrad_${theme}" x1="0%" y1="0%" x2="100%" y2="100%">`);
  lines.push(`      <stop offset="0%" stop-color="#10B981" stop-opacity="0.5"/>`);
  lines.push(`      <stop offset="100%" stop-color="#7C3AED" stop-opacity="0.0"/>`);
  lines.push(`    </linearGradient>`);
  lines.push(`    <filter id="glow_${theme}" x="-20%" y="-20%" width="140%" height="140%">`);
  lines.push(`      <feGaussianBlur stdDeviation="3" result="blur"/>`);
  lines.push(`      <feMerge>`);
  lines.push(`        <feMergeNode in="blur"/>`);
  lines.push(`        <feMergeNode in="SourceGraphic"/>`);
  lines.push(`      </feMerge>`);
  lines.push(`    </filter>`);
  lines.push(`    <style>`);
  lines.push(`      .txt-mono { font-family: 'SF Mono', 'Fira Code', Consolas, monospace; }`);
  lines.push(`      .txt-sans { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }`);
  lines.push(`      @keyframes loopCycle {`);
  lines.push(`        0% { opacity: 0; transform: scale(0.95); }`);
  lines.push(`        0.8% { opacity: 1; transform: scale(1); }`);
  lines.push(`        99.58% { opacity: 1; transform: scale(1); }`);
  lines.push(`        100% { opacity: 0; transform: scale(0.95); }`);
  lines.push(`      }`);
  lines.push(`      @keyframes rotateBeam {`);
  lines.push(`        from { transform: rotate(0deg); }`);
  lines.push(`        to { transform: rotate(360deg); }`);
  lines.push(`      }`);
  lines.push(`      @keyframes nodePulse {`);
  lines.push(`        0%, 100% { r: 6px; opacity: 0.85; }`);
  lines.push(`        50% { r: 8.5px; opacity: 1; }`);
  lines.push(`      }`);
  lines.push(`      .animated-content {`);
  lines.push(`        animation: loopCycle 120.5s ease-in-out infinite;`);
  lines.push(`        transform-origin: 250px 265px;`);
  lines.push(`      }`);
  lines.push(`      .radar-beam {`);
  lines.push(`        animation: rotateBeam 6s linear infinite;`);
  lines.push(`        transform-origin: 250px 265px;`);
  lines.push(`      }`);
  lines.push(`      .node-point {`);
  lines.push(`        animation: nodePulse 2.5s ease-in-out infinite;`);
  lines.push(`      }`);
  lines.push(`    </style>`);
  lines.push(`  </defs>`);

  // Main Card Background & Border (Static container)
  lines.push(`  <rect width="${W}" height="${H}" rx="16" fill="${bg}" stroke="${borderColor}" stroke-width="1.5"/>`);

  // Top Window Header Bar (Static container)
  lines.push(`  <rect width="${W}" height="34" rx="16" fill="${headerBg}"/>`);
  lines.push(`  <rect y="18" width="${W}" height="16" fill="${headerBg}"/>`);
  lines.push(`  <line x1="0" y1="34" x2="${W}" y2="34" stroke="${borderColor}" stroke-width="1"/>`);

  // Window Dots
  lines.push(`  <circle cx="20" cy="17" r="5" fill="#FF5F56"/>`);
  lines.push(`  <circle cx="36" cy="17" r="5" fill="#FFBD2E"/>`);
  lines.push(`  <circle cx="52" cy="17" r="5" fill="#27C93F"/>`);

  // Header Title
  lines.push(
    `  <text x="${CX}" y="21" class="txt-mono" text-anchor="middle" font-size="12" fill="${subText}">activity-radar.sh</text>`
  );

  // Live Indicator Badge
  lines.push(`  <circle cx="438" cy="17" r="4" fill="#10B981">`);
  lines.push(`    <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite"/>`);
  lines.push(`  </circle>`);
  lines.push(
    `  <text x="448" y="21" class="txt-mono" font-size="11" font-weight="700" fill="#10B981">LIVE</text>`
  );

  // --- BEGIN ANIMATED CONTENT GROUP (Fades in, holds 2 min, fades out 0.5s, loops infinitely) ---
  lines.push(`  <g class="animated-content">`);

  // Subheader Banner Title
  lines.push(
    `    <text x="${CX}" y="62" class="txt-sans" font-size="15" font-weight="700" text-anchor="middle" letter-spacing="1.5" fill="${tc}">ACTIVITY RADAR</text>`
  );

  // Rotating Radar Sweep Beam
  lines.push(`    <g class="radar-beam" opacity="0.35">`);
  lines.push(
    `      <path d="M 250 265 L 250 130 A 135 135 0 0 1 366.9 197.5 Z" fill="url(#sweepGrad_${theme})"/>`
  );
  lines.push(`    </g>`);

  // Web Polygons (Grid levels: 25%, 50%, 75%, 100%)
  const levels = [0.25, 0.5, 0.75, 1.0];
  levels.forEach((pct) => {
    const r = R * pct;
    const pts = ANGLES.map((_, i) => {
      const p = point(CX, CY, r, i);
      return `${fmt(p.x)},${fmt(p.y)}`;
    }).join(" ");
    const isOuter = pct === 1.0;
    lines.push(
      `    <polygon points="${pts}" fill="none" stroke="${isOuter ? gcAccent : gc}" stroke-width="${isOuter ? "1.5" : "1"}" ${!isOuter ? 'stroke-dasharray="3,3"' : ""}/>`
    );
  });

  // Radial Axis Lines
  for (let i = 0; i < 6; i++) {
    const p = point(CX, CY, R, i);
    lines.push(
      `    <line x1="${CX}" y1="${CY}" x2="${fmt(p.x)}" y2="${fmt(p.y)}" stroke="${gcAccent}" stroke-width="1.2"/>`
    );
  }

  // Data Polygon (Filled + Glowing Stroke)
  const pts = norm
    .map((v, i) => {
      const p = point(CX, CY, (v / 100) * R, i);
      return `${fmt(p.x)},${fmt(p.y)}`;
    })
    .join(" ");

  lines.push(
    `    <polygon points="${pts}" fill="url(#radarGrad_${theme})" stroke="url(#radarStroke_${theme})" stroke-width="2.5" filter="url(#glow_${theme})"/>`
  );

  // Vertices Data Nodes
  for (let i = 0; i < 6; i++) {
    const p = point(CX, CY, (norm[i] / 100) * R, i);
    lines.push(
      `    <circle class="node-point" cx="${fmt(p.x)}" cy="${fmt(p.y)}" r="6" fill="#10B981" opacity="0.85"/>`
    );
    lines.push(
      `    <circle cx="${fmt(p.x)}" cy="${fmt(p.y)}" r="3" fill="#FFFFFF"/>`
    );
  }

  // Vertex Label Pills & Values
  const pillOffsets = [
    { x: CX, y: CY - R - 24, anchor: "middle" }, // Top
    { x: CX + R * 0.866 + 32, y: CY - R * 0.5 - 6, anchor: "start" }, // Top-Right
    { x: CX + R * 0.866 + 32, y: CY + R * 0.5 + 14, anchor: "start" }, // Bottom-Right
    { x: CX, y: CY + R + 34, anchor: "middle" }, // Bottom
    { x: CX - R * 0.866 - 32, y: CY + R * 0.5 + 14, anchor: "end" }, // Bottom-Left
    { x: CX - R * 0.866 - 32, y: CY - R * 0.5 - 6, anchor: "end" }, // Top-Left
  ];

  for (let i = 0; i < 6; i++) {
    const m = METRICS[i];
    const pos = pillOffsets[i];
    const valStr = formatVal(values[i]);

    if (pos.anchor === "middle") {
      // Centered pill
      lines.push(
        `    <g transform="translate(${fmt(pos.x)}, ${fmt(pos.y)})">`
      );
      lines.push(
        `      <rect x="-55" y="-12" width="110" height="24" rx="12" fill="${pillBg}" stroke="${pillBorder}" stroke-width="1"/>`
      );
      lines.push(
        `      <text x="0" y="4" class="txt-sans" font-size="11" font-weight="600" text-anchor="middle" fill="${tc}">${m.icon} ${m.label}: <tspan font-weight="700" fill="#10B981">${valStr}</tspan></text>`
      );
      lines.push(`    </g>`);
    } else if (pos.anchor === "start") {
      // Left-aligned pill (on the right side)
      lines.push(
        `    <g transform="translate(${fmt(pos.x - 10)}, ${fmt(pos.y)})">`
      );
      lines.push(
        `      <rect x="0" y="-12" width="115" height="24" rx="12" fill="${pillBg}" stroke="${pillBorder}" stroke-width="1"/>`
      );
      lines.push(
        `      <text x="10" y="4" class="txt-sans" font-size="11" font-weight="600" fill="${tc}">${m.icon} ${m.label}: <tspan font-weight="700" fill="#10B981">${valStr}</tspan></text>`
      );
      lines.push(`    </g>`);
    } else {
      // Right-aligned pill (on the left side)
      lines.push(
        `    <g transform="translate(${fmt(pos.x + 10)}, ${fmt(pos.y)})">`
      );
      lines.push(
        `      <rect x="-115" y="-12" width="115" height="24" rx="12" fill="${pillBg}" stroke="${pillBorder}" stroke-width="1"/>`
      );
      lines.push(
        `      <text x="-10" y="4" class="txt-sans" font-size="11" font-weight="600" text-anchor="end" fill="${tc}">${m.icon} ${m.label}: <tspan font-weight="700" fill="#10B981">${valStr}</tspan></text>`
      );
      lines.push(`    </g>`);
    }
  }

  // Footer Summary Bar
  lines.push(
    `    <rect x="120" y="462" width="260" height="24" rx="12" fill="${headerBg}" stroke="${borderColor}" stroke-width="1"/>`
  );
  lines.push(
    `    <text x="${CX}" y="478" class="txt-mono" font-size="11" font-weight="600" text-anchor="middle" fill="${subText}">TOTAL METRICS: <tspan font-weight="700" fill="#7C3AED">${formatVal(totalActivity)}</tspan></text>`
  );

  lines.push(`  </g>`);
  // --- END ANIMATED CONTENT GROUP ---

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
