import { readCreatorAccountMedia } from "@/lib/explore/creator-accounts";
import { canAccessCreatorAccounts } from "@/lib/explore/creator-account-access";
import { requireFirebaseUser } from "@/lib/firebase/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request, context: { params: Promise<{ referenceId: string }> }) {
  try {
    if (!canAccessCreatorAccounts(await requireFirebaseUser(request))) return new Response(null, { status: 404, headers });
    const { referenceId } = await context.params;
    const variant = new URL(request.url).searchParams.get("variant");
    if (variant !== "poster" && variant !== "video") return new Response(null, { status: 400, headers });
    const object = await readCreatorAccountMedia(referenceId, variant);
    if (!object) return new Response(null, { status: 404, headers });
    return new Response(new Uint8Array(object.bytes), { headers: {
      ...headers, "Content-Type": object.contentType, "Content-Length": String(object.bytes.length),
    } });
  } catch { return new Response(null, { status: 404, headers }); }
}
