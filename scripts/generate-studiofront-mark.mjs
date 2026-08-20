/**
 * Render Studiofront S-mark + lockup PNGs (Syne + geometric S icon).
 * Usage: node scripts/generate-studiofront-mark.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fontDir = path.join(root, "scripts/stripe-brand/.fonts");
const outPublic = path.join(root, "public");
const outStripe = path.join(root, "scripts/stripe-brand");

fs.mkdirSync(fontDir, { recursive: true });
fs.mkdirSync(outStripe, { recursive: true });

for (const [src, name] of [
  ["/tmp/Syne-ExtraBold.ttf", "Syne-ExtraBold.ttf"],
  ["/tmp/Syne-Bold.ttf", "Syne-Bold.ttf"],
  ["/tmp/Syne-wght.ttf", "Syne[wght].ttf"],
]) {
  const dest = path.join(fontDir, name);
  if (fs.existsSync(src)) fs.copyFileSync(src, dest);
}

if (
  !fs.existsSync(path.join(fontDir, "Syne-Bold.ttf")) &&
  !fs.existsSync(path.join(fontDir, "Syne[wght].ttf"))
) {
  throw new Error("Missing Syne font — place Syne-Bold.ttf or Syne[wght].ttf in scripts/stripe-brand/.fonts/");
}

const GREEN = "#2f5d50";
const syneFontFile = fs.existsSync(path.join(fontDir, "Syne[wght].ttf"))
  ? "Syne[wght].ttf"
  : "Syne-Bold.ttf";
const syneFontFace =
  syneFontFile === "Syne[wght].ttf"
    ? `@font-face {
  font-family: Syne;
  src: url("Syne[wght].ttf") format("truetype");
  font-weight: 100 900;
  font-style: normal;
}`
    : `@font-face {
  font-family: Syne;
  src: url("Syne-Bold.ttf") format("truetype");
  font-weight: 700;
  font-style: normal;
}`;

function sMarkSvg(className = "") {
  return `<svg class="${className}" viewBox="0 0 80 92" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M61.5 27.5 A 21 21 0 1 0 40 49 A 21 21 0 1 1 18.5 64.5"
      stroke="${GREEN}"
      stroke-width="21"
      stroke-linecap="butt"
      stroke-linejoin="round"
    />
  </svg>`;
}

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
${syneFontFace}
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
}
.icon svg {
  height: 72%;
  width: auto;
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
</style>
</head>
<body>
  <div class="stage">
    <div class="icon" id="icon">${sMarkSvg()}</div>
    <div class="lockup" id="lockup">
      <span class="s">S</span>
      <span class="ch">t</span>
      <span class="ch">u</span>
      <span class="ch">d</span>
      <span class="ch">i</span>
      <span class="ch">o</span>
      <span class="ch">f</span>
      <span class="ch">r</span>
      <span class="ch">o</span>
      <span class="ch">n</span>
      <span class="ch">t</span>
    </div>
  </div>
</body>
</html>`;

const htmlPath = path.join(fontDir, "mark.html");
fs.writeFileSync(htmlPath, html);

const browser = await chromium.launch();
const page = await browser.newPage({
  deviceScaleFactor: 2,
  viewport: { width: 1400, height: 900 },
});
await page.goto(`file://${htmlPath}`);
await page.evaluate(async () => {
  await Promise.all([document.fonts.load("700 128px Syne"), document.fonts.load("800 128px Syne")]);
  await document.fonts.ready;
});
const loaded = await page.evaluate(() =>
  [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}`).join(" | "),
);
console.log(`FONTS=${loaded}`);

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
  const pad = Math.round(Math.max(meta.width, meta.height) * 0.22);
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
