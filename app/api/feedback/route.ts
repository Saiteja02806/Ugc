import { NextResponse } from "next/server";
import { z } from "zod";

import { PRODUCT_FEEDBACK_TYPES } from "@/lib/feedback/product-feedback-types";
import {
  createProductFeedback,
  ProductFeedbackStoreError,
} from "@/lib/feedback/product-feedback-store";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ProductFeedbackSchema = z
  .object({
    description: z.string().trim().min(10).max(4000),
    sourcePath: z.string().trim().min(1).max(500).startsWith("/").optional(),
    title: z.string().trim().min(3).max(120),
    type: z.enum(PRODUCT_FEEDBACK_TYPES),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const body = ProductFeedbackSchema.safeParse(
      await request.json().catch(() => null),
    );

    if (!body.success) {
      return json(
        {
          error:
            "Add a short title and at least 10 characters explaining your request.",
          ok: false,
        },
        400,
      );
    }

    const submission = await createProductFeedback({
      description: body.data.description,
      sourcePath: body.data.sourcePath ?? null,
      title: body.data.title,
      type: body.data.type,
      userAgent: truncateHeader(request.headers.get("user-agent"), 1000),
      userDisplayName: user.displayName,
      userEmail: user.email,
      userId: user.uid,
    });

    return json({ ok: true, submission }, 201);
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return json({ error: error.message, ok: false }, error.status);
    }

    if (error instanceof ProductFeedbackStoreError) {
      return json({ error: error.message, ok: false }, error.status);
    }

    console.error("Could not submit product feedback:", error);
    return json(
      { error: "Could not send this request. Try again.", ok: false },
      500,
    );
  }
}

function truncateHeader(value: string | null, maxLength: number) {
  if (!value) return null;
  return value.trim().slice(0, maxLength) || null;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
