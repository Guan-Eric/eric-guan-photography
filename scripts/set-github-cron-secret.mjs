/**
 * One-shot: set GitHub Actions CRON_SECRET from .env.local
 * Requires: gh auth login
 * Usage: node scripts/set-github-cron-secret.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let cron = "";
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
  if (line.startsWith("CRON_SECRET=")) {
    cron = line.slice("CRON_SECRET=".length).trim();
    break;
  }
}
if (!cron) {
  console.error("CRON_SECRET missing from .env.local");
  process.exit(1);
}

const gh =
  process.env.GH_BIN ||
  (process.platform === "win32"
    ? "C:\\Program Files\\GitHub CLI\\gh.exe"
    : "gh");

const result = spawnSync(
  gh,
  ["secret", "set", "CRON_SECRET", "--repo", "Guan-Eric/eric-guan-photography"],
  { input: cron, encoding: "utf8", shell: true },
);
if (result.status !== 0) {
  console.error(result.stderr || result.stdout || "gh secret set failed");
  process.exit(result.status ?? 1);
}
console.log("OK=CRON_SECRET set on Guan-Eric/eric-guan-photography");
