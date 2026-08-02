import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { verifyLemonSqueezySignature } from "./verify-signature";

const secret = "test-secret";
const body = JSON.stringify({ meta: { event_name: "order_created" } });

function sign(payload: string, key: string) {
  return createHmac("sha256", key).update(payload).digest("hex");
}

describe("verifyLemonSqueezySignature", () => {
  it("accepts a correctly signed payload", () => {
    expect(verifyLemonSqueezySignature(body, sign(body, secret), secret)).toBe(true);
  });

  it("rejects a payload signed with the wrong secret", () => {
    expect(verifyLemonSqueezySignature(body, sign(body, "wrong-secret"), secret)).toBe(false);
  });

  it("rejects a tampered body", () => {
    const tampered = JSON.stringify({ meta: { event_name: "subscription_cancelled" } });
    expect(verifyLemonSqueezySignature(tampered, sign(body, secret), secret)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verifyLemonSqueezySignature(body, null, secret)).toBe(false);
  });
});
