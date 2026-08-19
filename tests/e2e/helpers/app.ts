import { expect, type Browser, type Page } from "@playwright/test";

export const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
export const apex = `http://localhost:${PORT}`;

const COACH_TOUR_IDS = ["photo_v1", "agent_book_v1", "agent_gallery_v1"];

export function studioOrigin(slug: string) {
  return `http://${slug}.localhost:${PORT}`;
}

export async function skipCoachTours(page: Page) {
  await page.addInitScript((tourIds: string[]) => {
    for (const tourId of tourIds) {
      try {
        localStorage.setItem(`sf_tour_${tourId}`, "1");
      } catch {
        // ignore private mode / quota errors
      }
    }
  }, COACH_TOUR_IDS);
}

export async function clearUiOverlays(page: Page) {
  // New accounts can land with guided-tour overlays that intercept clicks.
  for (let i = 0; i < 5; i += 1) {
    await page.keyboard.press("Escape").catch(() => undefined);
    const dismiss = page.getByRole("button", { name: /dismiss|skip/i }).first();
    if (await dismiss.isVisible().catch(() => false)) {
      await dismiss.click({ force: true }).catch(() => undefined);
    }
    await page
      .evaluate(() => {
        const nodes = document.querySelectorAll(".coach-root, .coach-overlay");
        for (const node of nodes) {
          (node as HTMLElement).style.display = "none";
          (node as HTMLElement).style.pointerEvents = "none";
        }
      })
      .catch(() => undefined);
    await page.waitForTimeout(150);
  }
}

export async function signupStudio(page: Page, stamp: string, prefix = "e2e") {
  await skipCoachTours(page);
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
  await clearUiOverlays(page);

  return { email, password, studioName, slug: json.slug! };
}

export async function login(page: Page, email: string, password: string) {
  await page.goto(`${apex}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
}

export async function logout(page: Page) {
  await clearUiOverlays(page);
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
  await skipCoachTours(page);
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

export async function openBookingPage(page: Page, slug: string) {
  const origin = studioOrigin(slug);
  const bookingUrl = `${origin}/book`;
  let ready = false;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(bookingUrl);
    await expect(page).toHaveURL(/\/book/, { timeout: 30_000 });
    const sqft = page.locator('[data-field="squareFootage"] input');
    const packageSelect = page.locator('[data-field="packageId"] select');
    if (await sqft.isVisible().catch(() => false)) {
      ready = true;
      break;
    }
    if (await packageSelect.isVisible().catch(() => false)) {
      await packageSelect.selectOption({ index: 0 }).catch(() => undefined);
      await page.waitForTimeout(1000);
      if (await sqft.isVisible().catch(() => false)) {
        ready = true;
        break;
      }
    }
    await page.waitForTimeout(1500);
  }

  expect(ready, `Booking form did not load at ${bookingUrl}`).toBe(true);
  await clearUiOverlays(page);
  return { origin, bookingUrl };
}

async function selectFirstPreferredTime(page: Page) {
  const timeGroup = page.getByRole("group", { name: /times on/i });
  await expect(timeGroup).toBeVisible({ timeout: 30_000 });
  await timeGroup.getByRole("button").first().click();
  await expect(page.getByText(/1st choice/i)).toBeVisible({ timeout: 10_000 });
}

export async function submitBookingForm(page: Page) {
  await page.getByRole("button", { name: /send request/i }).click();
}

export async function createBooking(page: Page, slug: string, stamp: string) {
  const { origin } = await openBookingPage(page, slug);
  await page.locator('[data-field="squareFootage"] input').fill("1500");

  const addressField = page.getByRole("combobox", { name: /property address/i });
  if (await addressField.isVisible().catch(() => false)) {
    await addressField.fill("456 E2E Avenue");
  } else {
    await page.locator('[data-field="propertyAddress"] input').fill("456 E2E Avenue");
  }

  await page.locator('[data-field="postalCode"] input').fill("H2X 1Y4");
  await page.locator('[data-field="city"] input').fill("Montreal");
  await selectFirstPreferredTime(page);
  await page.locator('[data-field="agentName"] input').fill("E2E Agent");
  await page.locator('[data-field="agentEmail"] input').fill(`agent-e2e-${stamp}@example.com`);
  const bookResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/book") && response.request().method() === "POST",
  );
  await submitBookingForm(page);
  const bookResponse = await bookResponsePromise;
  const bookJson = (await bookResponse.json()) as { ok: boolean; error?: string };
  expect(bookJson.ok, bookJson.error ?? (await bookResponse.text())).toBeTruthy();
  await expect(page).toHaveURL(/\/book\/confirmation\//, { timeout: 45_000 });
  const orderId = page.url().match(/confirmation\/([^?/]+)/)?.[1];
  expect(orderId).toBeTruthy();
  return { origin, orderId: orderId! };
}
