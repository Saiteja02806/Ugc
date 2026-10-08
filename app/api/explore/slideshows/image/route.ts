import { requireAIStudioProUser } from "@/lib/ai-studio/server-access";
import { FirebaseAuthRequestError } from "@/lib/firebase/server-auth";
import { getRecreateReferences } from "@/lib/explore/recreate-catalog";
import { getMediaAssetForOwner } from "@/lib/media/media-storage";
import { isTrustedStorageUrl } from "@/lib/storage/storage";
import { isExploreUuid } from "@/worker/src/lib/explore-finishing-contract";

const MAX_BYTES = 25 * 1024 ** 2;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Load only a catalogue slide or an owned ready image for browser canvas export. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const preview = process.env.NODE_ENV === "development" && params.get("preview") === "1";
    const user = preview ? null : await requireAIStudioProUser(request);
    let source: string | undefined;
    const assetId = params.get("mediaAssetId");
    if (assetId) {
      if (!user || !isExploreUuid(assetId)) return Response.json({ error: "Choose an image from your account." }, { status: 400 });
      const asset = await getMediaAssetForOwner({ userId: user.uid, assetId });
      if (!asset || asset.user_id !== user.uid || asset.deleted_at != null || asset.collection !== "image" || asset.status !== "ready" || !IMAGE_TYPES.includes(asset.mime_type ?? "")) return Response.json({ error: "This image is unavailable." }, { status: 404 });
      source = asset.url;
    } else {
      const reference = getRecreateReferences().find(item => item.id === params.get("referenceId") && item.format === "slideshow");
      source = reference?.slides.find(slide => slide.id === params.get("slideId"))?.url;
    }
    if (!source || !source.startsWith("https://") || !isTrustedStorageUrl(source)) return Response.json({ error: "Choose a valid slideshow image." }, { status: 400 });
    // No client URL, redirects, credentials or generation provider are forwarded.
    const upstream = await fetch(source, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000) });
    const contentType = upstream.headers.get("content-type")?.split(";")[0].trim() ?? "";
    const length = Number(upstream.headers.get("content-length"));
    if (!upstream.ok || !upstream.body || !IMAGE_TYPES.includes(contentType) || length > MAX_BYTES) {
      await upstream.body?.cancel();
      return Response.json({ error: "Could not load this slide image." }, { status: 400 });
    }
    const reader = upstream.body.getReader();
    let bytes = 0;
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const chunk = await reader.read();
          if (chunk.done) { controller.close(); return; }
          bytes += chunk.value.byteLength;
          if (bytes > MAX_BYTES) { await reader.cancel(); controller.error(new Error("The slide image is too large.")); return; }
          controller.enqueue(chunk.value);
        } catch (error) { controller.error(error); }
      },
      cancel(reason) { return reader.cancel(reason); },
    });
    return new Response(stream, { headers: { "Content-Type": contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" } });
  } catch (error) {
    return Response.json({ error: error instanceof FirebaseAuthRequestError ? error.message : "Could not load this slide image." }, { status: error instanceof FirebaseAuthRequestError ? error.status : 503 });
  }
}
