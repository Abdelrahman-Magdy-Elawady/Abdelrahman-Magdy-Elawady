// Draws the "game HUD" cards for the profile README.
//   node scripts/build-assets.mjs            fetch live numbers from GitHub
//   node scripts/build-assets.mjs --offline  reuse data/stats.json
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOGIN = "Abdelrahman-Magdy-Elawady";
const OUT = join(ROOT, "assets", "hud");
const DATA = join(ROOT, "data", "stats.json");
mkdirSync(OUT, { recursive: true });

// ------------------------------------------------------------------ data

async function getText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "readme-hud" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}
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
  return days.sort((a, b) => (a.date < b.date ? -1 : 1));
}
async function liveStats() {
  const headers = { "User-Agent": "readme-hud", Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const user = await (await fetch(`https://api.github.com/users/${LOGIN}`, { headers })).json();
  const days = await calendar();
  const years = {}, all = new Map();
  for (let y = new Date(user.created_at).getUTCFullYear(); y <= new Date().getUTCFullYear(); y++) {
    const d = await calendar(`${y}-01-01`, `${y}-12-31`);
    years[y] = d.reduce((s, x) => s + x.count, 0);
    d.forEach((x) => all.set(x.date, x.count));
  }
  days.forEach((x) => all.set(x.date, x.count));
  return { publicRepos: user.public_repos, years, days, allDays: [...all].sort().map(([date, count]) => ({ date, count })) };
}
let S;
if (process.argv.includes("--offline")) S = JSON.parse(readFileSync(DATA, "utf8"));
else { S = await liveStats(); mkdirSync(dirname(DATA), { recursive: true }); writeFileSync(DATA, JSON.stringify(S)); }

const days = S.days;
const yearTotal = days.reduce((s, d) => s + d.count, 0);
const total = Object.values(S.years).reduce((s, x) => s + x, 0);
const activeDays = days.filter((d) => d.count > 0).length;
const best = days.reduce((a, d) => (d.count > a.count ? d : a), days[0]);
function streaks(list) {
  let longest = 0, run = 0;
  for (const d of list) { run = d.count ? run + 1 : 0; longest = Math.max(longest, run); }
  let i = list.length - 1, current = 0;
  if (!list[i].count) i--;
  while (i >= 0 && list[i].count) { current++; i--; }
  return { current, longest };
}
const st = streaks(S.allDays || days);
const LEVEL_XP = 1000;
const level = Math.floor(total / LEVEL_XP) + 1;
const xp = total % LEVEL_XP;
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const D = (iso) => new Date(iso + "T00:00:00Z");
const n = (x) => x.toLocaleString("en-US");
const today = D(days.at(-1).date);

// ------------------------------------------------------------------ pixel font (5x7)

const G = {
  A: "01110 10001 10001 11111 10001 10001 10001", B: "11110 10001 10001 11110 10001 10001 11110",
  C: "01111 10000 10000 10000 10000 10000 01111", D: "11110 10001 10001 10001 10001 10001 11110",
  E: "11111 10000 10000 11110 10000 10000 11111", F: "11111 10000 10000 11110 10000 10000 10000",
  G: "01111 10000 10000 10011 10001 10001 01111", H: "10001 10001 10001 11111 10001 10001 10001",
  I: "11111 00100 00100 00100 00100 00100 11111", J: "00111 00010 00010 00010 00010 10010 01100",
  K: "10001 10010 10100 11000 10100 10010 10001", L: "10000 10000 10000 10000 10000 10000 11111",
  M: "10001 11011 10101 10101 10001 10001 10001", N: "10001 11001 10101 10011 10001 10001 10001",
  O: "01110 10001 10001 10001 10001 10001 01110", P: "11110 10001 10001 11110 10000 10000 10000",
  Q: "01110 10001 10001 10001 10101 10010 01101", R: "11110 10001 10001 11110 10100 10010 10001",
  S: "01111 10000 10000 01110 00001 00001 11110", T: "11111 00100 00100 00100 00100 00100 00100",
  U: "10001 10001 10001 10001 10001 10001 01110", V: "10001 10001 10001 10001 10001 01010 00100",
  W: "10001 10001 10001 10101 10101 10101 01010", X: "10001 10001 01010 00100 01010 10001 10001",
  Y: "10001 10001 01010 00100 00100 00100 00100", Z: "11111 00001 00010 00100 01000 10000 11111",
  0: "01110 10011 10101 10101 11001 10001 01110", 1: "00100 01100 00100 00100 00100 00100 01110",
  2: "01110 10001 00001 00010 00100 01000 11111", 3: "11110 00001 00001 01110 00001 00001 11110",
  4: "00010 00110 01010 10010 11111 00010 00010", 5: "11111 10000 11110 00001 00001 10001 01110",
  6: "00110 01000 10000 11110 10001 10001 01110", 7: "11111 00001 00010 00100 01000 01000 01000",
  8: "01110 10001 10001 01110 10001 10001 01110", 9: "01110 10001 10001 01111 00001 00010 01100",
  " ": "00000 00000 00000 00000 00000 00000 00000", ".": "00000 00000 00000 00000 00000 01100 01100",
  ",": "00000 00000 00000 00000 01100 00100 01000", ":": "00000 01100 01100 00000 01100 01100 00000",
  "-": "00000 00000 00000 11111 00000 00000 00000", "/": "00001 00010 00010 00100 01000 01000 10000",
  "+": "00000 00100 00100 11111 00100 00100 00000", "!": "00100 00100 00100 00100 00100 00000 00100",
  "'": "00100 00100 01000 00000 00000 00000 00000", "?": "01110 10001 00001 00110 00100 00000 00100",
  ">": "10000 11000 11100 11110 11100 11000 10000", "<": "00001 00011 00111 01111 00111 00011 00001",
  "*": "00100 10101 01110 11111 01110 10101 00100", "#": "01010 11111 01010 01010 01010 11111 01010",
  "%": "11001 11010 00010 00100 01000 01011 10011", "=": "00000 00000 11111 00000 11111 00000 00000",
  "(": "00010 00100 01000 01000 01000 00100 00010", ")": "01000 00100 00010 00010 00010 00100 01000",
  "★": "00100 00100 11111 01110 01110 11011 00000",
  "&": "01100 10010 10100 01000 10101 10010 01101", "·": "00000 00000 00000 01100 01100 00000 00000",
};
const pxWidth = (text, s) => [...String(text).toUpperCase()].length * 6 * s - s;
// One <path> per string: every lit pixel becomes a small square.
function pixelText(text, x, y, s, fill, { anchor = "start", shadow = null, extra = "" } = {}) {
  const w = pxWidth(text, s);
  const x0 = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
  let d = "";
  [...String(text).toUpperCase()].forEach((ch, i) => {
    const rows = (G[ch] || G["?"]).split(" ");
    rows.forEach((row, r) => {
      for (let c = 0; c < 5; c++) if (row[c] === "1") d += `M${x0 + (i * 6 + c) * s} ${y + r * s}h${s}v${s}h-${s}z`;
    });
  });
  const sh = shadow ? `<path d="${d}" fill="${shadow}" transform="translate(${s} ${s})"/>` : "";
  return `<g ${extra}>${sh}<path d="${d}" fill="${fill}"/></g>`;
}

// ------------------------------------------------------------------ look

const FONTS = Object.fromEntries(["body", "mono", "monob"].map((k) => [k, readFileSync(join(ROOT, "assets", "fonts", `${k}.woff`)).toString("base64")]));
const P = {
  night: "#0e0a1f", panel: "#160f2e", panel2: "#1f1640", line: "#3b2b6b",
  gold: "#ffd166", rose: "#ff5f87", mint: "#4fe3a5", sky: "#7cc7ff", lilac: "#c9b8ff", ink: "#fff6e8", dim: "#a99cd6",
};
function doc(w, h, body, fonts = []) {
  const ff = { body: "HB", mono: "HM", monob: "HMB" };
  const faces = fonts.map((k) => `@font-face{font-family:${ff[k]};src:url(data:font/woff;base64,${FONTS[k]}) format('woff')}`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">
<style>${faces}
.b{font-family:HB,Poppins,'Segoe UI',sans-serif;font-weight:500}.m{font-family:HM,'DejaVu Sans Mono',Consolas,monospace}.mb{font-family:HMB,'DejaVu Sans Mono',Consolas,monospace;font-weight:700}
.blink{animation:blink 1.1s steps(1) infinite}@keyframes blink{50%{opacity:0}}
.tw{animation:tw 2.4s ease-in-out infinite}@keyframes tw{50%{opacity:.25}}
.in{opacity:0;animation:in .45s steps(4) forwards}@keyframes in{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:none}}
.grow{transform-box:fill-box;transform-origin:left;animation:grow 1.2s steps(12) forwards;transform:scaleX(0)}@keyframes grow{to{transform:scaleX(1)}}
.rise{transform-box:fill-box;transform-origin:bottom;animation:rise .6s steps(6) forwards;transform:scaleY(0)}@keyframes rise{to{transform:scaleY(1)}}
.hop{animation:hop .9s cubic-bezier(.3,0,.7,1) infinite alternate}@keyframes hop{to{transform:translateY(-22px)}}
@media (prefers-reduced-motion:reduce){.blink,.tw,.hop{animation:none}.in,.grow,.rise{animation:none;opacity:1;transform:none}}
</style>
${body}
</svg>`;
}
// Pixel frame: a panel with notched corners and a double border, like an old RPG window.
function frame(x, y, w, h, { fill = P.panel, edge = P.gold, inner = P.line, s = 4 } = {}) {
  const notch = (X, Y, W, H, k) => `M${X + k} ${Y}h${W - 2 * k}v${k}h${k}v${H - 2 * k}h-${k}v${k}h-${W - 2 * k}v-${k}h-${k}v-${H - 2 * k}h${k}z`;
  return `<path d="${notch(x, y, w, h, s)}" fill="${edge}"/>
<path d="${notch(x + s, y + s, w - 2 * s, h - 2 * s, s)}" fill="${P.night}"/>
<path d="${notch(x + 2 * s, y + 2 * s, w - 4 * s, h - 4 * s, s)}" fill="${fill}"/>
<rect x="${x + 3 * s}" y="${y + 3 * s}" width="${w - 6 * s}" height="${s / 2}" fill="${inner}"/>`;
}
// Segmented bar like a health/XP meter.
function meter(x, y, w, h, ratio, color, { seg = 10, delay = 0 } = {}) {
  const cells = Math.floor(w / seg);
  const lit = Math.round(cells * Math.max(0, Math.min(1, ratio)));
  let out = `<rect x="${x - 3}" y="${y - 3}" width="${cells * seg + 3}" height="${h + 6}" fill="${P.night}"/>`;
  for (let i = 0; i < cells; i++) out += `<rect x="${x + i * seg}" y="${y}" width="${seg - 3}" height="${h}" fill="${P.panel2}"/>`;
  out += `<g class="grow" style="animation-delay:${delay}s">`;
  for (let i = 0; i < lit; i++) out += `<rect x="${x + i * seg}" y="${y}" width="${seg - 3}" height="${h}" fill="${color}"/><rect x="${x + i * seg}" y="${y}" width="${seg - 3}" height="2" fill="#ffffff" opacity=".35"/>`;
  return out + "</g>";
}
const heart = (x, y, s, c) => {
  const rows = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"];
  let d = ""; rows.forEach((r, j) => [...r].forEach((b, i) => { if (b === "1") d += `M${x + i * s} ${y + j * s}h${s}v${s}h-${s}z`; }));
  return `<path d="${d}" fill="${c}"/>`;
};
const coin = (x, y, s) => `<rect x="${x + s}" y="${y}" width="${3 * s}" height="${5 * s}" fill="${P.gold}"/><rect x="${x}" y="${y + s}" width="${5 * s}" height="${3 * s}" fill="${P.gold}"/><rect x="${x + 2 * s}" y="${y + s}" width="${s}" height="${3 * s}" fill="#b8860b"/>`;
// Tiny climber sprite (the Tower Jump hero, abstracted).
function sprite(x, y, s) {
  const map = ["..kkk..", ".kkkkk.", ".kwkwk.", ".kkkkk.", "..rrr..", ".rrrrr.", "..k.k..", ".kk.kk."];
  const col = { k: "#2b1d4f", w: P.ink, r: P.rose };
  let out = "";
  map.forEach((row, j) => [...row].forEach((c, i) => { if (col[c]) out += `<rect x="${x + i * s}" y="${y + j * s}" width="${s}" height="${s}" fill="${col[c]}"/>`; }));
  return out;
}

// ------------------------------------------------------------------ screens

function titleScreen() {
  const W = 860, H = 300;
  let b = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1036"/><stop offset=".55" stop-color="#4a2a7a"/><stop offset="1" stop-color="#c76a9a"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  // stars
  let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(rnd() * W), y = Math.floor(rnd() * 170), s = rnd() > 0.85 ? 4 : 2;
    b += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${P.ink}" class="tw" style="animation-delay:${(rnd() * 2.4).toFixed(2)}s"/>`;
  }
  // moon
  b += `<rect x="44" y="18" width="44" height="44" fill="#fff1c9"/><rect x="40" y="22" width="52" height="36" fill="#fff1c9"/><rect x="54" y="30" width="8" height="8" fill="#f3dca0"/><rect x="72" y="44" width="6" height="6" fill="#f3dca0"/>`;
  // towers left and right, built from bricks
  const tower = (x0, w, h, flip) => {
    let t = "";
    for (let y = H - h; y < H; y += 12) for (let x = x0; x < x0 + w; x += 24) {
      const off = ((y / 12) % 2) * 12;
      t += `<rect x="${x + off - 12}" y="${y}" width="22" height="10" fill="#2a1a4d"/>`;
    }
    t += `<rect x="${x0 - 12}" y="${H - h - 12}" width="${w + 12}" height="12" fill="#2a1a4d"/>`;
    for (let x = x0 - 12; x < x0 + w; x += 24) t += `<rect x="${x}" y="${H - h - 24}" width="12" height="12" fill="#2a1a4d"/>`;
    t += `<rect x="${x0 + w / 2 - 10}" y="${H - h + 30}" width="20" height="28" fill="#ffd166" opacity=".8"/>`;
    return `<g clip-path="url(#clip${flip})">${t}</g><clipPath id="clip${flip}"><rect x="${x0 - 12}" y="0" width="${w + 12}" height="${H}"/></clipPath>`;
  };
  b += tower(0, 108, 190, 0) + tower(W - 108, 120, 230, 1);
  // floating platforms + hopping hero
  const plat = (x, y, w) => `<rect x="${x}" y="${y}" width="${w}" height="10" fill="#c9b8ff"/><rect x="${x}" y="${y + 10}" width="${w}" height="4" fill="#7b62c9"/>`;
  b += plat(150, 250, 84) + plat(640, 212, 72) + plat(560, 262, 60);
  b += `<g class="hop">${sprite(178, 210, 4)}</g>`;
  // rose
  b += `<rect x="664" y="196" width="8" height="8" fill="${P.rose}"/><rect x="660" y="200" width="4" height="4" fill="#b3123f"/><rect x="667" y="204" width="2" height="8" fill="${P.mint}"/>`;
  // title
  b += pixelText("ABDELRAHMAN", W / 2, 62, 8, P.gold, { anchor: "middle", shadow: "#7a2a4a" });
  b += pixelText("MAGDY", W / 2, 132, 5, P.ink, { anchor: "middle", shadow: "#4a2a7a" });
  b += pixelText(`FRONTEND DEV · LV ${level}`, W / 2, 182, 3, P.lilac, { anchor: "middle" });
  b += pixelText("> PRESS START", W / 2, 222, 4, P.ink, { anchor: "middle", extra: 'class="blink"' });
  b += `<rect width="${W}" height="${H}" fill="none" stroke="${P.gold}" stroke-width="6"/>`;
  return doc(W, H, b);
}

