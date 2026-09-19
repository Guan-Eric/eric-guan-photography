import { vi } from "vitest";

const cookieStore = new Map<string, string>();
const requestHeaders = new Map<string, string>([
  ["host", "localhost:3000"],
  ["x-platform-host", "1"],
]);

export function resetCookieStore() {
  cookieStore.clear();
}

export function getCookieValue(name: string) {
  return cookieStore.get(name);
}

/** Override next/headers request headers for the current test. */
export function setRequestHeaders(headers: Record<string, string | null>) {
  for (const [key, value] of Object.entries(headers)) {
    const name = key.toLowerCase();
    if (value === null) requestHeaders.delete(name);
    else requestHeaders.set(name, value);
  }
}

/** Restore the default platform-host mock used by most tests. */
export function resetRequestHeaders() {
  requestHeaders.clear();
  requestHeaders.set("host", "localhost:3000");
  requestHeaders.set("x-platform-host", "1");
}

/**
 * Route handlers set cookies on the response, not on the next/headers jar.
 * Copy them in so later calls (e.g. getPhotographerSession) see the session.
 */
export function absorbResponseCookies(response: Response) {
  const raw =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : response.headers.get("set-cookie")?.split(/,(?=[^;]+?=)/) ?? [];
  for (const cookie of raw) {
    const [pair] = cookie.split(";");
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = decodeURIComponent(pair.slice(eq + 1).trim());
    if (value) cookieStore.set(name, value);
    else cookieStore.delete(name);
  }
}

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get(name: string) {
      const value = cookieStore.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set(name: string, value: string) {
      cookieStore.set(name, value);
    },
    delete(name: string) {
      cookieStore.delete(name);
    },
  }),
  headers: async () => ({
    get(name: string) {
      return requestHeaders.get(name.toLowerCase()) ?? null;
    },
  }),
}));
