import "server-only";

import {
  FirebaseAuthRequestError,
} from "@/lib/firebase/server-auth";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseCreativeAssetGroupId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const groupId = value.trim();
  return UUID_PATTERN.test(groupId) ? groupId : null;
}

export function parseCreativeAssetGroupName(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const name = value.trim();
  return name.length > 0 && name.length <= 80 ? name : null;
}

export function creativeAssetGroupErrorResponse(
  error: unknown,
  fallback: string,
) {
  const status = error instanceof FirebaseAuthRequestError ? error.status : 500;

  if (status >= 500) {
    console.error(fallback, error);
  }

  return Response.json(
    {
      error:
        error instanceof FirebaseAuthRequestError ? error.message : fallback,
      ok: false,
    },
    { status },
  );
}
