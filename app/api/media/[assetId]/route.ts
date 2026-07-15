import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import {
  getMediaAssetForOwner,
  serializeMediaAsset,
  softDeleteMediaAsset,
  updateMediaAssetForOwner,
} from "@/lib/media/media-storage";

export const runtime = "nodejs";

type UpdateAssetBody = {
  draft?: unknown;
  title?: unknown;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  return handleRequest(request, context, "get");
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  return handleRequest(request, context, "patch");
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  return handleRequest(request, context, "delete");
}

async function handleRequest(
  request: Request,
  context: { params: Promise<{ assetId: string }> },
  action: "delete" | "get" | "patch",
) {
  try {
    const user = await requireFirebaseUser(request);
    const { assetId } = await context.params;
    const asset = await getMediaAssetForOwner({ assetId, userId: user.uid });

    if (!asset) {
      return Response.json({ ok: false, error: "Media asset was not found." }, { status: 404 });
    }

    if (action === "get") {
      return Response.json({ ok: true, asset: serializeMediaAsset(asset) });
    }

    if (action === "delete") {
      const deleted = await softDeleteMediaAsset({ assetId, userId: user.uid });

      return Response.json({ ok: true, asset: deleted ? serializeMediaAsset(deleted) : null });
    }

    const body = (await request.json().catch(() => null)) as UpdateAssetBody | null;
    const title = typeof body?.title === "string" ? body.title.trim().slice(0, 140) : undefined;
    if (body && "draft" in body) {
      return Response.json(
        {
          ok: false,
          error: "Editing changes must be saved to an Edit project, not a Creative Asset.",
        },
        { status: 400 },
      );
    }

    if (!title) {
      return Response.json({ ok: false, error: "No media changes were provided." }, { status: 400 });
    }

    const updated = await updateMediaAssetForOwner({
      assetId,
      title,
      userId: user.uid,
    });

    return Response.json({ ok: true, asset: updated ? serializeMediaAsset(updated) : null });
  } catch (error) {
    const status = error instanceof FirebaseAuthRequestError ? error.status : 500;

    if (status >= 500) {
      console.error("Could not manage media asset:", error);
    }

    return Response.json(
      {
        ok: false,
        error: error instanceof FirebaseAuthRequestError ? error.message : "Could not update media.",
      },
      { status },
    );
  }
}
