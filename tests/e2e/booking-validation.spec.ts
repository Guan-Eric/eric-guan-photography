import { expect, test } from "@playwright/test";
import { createBooking, openBookingPage, signupStudio, submitBookingForm } from "./helpers/app";

test.describe("Booking validation scenarios", () => {
  test("@regression booking form shows validation when required fields missing", async ({ page }) => {
    const stamp = String(Date.now());
    const { slug } = await signupStudio(page, stamp, "bookvalid");
    await openBookingPage(page, slug);
    await submitBookingForm(page);
    await expect(page.locator(".field-error, .form-error").first()).toBeVisible();
  });

  test("@critical @regression successful booking reaches confirmation URL", async ({ page }) => {
    const stamp = String(Date.now());
    const { slug } = await signupStudio(page, stamp, "bookok");
    await createBooking(page, slug, stamp);
    await expect(page).toHaveURL(/\/book\/confirmation\//);
  });
});
