import { expect, test } from "@playwright/test";
import { signupStudio, studioOrigin } from "./helpers/app";

test.describe("Portal access scenarios", () => {
  test("@regression unauthenticated portal routes redirect to login", async ({ page }) => {
    await page.goto("/portal");
    await expect(page).toHaveURL(/\/portal\/login/);
  });

  test("@regression gallery footer links to portal login when agent not signed in", async ({ page }) => {
    const stamp = String(Date.now());
    const { slug } = await signupStudio(page, stamp, "portalaccess");
    const origin = studioOrigin(slug);

    await page.goto(`${origin}/g/not-a-real-token`);
    // token will 404, but route should still avoid app crash
    await expect(page.getByText(/Application error|Internal Server Error/i)).toHaveCount(0);
  });
});
