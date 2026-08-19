import { expect, test } from "@playwright/test";
import { apex, createBooking, signupStudio } from "./helpers/app";

test.describe("Booking scenarios", () => {
  test("@critical @regression agent can submit booking and see it in admin", async ({ page }) => {
    const stamp = String(Date.now());
    const { slug } = await signupStudio(page, stamp, "booking");
    await createBooking(page, slug, stamp);

    await page.goto(`${apex}/admin`);
    await expect(page).toHaveURL(/\/admin/, { timeout: 30_000 });
    await expect(page.getByText(/456 E2E Avenue|E2E Agent/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
