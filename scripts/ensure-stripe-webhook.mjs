/**
 * @deprecated Use scripts/setup-stripe-production.mjs (creates webhook automatically)
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync("node", ["scripts/setup-stripe-production.mjs"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
process.exit(result.status ?? 1);
