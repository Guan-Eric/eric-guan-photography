import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { apex, createBooking, signupStudio } from "./helpers/app";

const e2ePhoto = readFileSync(join(__dirname, "../fixtures/e2e-photo.jpg"));

test.describe("Portal and gallery scenarios", () => {
  test("@critical @regression delivered gallery can be opened and unlocked", async ({ page }) => {
    const stamp = String(Date.now());
    const { slug } = await signupStudio(page, stamp, "gallery");
    const { origin, orderId } = await createBooking(page, slug, stamp);

    await page.goto(`${apex}/admin`);

    const jpeg = e2ePhoto;

    const upload = await page.request.post(`${apex}/api/admin/orders/${orderId}/upload`, {
      multipart: {
        files: {
          name: "e2e.jpg",
          mimeType: "image/jpeg",
          buffer: jpeg,
        },
      },
    });
    expect(upload.ok(), await upload.text()).toBeTruthy();
    const uploadJson = (await upload.json()) as { ok: boolean; token?: string };

    const deliver = await page.request.post(`${apex}/api/admin/orders/${orderId}/delivery`, {
      data: {},
    });
    expect(deliver.ok(), await deliver.text()).toBeTruthy();
    const deliverJson = (await deliver.json()) as {
      ok: boolean;
      gallery?: { publicToken: string };
      error?: string;
    };
    expect(deliverJson.ok, deliverJson.error ?? "delivery failed").toBe(true);

    const token = deliverJson.gallery?.publicToken ?? uploadJson.token;
    expect(token).toBeTruthy();

    await page.goto(`${origin}/g/${token}`);
    await expect(page.getByText(/456 E2E Avenue/i).first()).toBeVisible();

    const stub = page.getByRole("button", { name: /dev stub unlock/i });
    if (await stub.isVisible()) {
      await stub.click();
      await expect(page.getByText(/unlocked/i).first()).toBeVisible({ timeout: 15_000 });
    } else {
      const unlock = await page.request.post(`${origin}/api/g/${token}/checkout`, {
        data: { stub: true },
      });
      expect(unlock.ok()).toBeTruthy();
      await page.reload();
      await expect(page.getByText(/unlocked/i).first()).toBeVisible();
    }
  });
});
