import { expect, test } from "@playwright/test";
import { apex, createBooking, signupStudio, studioOrigin } from "./helpers/app";

test.describe("Portal and gallery scenarios", () => {
  test("@critical @regression delivered gallery can be opened and unlocked", async ({ page }) => {
    const stamp = String(Date.now());
    const { slug } = await signupStudio(page, stamp, "gallery");
    const { origin, orderId } = await createBooking(page, slug, stamp);

    await page.goto(`${apex}/admin`);

    const jpeg = Buffer.from(
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8hf//Z",
      "base64",
    );

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
      const unlock = await page.request.post(`${studioOrigin(slug)}/api/g/${token}/checkout`, {
        data: { stub: true },
      });
      expect(unlock.ok()).toBeTruthy();
      await page.reload();
      await expect(page.getByText(/unlocked/i).first()).toBeVisible();
    }
  });
});
