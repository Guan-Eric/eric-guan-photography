import fs from "node:fs";
import os from "node:os";
import path from "node:path";

delete process.env.DATABASE_URL;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sf-vitest-"));
process.env.DATABASE_PATH = path.join(dir, "platform.sqlite");
process.env.AUTH_SESSION_SECRET = "test-auth-secret-for-vitest-suite";
process.env.ADMIN_SESSION_SECRET = "test-admin-secret-for-vitest-suite";
process.env.PLATFORM_ROOT_DOMAIN = "localhost";
process.env.PLATFORM_NAME = "Studiofront";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
process.env.CRON_SECRET = "test-cron-secret";
process.env.ALLOW_GALLERY_STUB_UNLOCK = "1";
process.env.ADMIN_PASSWORD = "dev-admin-Test1!";

delete process.env.STRIPE_SECRET_KEY;
delete process.env.RESEND_API_KEY;
