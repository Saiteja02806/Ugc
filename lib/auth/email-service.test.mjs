import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

let firebaseRequest;
let firebaseError;
let firebaseResponse;
let resendRequest;
let resendStatus;
const envNames = ["RESEND_API_KEY", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "GOOGLE_CLOUD_CREDENTIALS_JSON", "VERCEL", "EMAIL_FROM", "EMAIL_AUTH_APP_URL", "RESEND_VERIFICATION_TEMPLATE_ID", "RESEND_PASSWORD_RESET_TEMPLATE_ID"];
const originalEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));

mock.module("google-auth-library", { namedExports: {
  GoogleAuth: class {
    constructor(options) {
      assert.deepEqual(options.scopes, ["https://www.googleapis.com/auth/cloud-platform"]);
      assert.equal(options.credentials.client_email, "test-app@ugcsaas.iam.gserviceaccount.com");
    }
    async getClient() {
      return { request: async (request) => {
        firebaseRequest = request;
        if (firebaseError) throw firebaseError;
        return { data: firebaseResponse };
      } };
    }
  },
} });
const { deliverAuthEmail, getAuthEmailConfiguration } = await import("./email-service.ts");

beforeEach(() => {
  process.env.RESEND_API_KEY = "test-resend-key";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "ugcsaas";
  process.env.GOOGLE_CLOUD_CREDENTIALS_JSON = JSON.stringify({ client_email: "test-app@ugcsaas.iam.gserviceaccount.com", private_key: "test-private-key" });
  process.env.VERCEL = "1";
  process.env.EMAIL_AUTH_APP_URL = "https://getugcpilot.com";
  delete process.env.EMAIL_FROM;
  delete process.env.RESEND_VERIFICATION_TEMPLATE_ID;
  delete process.env.RESEND_PASSWORD_RESET_TEMPLATE_ID;
  firebaseRequest = resendRequest = firebaseError = undefined;
  firebaseResponse = { oobLink: "https://ugcsaas.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=test-code&apiKey=public-config" };
  resendStatus = 200;
  mock.method(globalThis, "fetch", async (url, init) => {
    resendRequest = { url, ...init, body: JSON.parse(init.body) };
    return new Response("{}", { status: resendStatus });
  });
});
afterEach(() => {
  mock.restoreAll();
  for (const name of envNames) {
    if (originalEnv[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnv[name];
  }
});

test("Firebase generates the verification link without sending; Resend receives the published template", async () => {
  await deliverAuthEmail("verification", "owner@example.com", { plan: "growth", billing: "yearly" });
  assert.equal(firebaseRequest.url, "https://identitytoolkit.googleapis.com/v1/projects/ugcsaas/accounts:sendOobCode");
  assert.equal(firebaseRequest.method, "POST");
  assert.equal(firebaseRequest.timeout, 10000);
  assert.deepEqual(firebaseRequest.data, { requestType: "VERIFY_EMAIL", email: "owner@example.com", returnOobLink: true, continueUrl: "https://getugcpilot.com/sign-in?plan=growth&billing=yearly" });
  assert.equal(resendRequest.url, "https://api.resend.com/emails");
  assert.equal(resendRequest.headers.Authorization, "Bearer test-resend-key");
  assert.match(resendRequest.headers["Idempotency-Key"], /^auth-verification-/);
  assert.equal(resendRequest.body.from, "UGC Pilot <admin@getugcpilot.com>");
  assert.deepEqual(resendRequest.body.to, ["owner@example.com"]);
  assert.equal(resendRequest.body.template.id, "email-verification");
  assert.deepEqual(Object.keys(resendRequest.body.template.variables), ["VERIFICATION_URL"]);
  const link = new URL(resendRequest.body.template.variables.VERIFICATION_URL);
  assert.equal(link.origin + link.pathname, "https://getugcpilot.com/auth/action");
  assert.equal(link.searchParams.get("oobCode"), "test-code");
  assert.equal(link.searchParams.get("continueUrl"), firebaseRequest.data.continueUrl);
  assert.equal(resendRequest.body.html, undefined);
  assert.equal(resendRequest.body.text, undefined);
});

test("password reset uses its template and supports a configured hello sender", async () => {
  process.env.EMAIL_FROM = "UGC Pilot <hello@getugcpilot.com>";
  firebaseResponse.oobLink = firebaseResponse.oobLink.replace("verifyEmail", "resetPassword");
  await deliverAuthEmail("password-reset", "owner@example.com");
  assert.equal(firebaseRequest.data.requestType, "PASSWORD_RESET");
  assert.equal(resendRequest.body.template.id, "forgot-your-password");
  assert.equal(resendRequest.body.from, "UGC Pilot <hello@getugcpilot.com>");
  assert.deepEqual(Object.keys(resendRequest.body.template.variables), ["RESET_URL"]);
  assert.equal(new URL(resendRequest.body.template.variables.RESET_URL).searchParams.get("mode"), "resetPassword");
});

test("nonexistent reset accounts never reach Resend", async () => {
  firebaseError = { response: { data: { error: { message: "EMAIL_NOT_FOUND" } } } };
  await deliverAuthEmail("password-reset", "missing@example.com");
  assert.equal(resendRequest, undefined);
});

test("provider failures do not expose credentials or secure links", async () => {
  firebaseError = new Error("test-private-key test-code");
  await assert.rejects(deliverAuthEmail("verification", "owner@example.com"), (error) => {
    assert.equal(error.status, 503);
    assert.doesNotMatch(error.message, /test-private-key|test-code/);
    return true;
  });
  assert.equal(resendRequest, undefined);
  firebaseError = undefined;
  resendStatus = 422;
  await assert.rejects(deliverAuthEmail("verification", "owner@example.com"), /Could not send your email/);
});

test("missing credentials and invalid Firebase response stop before delivery", async () => {
  delete process.env.GOOGLE_CLOUD_CREDENTIALS_JSON;
  assert.throws(getAuthEmailConfiguration, /temporarily unavailable/);
  process.env.GOOGLE_CLOUD_CREDENTIALS_JSON = JSON.stringify({ client_email: "test-app@ugcsaas.iam.gserviceaccount.com", private_key: "test-private-key" });
  firebaseResponse = {};
  await assert.rejects(deliverAuthEmail("verification", "owner@example.com"), /Could not prepare your email/);
  assert.equal(resendRequest, undefined);
});
