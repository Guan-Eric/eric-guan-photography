import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Cloudflare / OpenNext builds must not inherit localhost from .env.local.
 * Next inlines PLATFORM_* and NEXT_PUBLIC_* at build time into the Worker.
 */
function loadStripeLivePublicKey() {
  try {
    const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
    const liveEnv = path.join(root, ".env.stripe.live");
    if (!fs.existsSync(liveEnv)) return {};
    for (const line of fs.readFileSync(liveEnv, "utf8").split("\n")) {
      const t = line.trim();
      if (t.startsWith("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=")) {
        const v = t.slice("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=".length).trim();
        if (v.startsWith("pk_live_")) {
          return { NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: v.replace(/^["']|["']$/g, "") };
        }
      }
    }
  } catch {
    /* optional */
  }
  return {};
}

const result = spawnSync(
  "npx",
  ["opennextjs-cloudflare", "build", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      ...loadStripeLivePublicKey(),
      OPEN_NEXT_CLOUDFLARE: "1",
      PLATFORM_ROOT_DOMAIN: "studiofront.ca",
      PLATFORM_PUBLIC_URL: "https://studiofront.ca",
      NEXT_PUBLIC_SITE_URL: "https://studiofront.ca",
    },
  },
);

process.exit(result.status ?? 1);
