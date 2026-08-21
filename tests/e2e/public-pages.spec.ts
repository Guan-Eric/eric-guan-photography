import { expect, test } from "@playwright/test";

const PUBLIC_ROUTES = [
  "/",
  "/pricing",
  "/lifetime",
  "/work",
  "/privacy",
  "/terms",
  "/login",
  "/signup",
];

test.describe("Public page scenarios", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`@regression route loads ${route}`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.ok()).toBeTruthy();
      await expect(page.locator("body")).toBeVisible();
      await expect(page.getByText(/Application error|Internal Server Error/i)).toHaveCount(0);
    });
  }
});
