/** Thin Request helpers for calling App Router handlers in Vitest. */

export function jsonRequest(
  url: string,
  body: unknown,
  init: RequestInit & { headers?: Record<string, string> } = {},
) {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new Request(url, {
    ...init,
    method: init.method ?? "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function readJson<T = unknown>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
