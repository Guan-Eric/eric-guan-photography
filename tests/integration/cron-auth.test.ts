import { beforeAll, describe, expect, it } from "vitest";
import { ensureTestDb } from "../helpers/db";
import { readJson } from "../helpers/http";

describe("cron reminders auth", () => {
  beforeAll(() => {
    ensureTestDb();
    process.env.CRON_SECRET = "test-cron-secret";
  });

  it("rejects missing or wrong bearer token", async () => {
    const { GET } = await import("@/app/api/cron/reminders/route");

    const missing = await GET(new Request("http://localhost:3000/api/cron/reminders"));
    expect(missing.status).toBe(401);

    const wrong = await GET(
      new Request("http://localhost:3000/api/cron/reminders", {
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );
    expect(wrong.status).toBe(401);
  });

  it("accepts CRON_SECRET and returns sent count", async () => {
    const { GET } = await import("@/app/api/cron/reminders/route");
    const response = await GET(
      new Request("http://localhost:3000/api/cron/reminders", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    );
    expect(response.status).toBe(200);
    const json = await readJson<{ ok: boolean; sent: number }>(response);
    expect(json.ok).toBe(true);
    expect(typeof json.sent).toBe("number");
  });
});
