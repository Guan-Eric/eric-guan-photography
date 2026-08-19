import { expect, test } from "@playwright/test";
import { getBilling, signupReferredPhotographer, signupStudio } from "./helpers/app";

test.describe("Referral scenarios", () => {
  test("@critical @regression both referrer and referred get trial extension", async ({ page, browser }) => {
    const stamp = String(Date.now());
    await signupStudio(page, stamp, "referrer");

    const before = await getBilling(page);
    expect(before.ok).toBe(true);
    expect(before.referralCode).toBeTruthy();
    expect(before.trialEndsAt).toBeTruthy();

    const beforeMs = new Date(before.trialEndsAt!).getTime();
    const referred = await signupReferredPhotographer(browser, before.referralCode!, stamp);
    expect(referred.trialEndsAt).toBeTruthy();
    expect(new Date(referred.trialEndsAt!).getTime()).toBeGreaterThan(beforeMs);

    const after = await getBilling(page);
    expect(after.trialEndsAt).toBeTruthy();
    expect(new Date(after.trialEndsAt!).getTime()).toBeGreaterThan(beforeMs);
  });
});
