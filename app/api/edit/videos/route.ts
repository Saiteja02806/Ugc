import {
  serializeEditableVideo,
  listEditableVideosForOwner,
} from "@/lib/edit/render-storage";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import { openEditDraftForOwner } from "@/lib/edit/open-draft";
import { EditDraftError } from "@/lib/edit/draft-contract";
import { withPrivateEditDelivery } from "@/lib/edit/private-video-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OpenEditableVideoBody = {
  sourceVideoId?: unknown;
};

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const videos = await listEditableVideosForOwner(user.uid);

    return Response.json(
      { ok: true, videos: await Promise.all(videos.map(video => withPrivateEditDelivery(video, user.uid))) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return editVideoErrorResponse(error, "Could not load your Edit projects.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const body = (await request.json().catch(() => null)) as
      | OpenEditableVideoBody
      | null;
    const sourceVideoId =
      typeof body?.sourceVideoId === "string" ? body.sourceVideoId.trim() : "";

    if (!sourceVideoId) {
      return Response.json(
        { ok: false, error: "Choose a Creative Asset before opening Edit." },
        { status: 400 },
      );
    }

    const opened = await openEditDraftForOwner(user.uid, sourceVideoId);
    const video = serializeEditableVideo(opened.video);

    return Response.json(
      { ok: true, video: await withPrivateEditDelivery(video, user.uid) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return editVideoErrorResponse(error, "Could not open this video in the editor.");
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
