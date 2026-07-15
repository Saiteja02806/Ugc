import { normalizeEditableVideoDraftInput } from "@/lib/edit/video-library";
import {
  getEditableVideoForOwner,
  saveEditableVideoDraftForOwner,
} from "@/lib/edit/render-storage";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UpdateEditableVideoBody = {
  draft?: unknown;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ sourceVideoId: string }> },
) {
  try {
    const user = await requireFirebaseUser(request);
    const { sourceVideoId } = await context.params;
    const video = await getEditableVideoForOwner({
      sourceVideoId,
      userId: user.uid,
    });

    if (!video) {
      return Response.json(
        { ok: false, error: "The Edit project was not found." },
        { status: 404 },
      );
    }

    return Response.json(
      { ok: true, video },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return editVideoErrorResponse(error, "Could not load this Edit project.");
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sourceVideoId: string }> },
) {
  try {
    const user = await requireFirebaseUser(request);
    const { sourceVideoId } = await context.params;
    const body = (await request.json().catch(() => null)) as
      | UpdateEditableVideoBody
      | null;
    const draft = normalizeEditableVideoDraftInput(body?.draft);

    if (!draft) {
      return Response.json(
        { ok: false, error: "The edit draft is invalid." },
        { status: 400 },
      );
    }

    const video = await saveEditableVideoDraftForOwner({
      draft,
      sourceVideoId,
      userId: user.uid,
    });

    if (!video) {
      return Response.json(
        { ok: false, error: "The Edit project was not found." },
        { status: 404 },
      );
    }

    return Response.json(
      { ok: true, video },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return editVideoErrorResponse(error, "Could not save this Edit project.");
  }
}

function editVideoErrorResponse(error: unknown, fallback: string) {
  const status = error instanceof FirebaseAuthRequestError ? error.status : 500;

  if (status >= 500) {
    console.error(fallback, error);
  }

  return Response.json(
    {
      ok: false,
      error:
        error instanceof FirebaseAuthRequestError ? error.message : fallback,
    },
    { status },
  );
}
