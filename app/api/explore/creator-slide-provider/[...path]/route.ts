import { readCreatorSlide } from "@/lib/explore/creator-slideshows";
import { verifyCreatorSlideDelivery } from "@/worker/src/lib/creator-slide-delivery";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
export async function GET(request: Request) {
  try {
    const identity = verifyCreatorSlideDelivery(request.url);
    if (!identity) return new Response(null,{status:404,headers});
    const object = await readCreatorSlide(identity.referenceId,identity.slideId);
    if (!object || object.slide.sha256 !== identity.sha256 || object.slide.extension !== identity.extension) return new Response(null,{status:404,headers});
    return new Response(new Uint8Array(object.bytes),{headers:{...headers,"Content-Type":object.contentType,"Content-Length":String(object.bytes.length)}});
  } catch { return new Response(null,{status:404,headers}); }
}
