import { beforeAll, describe, expect, it } from "vitest";
import { consumeAgentLoginToken, createAgentLoginToken } from "@/lib/agent-auth";
import { ensureTestDb } from "../helpers/db";

describe("agent login tokens", () => {
  beforeAll(() => {
    ensureTestDb();
  });

  it("consumes a magic link token only once", async () => {
    const token = await createAgentLoginToken("demo-studio", "agent-once@example.com");
    const first = await consumeAgentLoginToken(token);
    expect(first?.email).toBe("agent-once@example.com");
    const second = await consumeAgentLoginToken(token);
    expect(second).toBeNull();
  });
});
