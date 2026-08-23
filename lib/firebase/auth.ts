import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getIdToken,
  linkWithCredential,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";

import { auth, googleProvider } from "./client";
import { AUTH_SESSION_COOKIE_NAME } from "./auth-session";

export { AUTH_SESSION_COOKIE_NAME } from "./auth-session";

export const EDIT_RENDER_E2E_TOKEN_STORAGE_KEY =
  "ugc-studio.edit-render-e2e-token";
export const GOOGLE_SIGN_IN_REDIRECT_PENDING_KEY =
  "ugc-pilot.google-sign-in-redirect-pending";
export function setAuthSessionCookie() {
  if (typeof document === "undefined") {
    return;
  }
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${AUTH_SESSION_COOKIE_NAME}=1; path=/; max-age=2592000; SameSite=Lax${secure}`;
}

export function clearAuthSessionCookie() {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${AUTH_SESSION_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; SameSite=Lax`;
}

export type AuthUser = {
  uid: string;
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
  photoURL: string | null;
  providerIds: string[];
};

export class FirebaseAuthActionError extends Error {
  code: string;

  constructor(message: string, code = "auth/action-failed") {
    super(message);
    this.name = "FirebaseAuthActionError";
    this.code = code;
  }
}

export function mapFirebaseUser(user: User): AuthUser {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    emailVerified: user.emailVerified,
    photoURL: user.photoURL,
    providerIds: Array.from(
      new Set(user.providerData.map((provider) => provider.providerId)),
    ),
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

export async function signInWithGoogleRedirect() {
  setGoogleRedirectPending();

  try {
    return await signInWithRedirect(auth, googleProvider);
  } catch (error) {
    clearGoogleRedirectPending();
    console.error("Google redirect sign-in failed:", error);
    throw error;
  }
}

export function consumeGoogleRedirectPending() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const isPending =
      window.sessionStorage.getItem(GOOGLE_SIGN_IN_REDIRECT_PENDING_KEY) ===
      "true";

    if (isPending) {
      window.sessionStorage.removeItem(GOOGLE_SIGN_IN_REDIRECT_PENDING_KEY);
    }

    return isPending;
  } catch {
    return false;
  }
}

export async function signUpWithEmail(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  const currentUser = auth.currentUser;

  if (canLinkEmailCredential(currentUser, normalizedEmail)) {
    return linkEmailCredentialToUser(currentUser, normalizedEmail, password);
  }

  try {
    const result = await createUserWithEmailAndPassword(
      auth,
      normalizedEmail,
      password,
    );

    await sendEmailVerification(result.user);
    await getIdToken(result.user, true);

    return mapFirebaseUser(result.user);
  } catch (error) {
    if (isFirebaseError(error, "auth/email-already-in-use")) {
      throw new FirebaseAuthActionError(
        "An account already exists for this email. Sign in instead, or continue with Google and add a password from the same Firebase account.",
        "auth/email-already-in-use",
      );
    }

    throw error;
  }
}

export async function signInWithEmail(email: string, password: string) {
  const result = await signInWithEmailAndPassword(
    auth,
    normalizeEmail(email),
    password,
  );

  await getIdToken(result.user, true);

  return mapFirebaseUser(result.user);
}

export async function requestPasswordReset(email: string) {
  await sendPasswordResetEmail(auth, normalizeEmail(email));
}

export async function resendVerificationEmail() {
  const user = auth.currentUser;

  if (!user) {
    throw new FirebaseAuthActionError(
      "Sign in before requesting a verification email.",
      "auth/no-current-user",
    );
  }

  await reload(user);

  if (user.emailVerified) {
    await getIdToken(user, true);
    return mapFirebaseUser(user);
  }

  await sendEmailVerification(user);
  await getIdToken(user, true);

  return mapFirebaseUser(user);
}

export async function refreshCurrentFirebaseUser() {
  const e2eTestUser = getEditRenderE2ETestUser();

  if (e2eTestUser) {
    return e2eTestUser;
  }

  const user = auth.currentUser;

  if (!user) {
    return null;
  }

  await reload(user);
  await getIdToken(user, true);

  return mapFirebaseUser(user);
}

export async function getCurrentUserIdToken() {
  const e2eTestToken = getEditRenderE2ETestToken();

  if (e2eTestToken) {
    return e2eTestToken;
  }

  await auth.authStateReady();

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

function setGoogleRedirectPending() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      GOOGLE_SIGN_IN_REDIRECT_PENDING_KEY,
      "true",
    );
  } catch {
    // The redirect still works when browser storage is unavailable.
  }
}

