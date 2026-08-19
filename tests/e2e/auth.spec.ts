import { expect, test } from "@playwright/test";
import { login, logout, signupStudio } from "./helpers/app";

test.describe("Auth scenarios", () => {
  test("@critical @regression wrong password unlocks login retry", async ({ page }) => {
    const stamp = String(Date.now());
    const { email, password } = await signupStudio(page, stamp, "auth");
    await logout(page);

    await login(page, email, `${password}-wrong`);
    await expect(page.locator(".form-error")).toContainText(/wrong email or password|login failed/i, {
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeEnabled();

    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 20_000 });
  });

  test("@regression forgot-password submits without server error", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.locator(".form-error")).toHaveCount(0);
    await expect(page.getByText(/Application error|Internal Server Error/i)).toHaveCount(0);
    await expect(page.locator(".form-success")).toBeVisible({ timeout: 15_000 });
  });
});