function menuButton(label, color) {
  const s = 3, w = pxWidth(label, s) + 64, h = 46;
  let b = frame(0, 0, w, h, { edge: color, fill: P.panel, s: 3 });
  b += `<path d="M18 17h4v4h4v4h-4v4h-4z" fill="${color}" class="blink"/>`;
  b += pixelText(label, 36, 16, s, P.ink);
  return doc(w, h, b);
}

function playerCard() {
  const W = 860, H = 330;
  let b = frame(0, 0, W, H);
  b += pixelText("PLAYER 1", 32, 30, 3, P.gold);
  b += pixelText(`HI-SCORE ${n(yearTotal)}`, W - 32, 30, 3, P.gold, { anchor: "end" });
  // portrait
  b += `<rect x="32" y="62" width="128" height="128" fill="${P.night}"/><rect x="36" y="66" width="120" height="120" fill="#4a3590"/>`;
  b += `<g class="hop" style="animation-duration:1.4s">${sprite(68, 92, 8)}</g>`;
  b += `<rect x="36" y="170" width="120" height="16" fill="#6b52b8"/>`;
  // identity
  b += `<text x="186" y="88" class="mb" font-size="22" fill="${P.ink}">ABDELRAHMAN</text>`;
  b += `<text x="186" y="114" class="m" font-size="15" fill="${P.dim}">class: Frontend Developer · realm: Egypt</text>`;
  for (let i = 0; i < 3; i++) b += heart(186 + i * 34, 132, 4, P.rose);
  b += coin(302, 133, 5);
  b += `<text x="334" y="155" class="mb" font-size="17" fill="${P.gold}">× ${S.publicRepos}</text><text x="378" y="155" class="m" font-size="14" fill="${P.dim}">public repos</text>`;
  // level + XP
  b += pixelText(`LV ${level}`, 186, 176, 3, P.mint);
  b += meter(260, 175, 420, 16, xp / LEVEL_XP, P.mint, { delay: 0.2 });
  b += `<text x="${W - 32}" y="190" text-anchor="end" class="m" font-size="14" fill="${P.dim}">${n(xp)}/${n(LEVEL_XP)} XP</text>`;
  // stat rows
  const rows = [
    ["CURRENT STREAK", `${st.current} days`, st.current / Math.max(st.longest, 1), P.rose],
    ["LONGEST STREAK", `${st.longest} days`, 1, P.gold],
    ["ACTIVE DAYS", `${activeDays}/${days.length}`, activeDays / days.length, P.sky],
    ["BEST COMBO", `${best.count} in a day`, 1, P.lilac],
  ];
  rows.forEach(([k, v, r, c], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 32 + col * 412, y = 224 + row * 44;
    b += `<g class="in" style="animation-delay:${0.3 + i * 0.12}s">${pixelText(k, x, y, 2, P.dim)}
${meter(x, y + 20, 230, 12, r, c, { seg: 8, delay: 0.4 + i * 0.12 })}
<text x="${x + 392}" y="${y + 31}" text-anchor="end" class="mb" font-size="15" fill="${P.ink}">${v}</text></g>`;
  });
  return doc(W, H, b, ["mono", "monob"]);
}

