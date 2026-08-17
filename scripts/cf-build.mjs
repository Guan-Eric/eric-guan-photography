import { spawnSync } from "node:child_process";

/**
 * Cloudflare / OpenNext builds must not inherit localhost from .env.local.
 * Next inlines PLATFORM_* and NEXT_PUBLIC_* at build time into the Worker.
 */
const result = spawnSync(
  "npx",
  ["opennextjs-cloudflare", "build", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      OPEN_NEXT_CLOUDFLARE: "1",
      PLATFORM_ROOT_DOMAIN: "studiofront.ca",
      PLATFORM_PUBLIC_URL: "https://studiofront.ca",
      NEXT_PUBLIC_SITE_URL: "https://studiofront.ca",
    },
  },
);

process.exit(result.status ?? 1);
