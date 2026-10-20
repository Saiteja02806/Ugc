import "server-only";

import { GoogleAuth } from "google-auth-library";

import { getGoogleServiceAccountCredentials } from "@/lib/gcp/credentials";

export type FirebaseAdminUser = {
  createdAt: string | null;
  email: string;
  emailVerified: boolean;
  uid: string;
};

type FirebaseLookupResponse = {
  users?: Array<{
    createdAt?: string;
    email?: string;
    emailVerified?: boolean;
    localId?: string;
  }>;
};

export class FirebaseAdminLookupError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message);
    this.name = "FirebaseAdminLookupError";
  }
}

export async function findFirebaseUserByEmail(
  email: string,
): Promise<FirebaseAdminUser | null> {
  const projectId = getFirebaseProjectId();
  const credentials = getGoogleServiceAccountCredentials();
  const auth = new GoogleAuth({
    ...(credentials ? { credentials } : {}),
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();

  try {
    const response = await client.request<FirebaseLookupResponse>({
      data: { email: [email] },
      method: "POST",
      url: `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:lookup`,
    });
    const user = response.data.users?.[0];

    if (!user?.localId || !user.email) {
      return null;
    }

    return {
      createdAt: user.createdAt ?? null,
      email: user.email,
      emailVerified: Boolean(user.emailVerified),
      uid: user.localId,
    };
  } catch (error) {
    const message = getFirebaseErrorMessage(error);

    if (message === "EMAIL_NOT_FOUND") {
      return null;
    }

    throw new FirebaseAdminLookupError(
      "Could not look up the Firebase account for this email.",
    );
  }
}

function getFirebaseProjectId() {
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    process.env.GCP_PROJECT_ID?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim();

  if (!projectId) {
    throw new FirebaseAdminLookupError(
      "Firebase account lookup is not configured.",
      503,
    );
  }

  return projectId;
}

function getFirebaseErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "error" in error.response.data &&
    typeof error.response.data.error === "object" &&
    error.response.data.error !== null &&
    "message" in error.response.data.error &&
    typeof error.response.data.error.message === "string"
  ) {
    return error.response.data.error.message;
  }

  return "unknown Firebase account lookup error";
}
