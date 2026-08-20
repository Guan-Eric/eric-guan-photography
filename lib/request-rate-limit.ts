import { checkRateLimit } from "@/lib/quotas";

export function clientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export function rateLimitRequest(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number,
) {
  return checkRateLimit(`${scope}:${clientIp(request)}`, limit, windowMs);
}

/** Login, signup, password reset — 30 attempts per 15 minutes per IP. */
export function rateLimitAuth(request: Request, action: string) {
  return rateLimitRequest(request, `auth:${action}`, 30, 15 * 60 * 1000);
}

/** Public booking — 20 submissions per hour per IP. */
export function rateLimitBooking(request: Request) {
  return rateLimitRequest(request, "book", 20, 60 * 60 * 1000);
}
