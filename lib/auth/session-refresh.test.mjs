import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const owner = {
  uid: "owner", email: "owner@example.invalid", emailVerified: true,
  displayName: null, photoURL: null, metadata: {}, providerData: [],
};
const other = { ...owner, uid: "other" };
let ready, reloadUser, token, tokenCalls;
const auth = { currentUser: null, authStateReady: () => ready };
mock.module("../firebase/client.ts", { namedExports: { auth, googleProvider: {} } });
mock.module("../analytics/site-analytics.ts", { namedExports: { trackAccountCreated() {} } });
mock.module("firebase/auth", { namedExports: {
  createUserWithEmailAndPassword: async () => ({ user: owner }),
  EmailAuthProvider: { credential: () => ({}) },
  getAdditionalUserInfo: () => ({}), getRedirectResult: async () => null,
  getIdToken: async user => { tokenCalls.push(user); return token(user); },
  linkWithCredential: async () => ({ user: owner }),
  onAuthStateChanged: () => () => {}, onIdTokenChanged: () => () => {},
  reload: async user => reloadUser(user),
  signInWithEmailAndPassword: async () => ({ user: owner }),
  signInWithPopup: async () => ({ user: owner }), signInWithRedirect: async () => {},
  signOut: async () => {},
} });
const { refreshCurrentFirebaseUser, getCurrentUserIdToken } = await import("../firebase/auth.ts");

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  auth.currentUser = owner;
  ready = Promise.resolve();
  reloadUser = async () => {};
  token = async () => "fixture-token";
  tokenCalls = [];
});

test("user refresh waits for persisted auth restoration instead of returning false signed-out", async () => {
  const restoration = deferred();
  ready = restoration.promise;
  auth.currentUser = null;
  let settled = false;
  const request = refreshCurrentFirebaseUser().then(user => { settled = true; return user; });
  await Promise.resolve();
  assert.equal(settled, false);
  auth.currentUser = owner;
  restoration.resolve();
  assert.equal((await request).uid, owner.uid);
});

test("a genuinely signed-out initialized session still returns null", async () => {
  auth.currentUser = null;
  assert.equal(await refreshCurrentFirebaseUser(), null);
  assert.equal(tokenCalls.length, 0);
});

for (const action of ["logout", "switch", "same-uid-new-session"]) {
  test(`user refresh rejects ${action} during reload before requesting an old token`, async () => {
    reloadUser = async () => {
      auth.currentUser = action === "logout" ? null : action === "switch" ? other : { ...owner };
    };
    await assert.rejects(refreshCurrentFirebaseUser(), /signed-in account changed/i);
    assert.equal(tokenCalls.length, 0);
  });
}

test("user refresh rejects an account change while token refresh is pending", async () => {
  const pending = deferred();
  token = async () => { await pending.promise; return "fixture-token"; };
  const request = refreshCurrentFirebaseUser();
  // Wait until the actual helper reaches token acquisition.
  while (!tokenCalls.length) await Promise.resolve();
  auth.currentUser = other;
  pending.resolve();
  await assert.rejects(request, /signed-in account changed/i);
});

test("network refresh failures propagate without replacing the signed-in user", async () => {
  const offline = Object.assign(new Error("offline"), { code: "auth/network-request-failed" });
  reloadUser = async () => { throw offline; };
  await assert.rejects(refreshCurrentFirebaseUser(), error => error === offline);
  assert.equal(auth.currentUser, owner);
});

test("API token acquisition retains its before/after account checks", async () => {
  auth.currentUser = other;
  await assert.rejects(getCurrentUserIdToken(owner.uid), /account changed/i);
  assert.equal(tokenCalls.length, 0);
  auth.currentUser = owner;
  token = async () => { auth.currentUser = other; return "fixture-token"; };
  await assert.rejects(getCurrentUserIdToken(owner.uid), /account changed/i);
});