function climbChart() {
  const W = 860, H = 300;
  // Weekly totals for the last 26 weeks, drawn as brick towers the hero climbs.
  const weeks = [];
  for (let i = days.length; i > 0 && weeks.length < 26; i -= 7) {
    const chunk = days.slice(Math.max(0, i - 7), i);
    weeks.unshift({ end: chunk.at(-1).date, start: chunk[0].date, sum: chunk.reduce((s, d) => s + d.count, 0) });
  }
  const max = Math.max(...weeks.map((w) => w.sum), 1);
  const x0 = 40, base = 236, top = 100, cw = 26, gap = 4, brick = 8;
  let b = frame(0, 0, W, H);
  const sum = weeks.reduce((s, w) => s + w.sum, 0);
  b += pixelText("TOWER CLIMB", 32, 30, 3, P.gold);
  b += `<text x="${W - 32}" y="44" text-anchor="end" class="m" font-size="14" fill="${P.dim}">${n(sum)} contributions · 26 weeks · 1 tower = 1 week</text>`;
  b += `<rect x="${x0 - 8}" y="${base}" width="${weeks.length * (cw + gap) + 12}" height="6" fill="${P.line}"/>`;
  let peak = 0, lastLabel = -9;
  weeks.forEach((w, i) => {
    const h = Math.max(0, Math.round(((base - top) * w.sum) / max / brick) * brick);
    const x = x0 + i * (cw + gap);
    let col = "";
    for (let y = base - brick; y >= base - h; y -= brick) {
      const shade = y < base - h + brick ? P.gold : (y / brick) % 2 ? "#7b62c9" : "#8f78dd";
      col += `<rect x="${x}" y="${y}" width="${cw}" height="${brick - 2}" fill="${shade}"/>`;
    }
    if (!h) col += `<rect x="${x}" y="${base - 4}" width="${cw}" height="2" fill="${P.line}"/>`;
    b += `<g class="rise" style="animation-delay:${(i * 0.04).toFixed(2)}s">${col}</g>`;
    if (w.sum > (weeks[peak]?.sum ?? 0)) peak = i;
    const dt = D(w.start);
    if ((i === 0 || dt.getUTCMonth() !== D(weeks[i - 1].start).getUTCMonth()) && i - lastLabel >= 3) { b += pixelText(MONTHS[dt.getUTCMonth()], x, base + 16, 2, P.dim); lastLabel = i; }
  });
  // flag on the highest week, hero on the latest
  const px = x0 + peak * (cw + gap), ph = Math.round(((base - top) * weeks[peak].sum) / max / brick) * brick;
  b += `<rect x="${px + 12}" y="${base - ph - 30}" width="3" height="28" fill="${P.ink}"/><rect x="${px + 15}" y="${base - ph - 30}" width="14" height="9" fill="${P.rose}"/>`;
  b += `<text x="${px + 34}" y="${base - ph - 21}" class="mb" font-size="13" fill="${P.ink}">${weeks[peak].sum}</text>`;
  const lx = x0 + (weeks.length - 1) * (cw + gap), lh = Math.round(((base - top) * weeks.at(-1).sum) / max / brick) * brick;
  b += `<g class="hop">${sprite(lx - 1, base - lh - 34, 4)}</g>`;
  return doc(W, H, b, ["mono", "monob"]);
}

