/**
 * Render Studiofront S-mark + lockup PNGs (Syne ExtraBold + geometric S).
 * Usage: node scripts/generate-studiofront-mark.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fontSrc = "/tmp/Syne-wght.ttf";
const fontDest = path.join(root, "scripts/stripe-brand/.fonts/Syne[wght].ttf");
const outPublic = path.join(root, "public");
const outStripe = path.join(root, "scripts/stripe-brand");

fs.mkdirSync(path.dirname(fontDest), { recursive: true });
fs.mkdirSync(outStripe, { recursive: true });
if (fs.existsSync(fontSrc)) fs.copyFileSync(fontSrc, fontDest);
else if (!fs.existsSync(fontDest)) {
  throw new Error("Syne font missing — download Syne[wght].ttf to /tmp or scripts/stripe-brand/.fonts/");
}

const GREEN = "#2f5d50";

/** 6-blade shutter used for the two “o”s in the wordmark. */
function apertureSvg(size) {
  const cx = 50;
  const cy = 50;
  const rOuter = 36;
  const rInner = 13;
  const blades = 6;
  const parts = [];
  for (let i = 0; i < blades; i++) {
    const a0 = (Math.PI * 2 * i) / blades - Math.PI / 2;
    const a1 = a0 + (Math.PI * 2) / blades * 0.62;
    const a2 = a0 + (Math.PI * 2) / blades;
    const p = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
    parts.push(
      `<path d="M${p(rInner, a0)} L${p(rOuter, a0)} A${rOuter} ${rOuter} 0 0 1 ${p(rOuter, a1)} L${p(rInner, a2)} Z"/>`,
    );
  }
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">${parts.join("")}</svg>`;
}

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
@font-face {
  font-family: Syne;
  src: url("Syne[wght].ttf") format("truetype");
  font-weight: 100 900;
  font-style: normal;
}
html, body {
  margin: 0;
  background: transparent;
}
.stage {
  display: flex;
  flex-direction: column;
  gap: 48px;
  padding: 40px;
  width: max-content;
}
.icon {
  width: 512px;
  height: 512px;
  display: grid;
  place-items: center;
  font-family: Syne, sans-serif;
  font-weight: 800;
  font-size: 300px;
  line-height: 1;
  letter-spacing: -0.07em;
  color: ${GREEN};
}
.lockup {
  display: flex;
  align-items: baseline;
  color: ${GREEN};
  padding: 24px 16px 20px;
  font-family: Syne, sans-serif;
  font-weight: 700;
  font-size: 128px;
  letter-spacing: -0.05em;
  line-height: 1;
}
.lockup .s {
  font-weight: 800;
  font-size: 1.12em;
  letter-spacing: -0.08em;
  margin-right: 0.02em;
  line-height: 0.78;
}
.lockup .ch { display: block; }
.lockup .ap {
  display: inline-grid;
  place-items: center;
  width: 0.78em;
  height: 1em;
  margin: 0 0.01em;
  fill: ${GREEN};
  position: relative;
  top: 0.06em;
}
.lockup .ap svg { width: 0.7em; height: 0.7em; }
</style>
</head>
<body>
  <div class="stage">
    <div class="icon" id="icon">S</div>
    <div class="lockup" id="lockup">
      <span class="s">S</span>
      <span class="ch">t</span>
      <span class="ch">u</span>
      <span class="ch">d</span>
      <span class="ch">i</span>
      <span class="ap">${apertureSvg(72)}</span>
      <span class="ch">f</span>
      <span class="ch">r</span>
      <span class="ap">${apertureSvg(72)}</span>
      <span class="ch">n</span>
      <span class="ch">t</span>
    </div>
  </div>
</body>
</html>`;

const htmlDir = path.dirname(fontDest);
const htmlPath = path.join(htmlDir, "mark.html");
fs.writeFileSync(htmlPath, html);

const browser = await chromium.launch();
const page = await browser.newPage({
  deviceScaleFactor: 2,
  viewport: { width: 1400, height: 900 },
});
await page.goto(`file://${htmlPath}`);
await page.evaluate(() => document.fonts.ready);

async function shot(id, dest, pad) {
  const el = page.locator(`#${id}`);
  const buf = await el.screenshot({ omitBackground: true });
  let img = sharp(buf).trim({ threshold: 0 });
  if (pad) {
    img = img.extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }
  await img.png().toFile(dest);
}

const iconTmp = path.join(outStripe, "icon-raw.png");
const logoTmp = path.join(outStripe, "logo-raw.png");
await shot("icon", iconTmp, 0);
await shot("lockup", logoTmp, 0);
await browser.close();

async function squareIcon(src, dest, size) {
  const trimmed = await sharp(src).trim({ threshold: 10 }).toBuffer();
  const meta = await sharp(trimmed).metadata();
  const pad = Math.round(Math.max(meta.width, meta.height) * 0.16);
  await sharp(trimmed)
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(dest);
}

async function lockupPng(src, dest, height) {
  await sharp(src)
    .trim({ threshold: 10 })
    .resize({ height, withoutEnlargement: false })
    .png()
    .toFile(dest);
}

await squareIcon(iconTmp, path.join(outStripe, "icon.png"), 512);
await squareIcon(iconTmp, path.join(outPublic, "studiofront-icon.png"), 436);
await lockupPng(logoTmp, path.join(outStripe, "logo.png"), 208);
await lockupPng(logoTmp, path.join(outPublic, "studiofront-lockup.png"), 208);

fs.unlinkSync(iconTmp);
fs.unlinkSync(logoTmp);
fs.unlinkSync(htmlPath);

console.log("Wrote public/studiofront-icon.png, public/studiofront-lockup.png");
console.log("Wrote scripts/stripe-brand/icon.png, scripts/stripe-brand/logo.png");
