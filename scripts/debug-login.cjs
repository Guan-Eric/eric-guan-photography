const { chromium } = require("playwright");

(async () => {
  const stamp = Date.now();
  const email = `login-debug-${stamp}@example.com`;
  const password = "ValidPassw0rd!";
  const studioName = `Debug Studio ${stamp}`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // Fresh signup via API
  const signup = await context.request.post("http://localhost:3000/api/auth/signup", {
    data: {
      firstName: "Debug",
      lastName: "User",
      studioName,
      email,
      password,
    },
  });
  const signupHeaders = await signup.headersArray();
  const signupCookies = signupHeaders
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value);
  console.log("SIGNUP_STATUS", signup.status());
  console.log("SIGNUP_BODY", await signup.text());
  console.log("SIGNUP_SET_COOKIE_COUNT", signupCookies.length);
  for (const c of signupCookies) {
    console.log(
      "SIGNUP_SET_COOKIE",
      c.replace(/=([^;]*)/, (_, v) => `=${v ? `${v.slice(0, 10)}…len${v.length}` : ""}`),
    );
  }
  console.log(
    "AFTER_SIGNUP_COOKIES",
    JSON.stringify(
      (await context.cookies()).map((c) => ({
        name: c.name,
        domain: c.domain,
        valueLen: c.value.length,
      })),
    ),
  );

  const admin1 = await context.request.fetch("http://localhost:3000/admin", {
    maxRedirects: 0,
  });
  console.log("ADMIN_AFTER_SIGNUP", admin1.status(), admin1.headers()["location"] || "");

  // Logout
  await context.request.post("http://localhost:3000/api/admin/logout");
  console.log(
    "AFTER_LOGOUT_COOKIES",
    JSON.stringify(
      (await context.cookies()).map((c) => ({
        name: c.name,
        domain: c.domain,
        valueLen: c.value.length,
      })),
    ),
  );

  // Login via API
  const login = await context.request.post("http://localhost:3000/api/auth/login", {
    data: { email, password },
  });
  const loginHeaders = await login.headersArray();
  const loginCookies = loginHeaders
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value);
  console.log("LOGIN_STATUS", login.status());
  console.log("LOGIN_BODY", await login.text());
  console.log("LOGIN_SET_COOKIE_COUNT", loginCookies.length);
  for (const c of loginCookies) {
    console.log(
      "LOGIN_SET_COOKIE",
      c.replace(/=([^;]*)/, (_, v) => `=${v ? `${v.slice(0, 10)}…len${v.length}` : ""}`),
    );
  }
  console.log(
    "AFTER_LOGIN_COOKIES",
    JSON.stringify(
      (await context.cookies()).map((c) => ({
        name: c.name,
        domain: c.domain,
        valueLen: c.value.length,
      })),
    ),
  );

  const admin2 = await context.request.fetch("http://localhost:3000/admin", {
    maxRedirects: 0,
  });
  console.log("ADMIN_AFTER_LOGIN", admin2.status(), admin2.headers()["location"] || "");

  // UI login in fresh context
  const context2 = await browser.newContext();
  const page = await context2.newPage();
  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  const [uiLogin] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/auth/login") && r.request().method() === "POST",
    ),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]);
  const uiSet = (await uiLogin.headersArray())
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value);
  console.log("UI_LOGIN_STATUS", uiLogin.status());
  console.log("UI_SET_COOKIE_COUNT", uiSet.length);
  for (const c of uiSet) {
    console.log(
      "UI_SET_COOKIE",
      c.replace(/=([^;]*)/, (_, v) => `=${v ? `${v.slice(0, 10)}…len${v.length}` : ""}`),
    );
  }
  await page.waitForTimeout(2000);
  console.log("UI_FINAL_URL", page.url());
  console.log(
    "UI_COOKIES",
    JSON.stringify(
      (await context2.cookies()).map((c) => ({
        name: c.name,
        domain: c.domain,
        valueLen: c.value.length,
      })),
    ),
  );

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
