import { describe, expect, it } from "vitest";
import { isUnusableConnectAccountError } from "@/lib/stripe-connect";
import { isStripeModeMismatchError } from "@/lib/stripe";

describe("isUnusableConnectAccountError", () => {
  it("detects a test Connect account used with live keys", () => {
    expect(
      isUnusableConnectAccountError({
        message:
          "The account acct_1U4tRJIyxXCVIII2 was a test account created with a testmode key, and therefore can only be used with testmode keys.",
      }),
    ).toBe(true);
  });

  it("detects a missing Connect account", () => {
    expect(
      isUnusableConnectAccountError(new Error("No such account: 'acct_missing'")),
    ).toBe(true);
  });

  it("ignores unrelated Stripe errors", () => {
    expect(
      isUnusableConnectAccountError(new Error("Your card was declined.")),
    ).toBe(false);
    expect(isUnusableConnectAccountError(null)).toBe(false);
  });
});

describe("isStripeModeMismatchError", () => {
  it("detects a test customer used with live keys", () => {
    expect(
      isStripeModeMismatchError({
        message:
          "No such customer: 'cus_V53YHzwjSR6rXE'; a similar object exists in test mode, but a live mode key was used to make this request.",
      }),
    ).toBe(true);
  });
});
