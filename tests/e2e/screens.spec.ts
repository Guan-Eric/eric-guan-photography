import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  apex,
  clearUiOverlays,
  createBooking,
  skipCoachTours,
  signupStudio,
  studioOrigin,
} from "./helpers/app";

const OUT = join(process.cwd(), "public", "screens");
const FIXTURE_DIR = join(__dirname, "../fixtures");

function listingFixtures() {
  const named = readdirSync(FIXTURE_DIR)
    .filter((name) => /^listing-\d+\.jpe?g$/i.test(name))
    .sort()
    .map((name) => ({
      name,
      buffer: readFileSync(join(FIXTURE_DIR, name)),
    }));
  if (named.length > 0) return named;
  return [
    {
      name: "e2e-photo.jpg",
      buffer: readFileSync(join(FIXTURE_DIR, "e2e-photo.jpg")),
    },
  ];
}

test.describe("Marketing product screenshots", () => {
  test("@screens capture gallery, admin, and listing screens", async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await skipCoachTours(page);

    const stamp = String(Date.now());
    const { slug } = await signupStudio(page, stamp, "screens");
    const origin = studioOrigin(slug);
    const { orderId } = await createBooking(page, slug, stamp);

    await page.goto(`${apex}/admin`);
    await clearUiOverlays(page);

    for (const photo of listingFixtures()) {
      const upload = await page.request.post(
        `${apex}/api/admin/orders/${orderId}/upload`,
        {
          multipart: {
            files: {
              name: photo.name,
              mimeType: "image/jpeg",
              buffer: photo.buffer,
            },
          },
        },
      );
      expect(upload.ok(), await upload.text()).toBeTruthy();
    }

    const deliver = await page.request.post(
      `${apex}/api/admin/orders/${orderId}/delivery`,
      { data: {} },
    );
    expect(deliver.ok(), await deliver.text()).toBeTruthy();
    const deliverJson = (await deliver.json()) as {
      ok: boolean;
      gallery?: { publicToken: string };
      listingUrl?: string | null;
      error?: string;
    };
    expect(deliverJson.ok, deliverJson.error ?? "delivery failed").toBe(true);
    const token = deliverJson.gallery?.publicToken;
    expect(token).toBeTruthy();

    await page.goto(`${origin}/g/${token}`);
    await expect(page.getByText(/Pay .*unlock|Pay & unlock/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: join(OUT, "gallery-proofing.png"),
      fullPage: false,
    });

    const stub = page.getByRole("button", { name: /dev stub unlock/i });
    if (await stub.isVisible().catch(() => false)) {
      await stub.click();
    } else {
      // Browser resolves *.localhost; Node's API client often does not on Windows.
      await page.evaluate(async (galleryToken) => {
        const response = await fetch(`/api/g/${galleryToken}/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stub: true }),
        });
        if (!response.ok) {
          throw new Error(`stub unlock failed: ${response.status}`);
        }
      }, token);
      await page.reload();
    }
    await expect(page.getByText(/unlocked|download/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await page.waitForTimeout(600);
    await page.screenshot({
      path: join(OUT, "gallery-unlocked.png"),
      fullPage: false,
    });

    await page.goto(`${apex}/admin`);
    await clearUiOverlays(page);
    await expect(
      page.getByText(/456 E2E Avenue|orders|requested|delivered/i).first(),
    ).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(600);
    await page.screenshot({
      path: join(OUT, "admin-orders.png"),
      fullPage: false,
    });

    let listingPath: string | null = null;
    if (deliverJson.listingUrl) {
      try {
        listingPath = new URL(deliverJson.listingUrl).pathname;
      } catch {
        listingPath = deliverJson.listingUrl.startsWith("/")
          ? deliverJson.listingUrl
          : null;
      }
    }
    if (!listingPath) {
      listingPath = "/p/456-e2e-avenue";
    }
    const listingUrl = `${origin}${listingPath}`;
    await page.goto(listingUrl);
    await expect(page.locator("body")).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: join(OUT, "listing-page.png"),
      fullPage: false,
    });
  });
});
