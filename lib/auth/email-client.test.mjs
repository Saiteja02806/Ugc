import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

let calls;
let httpStatus;
const firebaseUser = {
  uid: "new-owner", email: "owner@example.com", emailVerified: false,
  displayName: null, photoURL: null, metadata: {}, providerData: [{ providerId: "password" }],
};
const auth = { currentUser: null };
mock.module("../firebase/client.ts", { namedExports: { auth, googleProvider: {} } });
mock.module("firebase/auth", { namedExports: {
  createUserWithEmailAndPassword: async (_auth, email) => {
    calls.push(["create", email]); auth.currentUser = firebaseUser; return { user: firebaseUser };
  },
  getIdToken: async (user, force) => { calls.push(["token", user.uid, force]); return "test-id-token"; },
  reload: async () => {},
  EmailAuthProvider: { credential: () => ({}) },
  linkWithCredential: async () => ({ user: firebaseUser }),
  onAuthStateChanged: () => () => {},
  signInWithEmailAndPassword: async () => ({ user: firebaseUser }),
  signInWithPopup: async () => ({ user: firebaseUser }),
  signInWithRedirect: async () => {},
  signOut: async () => {},
} });
const { signUpWithEmail, requestPasswordReset, resendVerificationEmail } = await import("../firebase/auth.ts");

beforeEach(() => {
  calls = []; httpStatus = 200; auth.currentUser = null;
  mock.method(globalThis, "fetch", async (path, init) => {
    calls.push(["http", path, JSON.parse(init.body), init.headers]);
    return Response.json(httpStatus === 200 ? { sent: true } : { error: "Could not send your email. Please try again later." }, { status: httpStatus });
  });
});
afterEach(() => { mock.restoreAll(); });

test("signup authenticates its new Firebase user before requesting a branded verification email", async () => {
  const user = await signUpWithEmail(" OWNER@Example.com ", "test-password", { plan: "growth", billing: "yearly" });
  assert.equal(user.uid, "new-owner");
  assert.deepEqual(calls.slice(0, 2), [["create", "owner@example.com"], ["token", "new-owner", true]]);
  const request = calls.find((call) => call[0] === "http");
  assert.equal(request[1], "/api/auth/send-verification");
  assert.deepEqual(request[2], { plan: "growth", billing: "yearly" });
  assert.equal(request[3].Authorization, "Bearer test-id-token");
});

test("an email-delivery failure preserves the created account and tells the UI to offer resend", async () => {
  httpStatus = 503;
  await assert.rejects(signUpWithEmail("owner@example.com", "test-password"), (error) => {
    assert.equal(error.code, "auth/verification-send-failed"); return true;
  });
  assert.equal(auth.currentUser.uid, "new-owner");
});

test("resend authenticates the active user and password reset posts only the normalized email", async () => {
  auth.currentUser = firebaseUser;
  await resendVerificationEmail();
  assert.equal(calls.find((call) => call[0] === "http")[3].Authorization, "Bearer test-id-token");
  calls = [];
  await requestPasswordReset(" OWNER@Example.com ");
  assert.deepEqual(calls[0], ["http", "/api/auth/forgot-password", { email: "owner@example.com" }, { "Content-Type": "application/json" }]);
});
