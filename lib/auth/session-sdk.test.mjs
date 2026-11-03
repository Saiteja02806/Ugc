import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { initializeApp, deleteApp } from "firebase/app";

// Exercise the installed SDK, not a mock of its auth/persistence decisions.
// Every HTTP response and identity is a fixture; never contact a real account.
let mode = "healthy";
let verified = false;
const issued = Math.floor(Date.now() / 1000);
function fixtureToken() {
  return [
    Buffer.from('{"alg":"RS256"}').toString("base64url"),
    Buffer.from(JSON.stringify({
      sub: "fixture-owner", user_id: "fixture-owner", iat: issued,
      exp: issued + 3600, auth_time: issued, aud: "session-fixture",
      iss: "https://securetoken.google.com/session-fixture",
      email_verified: verified, firebase: { sign_in_provider: "password" },
    })).toString("base64url"),
    "fixture-signature",
  ].join(".");
}
mock.method(globalThis, "fetch", async input => {
  const url = new URL(String(input));
  assert.ok(["identitytoolkit.googleapis.com", "securetoken.googleapis.com"].includes(url.hostname));
  if (url.pathname.includes("signInWithPassword")) {
    return Response.json({ localId: "fixture-owner", email: "fixture@example.invalid",
      idToken: fixtureToken(), refreshToken: "fixture-refresh", expiresIn: "3600" });
  }
  if (mode === "network") throw new TypeError("Fixture offline transport");
  const errors = {
    outage: [500, "INTERNAL_ERROR"], throttled: [429, "TOO_MANY_ATTEMPTS_TRY_LATER"],
    revoked: [400, "TOKEN_EXPIRED"], disabled: [400, "USER_DISABLED"],
  };
  if (errors[mode]) {
    const [status, message] = errors[mode];
    return Response.json({ error: { code: status, message } }, { status });
  }
  if (url.hostname === "securetoken.googleapis.com") {
    return Response.json({ access_token: fixtureToken(), refresh_token: "fixture-refresh",
      expires_in: "3600", token_type: "Bearer", user_id: "fixture-owner" });
  }
  assert.ok(url.pathname.includes("accounts:lookup"));
  return Response.json({ users: [{ localId: "fixture-owner", email: "fixture@example.invalid",
    emailVerified: verified, providerUserInfo: [{ providerId: "password" }] }] });
});
let sdk;
if (process.env.AUTH_SDK_BUILD === "browser") {
  const requireAuth = createRequire(import.meta.resolve("firebase/auth"));
  const packageUrl = pathToFileURL(requireAuth.resolve("@firebase/auth/package.json"));
  sdk = await import(new URL("./dist/esm/index.js", packageUrl).href);
  mock.module("firebase/auth", { namedExports: { ...sdk } });
} else {
  sdk = await import("firebase/auth");
}
const config = { apiKey: "fixture-public-key", projectId: "session-fixture" };
const helperApp = initializeApp(config, "helper-session-fixture");
const helperAuth = sdk.initializeAuth(helperApp, { persistence: sdk.inMemoryPersistence });
mock.module("../firebase/client.ts", { namedExports: { auth: helperAuth, googleProvider: {} } });
mock.module("../analytics/site-analytics.ts", { namedExports: { trackAccountCreated() {} } });
const { listenToAuthState, refreshCurrentFirebaseUser, getFirebaseAuthErrorMessage } = await import("../firebase/auth.ts");

const stored = new Map();
class FixturePersistence {
  type = "LOCAL";
  _shouldAllowMigration = true;
  async _isAvailable() { return true; }
  async _set(key, value) { stored.set(key, structuredClone(value)); }
  async _get(key) { return structuredClone(stored.get(key) ?? null); }
  async _remove(key) { stored.delete(key); }
  _addListener() {}
  _removeListener() {}
}

for (const scenario of ["healthy", "network", "outage", "throttled", "revoked", "disabled"]) {
  test(`SDK restoration ${scenario}: transient failures retain sessions; invalidated users stay signed out`, async () => {
    mode = "healthy";
    const name = `restore-${scenario}`;
    let app = initializeApp(config, name);
    let auth = sdk.initializeAuth(app, { persistence: FixturePersistence });
    try {
      await auth.authStateReady();
      await sdk.signInWithEmailAndPassword(auth, "fixture@example.invalid", "fixture-password");
      assert.ok(auth.currentUser);
      await deleteApp(app);
      mode = scenario;
      app = initializeApp(config, name);
      auth = sdk.initializeAuth(app, { persistence: FixturePersistence });
      await auth.authStateReady();
      const shouldRetain = !["revoked", "disabled"].includes(scenario);
      assert.equal(Boolean(auth.currentUser), shouldRetain);
      const saved = [...stored.entries()].find(([key]) => key.includes("authUser") && key.endsWith(`:${name}`));
      assert.equal(Boolean(saved), shouldRetain);
    } finally {
      await deleteApp(app);
      mode = "healthy";
    }
  });
}

test("SDK notifications publish same-account email verification without a context refresh write", async () => {
  const snapshots = [];
  const stop = listenToAuthState(user => snapshots.push(user));
  try {
    mode = "healthy"; verified = false;
    await helperAuth.authStateReady();
    await sdk.signInWithEmailAndPassword(helperAuth, "fixture@example.invalid", "fixture-password");
    assert.equal(snapshots.at(-1).emailVerified, false);
    verified = true;
    assert.equal((await refreshCurrentFirebaseUser()).emailVerified, true);
    assert.equal(snapshots.at(-1).emailVerified, true);
    assert.equal(snapshots.at(-1).uid, "fixture-owner");

    for (const failure of ["network", "outage", "throttled"]) {
      mode = failure;
      await assert.rejects(sdk.getIdToken(helperAuth.currentUser, true), error => {
        if (failure === "throttled") {
          assert.match(getFirebaseAuthErrorMessage(error), /too many attempts/i);
        }
        return true;
      });
      assert.ok(helperAuth.currentUser);
      assert.equal(snapshots.at(-1).uid, "fixture-owner");
    }
    mode = "healthy";
    await sdk.signOut(helperAuth);
    assert.equal(snapshots.at(-1), null);
  } finally { stop(); mode = "healthy"; }
});

after(async () => { await deleteApp(helperApp); mock.restoreAll(); });
