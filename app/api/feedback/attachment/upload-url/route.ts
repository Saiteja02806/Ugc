import { z } from "zod";

import {
  PRODUCT_FEEDBACK_ATTACHMENT_UPLOAD_EXPIRES_SECONDS,
} from "@/lib/feedback/product-feedback-attachment";
import {
  createProductFeedbackAttachmentUpload,
  ProductFeedbackStoreError,
} from "@/lib/feedback/product-feedback-store";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  createSignedPutUrl,
  getMissingStorageEnvVars,
} from "@/lib/storage/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ProductFeedbackAttachmentSchema = z
  .object({
    contentType: z.string().trim().min(1).max(120),
    fileName: z.string().trim().min(1).max(255),
    fileSize: z.number().int().positive(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const body = ProductFeedbackAttachmentSchema.safeParse(
      await request.json().catch(() => null),
    );

    if (!body.success) {
      return json(
        { error: "Choose a valid image attachment.", ok: false },
        400,
      );
    }

    const missingStorage = getMissingStorageEnvVars();
    if (missingStorage.length > 0) {
      throw new Error(
        `Product feedback image uploads are not configured: ${missingStorage.join(", ")}`,
      );
    }

    const attachment = await createProductFeedbackAttachmentUpload({
      contentType: body.data.contentType,
      fileName: body.data.fileName,
      fileSize: body.data.fileSize,
      userId: user.uid,
    });
    const uploadUrl = await createSignedPutUrl({
      contentType: attachment.contentType,
      expiresInSeconds: PRODUCT_FEEDBACK_ATTACHMENT_UPLOAD_EXPIRES_SECONDS,
      key: attachment.storageKey,
    });

    return json({
      attachmentId: attachment.attachmentId,
      expiresInSeconds: PRODUCT_FEEDBACK_ATTACHMENT_UPLOAD_EXPIRES_SECONDS,
      ok: true,
      requiredHeaders: { "Content-Type": attachment.contentType },
      storageKey: attachment.storageKey,
      uploadUrl,
    });
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return json({ error: error.message, ok: false }, error.status);
    }
    if (error instanceof ProductFeedbackStoreError) {
      return json({ error: error.message, ok: false }, error.status);
    }

    console.error("Could not prepare product feedback image attachment:", error);
    return json(
      { error: "Could not prepare the image attachment. Try again.", ok: false },
      500,
    );
  }
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
    status,
  });
}
