import { expect, type Browser, type Page } from "@playwright/test";

export const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
export const apex = `http://localhost:${PORT}`;

export function studioOrigin(slug: string) {
  return `http://${slug}.localhost:${PORT}`;
}

export async function signupStudio(page: Page, stamp: string, prefix = "e2e") {
  const email = `${prefix}-${stamp}@example.com`;
  const password = "ValidPassw0rd!";
  const studioName = `E2E Studio ${prefix} ${stamp}`;

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

export async function login(page: Page, email: string, password: string) {
  await page.goto(`${apex}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
}

export async function getBilling(page: Page) {
  const response = await page.request.get(`${apex}/api/admin/billing`);
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as {
    ok: boolean;
    trialEndsAt: string | null;
    referralCode?: string | null;
    plan?: string;
  };
}

export async function signupReferredPhotographer(
  browser: Browser,
  referralCode: string,
  stamp: string,
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = `referred-${stamp}@example.com`;
  const password = "ValidPassw0rd!";
  const studioName = `Referred Studio ${stamp}`;

  await page.goto(`${apex}/signup?ref=${encodeURIComponent(referralCode)}`);
  await page.getByLabel("First name").fill("Referred");
  await page.getByLabel("Last name").fill("Photographer");
  await page.getByLabel("Studio name").fill(studioName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/admin/, { timeout: 30_000 });

  const billing = await getBilling(page);
  await context.close();
  return billing;
}

export async function createBooking(page: Page, slug: string, stamp: string) {
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
  return { origin, orderId: orderId! };
}
