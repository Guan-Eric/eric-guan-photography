import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run dev:e2e -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
    timeout: 180_000,
    env: {
      ...process.env,
      ALLOW_GALLERY_STUB_UNLOCK: "1",
      ALLOW_E2E_TEAM_SETUP: "1",
      MEDIA_PROCESS_WITH_SHARP: "1",
      E2E_TRIAL_SEATS: "3",
      PLATFORM_ROOT_DOMAIN: "localhost",
      NEXT_PUBLIC_SITE_URL: baseURL,
    },
  },
  projects: [
    {
      name: "chromium-smoke",
      grep: /@smoke/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-critical",
      grep: /@critical/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-regression",
      grep: /@regression/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
