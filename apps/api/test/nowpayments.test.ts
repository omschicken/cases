import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { computeIpnSignature, NowpaymentsService } from "../src/payments/nowpayments.service";

describe("NOWPayments IPN signature", () => {
  it("signs the key-sorted JSON (matches the provider's documented algorithm)", () => {
    const body = { payment_status: "finished", payment_id: 5, nested: { b: 2, a: 1 } };
    const sorted = '{"nested":{"a":1,"b":2},"payment_id":5,"payment_status":"finished"}';
    expect(computeIpnSignature(body, "s3cret")).toBe(createHmac("sha512", "s3cret").update(sorted).digest("hex"));
  });

  it("verifies a good signature and rejects bad / missing ones", () => {
    process.env.NOWPAYMENTS_IPN_SECRET = "s3cret";
    const svc = new NowpaymentsService({} as never, {} as never, {} as never);
    const body = { payment_id: 1, payment_status: "finished" };
    const sig = computeIpnSignature(body, "s3cret");
    expect(svc.verifySignature(body, sig)).toBe(true);
    expect(svc.verifySignature({ ...body, payment_status: "waiting" }, sig)).toBe(false);
    expect(svc.verifySignature(body, "00")).toBe(false);
    expect(svc.verifySignature(body, undefined)).toBe(false);
  });
});
