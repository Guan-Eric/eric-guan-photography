import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false,
    pool: "forks",
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      include: ["lib/**/*.ts"],
      exclude: [
        "lib/db/**",
        "lib/sharp-stub.ts",
        "lib/toast.ts",
        "lib/stripe.ts",
        "lib/stripe-connect.ts",
        "lib/media-storage.ts",
        "lib/media-process.ts",
        "lib/gallery-zip.ts",
        "lib/share-kit.ts",
        "lib/platform-seed.ts",
        "lib/admin-auth.ts",
        "lib/auth.ts",
        "lib/invites.ts",
        "lib/reviews.ts",
        "lib/domain-billing.ts",
        "lib/listing-domains.ts",
        "lib/galleries.ts",
        "lib/tenants.ts",
        "lib/tenant-store.ts",
        "lib/order-notify.ts",
        "lib/billing.ts",
        "lib/email.ts",
        "lib/agent-auth.ts",
        "lib/custom-domain.ts",
        "lib/cloudflare-saas.ts",
      ],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": root,
    },
  },
});
