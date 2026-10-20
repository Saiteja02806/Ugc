import { requireFirebaseUser, FirebaseAuthRequestError } from "@/lib/firebase/server-auth";
import { listImageLibraryAssetsPage, serializeMediaAsset } from "@/lib/media/media-storage";
import { isLibraryImage } from "@/lib/media/image-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const params = new URL(request.url).searchParams;
    const offset = Number(params.get("offset") ?? 0), query = (params.get("q") ?? "").trim();
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100_000 || query.length > 140) {
      return Response.json({ ok: false, error: "Invalid image search." }, { status: 400 });
    }
    const rows = await listImageLibraryAssetsPage({ userId: user.uid, offset, query });
    const archived = params.get("archived") === "1";
    return Response.json({ ok: true, assets: rows.slice(0, 60).map(serializeMediaAsset).filter(asset => isLibraryImage(asset) && (asset.metadata.imageLibraryArchived === true) === archived),
      nextOffset: rows.length > 60 ? offset + 60 : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof FirebaseAuthRequestError ? error.status : 500;
    if (status === 500) console.error("Could not load image library", error);
    return Response.json({ ok: false, error: status === 500 ? "Could not load your image library." : (error as Error).message }, { status });
  }
}
