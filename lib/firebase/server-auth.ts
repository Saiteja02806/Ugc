import "server-only";

import { createInFlightAuthRequestCoalescer } from "./in-flight-auth-requests";

export type VerifiedFirebaseUser = {
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
  photoURL: string | null;
  providerIds: string[];
  uid: string;
};

type FirebaseLookupUser = {
  displayName?: string;
  email?: string;
  emailVerified?: boolean;
  localId?: string;
  photoUrl?: string;
  providerUserInfo?: Array<{
    providerId?: string;
  }>;
};

type FirebaseLookupResponse = {
  error?: {
    message?: string;
  };
  users?: FirebaseLookupUser[];
};

const runFirebaseUserLookup =
  createInFlightAuthRequestCoalescer<VerifiedFirebaseUser>();

export class FirebaseAuthRequestError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "FirebaseAuthRequestError";
    this.status = status;
  }
}

export async function requireFirebaseUser(request: Request) {
  const idToken = getBearerToken(request);

  if (!idToken) {
    throw new FirebaseAuthRequestError("Sign in before rendering this video.");
  }

  const e2eTestUser = getEditRenderE2ETestUser(idToken);

  if (e2eTestUser) {
    return e2eTestUser;
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();

  if (!apiKey) {
    throw new FirebaseAuthRequestError(
      "Firebase server verification is not configured.",
      500,
    );
  }

  return runFirebaseUserLookup(`${apiKey}:${idToken}`, () =>
    lookupFirebaseUser(apiKey, idToken),
  );
}

async function lookupFirebaseUser(apiKey: string, idToken: string) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
      apiKey,
    )}`,
    {
      body: JSON.stringify({
        idToken,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  const data = (await response.json()) as FirebaseLookupResponse;

  if (!response.ok || data.error) {
    throw new FirebaseAuthRequestError("Your sign-in session is invalid.");
  }

  const firebaseUser = data.users?.[0];

  if (!firebaseUser?.localId) {
    throw new FirebaseAuthRequestError("Your sign-in session could not be verified.");
  }

  if (!firebaseUser.emailVerified) {
    throw new FirebaseAuthRequestError(
      "Verify your email before using this feature.",
      403,
    );
  }

  return {
    displayName: firebaseUser.displayName ?? null,
    email: firebaseUser.email ?? null,
    emailVerified: true,
    photoURL: firebaseUser.photoUrl ?? null,
    providerIds: Array.from(
      new Set(
        firebaseUser.providerUserInfo
          ?.map((provider) => provider.providerId)
          .filter((providerId): providerId is string => Boolean(providerId)) ??
          [],
      ),
    ),
    uid: firebaseUser.localId,
  } satisfies VerifiedFirebaseUser;
}

function getEditRenderE2ETestUser(idToken: string) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const expectedToken = process.env.EDIT_RENDER_E2E_TEST_TOKEN?.trim();

  if (!expectedToken || idToken !== expectedToken) {
    return null;
  }

  return {
    displayName: "Edit Render E2E",
    email: "edit-render-e2e@localhost",
    emailVerified: true,
    photoURL: null,
    providerIds: ["password"],
    uid: process.env.EDIT_RENDER_E2E_USER_ID?.trim() || "edit-render-e2e",
  } satisfies VerifiedFirebaseUser;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(/\s+/, 2);

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}
