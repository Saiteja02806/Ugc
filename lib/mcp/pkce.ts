import { createHash, timingSafeEqual } from "node:crypto";

export function matchesPkce(verifier: string, expected: string) {
  const actual = pkceChallenge(verifier);
  if (!actual) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function pkceChallenge(verifier: string) {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return null;
  return createHash("sha256").update(verifier).digest("base64url");
}
