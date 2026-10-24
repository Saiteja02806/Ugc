import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import { getBackgroundJobsByIds } from "@/lib/jobs/background-jobs";
import { getGeneratedImageHistoryMetadata } from "@/lib/ai-studio/generated-image-history-metadata";
import { remixSourceFromJob } from "@/lib/explore/remix-source";
import { isExploreUuid } from "@/worker/src/lib/explore-finishing-contract";
import { isAvailableLibraryImage } from "@/lib/media/image-library";
import { getMediaAssetsForOwnerByIds, serializeMediaAsset } from "@/lib/media/media-storage";

export const runtime = "nodejs";

/** Read-only batch admission: all chosen images must still belong to this owner. */
export async function POST(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const body = await request.json().catch(() => null);
    const ids: unknown = body?.mediaAssetIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > 20 || !ids.every(id => typeof id === "string" && isExploreUuid(id))) {
      return Response.json({ ok: false, error: "Choose between 1 and 20 valid images." }, { status: 400 });
    }
    const unique = [...new Set<string>(ids)];
    const rows = await getMediaAssetsForOwnerByIds({ assetIds: unique, userId: user.uid });
    const assets = new Map(rows.map(row => { const asset = serializeMediaAsset(row); return [asset.id, asset] as const; }));
    if (unique.some(id => !assets.has(id) || !isAvailableLibraryImage(assets.get(id)!))) {
      return Response.json({ ok: false, error: "An image is no longer available. Refresh the library and choose again." }, { status: 409 });
    }
    const jobIds = [...new Set(rows.filter(row => row.source_type === "generated_image" && row.source_record_id).map(row => row.source_record_id!))];
    const jobs = jobIds.length ? await getBackgroundJobsByIds(jobIds) : [];
    const byJob = new Map(jobs.filter(job => job.userId === user.uid && job.jobType === "generate_image").map(job => [job.id, job]));
    return Response.json({ ok: true, assets: unique.map(id => {
      const asset = assets.get(id)!;
      const job = asset.sourceType === "generated_image" ? byJob.get(asset.sourceRecordId ?? "") : undefined;
      return { ...asset, metadata: { ...asset.metadata, ...(job ? getGeneratedImageHistoryMetadata(job.input) : {}), remixTextSource: job ? remixSourceFromJob(job.input) : null } };
    }) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof FirebaseAuthRequestError ? error.status : 500;
    if (status === 500) console.error("Could not resolve library images", error);
    return Response.json({ ok: false, error: status === 500 ? "Could not check your images. Try again." : (error as Error).message }, { status });
  }
}
