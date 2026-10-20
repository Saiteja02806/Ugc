import assert from "node:assert/strict";
import test from "node:test";
import { createAuthEmailHandlers, type AuthEmailDependencies } from "./email-handlers.ts";
import {
  AuthEmailError, buildBrandedEmailActionLink, getEmailAuthAppUrl, getEmailSignInPath,
  getSafeEmailContinuePath, PASSWORD_RESET_MESSAGE,
} from "./email-policy.ts";
import { requireFirebaseIdentity, requireFirebaseUser } from "../firebase/server-auth.ts";

function request(body: unknown = {}, extraHeaders: Record<string, string> = {}) {
  return new Request("https://getugcpilot.com/api/auth/email", {
    method: "POST", headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  });
}

function setup(overrides: Partial<AuthEmailDependencies> = {}) {
  const deliveries: unknown[][] = [];
  const limits: unknown[][] = [];
  const scheduled: Array<() => Promise<void>> = [];
  const failures: string[] = [];
  const handlers = createAuthEmailHandlers({
    authenticate: async () => ({ uid: "owner-uid", email: "Owner@Example.com", emailVerified: false }),
    ensureConfigured: () => {},
    consumeLimit: async (...args) => { limits.push(args.slice(1)); },
    deliver: async (...args) => { deliveries.push(args); },
    schedule: (work) => { scheduled.push(work); },
    reportFailure: (kind) => { failures.push(kind); },
    ...overrides,
  });
  return { handlers, deliveries, limits, scheduled, failures };
}

