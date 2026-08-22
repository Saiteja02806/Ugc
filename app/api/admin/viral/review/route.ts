import { NextResponse } from "next/server";
import { z } from "zod";

import {
  FirebaseAuthRequestError,
} from "@/lib/firebase/server-auth";
import {
  getMissingViralReviewEnvVars,
  getViralHookReviewPage,
  ViralReviewStoreError,
} from "@/lib/viral/review-store";
import { requireViralReviewer } from "@/lib/viral/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ReviewQuerySchema = z.object({
  cursor: z.string().uuid().nullable(),
  limit: z.coerce.number().int().min(1).max(24),
  section: z.enum(["hook_video", "wall_of_text", "slideshow"]).optional(),
});

export async function GET(request: Request) {
  try {
    await requireViralReviewer(request);
  } catch (error) {
    return authErrorResponse(error);
  }

  const url = new URL(request.url);
  const query = ReviewQuerySchema.safeParse({
    cursor: url.searchParams.get("cursor"),
    limit: url.searchParams.get("limit") ?? "12",
    section: url.searchParams.get("section") ?? "hook_video",
  });

  if (!query.success) {
    return json(
      { message: "The Explore review page request is invalid.", ok: false },
      400,
    );
  }

  if (getMissingViralReviewEnvVars().length > 0) {
    return json(
      { message: "Explore is temporarily unavailable.", ok: false },
      501,
    );
  }

  try {
    const page = await getViralHookReviewPage(query.data);
    return json({ ...page, ok: true });
  } catch (error) {
    console.error("Could not load the Viral Hook review queue:", error);
    const status = error instanceof ViralReviewStoreError ? error.status : 500;
    return json(
      { message: "Could not load Explore. Try again.", ok: false },
      status,
    );
  }
}

function authErrorResponse(error: unknown) {
  if (error instanceof FirebaseAuthRequestError) {
    return json(
      {
        message:
          error.status === 401
            ? "Sign in before opening Explore."
            : error.status === 503
              ? "Explore reviewer access is temporarily unavailable."
              : "This account does not have Explore access.",
        ok: false,
      },
      error.status,
    );
  }

  console.error("Could not verify the Viral reviewer:", error);
  return json(
    { message: "Could not verify your Explore access.", ok: false },
    500,
  );
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
