import { getTalkingHeadReferences } from "@/lib/explore/talking-head-reference-catalog";
import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await requireFirebaseUser(request);
    return Response.json({ ok: true, items: getTalkingHeadReferences() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: "Sign in to browse talking-head references." }, { status: error instanceof FirebaseAuthRequestError ? error.status : 500 });
  }
}
