import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import { getSocialProfilePictureForOwner } from "@/lib/social/profile-picture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ connectionId: string }> }) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  try {
    const user = await requireFirebaseUser(request);
    const { connectionId } = await context.params;
    if (!/^[a-zA-Z0-9-]{1,128}$/.test(connectionId)) return new Response(null, { status: 400, headers });
    const picture = await getSocialProfilePictureForOwner({ connectionId, userId: user.uid });
    if (!picture) return new Response(null, { status: 404, headers });
    return new Response(new Uint8Array(picture.bytes), {
      headers: { ...headers, "Content-Type": picture.contentType },
    });
  } catch (error) {
    return new Response(null, {
      status: error instanceof FirebaseAuthRequestError ? error.status : 502,
      headers,
    });
  }
}
