import { expect, test } from "@playwright/test";
import { clearUiOverlays, signupStudio } from "./helpers/app";

const ADMIN_ROUTES = [
  "/admin",
  "/admin/today",
  "/admin/work",
  "/admin/pricing",
  "/admin/booking",
  "/admin/listings",
  "/admin/reviews",
  "/admin/schedule",
  "/admin/settings",
];

test.describe("Admin navigation scenarios", () => {
  test("@critical @regression all main admin pages load", async ({ page }) => {
    const stamp = String(Date.now());
    await signupStudio(page, stamp, "adminnav");
    await clearUiOverlays(page);

    for (const route of ADMIN_ROUTES) {
      const response = await page.goto(route);
      expect(response?.ok(), `failed route ${route}`).toBeTruthy();
      await expect(page).toHaveURL(new RegExp(route.replace("/", "\\/")));
      await expect(page.getByText(/Application error|Internal Server Error/i)).toHaveCount(0);
    }
  });
});