function clearGoogleRedirectPending() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(GOOGLE_SIGN_IN_REDIRECT_PENDING_KEY);
  } catch {
    // Nothing else is required when browser storage is unavailable.
  }
}

export function listenToAuthState(
  onUser: (user: AuthUser | null) => void,
  onError?: (error: Error) => void,
) {
  const e2eTestUser = getEditRenderE2ETestUser();

  if (e2eTestUser) {
    setAuthSessionCookie();
    onUser(e2eTestUser);

    return () => {};
  }

  return onAuthStateChanged(
    auth,
    (user) => {
      if (user) {
        setAuthSessionCookie();
      } else {
        clearAuthSessionCookie();
      }
      onUser(user ? mapFirebaseUser(user) : null);
    },
    (error) => {
      clearAuthSessionCookie();
      onError?.(error);
    },
  );
}

export function getFirebaseAuthErrorMessage(error: unknown) {
  if (error instanceof FirebaseAuthActionError) {
    return error.message;
  }

  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/account-exists-with-different-credential":
        return "An account already exists for this email with another sign-in method. Sign in with that method first, then add email/password.";
      case "auth/credential-already-in-use":
        return "Those email credentials are already linked to another Firebase account.";
      case "auth/email-already-in-use":
        return "An account already exists for this email. Sign in instead.";
      case "auth/invalid-credential":
      case "auth/user-not-found":
      case "auth/wrong-password":
        return "The email or password is incorrect.";
      case "auth/invalid-email":
        return "Enter a valid email address.";
      case "auth/missing-password":
        return "Enter your password.";
      case "auth/network-request-failed":
        return "Network connection failed. Check your connection and try again.";
      case "auth/popup-blocked":
        return "Popup was blocked. Please allow popups and try again.";
      case "auth/popup-closed-by-user":
        return "Sign-in was cancelled. Try again when you are ready.";
      case "auth/provider-already-linked":
        return "This sign-in method is already connected to your account.";
      case "auth/requires-recent-login":
        return "For security, sign out and sign back in before changing sign-in methods.";
      case "auth/too-many-requests":
        return "Too many attempts. Wait a moment and try again.";
      case "auth/unauthorized-domain":
        return "This domain is not authorized for Firebase sign-in. Use the configured app domain or add this local domain in Firebase Authentication settings.";
      case "auth/weak-password":
        return "Use a stronger password with at least 6 characters.";
      default:
        return "Authentication failed. Please try again.";
    }
  }

  return "Authentication failed. Please try again.";
}

function getEditRenderE2ETestUser(): AuthUser | null {
  const e2eTestToken = getEditRenderE2ETestToken();

  if (!e2eTestToken) {
    return null;
  }

  return {
    displayName: "Edit Render E2E",
    email: "edit-render-e2e@localhost",
    emailVerified: true,
    photoURL: null,
    providerIds: ["password"],
    uid: "edit-render-e2e",
  };
}

export async function logout() {
  clearAuthSessionCookie();
  await signOut(auth);
}

async function linkEmailCredentialToUser(
  user: User,
  email: string,
  password: string,
) {
  if (user.providerData.some((provider) => provider.providerId === "password")) {
    throw new FirebaseAuthActionError(
      "This account already has email and password sign-in enabled.",
      "auth/provider-already-linked",
    );
  }

  try {
    const credential = EmailAuthProvider.credential(email, password);
    const result = await linkWithCredential(user, credential);

    if (!result.user.emailVerified) {
      await sendEmailVerification(result.user);
    }

    await getIdToken(result.user, true);

    return mapFirebaseUser(result.user);
  } catch (error) {
    if (isFirebaseError(error, "auth/provider-already-linked")) {
      throw new FirebaseAuthActionError(
        "This account already has email and password sign-in enabled.",
        "auth/provider-already-linked",
      );
    }

    if (isFirebaseError(error, "auth/credential-already-in-use")) {
      throw new FirebaseAuthActionError(
        "Those email credentials are already linked to another Firebase account.",
        "auth/credential-already-in-use",
      );
    }

    throw error;
  }
}

function canLinkEmailCredential(user: User | null, email: string): user is User {
  return user?.email?.toLowerCase() === email.toLowerCase();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isFirebaseError(error: unknown, code: string) {
  return error instanceof FirebaseError && error.code === code;
}
