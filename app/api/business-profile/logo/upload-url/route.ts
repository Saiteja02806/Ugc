import {
  BUSINESS_LOGO_MAX_BYTES,
  BUSINESS_LOGO_UPLOAD_EXPIRES_IN_SECONDS,
  createBusinessLogoStorageKey,
  isBusinessLogoMimeType,
} from "@/lib/business-profiles/logo";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  createSignedPutUrl,
  getMissingStorageEnvVars,
} from "@/lib/storage/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const body = (await request.json().catch(() => null)) as {
      contentType?: unknown;
      fileSize?: unknown;
    } | null;
    const fileSize = typeof body?.fileSize === "number" ? body.fileSize : 0;

    if (!isBusinessLogoMimeType(body?.contentType)) {
      return Response.json(
        { message: "Upload a PNG, JPEG, or WebP logo.", ok: false },
        { status: 400 },
      );
    }

    if (!Number.isInteger(fileSize) || fileSize < 1 || fileSize > BUSINESS_LOGO_MAX_BYTES) {
      return Response.json(
        { message: "Choose a logo smaller than 2 MB.", ok: false },
        { status: 400 },
      );
    }

    const missing = getMissingStorageEnvVars();

    if (missing.length > 0) {
      throw new Error(`Logo upload is not configured: ${missing.join(", ")}`);
    }

    const key = createBusinessLogoStorageKey({
      contentType: body.contentType,
      userId: user.uid,
    });
    const uploadUrl = await createSignedPutUrl({
      contentType: body.contentType,
      expiresInSeconds: BUSINESS_LOGO_UPLOAD_EXPIRES_IN_SECONDS,
      key,
    });

    return Response.json({
      expiresInSeconds: BUSINESS_LOGO_UPLOAD_EXPIRES_IN_SECONDS,
      key,
      ok: true,
      requiredHeaders: { "Content-Type": body.contentType },
      uploadUrl,
    });
  } catch (error) {
    const status = error instanceof FirebaseAuthRequestError ? error.status : 500;

    if (status >= 500) {
      console.error("Could not prepare business logo upload:", error);
    }

    return Response.json(
      {
        message:
          error instanceof FirebaseAuthRequestError
            ? error.message
            : "Could not prepare the logo upload.",
        ok: false,
      },
      { status },
    );
  }
}
