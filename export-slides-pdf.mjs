import { chromium } from "playwright";
import { pathToFileURL } from "url";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "year-plan-slides.html");
const pdfPath = path.join(
  __dirname,
  "Eric-Guan-RE-Photography-Year-Plan.pdf"
);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
});

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
await page.evaluateHandle("document.fonts.ready");
await page.waitForTimeout(500);

const slides = page.locator(".slide");
const count = await slides.count();

await page.pdf({
  path: pdfPath,
  width: "1280px",
  height: "720px",
  printBackground: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
  preferCSSPageSize: false,
});

await browser.close();
console.log(`Wrote ${pdfPath} (${count} slides)`);
