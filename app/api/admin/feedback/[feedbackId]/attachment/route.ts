import { z } from "zod";

import { isProductFeedbackAdmin } from "@/lib/feedback/server-admin-access";
import {
  getProductFeedbackAttachment,
  ProductFeedbackStoreError,
} from "@/lib/feedback/product-feedback-store";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import { getStorageObject } from "@/lib/storage/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FeedbackIdSchema = z.string().uuid();

export async function GET(
  request: Request,
  context: { params: Promise<{ feedbackId: string }> },
) {
  try {
    const user = await requireFirebaseUser(request);

    if (!isProductFeedbackAdmin(user)) {
      return json({ error: "You do not have access to customer requests." }, 403);
    }

    const { feedbackId } = await context.params;
    const parsedId = FeedbackIdSchema.safeParse(feedbackId);

    if (!parsedId.success) {
      return json({ error: "The request image was not found." }, 404);
    }

    const { attachment, storageKey } = await getProductFeedbackAttachment(
      parsedId.data,
    );
    const object = await getStorageObject({ key: storageKey });

    if (!object.Body) {
      return json({ error: "The request image could not be read." }, 404);
    }

    return new Response(object.Body.transformToWebStream(), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${sanitizeFileName(attachment.fileName)}"`,
        "Content-Length": String(object.ContentLength ?? attachment.sizeBytes),
        "Content-Type": attachment.mimeType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return json({ error: error.message }, error.status);
    }
    if (error instanceof ProductFeedbackStoreError) {
      return json({ error: error.message }, error.status);
    }

    console.error("Could not load product feedback image attachment:", error);
    return json({ error: "Could not load the request image. Try again." }, 500);
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

function sanitizeFileName(value: string) {
  return value.replace(/["\\\r\n]/gu, "-").slice(0, 255) || "attachment";
}
