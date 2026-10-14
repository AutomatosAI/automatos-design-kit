// Draws assets/preview.png for every example skin in skins/: a small Studio-shaped picture (the
// sidebar, a page header, stats cards, a chat exchange, buttons, a focused field and a chart)
// painted from the skin's own tokens, one panel per tone. No text, no fonts and nothing from the
// internet: shapes in the skin's colours, written as a PNG with Node's zlib.
//
//   npm run previews            every folder in skins/
//   npm run previews -- ember   one skin
//
// Plain Node, no dependencies, so it runs before `npm install`. The examples set every token
// drawn here; a skin that doesn't is refused with the token's name.

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";

const WIDTH = 960;
const HEIGHT = 540;
const SKINS_DIR = "skins";
const DRAWN = [
  "background", "foreground", "card", "card-foreground", "secondary", "muted-foreground", "border", "ring",
  "primary", "primary-foreground", "destructive", "destructive-foreground", "success", "warning", "info",
  "chart-1", "chart-2", "chart-3", "chart-4", "chart-5",
];

/** The sRGB colour a browser draws for hsl(<triplet>), as lib/skins/colour.ts computes it. */
function tripletToRgb(triplet) {
  const match = /^([\d.]+) ([\d.]+)% ([\d.]+)%$/.exec(triplet);
  if (!match) throw new Error(`${triplet} isn't an HSL triplet`);
  const [h, s, l] = [Number(match[1]), Number(match[2]) / 100, Number(match[3]) / 100];
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const at = (n) => {
    const k = (n + h / 30) % 12;
    return Math.round((l - (chroma / 2) * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return [at(0), at(8), at(4)];
}

function hexToRgb(hex) {
  return [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
}

function colourOf(value) {
  return value.startsWith("#") ? hexToRgb(value) : tripletToRgb(value);
}

function createCanvas(width, height) {
  return { width, height, pixels: new Uint8Array(width * height * 3) };
}

function blend(canvas, x, y, [r, g, b], alpha) {
  if (alpha <= 0 || x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const at = (y * canvas.width + x) * 3;
  const mix = (from, to) => Math.round(from + (to - from) * Math.min(1, alpha));
  canvas.pixels[at] = mix(canvas.pixels[at], r);
  canvas.pixels[at + 1] = mix(canvas.pixels[at + 1], g);
  canvas.pixels[at + 2] = mix(canvas.pixels[at + 2], b);
}

/** Signed distance from a pixel centre to a rounded rectangle (negative inside). */
function roundRectDistance(px, py, { x, y, w, h, r }) {
  const radius = Math.min(r, w / 2, h / 2);
  const qx = Math.abs(px - (x + w / 2)) - (w / 2 - radius);
  const qy = Math.abs(py - (y + h / 2)) - (h / 2 - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - radius;
}

/** Fills a rounded rectangle, or strokes it `stroke` px wide, with soft edges. */
function rect(canvas, box, colour, { stroke = 0, alpha = 1 } = {}) {
  const rgb = colourOf(colour);
  const pad = 2;
  for (let py = Math.floor(box.y - pad); py < Math.ceil(box.y + box.h + pad); py += 1) {
    for (let px = Math.floor(box.x - pad); px < Math.ceil(box.x + box.w + pad); px += 1) {
      const d = roundRectDistance(px + 0.5, py + 0.5, box);
      const cover = stroke > 0 ? Math.min(0.5 - d, d + stroke + 0.5) : 0.5 - d;
      blend(canvas, px, py, rgb, Math.max(0, Math.min(1, cover)) * alpha);
    }
  }
}

/** A line of "text": a pill the height of a lowercase line. */
function line(canvas, x, y, w, colour, h = 8) {
  rect(canvas, { x, y, w, h, r: h / 2 }, colour);
}

function drawSidebar(canvas, t, frame, radius) {
  const w = Math.round(frame.w * 0.22);
  rect(canvas, { x: frame.x, y: frame.y, w, h: frame.h, r: 0 }, t.card);
  rect(canvas, { x: frame.x + w - 1, y: frame.y, w: 1, h: frame.h, r: 0 }, t.border);
  rect(canvas, { x: frame.x + 14, y: frame.y + 18, w: 14, h: 14, r: radius / 2 }, t.primary);
  line(canvas, frame.x + 34, frame.y + 21, w * 0.4, t.foreground);
  const items = [0.55, 0.4, 0.5, 0.35, 0.45];
  items.forEach((share, index) => {
    const y = frame.y + 58 + index * 30;
    if (index === 0) rect(canvas, { x: frame.x + 8, y: y - 9, w: w - 16, h: 26, r: radius }, t.secondary);
    line(canvas, frame.x + 18, y, (w - 36) * share, index === 0 ? t.foreground : t["muted-foreground"]);
  });
}

function drawStats(canvas, t, area, radius) {
  const gap = 10;
  const w = (area.w - gap * 2) / 3;
  ["success", "info", "warning"].forEach((status, index) => {
    const x = area.x + index * (w + gap);
    rect(canvas, { x, y: area.y, w, h: 56, r: radius }, t.card);
    rect(canvas, { x, y: area.y, w, h: 56, r: radius }, t.border, { stroke: 1 });
    rect(canvas, { x: x + 12, y: area.y + 12, w: 8, h: 8, r: 4 }, t[status]);
    line(canvas, x + 26, area.y + 12, w * 0.3, t["muted-foreground"]);
    line(canvas, x + 12, area.y + 32, w * 0.35, t["card-foreground"], 12);
  });
  return area.y + 56;
}

function drawChat(canvas, t, area, radius) {
  const bubbleW = area.w * 0.5;
  rect(canvas, { x: area.x + area.w - bubbleW, y: area.y, w: bubbleW, h: 34, r: radius }, t.secondary);
  line(canvas, area.x + area.w - bubbleW + 14, area.y + 13, bubbleW * 0.7, t.foreground);
  const tools = [t.success, t.success, t.primary];
  tools.forEach((colour, index) => {
    const y = area.y + 50 + index * 18;
    rect(canvas, { x: area.x, y, w: 8, h: 8, r: 4 }, colour);
    line(canvas, area.x + 16, y, area.w * (0.3 - index * 0.04), t["muted-foreground"]);
  });
  [0.92, 0.85, 0.6].forEach((share, index) => line(canvas, area.x, area.y + 108 + index * 16, area.w * share, t.foreground));
  return area.y + 150;
}

function button(canvas, box, fill, ink, { outline, glow } = {}) {
  if (glow > 0) rect(canvas, { ...box, x: box.x - glow / 2, y: box.y - glow / 2, w: box.w + glow, h: box.h + glow, r: box.r + glow / 2 }, fill, { alpha: 0.18 });
  if (outline) rect(canvas, box, outline, { stroke: 1 });
  else rect(canvas, box, fill);
  line(canvas, box.x + box.w * 0.22, box.y + box.h / 2 - 4, box.w * 0.56, ink);
}

function drawControls(canvas, t, area, radius, glow) {
  const h = 32;
  button(canvas, { x: area.x, y: area.y, w: 104, h, r: radius }, t.primary, t["primary-foreground"], { glow: Math.round(glow / 3) });
  button(canvas, { x: area.x + 118, y: area.y, w: 92, h, r: radius }, t.background, t.foreground, { outline: t.border });
  button(canvas, { x: area.x + 224, y: area.y, w: 92, h, r: radius }, t.destructive, t["destructive-foreground"]);
  const field = { x: area.x, y: area.y + h + 14, w: Math.min(area.w, 316), h, r: radius };
  rect(canvas, field, t.card);
  rect(canvas, { ...field, x: field.x - 3, y: field.y - 3, w: field.w + 6, h: field.h + 6, r: field.r + 3 }, t.ring, { stroke: 2 });
  line(canvas, field.x + 12, field.y + 12, field.w * 0.4, t["muted-foreground"]);
  return field.y + h;
}

function drawChart(canvas, t, area, radius) {
  rect(canvas, { ...area, r: radius }, t.card);
  rect(canvas, { ...area, r: radius }, t.border, { stroke: 1 });
  const heights = [0.55, 0.8, 0.4, 0.95, 0.65, 0.7, 0.5, 0.85, 0.35, 0.6];
  const barW = (area.w - 32) / heights.length - 6;
  heights.forEach((share, index) => {
    const h = (area.h - 40) * share;
    const x = area.x + 16 + index * (barW + 6);
    rect(canvas, { x, y: area.y + area.h - 16 - h, w: barW, h, r: Math.min(radius, barW / 2) / 2 }, t[`chart-${(index % 5) + 1}`]);
  });
}

function drawTone(canvas, skin, tokens, frame) {
  const missing = DRAWN.filter((name) => !tokens[name]);
  if (missing.length > 0) throw new Error(`${skin.slug}: the preview needs ${missing.join(", ")}`);
  const radius = Math.min(skin.shape?.radius ?? 8, 16);
  const glow = skin.shape?.glow ?? 0;
  rect(canvas, { ...frame, r: 0 }, tokens.background);
  drawSidebar(canvas, tokens, frame, radius);
  const left = frame.x + Math.round(frame.w * 0.22) + 22;
  const main = { x: left, w: frame.x + frame.w - left - 22 };
  line(canvas, main.x, frame.y + 20, main.w * 0.35, tokens.foreground, 16);
  line(canvas, main.x, frame.y + 46, main.w * 0.55, tokens["muted-foreground"]);
  const statsEnd = drawStats(canvas, tokens, { ...main, y: frame.y + 70 }, radius);
  const chatEnd = drawChat(canvas, tokens, { ...main, y: statsEnd + 22 }, radius);
  const controlsEnd = drawControls(canvas, tokens, { ...main, y: chatEnd + 10 }, radius, glow);
  const chartTop = controlsEnd + 18;
  drawChart(canvas, tokens, { ...main, y: chartTop, h: frame.y + frame.h - chartTop - 18 }, radius);
}

function encodePng({ width, height, pixels }) {
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    rows[y * (width * 3 + 1)] = 0;
    Buffer.from(pixels.buffer, y * width * 3, width * 3).copy(rows, y * (width * 3 + 1) + 1);
  }
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
    return Buffer.concat([head, data, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([signature, chunk("IHDR", header), chunk("IDAT", deflateSync(rows, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

function drawSkin(folder) {
  const skin = JSON.parse(readFileSync(join(folder, "skin.json"), "utf8"));
  const canvas = createCanvas(WIDTH, HEIGHT);
  const panel = WIDTH / skin.tones.length;
  skin.tones.forEach((tone, index) => {
    drawTone(canvas, skin, skin.tokens[tone] ?? {}, { x: Math.round(index * panel), y: 0, w: Math.round(panel), h: HEIGHT });
  });
  const out = join(folder, "assets", "preview.png");
  writeFileSync(out, encodePng(canvas));
  console.log(`Drew ${out}`);
}

const wanted = process.argv.slice(2);
const slugs = readdirSync(SKINS_DIR).filter((name) => statSync(join(SKINS_DIR, name)).isDirectory());
for (const slug of wanted.length > 0 ? wanted : slugs) drawSkin(join(SKINS_DIR, slug));
