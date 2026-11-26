// Builds the SVG cards for the profile README.
// Runs every night in .github/workflows/readme-assets.yml, or locally:
//   node scripts/build-assets.mjs            (fetches live numbers from GitHub)
//   node scripts/build-assets.mjs --offline  (uses data/stats.json from the last run)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOGIN = "Abdelrahman-Magdy-Elawady";
const OUT = join(ROOT, "assets");
const DATA = join(ROOT, "data", "stats.json");
mkdirSync(OUT, { recursive: true });
mkdirSync(dirname(DATA), { recursive: true });

// ---------------------------------------------------------------- data

async function getText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "readme-assets", Accept: "text/html" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

// The public contribution calendar (it includes private work when the profile shows it).
async function calendar(from, to) {
  const q = from ? `?from=${from}&to=${to}` : "";
  const html = await getText(`https://github.com/users/${LOGIN}/contributions${q}`);
  const tips = {};
  for (const m of html.matchAll(/<tool-tip[^>]*\bfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) tips[m[1]] = m[2].trim();
  const days = [];
  for (const m of html.matchAll(/<td\b[^>]*>/g)) {
    const date = m[0].match(/data-date="([^"]+)"/)?.[1];
    const id = m[0].match(/\bid="([^"]+)"/)?.[1];
    if (!date || !id) continue;
    const t = (tips[id] || "").match(/^(\d[\d,]*|No) contribution/);
    days.push({ date, count: t ? (t[1] === "No" ? 0 : Number(t[1].replace(/,/g, ""))) : 0 });
  }
  days.sort((a, b) => (a.date < b.date ? -1 : 1));
  return days;
}

