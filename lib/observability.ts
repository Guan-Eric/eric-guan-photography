/** Structured server errors for Cloudflare Workers logs / future Sentry wiring. */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
) {
  console.error("[captureException]", {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
  });
}
