import { requireFirebaseUser } from "@/lib/firebase/server-auth";
import { canAccessCreatorAccounts } from "@/lib/explore/creator-account-access";
import { readCreatorSlide } from "@/lib/explore/creator-slideshows";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization", "X-Content-Type-Options": "nosniff" };
export async function GET(request: Request, context: { params: Promise<{ referenceId: string; slideId: string }> }) {
  try {
    if (!canAccessCreatorAccounts(await requireFirebaseUser(request))) return new Response(null,{status:404,headers});
    const {referenceId,slideId} = await context.params, object = await readCreatorSlide(referenceId,slideId);
    if (!object) return new Response(null,{status:404,headers});
    return new Response(new Uint8Array(object.bytes),{headers:{...headers,"Content-Type":object.contentType,"Content-Length":String(object.bytes.length)}});
  } catch { return new Response(null,{status:404,headers}); }
}
