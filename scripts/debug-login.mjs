const { chromium } = require("playwright");

const email = process.env.SF_EMAIL;
const password = process.env.SF_PASSWORD;

if (!email || !password) {
  console.error("Set SF_EMAIL and SF_PASSWORD");
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const loginResPromise = page.waitForResponse(
    (r) => r.url().includes("/api/auth/login") && r.request().method() === "POST",
  );

  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  const loginRes = await loginResPromise;
  const setCookies = (await loginRes.headersArray())
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value);
  const body = await loginRes.json();
  console.log("LOGIN_STATUS", loginRes.status());
  console.log("LOGIN_BODY", JSON.stringify(body));
  console.log("SET_COOKIE_COUNT", setCookies.length);
  for (const c of setCookies) {
    const redacted = c.replace(/=([^;]*)/, (_, v) => `=${v ? `${v.slice(0, 8)}…` : ""}`);
    console.log("SET_COOKIE", redacted);
  }

  await page.waitForTimeout(2500);
  console.log("FINAL_URL", page.url());
  const cookies = await context.cookies();
  console.log(
    "COOKIES",
    JSON.stringify(
      cookies.map((c) => ({
        name: c.name,
        domain: c.domain,
        path: c.path,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite,
        valueLen: (c.value || "").length,
      })),
      null,
      2,
    ),
  );

  // Hit /admin via request API with same storage
  const admin = await page.request.get("http://localhost:3000/admin", {
    maxRedirects: 0,
  });
  console.log("ADMIN_STATUS", admin.status());
  console.log("ADMIN_LOCATION", admin.headers()["location"] || "");

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
