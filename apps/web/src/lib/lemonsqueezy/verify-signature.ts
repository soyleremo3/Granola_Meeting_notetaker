import { createHmac, timingSafeEqual } from "crypto";

export function verifyLemonSqueezySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const givenBuf = Buffer.from(signatureHeader, "utf8");

  return expectedBuf.length === givenBuf.length && timingSafeEqual(expectedBuf, givenBuf);
}
