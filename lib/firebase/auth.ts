import {
  getIdToken,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";

import { auth, googleProvider } from "./client";

export const EDIT_RENDER_E2E_TOKEN_STORAGE_KEY =
  "ugc-studio.edit-render-e2e-token";

export type AuthUser = {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
};

export function mapFirebaseUser(user: User): AuthUser {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  };
}

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return mapFirebaseUser(result.user);
  } catch (error) {
    console.error("Google sign-in failed:", error);
    throw error;
  }
}

export async function getCurrentUserIdToken() {
  const e2eTestToken = getEditRenderE2ETestToken();

  if (e2eTestToken) {
    return e2eTestToken;
  }

  return auth.currentUser ? getIdToken(auth.currentUser) : null;
}

function getEditRenderE2ETestToken() {
  if (process.env.NEXT_PUBLIC_ENABLE_EDIT_RENDER_E2E_AUTH !== "true") {
    return null;
  }

  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage
    .getItem(EDIT_RENDER_E2E_TOKEN_STORAGE_KEY)
    ?.trim() || null;
}

export function listenToAuthState(
  onUser: (user: AuthUser | null) => void,
  onError?: (error: Error) => void,
) {
  const e2eTestUser = getEditRenderE2ETestUser();

  if (e2eTestUser) {
    onUser(e2eTestUser);

    return () => {};
  }

  return onAuthStateChanged(
    auth,
    (user) => {
      onUser(user ? mapFirebaseUser(user) : null);
    },
    onError,
  );
}

function getEditRenderE2ETestUser(): AuthUser | null {
  const e2eTestToken = getEditRenderE2ETestToken();

  if (!e2eTestToken) {
    return null;
  }

  return {
    displayName: "Edit Render E2E",
    email: "edit-render-e2e@localhost",
    photoURL: null,
    uid: "edit-render-e2e",
  };
}

export async function logout() {
  await signOut(auth);
}