test("verification sends only to the authenticated identity, ignoring supplied recipients", async () => {
  const s = setup();
  const response = await s.handlers.sendVerification(request({ email: "victim@example.com", plan: "growth", billing: "yearly" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { sent: true });
  assert.deepEqual(s.deliveries, [["verification", "owner@example.com", { plan: "growth", billing: "yearly" }]]);
  assert.deepEqual(s.limits, [["verification", "owner-uid"]]);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("unauthenticated verification is rejected without sending or consuming limits", async () => {
  const s = setup({ authenticate: async () => { throw Object.assign(new Error("private token details"), { status: 401 }); } });
  const response = await s.handlers.sendVerification(request());
  assert.equal(response.status, 401);
  assert.doesNotMatch(await response.text(), /private token/);
  assert.equal(s.deliveries.length, 0);
  assert.equal(s.limits.length, 0);
});

test("verified accounts do not get duplicate verification emails", async () => {
  const s = setup({ authenticate: async () => ({ uid: "owner", email: "owner@example.com", emailVerified: true }) });
  assert.deepEqual(await (await s.handlers.sendVerification(request())).json(), { alreadyVerified: true });
  assert.equal(s.deliveries.length, 0);
  assert.equal(s.limits.length, 0);
});

test("rate-limit rejection prevents sending and provides a retry interval", async () => {
  const s = setup({ consumeLimit: async () => { throw new AuthEmailError("Please wait.", 429, 57); } });
  for (const response of [
    await s.handlers.sendVerification(request()),
    await s.handlers.forgotPassword(request({ email: "owner@example.com" })),
  ]) {
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("Retry-After"), "57");
  }
  assert.equal(s.deliveries.length, 0);
  assert.equal(s.scheduled.length, 0);
});

test("password reset responds before delivery and returns the same result on provider failure", async () => {
  for (const fails of [false, true]) {
    const s = setup({ deliver: async () => { if (fails) throw new Error("secret provider response"); } });
    const response = await s.handlers.forgotPassword(request({ email: " OWNER@Example.com " }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { message: PASSWORD_RESET_MESSAGE });
    assert.deepEqual(s.limits, [["password-reset", "owner@example.com"]]);
    assert.equal(s.scheduled.length, 1);
    await s.scheduled[0]();
    assert.deepEqual(s.failures, fails ? ["password-reset"] : []);
  }
});

test("invalid, oversized and cross-origin requests do not send mail", async () => {
  const s = setup();
  assert.equal((await s.handlers.forgotPassword(request({ email: "invalid" }))).status, 400);
  assert.equal((await s.handlers.sendVerification(request({}, { Origin: "https://attacker.example" }))).status, 403);
  assert.equal((await s.handlers.sendVerification(request({ padding: "x".repeat(2050) }))).status, 413);
  assert.equal(s.deliveries.length, 0);
  assert.equal(s.scheduled.length, 0);
});

test("configuration and storage failures fail closed without revealing internal errors", async () => {
  const s = setup({ ensureConfigured: () => { throw new Error("re_private_api_key"); } });
  const response = await s.handlers.forgotPassword(request({ email: "owner@example.com" }));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /re_private_api_key/);
  assert.equal(s.scheduled.length, 0);
  const unavailable = setup({ consumeLimit: async () => { throw new Error("private database URL"); } });
  assert.equal((await unavailable.handlers.sendVerification(request())).status, 503);
  assert.equal(unavailable.deliveries.length, 0);
});

test("branded links preserve Firebase codes and use only the configured app and purchase intent", () => {
  const source = "https://ugcsaas.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=valid-code&apiKey=public-key&continueUrl=https://attacker.example";
  const url = new URL(buildBrandedEmailActionLink(source, "https://getugcpilot.com", "verification", { plan: "growth", billing: "yearly" }));
  assert.equal(url.origin + url.pathname, "https://getugcpilot.com/auth/action");
  assert.equal(url.searchParams.get("oobCode"), "valid-code");
  assert.equal(url.searchParams.get("apiKey"), "public-key");
  assert.equal(url.searchParams.get("continueUrl"), "https://getugcpilot.com/sign-in?plan=growth&billing=yearly");
  assert.throws(() => buildBrandedEmailActionLink(source, "https://getugcpilot.com", "password-reset"));
});

test("continue URLs cannot redirect to another origin or an arbitrary app route", () => {
  const origin = "https://getugcpilot.com";
  for (const value of ["https://attacker.example/sign-in", "//attacker.example/sign-in", "javascript:alert(1)", "/api/admin", "/sign-in/other"]) {
    assert.equal(getSafeEmailContinuePath(value, origin), "/sign-in");
  }
  assert.equal(getSafeEmailContinuePath(`${origin}/sign-in?plan=starter&billing=yearly&next=https://attacker.example`, origin), "/sign-in?plan=starter&billing=yearly");
  assert.equal(getEmailSignInPath({ plan: "invalid", billing: "yearly" }), "/sign-in");
  assert.throws(() => getEmailAuthAppUrl({ NODE_ENV: "production", EMAIL_AUTH_APP_URL: "http://getugcpilot.com" } as NodeJS.ProcessEnv));
});

test("unverified identities are allowed only through the verification-specific auth helper", async (t) => {
  const previous = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "test-public-key";
  t.after(() => { if (previous === undefined) delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY; else process.env.NEXT_PUBLIC_FIREBASE_API_KEY = previous; });
  t.mock.method(globalThis, "fetch", async () => Response.json({ users: [{ localId: "unverified", email: "owner@example.com", emailVerified: false }] }));
  const signed = new Request("https://getugcpilot.com", { headers: { Authorization: "Bearer valid-test-token" } });
  assert.equal((await requireFirebaseIdentity(signed)).emailVerified, false);
  await assert.rejects(requireFirebaseUser(signed), (error: unknown) => (error as { status: number }).status === 403);
});

test("missing and invalid Firebase tokens are rejected", async (t) => {
  await assert.rejects(requireFirebaseIdentity(new Request("https://getugcpilot.com")), (error: unknown) => (error as { status: number }).status === 401);
  const previous = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "test-public-key";
  t.after(() => { if (previous === undefined) delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY; else process.env.NEXT_PUBLIC_FIREBASE_API_KEY = previous; });
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: { message: "INVALID_ID_TOKEN" } }, { status: 400 }));
  await assert.rejects(requireFirebaseIdentity(new Request("https://getugcpilot.com", { headers: { Authorization: "Bearer invalid-test-token" } })), (error: unknown) => (error as { status: number }).status === 401);
});
