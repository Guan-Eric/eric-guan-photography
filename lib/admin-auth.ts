/**
 * Compatibility shim: admin board now uses photographer auth (lib/auth.ts).
 * Kept so older imports keep working during the Phase 3 transition.
 */
export {
  getPhotographerSession as getAdminSession,
  clearPhotographerSession as clearAdminSession,
} from "@/lib/auth";

import { getPhotographerSession } from "@/lib/auth";

export async function isAdminAuthenticated() {
  return Boolean(await getPhotographerSession());
}

export function isDefaultAdminPassword() {
  return !process.env.ADMIN_PASSWORD;
}

/** @deprecated Prefer email/password photographer login. */
export function verifyAdminPassword(_password: string) {
  return false;
}

export async function createAdminSession() {
  throw new Error("Use photographer login (/api/auth/login) instead.");
}