async function getJSON(url) {
  const headers = { "User-Agent": "readme-assets", Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function liveStats() {
  const user = await getJSON(`https://api.github.com/users/${LOGIN}`);
  const lastYear = await calendar();
  const firstYear = new Date(user.created_at).getUTCFullYear();
  const thisYear = new Date().getUTCFullYear();
  const all = new Map();
  const years = {};
  for (let y = firstYear; y <= thisYear; y++) {
    const days = await calendar(`${y}-01-01`, `${y}-12-31`);
    years[y] = days.reduce((s, d) => s + d.count, 0);
    for (const d of days) all.set(d.date, d.count);
  }
  for (const d of lastYear) all.set(d.date, d.count);
  const allDays = [...all.entries()].sort().map(([date, count]) => ({ date, count }));
  return { publicRepos: user.public_repos, years, days: lastYear, allDays };
}

let stats;
if (process.argv.includes("--offline")) {
  stats = JSON.parse(readFileSync(DATA, "utf8"));
} else {
  stats = await liveStats();
  writeFileSync(DATA, JSON.stringify(stats));
}

const today = new Date(stats.days.at(-1).date + "T00:00:00Z");
const days = stats.days;
const lastYearTotal = days.reduce((s, d) => s + d.count, 0);
const total = Object.values(stats.years).reduce((s, n) => s + n, 0);
const firstActiveYear = Object.keys(stats.years).find((y) => stats.years[y] > 0);

function streaks(list) {
  let longest = 0, run = 0, longestEnd = null;
  for (const d of list) {
    run = d.count > 0 ? run + 1 : 0;
    if (run > longest) { longest = run; longestEnd = d.date; }
  }
  // Today may still be empty: then the streak runs up to yesterday.
  let i = list.length - 1;
  if (list[i].count === 0) i--;
  let current = 0;
  while (i >= 0 && list[i].count > 0) { current++; i--; }
  const currentStart = current ? list[i + 1].date : null;
  const longestStart = longestEnd ? shiftDate(longestEnd, -(longest - 1)) : null;
  return { current, currentStart, longest, longestStart, longestEnd };
}
function shiftDate(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const st = streaks(stats.allDays || days);
const activeDays = days.filter((d) => d.count > 0).length;
const best = days.reduce((a, d) => (d.count > a.count ? d : a), days[0]);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDay = (iso) => { const d = new Date(iso + "T00:00:00Z"); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
const fmtDate = (d) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
const n = (x) => x.toLocaleString("en-US");

// ---------------------------------------------------------------- design system

const FONTS = Object.fromEntries(
  ["display", "body", "mono", "monob"].map((k) => [k, readFileSync(join(OUT, "fonts", `${k}.woff`)).toString("base64")])
);
const METRICS = JSON.parse(readFileSync(join(OUT, "fonts", "metrics.json"), "utf8"));
const FAMILY = { display: "AMDisplay", body: "AMBody", mono: "AMMono", monob: "AMMonoB" };

function fontCSS(used) {
  return used
    .map((k) => `@font-face{font-family:${FAMILY[k]};src:url(data:font/woff;base64,${FONTS[k]}) format('woff')}`)
    .join("");
}
function width(text, font, size) {
  const m = METRICS[font];
  let w = 0;
  for (const ch of String(text)) w += m[ch] ?? 0.6;
  return w * size;
}
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const C = {
  panel: "#15172e", panelEdge: "#24274a", dot: "#2b2f57", ink: "#f4f5ff", soft: "#b9bde6", mute: "#7d82b5",
  blue: ["#3464d8", "#1f3d8f"], green: ["#1f9160", "#136040"], amber: ["#d0811f", "#8a520e"],
  violet: ["#7445e0", "#472691"], teal: ["#148f8f", "#0b5c5c"], rose: ["#d2436a", "#86233e"],
  coral: "#ff7a59", night: ["#232648", "#151730"],
};

function svgDoc(w, h, body, fonts = ["display", "body", "mono", "monob"]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><style>${fontCSS(fonts)}
.d{font-family:${FAMILY.display},Poppins,'Segoe UI',sans-serif;font-weight:700}
.b{font-family:${FAMILY.body},Poppins,'Segoe UI',sans-serif;font-weight:500}
.m{font-family:${FAMILY.mono},'DejaVu Sans Mono',Consolas,monospace}
.mb{font-family:${FAMILY.monob},'DejaVu Sans Mono',Consolas,monospace;font-weight:700}
.pop{opacity:0;animation:pop .55s cubic-bezier(.2,1.4,.4,1) forwards}
.fade{opacity:0;animation:fade .5s ease-out forwards}
@keyframes pop{0%{opacity:0;transform:translateY(14px) scale(.96)}100%{opacity:1;transform:none}}
@keyframes fade{to{opacity:1}}
@media (prefers-reduced-motion:reduce){.pop,.fade{animation:none;opacity:1}}
</style>
<pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.1" fill="${C.dot}"/></pattern>
</defs>
${body}
</svg>`;
}

// A rounded panel with the dotted background every card sits on.
function panel(x, y, w, h, r = 22) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${C.panel}"/>
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#dots)"/>
<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="${r}" fill="none" stroke="${C.panelEdge}"/>`;
}
// A chunky tile: colored face on a darker "ledge", optionally tilted.
function tile(x, y, w, h, [face, ledge], { r = 16, tilt = 0, ledgeH = 6, stroke = true } = {}) {
  const cx = x + w / 2, cy = y + h / 2;
  return `<g transform="rotate(${tilt} ${cx} ${cy})">
<rect x="${x}" y="${y + ledgeH}" width="${w}" height="${h}" rx="${r}" fill="${ledge}"/>
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${face}"${stroke ? ` stroke="#ffffff" stroke-opacity=".14"` : ""}/>
</g>`;
}
function chip(x, y, label, [face, ledge], { size = 13, font = "mb", padX = 11, h = 28, color = C.ink } = {}) {
  const w = width(label, font === "mb" ? "monob" : font === "m" ? "mono" : font === "d" ? "display" : "body", size) + padX * 2;
  return {
    w,
    svg: `${tile(x, y, w, h, [face, ledge], { r: 8, ledgeH: 3, stroke: false })}
<text x="${x + w / 2}" y="${y + h / 2 + size * 0.36}" text-anchor="middle" class="${font}" font-size="${size}" fill="${color}">${esc(label)}</text>`,
  };
}
function chipsRow(x, y, items, opts) {
  let out = "", cx = x;
  for (const [label, color] of items) {
    const c = chip(cx, y, label, color, opts);
    out += c.svg;
    cx += c.w + (opts?.gap ?? 10);
  }
  return { svg: out, w: cx - x };
}

// Tiny line icons, drawn on a 24x24 grid.
const ICON = {
  calendar: `<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>`,
  flame: `<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 3 3 5 1-2 1-6 1-9z"/>`,
  trophy: `<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8"/>`,
  bars: `<path d="M5 20V12M10 20V6M15 20v-9M20 20V4"/>`,
  folder: `<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>`,
  check: `<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12l3 3 5-6"/>`,
  bolt: `<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>`,
  arrow: `<path d="M7 17L17 7M9 7h8v8"/>`,
};
const icon = (name, x, y, s = 24, color = C.ink, sw = 2.2) =>
  `<g transform="translate(${x} ${y}) scale(${s / 24})" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</g>`;

// ---------------------------------------------------------------- cards

function hero() {
  const W = 860, H = 236;
  let b = panel(0, 0, W, H);
  // Logo tile
  b += `<g class="pop" style="animation-delay:.05s">${tile(34, 56, 100, 100, ["#f4f5ff", C.rose[0]], { r: 22, ledgeH: 9, tilt: -4 })}
<text x="84" y="128" text-anchor="middle" class="d" font-size="66" fill="${C.panel}" transform="rotate(-4 84 106)">A</text></g>`;
  // Title with highlighted name
  const hi = "Hi, I'm ";
  const name = "Abdelrahman";
  const fs = 44, tx = 166, ty = 104;
  const hiW = width(hi, "display", fs);
  const nameW = width(name, "display", fs);
  b += `<g class="pop" style="animation-delay:.18s"><text x="${tx}" y="${ty}" class="d" font-size="${fs}" fill="${C.ink}">${hi}</text>
${tile(tx + hiW - 4, ty - 44, nameW + 22, 56, C.rose, { r: 10, ledgeH: 5, tilt: -1.5, stroke: false })}
<text x="${tx + hiW + 7}" y="${ty}" class="d" font-size="${fs}" fill="${C.ink}" transform="rotate(-1.5 ${tx + hiW + nameW / 2} ${ty - 16})">${name}</text></g>`;
  b += `<text x="${tx}" y="${ty + 36}" class="b fade" style="animation-delay:.35s" font-size="17.5" fill="${C.soft}">Frontend developer building fast, animated React &amp; Next.js apps.</text>`;
  const row = chipsRow(tx, ty + 58, [
    ["React & Next.js", C.blue], ["GSAP motion", C.green], ["Arabic RTL UIs", C.amber], ["Browser games", C.violet],
  ], { size: 12.5 });
  b += `<g class="pop" style="animation-delay:.5s">${row.svg}</g>`;
  // Sticker
  const st = "frontend · since 2023";
  const sw = width(st, "monob", 14) + 26;
  b += `<g class="pop" style="animation-delay:.7s">${tile(W - sw - 28, 22, sw, 38, [C.coral, "#a8432c"], { r: 10, ledgeH: 5, tilt: 4, stroke: false })}
<text x="${W - 28 - sw / 2}" y="${46}" text-anchor="middle" class="mb" font-size="14" fill="#2a0f08" transform="rotate(4 ${W - 28 - sw / 2} 41)">${st}</text></g>`;
  return svgDoc(W, H, b);
}

function badge(label, sub, [face, ledge], glyph) {
  const fsz = 14;
  const wl = width(label, "display", fsz);
  const ws = sub ? width(sub, "mono", 13) + 14 : 0;
  const gx = glyph ? 26 : 0;
  const w = 26 + gx + wl + ws;
  const h = 40;
  let b = tile(2, 2, w, h - 8, [face, ledge], { r: 8, ledgeH: 4, stroke: true });
  let x = 15;
  if (glyph) { b += glyph(x, 9); x += gx; }
  b += `<text x="${x}" y="${23}" class="d" font-size="${fsz}" fill="${C.ink}">${esc(label)}</text>`;
  if (sub) b += `<text x="${x + wl + 12}" y="${23}" class="m" font-size="13" fill="#e6e8ff" opacity=".85">${esc(sub)}</text>`;
  return svgDoc(w + 6, h, b, sub ? ["display", "mono"] : ["display"]);
}

function githubPanel() {
  const W = 860, H = 340;
  let b = panel(0, 0, W, H);
  b += `<text x="32" y="56" class="d" font-size="27" fill="${C.ink}">On GitHub</text>`;
  b += `<text x="${W - 32}" y="52" text-anchor="end" class="m" font-size="14" fill="${C.soft}">redrawn every night · ${fmtDate(today)}</text>`;
  const big = [
    { v: n(lastYearTotal), l: ["contributions in", "the last year"], c: C.blue, i: "calendar" },
    { v: `${st.current} day${st.current === 1 ? "" : "s"}`, l: ["current streak,", st.current ? `since ${fmtDay(st.currentStart)}` : "starts today"], c: C.green, i: "flame" },
    { v: `${st.longest} days`, l: ["longest streak", "ever"], c: C.amber, i: "trophy" },
    { v: n(total), l: ["contributions", `since ${firstActiveYear}`], c: C.violet, i: "bars" },
  ];
  const tw = 182, th = 124, gap = 16, x0 = 32, y0 = 84;
  big.forEach((t, k) => {
    const x = x0 + k * (tw + gap), tilt = [-1.6, 1.4, -1.2, 1.6][k];
    const cx = x + tw / 2, cy = y0 + th / 2;
    b += `<g class="pop" style="animation-delay:${0.1 + k * 0.12}s">${tile(x, y0, tw, th, t.c, { tilt })}
<g transform="rotate(${tilt} ${cx} ${cy})">${icon(t.i, x + tw - 38, y0 + 12, 22)}
<text x="${x + 16}" y="${y0 + 58}" class="d" font-size="${t.v.length > 7 ? 30 : 34}" fill="${C.ink}">${esc(t.v)}</text>
<text x="${x + 16}" y="${y0 + 84}" class="m" font-size="13.5" fill="#eef0ff">${esc(t.l[0])}</text>
<text x="${x + 16}" y="${y0 + 103}" class="m" font-size="13.5" fill="#eef0ff">${esc(t.l[1])}</text></g></g>`;
  });
  const small = [
    { v: n(stats.publicRepos), l: "public repos", c: C.teal, i: "folder" },
    { v: n(activeDays), l: "active days", c: C.rose, i: "check" },
    { v: n(best.count), l: `best day · ${fmtDay(best.date)}`, c: C.green, i: "bolt" },
  ];
  const sy = 244, sh = 62;
  let sx = 52;
  const sws = small.map((s) => 64 + width(s.v, "display", 28) + 12 + width(s.l, "mono", 14) + 20);
  const totalW = sws.reduce((a, c) => a + c, 0) + gap * (small.length - 1);
  sx = (W - totalW) / 2;
  small.forEach((s, k) => {
    const w = sws[k], tilt = [-1, 1.2, -1.4][k];
    const cx = sx + w / 2, cy = sy + sh / 2;
    b += `<g class="pop" style="animation-delay:${0.6 + k * 0.12}s">${tile(sx, sy, w, sh, s.c, { tilt })}
<g transform="rotate(${tilt} ${cx} ${cy})">${icon(s.i, sx + 18, sy + 19, 24)}
<text x="${sx + 56}" y="${sy + 41}" class="d" font-size="28" fill="${C.ink}">${esc(s.v)}</text>
<text x="${sx + 56 + width(s.v, "display", 28) + 12}" y="${sy + 37}" class="m" font-size="14" fill="#eef0ff">${esc(s.l)}</text></g></g>`;
    sx += w + gap;
  });
  return svgDoc(W, H, b);
}

function heatmap() {
  const W = 860;
  // Last 26 full weeks, Sunday to Saturday, ending with today's week.
  const end = days.length - 1;
  const lastDow = new Date(days[end].date + "T00:00:00Z").getUTCDay();
  const weeks = 26;
  const startIdx = end - lastDow - (weeks - 1) * 7;
  const slice = days.slice(Math.max(0, startIdx));
  const sum = slice.reduce((s, d) => s + d.count, 0);
  const nonzero = slice.map((d) => d.count).filter((c) => c > 0).sort((a, z) => a - z);
  const q = (p) => nonzero[Math.floor((nonzero.length - 1) * p)] ?? 1;
  const cuts = [q(0.25), q(0.5), q(0.8)];
  const level = (c) => (c === 0 ? 0 : c <= cuts[0] ? 1 : c <= cuts[1] ? 2 : c <= cuts[2] ? 3 : 4);
  const fills = ["#252a50", "#18603d", "#20834f", "#2aa865", "#55d98a"];
  const texts = ["#5b6196", "#cfeedd", "#e6fff0", "#f4fff8", "#0b3a1f"];
  const cell = 26, gap = 3, x0 = 44, y0 = 106;
  const H = y0 + 7 * (cell + gap) + 64;
  let b = panel(0, 0, W, H);
  b += `<rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="16" fill="${C.night[0]}" stroke="#ffffff" stroke-opacity=".06"/>`;
  b += `<text x="${x0}" y="64" class="d" font-size="26" fill="${C.ink}">${n(sum)}</text>`;
  b += `<text x="${x0 + width(n(sum), "display", 26) + 10}" y="63" class="m" font-size="16" fill="${C.soft}">contributions in the last 6 months</text>`;
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const x = x0 + w * (cell + gap);
    let colCells = "";
    for (let r = 0; r < 7; r++) {
      const i = w * 7 + r;
      const d = slice[i];
      if (!d) continue;
      const dt = new Date(d.date + "T00:00:00Z");
      if (dt.getUTCDate() === 1 && dt.getUTCMonth() !== lastMonth) {
        b += `<text x="${x}" y="${y0 - 12}" class="m" font-size="14" fill="${C.soft}">${MONTHS[dt.getUTCMonth()]}</text>`;
        lastMonth = dt.getUTCMonth();
      }
      const lv = level(d.count);
      const y = y0 + r * (cell + gap);
      const label = d.count > 999 ? "1k+" : String(d.count);
      const fs = label.length >= 3 ? 9.5 : 11;
      colCells += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="6" fill="${fills[lv]}"/>
<text x="${x + cell / 2}" y="${y + cell / 2 + fs * 0.36}" text-anchor="middle" class="mb" font-size="${fs}" fill="${texts[lv]}"${lv === 0 ? ' opacity=".9"' : ""}>${label}</text>`;
    }
    b += `<g class="fade" style="animation-delay:${(0.03 * w).toFixed(2)}s">${colCells}</g>`;
  }
  const ly = y0 + 7 * (cell + gap) + 26;
  b += `<text x="${x0}" y="${ly}" class="m" font-size="14" fill="${C.soft}">contributions per day</text>`;
  const lx = x0 + weeks * (cell + gap) - gap;
  b += `<text x="${lx}" y="${ly}" text-anchor="end" class="m" font-size="14" fill="${C.soft}">More</text>`;
  const sqEnd = lx - width("More", "mono", 14) - 10;
  for (let k = 4; k >= 0; k--) b += `<rect x="${sqEnd - 14 - (4 - k) * 18}" y="${ly - 12}" width="14" height="14" rx="3" fill="${fills[k]}"/>`;
  b += `<text x="${sqEnd - 14 - 4 * 18 - 10}" y="${ly}" text-anchor="end" class="m" font-size="14" fill="${C.soft}">Less</text>`;
  return svgDoc(W, H, b, ["display", "mono", "monob"]);
}

function lineChart() {
  const W = 860, H = 360;
  const last = days.slice(-30);
  const sum = last.reduce((s, d) => s + d.count, 0);
  const max = Math.max(...last.map((d) => d.count), 1);
  const nice = (v) => { const p = 10 ** Math.floor(Math.log10(v)); return Math.ceil(v / p) * p; };
  const top = nice(max);
  const x0 = 76, x1 = W - 46, y0 = 98, y1 = 286;
  const X = (i) => x0 + (i * (x1 - x0)) / (last.length - 1);
  const Y = (v) => y1 - (v / top) * (y1 - y0);
  let b = panel(0, 0, W, H);
  b += `<rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="16" fill="${C.night[0]}" stroke="#ffffff" stroke-opacity=".06"/>`;
  b += `<text x="44" y="64" class="d" font-size="26" fill="${C.ink}">${n(sum)}</text>`;
  b += `<text x="${44 + width(n(sum), "display", 26) + 10}" y="63" class="m" font-size="16" fill="${C.soft}">contributions in the last 30 days</text>`;
  for (let k = 0; k <= 4; k++) {
    const v = Math.round((top * k) / 4), y = Y(v);
    b += `<line x1="${x0}" x2="${x1}" y1="${y}" y2="${y}" stroke="#3a3e6e" stroke-dasharray="4 5" stroke-opacity="${k ? 1 : 0}"/>
<text x="${x0 - 12}" y="${y + 5}" text-anchor="end" class="m" font-size="13" fill="${C.soft}">${v}</text>`;
  }
  b += `<line x1="${x0}" x2="${x1}" y1="${y1}" y2="${y1}" stroke="#4a4f86"/>`;
  // Smooth path (Catmull-Rom -> cubic Bezier)
  const pts = last.map((d, i) => [X(i), Y(d.count)]);
  let path = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const t = 0.18;
    const c1 = [p1[0] + (p2[0] - p0[0]) * t, Math.min(y1, p1[1] + (p2[1] - p0[1]) * t)];
    const c2 = [p2[0] - (p3[0] - p1[0]) * t, Math.min(y1, p2[1] - (p3[1] - p1[1]) * t)];
    path += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  b += `<path d="${path} L${x1},${y1} L${x0},${y1} Z" fill="${C.coral}" fill-opacity=".16" class="fade" style="animation-delay:1s"/>`;
  b += `<path d="${path}" fill="none" stroke="${C.coral}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"><animate attributeName="stroke-dashoffset" from="1" to="0" dur="1.6s" begin="0.2s" fill="freeze" calcMode="spline" keySplines=".4 0 .2 1" keyTimes="0;1"/></path>`;
  pts.forEach(([x, y], i) => {
    b += `<circle cx="${x}" cy="${y}" r="5" fill="${C.coral}" stroke="${C.night[0]}" stroke-width="2.5" class="pop" style="animation-delay:${(0.25 + i * 0.05).toFixed(2)}s"/>`;
  });
  let month = -1;
  last.forEach((d, i) => {
    const dt = new Date(d.date + "T00:00:00Z");
    b += `<text x="${X(i)}" y="${y1 + 24}" text-anchor="middle" class="m" font-size="12.5" fill="${C.soft}">${dt.getUTCDate()}</text>`;
    if (dt.getUTCMonth() !== month) {
      b += `<text x="${X(i)}" y="${y1 + 44}" text-anchor="middle" class="m" font-size="12.5" fill="${C.ink}">${MONTHS[dt.getUTCMonth()]}</text>`;
      month = dt.getUTCMonth();
    }
  });
  return svgDoc(W, H, b, ["display", "mono"]);
}

function terminal() {
  const W = 860, H = 318;
  const lines = [
    ["$", "whoami"],
    ["b", "abdelrahman", "  ·  frontend developer  ·  Egypt"],
    ["o", "I build React & Next.js apps, admin dashboards, landing pages and browser games."],
    ["$", "cat now.txt"],
    ["→", "Shipping client apps with Next.js, Redux Toolkit & GSAP"],
    ["→", "Tower Jump: online races for up to 4 players"],
    ["→", "Learning Node.js on the way to full-stack"],
  ];
  let b = panel(0, 0, W, H);
  b += `<rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="14" fill="#11132a" stroke="#ffffff" stroke-opacity=".07"/>
<path d="M32 18h${W - 64}a14 14 0 0 1 14 14v18H18V32a14 14 0 0 1 14-14z" fill="#1a1d3c"/>
<circle cx="42" cy="34" r="6" fill="#ff5f56"/><circle cx="62" cy="34" r="6" fill="#ffbd2e"/><circle cx="82" cy="34" r="6" fill="#27c93f"/>
<text x="${W / 2}" y="39" text-anchor="middle" class="m" font-size="13.5" fill="${C.mute}">abdelrahman@github: ~</text>`;
  const x0 = 44, fs = 16;
  let y = 94, t = 0.3;
  const cw = width("x", "mono", fs);
  for (const [kind, a, c] of lines) {
    if (kind === "$" && y > 94) y += 12;
    let content, plain;
    if (kind === "$") { content = `<tspan fill="${C.coral}" class="mb">$ </tspan><tspan fill="${C.ink}" class="mb">${esc(a)}</tspan>`; plain = "$ " + a; }
    else if (kind === "b") { content = `<tspan fill="${C.ink}" class="mb">${esc(a)}</tspan><tspan fill="${C.soft}">${esc(c)}</tspan>`; plain = a + c; }
    else if (kind === "→") { content = `<tspan fill="#4ade80">→ </tspan><tspan fill="${C.soft}">${esc(a)}</tspan>`; plain = "→ " + a; }
    else { content = `<tspan fill="${C.soft}">${esc(a)}</tspan>`; plain = a; }
    const full = plain.length * cw + 4;
    const typed = kind === "$";
    const steps = typed ? plain.length : 3;
    const dur = typed ? Math.max(0.45, plain.length * 0.055) : 0.2;
    const vals = Array.from({ length: steps + 1 }, (_, j) => ((full * j) / steps).toFixed(1)).join(";");
    b += `<clipPath id="l${y}"><rect x="${x0}" y="${y - 18}" height="26" width="0"><animate attributeName="width" values="${vals}" dur="${dur.toFixed(2)}s" begin="${t.toFixed(2)}s" fill="freeze" calcMode="discrete"/></rect></clipPath>
<text x="${x0}" y="${y}" class="m" font-size="${fs}" clip-path="url(#l${y})">${content}</text>`;
    t += dur + (typed ? 0.25 : 0.12);
    y += 28;
  }
  y += 12;
  b += `<text x="${x0}" y="${y}" class="mb" font-size="${fs}" fill="${C.coral}" opacity="0">$<set attributeName="opacity" to="1" begin="${t.toFixed(2)}s"/></text>
<rect x="${x0 + cw * 2}" y="${y - 15}" width="${cw}" height="19" fill="${C.ink}" opacity="0"><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.5;.5;1" dur="1s" begin="${t.toFixed(2)}s" repeatCount="indefinite"/></rect>`;
  return svgDoc(W, H, b, ["mono", "monob"]);
}

function sectionTitle(label, [face, ledge], note) {
  const fs = 27;
  const w = width(label, "display", fs) + 36;
  const nw = note ? width(note, "monob", 14) + 24 : 0;
  const W = w + (note ? nw + 34 : 0) + 20, H = 74;
  let b = `<g class="pop">${tile(8, 12, w, 48, [face, ledge], { r: 12, ledgeH: 6, tilt: -2 })}
<text x="${8 + w / 2}" y="${45}" text-anchor="middle" class="d" font-size="${fs}" fill="${C.ink}" transform="rotate(-2 ${8 + w / 2} 36)">${esc(label)}</text></g>`;
  if (note) {
    b += `<g class="fade" style="animation-delay:.25s"><rect x="${w + 30}" y="22" width="${nw}" height="30" rx="7" fill="#1d2044"/>
<text x="${w + 30 + nw / 2}" y="42" text-anchor="middle" class="mb" font-size="14" fill="${C.ink}">${esc(note)}</text></g>`;
  }
  return svgDoc(W, H, b, note ? ["display", "monob"] : ["display"]);
}

function shipCard({ title, status, statusColor, desc, tags, foot, colors, glyph, link }) {
  const W = 424, H = 288;
  let b = `<rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="20" fill="${C.panel}"/><rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="20" fill="url(#dots)"/>`;
  b += tile(16, 14, W - 32, H - 40, colors, { r: 18, ledgeH: 7 });
  // icon tile
  b += `<rect x="34" y="34" width="68" height="68" rx="16" fill="#0f1124" stroke="#ffffff" stroke-opacity=".18"/>${glyph(34, 34)}`;
  b += `<text x="118" y="66" class="d" font-size="${width(title, "display", 26) > 250 ? 22 : 26}" fill="${C.ink}">${esc(title)}</text>`;
  const sc = chip(118, 76, status, statusColor, { size: 12, h: 24, padX: 10, color: "#062612" });
  b += sc.svg;
  if (link) b += `${tile(W - 66, 30, 34, 34, [C.coral, "#a8432c"], { r: 8, ledgeH: 3, stroke: false })}${icon("arrow", W - 59, 37, 20, "#2a0f08", 2.6)}`;
  const dfs = Math.min(16.5, ...desc.map((l) => (16.5 * (W - 70)) / width(l, "body", 16.5)));
  desc.forEach((line, i) => (b += `<text x="34" y="${136 + i * 23}" class="b" font-size="${dfs.toFixed(1)}" fill="${C.ink}">${esc(line)}</text>`));
  const ty = 136 + desc.length * 23 + 6;
  const row = chipsRow(34, ty, tags.map((t) => [t, ["#0f1124", "#0f1124"]]), { size: 12, h: 24, padX: 9, gap: 7, color: "#e6e8ff" });
  b += row.svg;
  b += `<text x="34" y="${ty + 52}" class="m" font-size="14" fill="#e9ebff" opacity=".9">${esc(foot)}</text>`;
  return svgDoc(W, H, `<g class="pop">${b}</g>`);
}

// Card glyphs (64x64 inside the icon tile)
const glyphs = {
  tower: (x, y) => `<g transform="translate(${x} ${y})">
<rect x="14" y="44" width="24" height="5" rx="2.5" fill="#c9b8ff"/><rect x="28" y="33" width="24" height="5" rx="2.5" fill="#c9b8ff"/><rect x="12" y="22" width="22" height="5" rx="2.5" fill="#c9b8ff"/>
<circle cx="44" cy="20" r="6" fill="#ff5f87"/><circle cx="44" cy="20" r="2.5" fill="#b3123f"/><path d="M44 26v10" stroke="#4ade80" stroke-width="2.5"/>
<rect x="20" y="12" width="8" height="9" rx="3" fill="#1b1b2e" stroke="#f4f5ff" stroke-width="1.5"/></g>`,
  briefcase: (x, y) => `<g transform="translate(${x + 12} ${y + 12})" fill="none" stroke="#7fb2ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="12" width="34" height="23" rx="5"/><path d="M14 12V8a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v4M3 22h34"/></g>`,
  monogram: (x, y) => `<text x="${x + 34}" y="${y + 46}" text-anchor="middle" class="d" font-size="34" fill="#f4f5ff">AM</text><rect x="${x + 14}" y="${y + 52}" width="40" height="4" rx="2" fill="#4ade80"/>`,
  sticker: (x, y) => `<g transform="translate(${x} ${y})"><rect x="12" y="14" width="40" height="36" rx="7" fill="none" stroke="#ffd166" stroke-width="3"/><path d="M18 14v36M46 14v36" stroke="#ffd166" stroke-width="2" stroke-dasharray="4 4"/><path d="M27 25l12 7-12 7z" fill="#ffd166"/></g>`,
};

// ---------------------------------------------------------------- write

const files = {
  "hero.svg": hero(),
  "badge-linkedin.svg": badge("LinkedIn", null, ["#0a66c2", "#06427e"], (x, y) => `<rect x="${x}" y="${y + 1}" width="17" height="17" rx="3.5" fill="#fff"/><text x="${x + 8.5}" y="${y + 15}" text-anchor="middle" class="d" font-size="12" fill="#0a66c2">in</text>`),
  "badge-hackerrank.svg": badge("HackerRank", "@abdalrahman_mag1", C.green, (x, y) => `<rect x="${x}" y="${y + 1}" width="17" height="17" rx="3.5" fill="#fff"/><text x="${x + 8.5}" y="${y + 15}" text-anchor="middle" class="d" font-size="12" fill="#1f9160">H</text>`),
  "badge-site.svg": badge("abdelrahman-magdy.vercel.app", null, ["#23264a", "#121430"], null),
  "github.svg": githubPanel(),
  "graph-6m.svg": heatmap(),
  "graph-30d.svg": lineChart(),
  "terminal.svg": terminal(),
  "title-ship.svg": sectionTitle("What I ship", C.amber, "4 things I built"),
  "title-play.svg": sectionTitle("Play it", C.rose, "runs in your browser"),
  "title-toolkit.svg": sectionTitle("Daily toolkit", C.blue, null),
  "card-tower-jump.svg": shipCard({
    title: "Tower Jump", status: "live · play now", statusColor: ["#4ade80", "#1f8a4c"], colors: ["#2b2f66", "#1b1d45"], glyph: glyphs.tower, link: true,
    desc: ["A rose-tower climber for the browser:", "wall jumps, combos and online races."],
    tags: ["Phaser", "TypeScript", "PWA", "Online"], foot: "desktop · phone · gamepad",
  }),
  "card-client-work.svg": shipCard({
    title: "Client apps", status: "10+ shipped", statusColor: ["#4ade80", "#1f8a4c"], colors: ["#1f3b63", "#132640"], glyph: glyphs.briefcase, link: false,
    desc: ["Admin dashboards, agency portals and", "landing pages, in English and Arabic."],
    tags: ["Next.js", "Redux Toolkit", "Tailwind", "GSAP"], foot: "4,000+ commits across private repos",
  }),
  "card-portfolio.svg": shipCard({
    title: "Portfolio", status: "live", statusColor: ["#4ade80", "#1f8a4c"], colors: ["#3b2752", "#251735"], glyph: glyphs.monogram, link: true,
    desc: ["My personal site: smooth scrolling,", "GSAP scenes and a lot of motion."],
    tags: ["React", "Vite", "GSAP", "Lenis"], foot: "abdelrahman-magdy.vercel.app",
  }),
  "card-sticker-maker.svg": shipCard({
    title: "Sticker Maker", status: "Windows app", statusColor: ["#ffd166", "#a8791c"], colors: ["#2d3a2f", "#1b251d"], glyph: glyphs.sticker, link: false,
    desc: ["Turns cartoon videos into transparent", "512×512 GIF stickers, fully offline."],
    tags: ["Python", "PySide6", "AI cut-out", "ffmpeg"], foot: "no install · no internet needed",
  }),
};
for (const [name, svg] of Object.entries(files)) writeFileSync(join(OUT, name), svg);
console.log(`wrote ${Object.keys(files).length} files · last year ${lastYearTotal} · streak ${st.current}/${st.longest} · total ${total}`);
