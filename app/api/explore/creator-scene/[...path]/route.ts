import { readCreatorStartingFrame } from "@/lib/explore/creator-accounts";
import { verifyCreatorSceneDelivery } from "@/worker/src/lib/creator-scene-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };

export async function GET(request: Request) {
  try {
    const identity = verifyCreatorSceneDelivery(new URL(request.url));
    if (!identity) return new Response(null, { status: 404, headers });
    const object = await readCreatorStartingFrame(identity.referenceId, identity.frameSha256);
    if (!object || object.source.sourceSha256 !== identity.sourceSha256) return new Response(null, { status: 404, headers });
    return new Response(new Uint8Array(object.bytes), { headers: { ...headers, "Content-Type": "image/png", "Content-Length": String(object.bytes.length) } });
  } catch { return new Response(null, { status: 404, headers }); }
}
