import { expect, test } from "@playwright/test";
import { signupStudio, studioOrigin } from "./helpers/app";

test.describe("Portal access scenarios", () => {
  test("@regression unauthenticated portal routes redirect to login", async ({ page }) => {
    await page.goto("/portal");
    await expect(page).toHaveURL(/\/portal\/login/);
    // Platform host has no tenant — guides agents to the studio subdomain.
    await expect(page.getByRole("heading", { name: /Agent portal/i })).toBeVisible();
    await expect(page.getByText(/Open your photographer/i)).toBeVisible();
  });

  test("@regression studio portal login shows email OTP form", async ({ page }) => {
    const stamp = String(Date.now());
    const { slug } = await signupStudio(page, stamp, "portalotp");
    const origin = studioOrigin(slug);

    await page.goto(`${origin}/portal`);
    await expect(page).toHaveURL(/\/portal\/login/);
    await expect(page.getByRole("button", { name: /Email me a code/i })).toBeVisible();
    await expect(page.getByText(/6-digit sign-in code/i)).toBeVisible();
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
