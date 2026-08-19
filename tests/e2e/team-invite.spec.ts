import { expect, test } from "@playwright/test";
import {
  apex,
  getTeam,
  loginViaInvite,
  provisionOwnerStudio,
  sendTeamInvite,
  signupViaInvite,
} from "./helpers/app";

test.describe("Team invite scenarios", () => {
  test("@critical @regression wrong session on invite redirects to login with invited email", async ({
    page,
  }) => {
    const stamp = String(Date.now());
    const editorEmail = `editor-${stamp}@example.com`;
    await provisionOwnerStudio(page, stamp, "invite-owner");

    const token = await sendTeamInvite(page, editorEmail);

    await page.goto(`${apex}/invite/${token}`);
    await expect(page).toHaveURL(new RegExp(`/login\\?invite=${token}`));
    await expect(page.getByLabel("Email")).toHaveValue(editorEmail);
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByText(/couldn't join/i)).toHaveCount(0);
  });

  test("@critical @regression login with invite while wrong session clears and shows invited email", async ({
    page,
  }) => {
    const stamp = String(Date.now());
    const editorEmail = `editor-login-${stamp}@example.com`;
    await provisionOwnerStudio(page, stamp, "invite-owner-login");

    const token = await sendTeamInvite(page, editorEmail);

    await page.goto(`${apex}/login?invite=${encodeURIComponent(token)}`);
    await expect(page).toHaveURL(new RegExp(`/login\\?invite=${token}`));
    await expect(page.getByLabel("Email")).toHaveValue(editorEmail);
    await expect(page.getByText(/couldn't join/i)).toHaveCount(0);
  });

  test("@critical @regression editor signup via invite joins the studio", async ({
    page,
    browser,
  }) => {
    const stamp = String(Date.now());
    const editorEmail = `editor-join-${stamp}@example.com`;
    await provisionOwnerStudio(page, stamp, "invite-owner-join");

    const token = await sendTeamInvite(page, editorEmail);

    const editorContext = await browser.newContext();
    const editorPage = await editorContext.newPage();
    await signupViaInvite(editorPage, { token, email: editorEmail });

    const team = await getTeam(page);
    expect(team.members?.some((member) => member.email === editorEmail)).toBe(true);

    await editorContext.close();
  });

  test("@regression editor login via invite joins when account already exists", async ({
    page,
    browser,
  }) => {
    const stamp = String(Date.now());
    const editorEmail = `editor-existing-${stamp}@example.com`;
    const password = "ValidPassw0rd!";
    await provisionOwnerStudio(page, stamp, "invite-owner-existing");

    const editorContext = await browser.newContext();
    const editorPage = await editorContext.newPage();
    const signupResponse = await editorPage.request.post(`${apex}/api/auth/signup`, {
      data: {
        firstName: "Editor",
        lastName: "Existing",
        studioName: `Editor Studio ${stamp}`,
        email: editorEmail,
        password,
      },
    });
    expect(signupResponse.ok(), await signupResponse.text()).toBeTruthy();

    const token = await sendTeamInvite(page, editorEmail);

    await editorPage.request.post(`${apex}/api/admin/logout`);
    await loginViaInvite(editorPage, { token, email: editorEmail, password });

    const team = await getTeam(page);
    expect(team.members?.some((member) => member.email === editorEmail)).toBe(true);

    await editorContext.close();
  });
});
