import { EditDraftError, editDraftRevision, parseEditDraft } from "@/lib/edit/draft-contract";
import { z } from "zod";
import { withPrivateEditDelivery } from "@/lib/edit/private-video-delivery";
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
  draftId?: unknown;
  requestId?: unknown;
  expectedRevision?: unknown;
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
      { ok: true, video: await withPrivateEditDelivery(video, user.uid) },
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
    if (!z.uuid().safeParse(body?.draftId).success || !z.uuid().safeParse(body?.requestId).success || !editDraftRevision.safeParse(body?.expectedRevision).success)
      throw new EditDraftError("DRAFT_PRECONDITION_REQUIRED", "Reload this editor to save your changes safely.", 428);
    const draft = parseEditDraft(body?.draft);

    const video = await saveEditableVideoDraftForOwner({
      draft,
      draftId: body!.draftId as string,
      requestId: body!.requestId as string,
      expectedRevision: body!.expectedRevision as number,
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
      { ok: true, video: await withPrivateEditDelivery(video, user.uid) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return editVideoErrorResponse(error, "Could not save this Edit project.");
  }
}

function editVideoErrorResponse(error: unknown, fallback: string) {
  const status = error instanceof FirebaseAuthRequestError || error instanceof EditDraftError ? error.status : 500;

  if (status >= 500) {
    console.error(fallback, error);
  }

  return Response.json(
    {
      ok: false,
      error:
        error instanceof FirebaseAuthRequestError || error instanceof EditDraftError ? error.message : fallback,
      ...(error instanceof EditDraftError ? { code: error.code } : {}),
    },
    { status },
  );
}
