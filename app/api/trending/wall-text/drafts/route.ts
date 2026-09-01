import { NextResponse } from "next/server";
import { z } from "zod";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import { TrendingCreativeEditAccessError } from "@/lib/trending/creative-edits";
import {
  getSavedWallTextDraft,
  listSavedWallTextDrafts,
  markWallTextDraftSaved,
} from "@/lib/trending/wall-text-db";
import {
  requestWallTextRender,
  WallTextRenderRequestError,
} from "@/lib/trending/wall-text-render-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SaveWallTextDraftSchema = z
  .object({
    assignmentId: z.string().uuid(),
  })
  .strict();

export async function GET(request: Request) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const assignmentId = new URL(request.url).searchParams.get("assignmentId");

    if (assignmentId) {
      const parsedAssignmentId = z.string().uuid().safeParse(assignmentId);

      if (!parsedAssignmentId.success) {
        return json({ error: "Choose a valid Wall-of-text video.", ok: false }, 400);
      }

      const draft = await getSavedWallTextDraft({
        assignmentId: parsedAssignmentId.data,
        userId,
      });

      if (!draft) {
        return json({ error: "This Wall-of-text video was not found.", ok: false }, 404);
      }

      return json({ draft, ok: true });
    }

    return json({
      drafts: await listSavedWallTextDrafts({ userId }),
      ok: true,
    });
  } catch (error) {
    console.error("Could not load saved Wall-of-text videos:", error);
    return json(
      { error: "Could not load saved Wall-of-text videos.", ok: false },
      500,
    );
  }
}

export async function POST(request: Request) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    return authErrorResponse(error);
  }

  const parsed = SaveWallTextDraftSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return json({ error: "Choose a valid Wall-of-text video.", ok: false }, 400);
  }

  try {
    await markWallTextDraftSaved({
      assignmentId: parsed.data.assignmentId,
      userId,
    });
    const result = await requestWallTextRender({
      assignmentId: parsed.data.assignmentId,
      userId,
    });

    return json({
      draft: result.draft,
      jobId: result.jobId ?? undefined,
      ok: true,
    });
  } catch (error) {
    if (error instanceof TrendingCreativeEditAccessError) {
      return json({ error: error.message, ok: false }, error.status);
    }

    if (error instanceof WallTextRenderRequestError) {
      return json({ error: error.message, ok: false }, error.status);
    }

    console.error("Could not save the Wall-of-text video:", error);
    return json(
      { error: "Could not save and prepare this Wall-of-text video.", ok: false },
      500,
    );
  }
}

function authErrorResponse(error: unknown) {
  if (error instanceof FirebaseAuthRequestError) {
    return json(
      {
        error:
          error.status === 401
            ? "Sign in before saving Wall-of-text videos."
            : error.message,
        ok: false,
      },
      error.status,
    );
  }

  console.error("Failed to verify Wall-of-text requester:", error);
  return json({ error: "Could not verify your sign-in session.", ok: false }, 500);
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