function banner(label, color) {
  const s = 4, tw = pxWidth(label, s);
  const W = 860, H = 52;
  let b = `<rect x="0" y="22" width="${W}" height="4" fill="${P.line}"/>`;
  b += `<rect x="${(W - tw) / 2 - 28}" y="4" width="${tw + 56}" height="${H - 8}" fill="${P.night}"/>`;
  b += `<path d="M${(W - tw) / 2 - 28} 18h6v6h6v6h-6v6h-6z" fill="${color}" class="blink"/>`;
  b += pixelText(label, W / 2, 12, s, color, { anchor: "middle" });
  return doc(W, H, b);
}

function levelRow(i, { name, stars, status, statusColor, desc, items, accent, play }) {
  const W = 860, H = 128;
  let b = `<g class="in" style="animation-delay:${0.1 + i * 0.08}s">${frame(0, 0, W, H, { edge: accent })}`;
  b += `<rect x="24" y="24" width="96" height="80" fill="${P.night}"/><rect x="28" y="28" width="88" height="72" fill="${P.panel2}"/>`;
  b += pixelText(String(i + 1), 72, 36, 6, accent, { anchor: "middle", shadow: P.night });
  b += pixelText("LEVEL", 72, 86, 2, P.dim, { anchor: "middle" });
  b += pixelText(name, 144, 26, 4, P.ink);
  const sx = 144 + pxWidth(name, 4) + 18;
  for (let k = 0; k < 3; k++) b += pixelText("★", sx + k * 22, 26, 3, k < stars ? P.gold : P.line);
  b += `<text x="144" y="80" class="b" font-size="16" fill="${P.ink}">${desc}</text>`;
  let ix = 144;
  items.forEach((it) => {
    const w = it.length * 8.4 + 18;
    b += `<rect x="${ix}" y="92" width="${w}" height="22" fill="${P.night}"/><rect x="${ix + 2}" y="94" width="${w - 4}" height="18" fill="${P.panel2}"/>
<text x="${ix + w / 2}" y="108" text-anchor="middle" class="mb" font-size="12" fill="${P.lilac}">${it}</text>`;
    ix += w + 8;
  });
  const sw = pxWidth(status, 2) + 20;
  b += `<rect x="${W - 28 - sw}" y="26" width="${sw}" height="22" fill="${statusColor}"/>`;
  b += pixelText(status, W - 28 - sw / 2, 30, 2, P.night, { anchor: "middle" });
  if (play) {
    b += `<rect x="${W - 140}" y="70" width="112" height="36" fill="${P.rose}"/><rect x="${W - 140}" y="102" width="112" height="4" fill="#a3244a"/>`;
    b += `<path d="M${W - 124} 80h4v4h4v4h4v4h-4v4h-4v4h-4z" fill="${P.ink}" class="blink"/>`;
    b += pixelText("PLAY", W - 100, 81, 3, P.ink);
  }
  return doc(W, H, b + "</g>", ["body", "monob"]);
}

