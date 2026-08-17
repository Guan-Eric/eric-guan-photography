import { afterEach, describe, expect, it } from "vitest";
import {
  PASSWORD_MIN_LENGTH,
  passwordIsValid,
  passwordIssues,
} from "@/lib/password-rules";

describe("password-rules", () => {
  afterEach(() => {
    // no shared state
  });

  it("rejects short passwords", () => {
    const issues = passwordIssues("Ab1!");
    expect(issues).toContain("At least 12 characters");
    expect(passwordIsValid("Ab1!")).toBe(false);
  });

  it("requires mixed case, number, and special", () => {
    expect(passwordIssues("abcdefghijkl")).toEqual(
      expect.arrayContaining([
        "Upper and lowercase letters",
        "At least one number",
        "At least one special character",
      ]),
    );
    expect(passwordIssues("Abcdefghijkl")).toEqual(
      expect.arrayContaining([
        "At least one number",
        "At least one special character",
      ]),
    );
    expect(passwordIssues("Abcdefghijk1")).toEqual([
      "At least one special character",
    ]);
  });

  it("accepts a valid password", () => {
    const password = "ValidPassw0rd!";
    expect(password.length).toBeGreaterThanOrEqual(PASSWORD_MIN_LENGTH);
    expect(passwordIssues(password)).toEqual([]);
    expect(passwordIsValid(password)).toBe(true);
  });
});
