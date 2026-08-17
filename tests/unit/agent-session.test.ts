import { describe, expect, it } from "vitest";
import {
  parseAgentSessionCookie,
  serializeAgentSessionCookie,
} from "@/lib/agent-auth";

describe("agent session cookie", () => {
  it("round-trips emails that contain dots", () => {
    const raw = serializeAgentSessionCookie({
      tenantId: "ten_test",
      email: "jane.doe@realty.example.com",
    });
    expect(parseAgentSessionCookie(raw)).toEqual({
      tenantId: "ten_test",
      email: "jane.doe@realty.example.com",
    });
  });

  it("rejects a truncated value", () => {
    expect(parseAgentSessionCookie("not-a-cookie")).toBeNull();
  });
});