function footer() {
  const W = 860, H = 40;
  const label = `SAVED ${today.getUTCDate()} ${MONTHS[today.getUTCMonth()]} ${today.getUTCFullYear()} · CONTINUE?`;
  let b = pixelText(label, W / 2, 12, 2, P.dim, { anchor: "middle" });
  b += `<rect x="${W / 2 + pxWidth(label, 2) / 2 + 8}" y="12" width="8" height="14" fill="${P.gold}" class="blink"/>`;
  return doc(W, H, b);
}

// ------------------------------------------------------------------ write

const levels = [
  { name: "TOWER JUMP", stars: 3, status: "LIVE", statusColor: P.mint, accent: P.rose, play: true,
    desc: "My browser game: wall jumps, combos, online races.", items: ["PHASER", "TYPESCRIPT", "PWA", "GAMEPAD"] },
  { name: "CLIENT APPS", stars: 3, status: "10+ CLEARED", statusColor: P.gold, accent: P.sky,
    desc: "Admin dashboards, agency portals and landing pages, in English and Arabic.", items: ["NEXT.JS", "REDUX TOOLKIT", "TAILWIND", "GSAP"] },
  { name: "PORTFOLIO", stars: 2, status: "LIVE", statusColor: P.mint, accent: P.lilac,
    desc: "My personal site: smooth scrolling and GSAP scenes all the way down.", items: ["REACT", "VITE", "GSAP", "LENIS"] },
  { name: "STICKER MAKER", stars: 2, status: "WINDOWS", statusColor: P.sky, accent: P.mint,
    desc: "Turns cartoon videos into transparent 512x512 GIF stickers, fully offline.", items: ["PYTHON", "PYSIDE6", "AI CUT-OUT", "FFMPEG"] },
];
const files = {
  "title.svg": titleScreen(),
  "btn-linkedin.svg": menuButton("LINKEDIN", P.sky),
  "btn-hackerrank.svg": menuButton("HACKERRANK", P.mint),
  "btn-portfolio.svg": menuButton("PORTFOLIO", P.rose),
  "player.svg": playerCard(),
  "climb.svg": climbChart(),
  "banner-levels.svg": banner("SELECT LEVEL", P.gold),
  "banner-bonus.svg": banner("BONUS STAGE", P.rose),
  "banner-inventory.svg": banner("INVENTORY", P.sky),
  "footer.svg": footer(),
};
levels.forEach((l, i) => (files[`level-${i + 1}.svg`] = levelRow(i, l)));
for (const [k, v] of Object.entries(files)) writeFileSync(join(OUT, k), v);
console.log(`hud: ${Object.keys(files).length} files · LV ${level} · ${xp} XP · streak ${st.current}/${st.longest} · year ${yearTotal}`);
