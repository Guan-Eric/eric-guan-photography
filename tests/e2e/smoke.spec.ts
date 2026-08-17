import { expect, test, type Page } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const apex = `http://localhost:${PORT}`;

function studioOrigin(slug: string) {
  return `http://${slug}.localhost:${PORT}`;
}

async function signupStudio(page: Page, stamp: string) {
  const email = `e2e-${stamp}@example.com`;
  const password = "ValidPassw0rd!";
  const studioName = `E2E Studio ${stamp}`;

  await page.goto(`${apex}/signup`);
  await page.getByLabel("First name").fill("E2E");
  await page.getByLabel("Last name").fill("Photographer");
  await page.getByLabel("Studio name").fill(studioName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/signup") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /create account/i }).click();
  const response = await responsePromise;
  const json = (await response.json()) as { ok: boolean; slug?: string };
  expect(json.ok).toBe(true);
  expect(json.slug).toBeTruthy();
  await expect(page).toHaveURL(/\/admin/, { timeout: 30_000 });

  return { email, password, studioName, slug: json.slug! };
}

test.describe("Studiofront smoke", () => {
  test("apex marketing loads and signup creates a studio", async ({ page }) => {
    await page.goto(apex);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(/Studiofront|Book the shoot|Create/i).first()).toBeVisible();

    const stamp = String(Date.now());
    await signupStudio(page, stamp);
  });

  test("studio book → admin board → gallery stub unlock", async ({ page }) => {
    const stamp = String(Date.now());
    const { slug } = await signupStudio(page, stamp);
    const origin = studioOrigin(slug);

    await page.goto(`${origin}/book`);
    await expect(page.getByRole("heading", { name: /package/i }).first()).toBeVisible({
      timeout: 30_000,
    });

    await page.locator('[data-field="squareFootage"] input').fill("1500");
    await page.locator('[data-field="propertyAddress"] input').fill("456 E2E Avenue");
    await page.locator('[data-field="postalCode"] input').fill("H2X 1Y4");
    await page.locator('[data-field="city"] input').fill("Montreal");

    const timeChip = page.locator(".time-chip").first();
    await expect(timeChip).toBeVisible({ timeout: 30_000 });
    await timeChip.click();

    await page.locator('[data-field="agentName"] input').fill("E2E Agent");
    await page.locator('input[type="email"]').fill(`agent-e2e-${stamp}@example.com`);

    await page.getByRole("button", { name: /request this shoot/i }).click();
    await expect(page).toHaveURL(/\/book\/confirmation\//, { timeout: 45_000 });
    const orderId = page.url().match(/confirmation\/([^?/]+)/)?.[1];
    expect(orderId).toBeTruthy();

    // Admin session was set on apex during signup; Chromium keeps host-only cookies
    // on localhost more reliably than Domain=.localhost across *.localhost.
    await page.goto(`${apex}/admin`);
    await expect(page).toHaveURL(/\/admin/, { timeout: 30_000 });
    await expect(page.getByText(/456 E2E Avenue|E2E Agent/i).first()).toBeVisible({
      timeout: 30_000,
    });

    // Upload a tiny JPEG so publishDelivery can create a public gallery token.
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
    expect(uploadJson.ok).toBe(true);
    expect(uploadJson.token).toBeTruthy();

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

  test("forgot-password submits without 500", async ({ page }) => {
    await page.goto(`${apex}/forgot-password`);
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.locator(".form-error")).toHaveCount(0);
    await expect(page.getByText(/Application error|Internal Server Error/i)).toHaveCount(0);
    await expect(page.locator(".form-success")).toBeVisible({ timeout: 15_000 });
  });
});
