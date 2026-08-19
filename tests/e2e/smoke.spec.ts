import { expect, test } from "@playwright/test";
import { apex, signupStudio } from "./helpers/app";

test.describe("Studiofront smoke", () => {
  test("@smoke apex marketing loads", async ({ page }) => {
    await page.goto(apex);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(/Studiofront|Book the shoot|Create/i).first()).toBeVisible();
  });

  test("@smoke signup creates a studio", async ({ page }) => {
    const stamp = String(Date.now());
    await signupStudio(page, stamp);
  });
});
