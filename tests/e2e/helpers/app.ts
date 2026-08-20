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

export async function provisionOwnerStudio(page: Page, stamp: string, prefix = "e2e") {
  await skipCoachTours(page);
  const email = `${prefix}-${stamp}@example.com`;
  const password = "ValidPassw0rd!";
  const studioName = `E2E Studio ${prefix} ${stamp}`;

  const response = await page.request.post(`${apex}/api/auth/signup`, {
    data: {
      firstName: "E2E",
      lastName: "Owner",
      studioName,
      email,
      password,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const json = (await response.json()) as { ok: boolean; slug?: string };
  expect(json.ok).toBe(true);
  expect(json.slug).toBeTruthy();

  await ensureTeamInviteCapacity(page);

  return { email, password, studioName, slug: json.slug! };
}

export async function ensureTeamInviteCapacity(page: Page) {
  const response = await page.request.post(`${apex}/api/admin/invites/e2e-capacity`);
  expect(response.ok(), await response.text()).toBeTruthy();
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
  const [, response] = await Promise.all([
    page.getByRole("button", { name: /create account/i }).click(),
    responsePromise,
  ]);
  let json: { ok: boolean; slug?: string };
  try {
    json = (await response.json()) as { ok: boolean; slug?: string };
  } catch {
    await expect(page).toHaveURL(/\/admin/, { timeout: 30_000 });
    const connect = await page.request.get(`${apex}/api/admin/connect`);
    expect(connect.ok(), await connect.text()).toBeTruthy();
    json = { ok: true, slug: ((await connect.json()) as { slug?: string }).slug };
  }
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
  await page.getByRole("button", { name: /sign in/i }).click();
}

export async function sendTeamInvite(page: Page, email: string) {
  const response = await page.request.post(`${apex}/api/admin/invites`, {
    data: { email, role: "editor" },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const json = (await response.json()) as { ok: boolean; acceptPath?: string };
  expect(json.ok).toBe(true);
  expect(json.acceptPath).toMatch(/^\/invite\//);
  return json.acceptPath!.replace("/invite/", "");
}

export async function signupViaInvite(
  page: Page,
  options: { token: string; email: string; password?: string },
) {
  const password = options.password ?? "ValidPassw0rd!";
  await skipCoachTours(page);
  await page.goto(`${apex}/signup?invite=${encodeURIComponent(options.token)}`);
  await expect(page.getByLabel("Email")).toHaveValue(options.email);
  await page.getByLabel("First name").fill("Editor");
  await page.getByLabel("Last name").fill("Invitee");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: /create account & join/i }).click();
  await expect(page).toHaveURL(/\/admin/, { timeout: 30_000 });
  await clearUiOverlays(page);
  return { password };
}

export async function loginViaInvite(
  page: Page,
  options: { token: string; email: string; password: string },
) {
  await skipCoachTours(page);
  await page.goto(`${apex}/login?invite=${encodeURIComponent(options.token)}`);
  if (!page.url().includes("/login")) {
    await expect(page).toHaveURL(/\/admin/, { timeout: 30_000 });
    await clearUiOverlays(page);
    return;
  }
  await expect(page.getByLabel("Email")).toHaveValue(options.email);
  await page.getByLabel("Password").fill(options.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin/, { timeout: 30_000 });
  await clearUiOverlays(page);
}

export async function getTeam(page: Page) {
  const response = await page.request.get(`${apex}/api/admin/invites`);
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as {
    ok: boolean;
    members?: Array<{ email: string; role: string }>;
    invites?: Array<{ email: string; role: string }>;
  };
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
  await skipCoachTours(page);
  await page.goto(bookingUrl, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/book/, { timeout: 30_000 });
  await expect(
    page.getByLabel(/square footage/i),
    `Booking form did not load at ${bookingUrl}`,
  ).toBeVisible({ timeout: 45_000 });
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
  await page.getByLabel(/square footage/i).fill("1500");

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
