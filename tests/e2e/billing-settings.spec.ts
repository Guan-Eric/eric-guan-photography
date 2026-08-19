import { expect, test } from "@playwright/test";
import { clearUiOverlays, signupStudio } from "./helpers/app";

test.describe("Billing and settings scenarios", () => {
  test("@critical @regression plan selection previews before checkout", async ({ page }) => {
    const stamp = String(Date.now());
    await signupStudio(page, stamp, "plan");

    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: /subscription/i })).toBeVisible();
    await clearUiOverlays(page);

    await page.getByRole("button", { name: /growth/i }).click();
    await expect(page).toHaveURL(/\/admin\/settings/);
    await expect(page.getByText(/Growth includes:/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /switch to growth/i })).toBeVisible();
  });

  test("@regression referral section is visible in settings", async ({ page }) => {
    const stamp = String(Date.now());
    await signupStudio(page, stamp, "settingsref");

    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: /refer a photographer/i })).toBeVisible();
  });
});
