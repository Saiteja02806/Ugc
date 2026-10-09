import { getReadyMediaAssetForDelivery } from "@/lib/media/media-storage";
import { isPrivateUserMedia, verifyProtectedMediaDeliveryToken } from "@/lib/media/media-delivery";
import { privateMediaObject } from "@/lib/media/private-media-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await context.params;
  const query = new URL(request.url).searchParams;
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(assetId) ||
        !verifyProtectedMediaDeliveryToken({ assetId, expires: query.get("expires"),
          signature: query.get("signature"), variant: query.get("variant") })) {
      return new Response("Not found.", { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    const asset = await getReadyMediaAssetForDelivery(assetId);
    if (!asset || asset.status !== "ready" || asset.deleted_at !== null || !isPrivateUserMedia(asset)) {
      return new Response("Not found.", { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    const thumbnail = query.get("variant") === "thumbnail";
    const object = await privateMediaObject({
      key: thumbnail ? `${asset.storage_key}.thumbnail.webp` : asset.storage_key,
      range: request.headers.get("range") ?? undefined,
    });
    const headers = new Headers({ "Accept-Ranges": "bytes", "Cache-Control": "private, no-store",
      "Content-Type": object.contentType || (thumbnail ? "image/webp" : asset.mime_type),
      "Content-Length": String(object.size), "X-Content-Type-Options": "nosniff" });
    if (object.contentRange) headers.set("Content-Range", object.contentRange);
    return new Response(object.body, { headers, status: object.contentRange ? 206 : 200 });
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    const status = code === 404 ? 404 : error instanceof Error && error.message === "Invalid media byte range." ? 416 : 503;
    return new Response(status === 404 ? "Not found." : "Could not load media.", {
      status, headers: { "Cache-Control": "no-store" },
    });
  }
}
