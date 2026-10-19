import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import { getBackgroundJobForUser } from "@/lib/jobs/background-jobs";
import { remixSourceFromJob } from "@/lib/explore/remix-source";
import { getGeneratedImageHistoryMetadata } from "@/lib/ai-studio/generated-image-history-metadata";
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
  libraryArchived?: unknown;
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
      const serialized = serializeMediaAsset(asset);
      const job = asset.source_record_id && (asset.source_type === "generated_video" || asset.source_type === "generated_image")
        ? await getBackgroundJobForUser({ jobId: asset.source_record_id, userId: user.uid }) : null;
      if (asset.source_type === "generated_image" && job?.jobType === "generate_image") {
        serialized.metadata = { ...serialized.metadata, ...getGeneratedImageHistoryMetadata(job.input) };
      }
      if (new URL(request.url).searchParams.get("remixSource") === "1") {
        // Read provenance from this owner's original job, never browser state.
        // Original reference imports already contain server-validated provenance.
        // Unlike generated assets, they have no background generation job.
        const importedOriginal = asset.source_type === "upload" && asset.project_id === "explore-catalog-reference";
        serialized.metadata = { ...serialized.metadata, remixTextSource: job ? remixSourceFromJob(job.input) : importedOriginal ? serialized.metadata.remixTextSource ?? null : null };
      }
      return Response.json({ ok: true, asset: serialized });
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

    const archive = body && "libraryArchived" in body ? body.libraryArchived : undefined;
    if (archive !== undefined && (typeof archive !== "boolean" || asset.collection !== "image")) {
      return Response.json({ ok: false, error: "Choose a valid image library action." }, { status: 400 });
    }
    if (!title && archive === undefined) {
      return Response.json({ ok: false, error: "No media changes were provided." }, { status: 400 });
    }

    const updated = await updateMediaAssetForOwner({
      assetId,
      title,
      ...(typeof archive === "boolean" ? { metadata: { imageLibraryArchived: archive } } : {}),
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
