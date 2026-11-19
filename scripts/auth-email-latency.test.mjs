import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Source-level contract: the auth email chain must not re-create its heavyweight
// clients per request (regression for the slow verification-email fix).
const service = readFileSync("lib/auth/email-service.ts", "utf8");
const rateLimit = readFileSync("lib/auth/email-rate-limit.ts", "utf8");

test("auth email delivery reuses one GoogleAuth client instead of building one per send", () => {
  assert.match(service, /const cachedIdentityAuth = \{ auth: null as GoogleAuth \| null \};/u, "The GoogleAuth client must be cached at module level");
  assert.match(service, /cachedIdentityAuth\.auth \?\?= new GoogleAuth/u);
  assert.match(service, /cachedIdentityAuth\.auth = null;/u, "A failed acquisition must not poison the cache");
  assert.doesNotMatch(service, /new GoogleAuth\(\{[^}]*\}\)\.getClient\(\)/, "getClient must go through the cached instance");
});

test("auth email rate limiting reuses one Supabase client instead of building one per call", () => {
  assert.match(rateLimit, /let cachedLimitClient/u, "The Supabase limit client must be cached at module level");
  assert.match(rateLimit, /getLimitClient\(url, key\)\.rpc\("consume_auth_email_limits"/u, "The limit RPC goes through the cached client");
});

test("verification email responds before delivery, like password reset", () => {
  const handlers = readFileSync("lib/auth/email-handlers.ts", "utf8");
  const verification = handlers.slice(handlers.indexOf("async sendVerification"), handlers.indexOf("async forgotPassword"));
  assert.match(handlers, /schedule\(async \(\) => \{\s*try \{ await deps\.deliver\("password-reset"/u, "Password reset delivers via schedule");
  // Between the limit check and the success response, nothing may deliver inline.
  const inlineWindow = verification.slice(verification.indexOf("consumeLimit"), verification.indexOf("deps.schedule"));
  assert.doesNotMatch(inlineWindow, /deps\.deliver/u);
  assert.match(verification, /deps\.schedule\(async \(\) => \{\s*try \{ await deps\.deliver\("verification"/u, "Verification delivers via schedule");
  assert.match(verification, /deps\.reportFailure\("verification"\)/u, "Background verification failures are reported");
});
