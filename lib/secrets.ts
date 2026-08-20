const DEV_AUTH_SECRET = "dev-auth-secret-change-me";

/** Photographer / agent session signing secret. Fails fast in production when unset. */
export function authSessionSecret(): string {
  const value =
    process.env.AUTH_SESSION_SECRET?.trim() ||
    process.env.ADMIN_SESSION_SECRET?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SESSION_SECRET (or ADMIN_SESSION_SECRET) is required in production.",
    );
  }
  return DEV_AUTH_SECRET;
}
