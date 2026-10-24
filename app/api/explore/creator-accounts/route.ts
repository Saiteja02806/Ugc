import { getCreatorAccounts } from "@/lib/explore/creator-accounts";
import { getCreatorSlideshowAccounts } from "@/lib/explore/creator-slideshows";
import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store", Vary: "Authorization", "X-Content-Type-Options": "nosniff" };
  try {
    const user = await requireFirebaseUser(request);
    const format = new URL(request.url).searchParams.get("format");
    return Response.json({ ok: true, accounts: format === "slideshow" ? getCreatorSlideshowAccounts(user) : getCreatorAccounts(user) }, { headers });
  } catch (error) {
    return Response.json({ ok: false, message: "Creator accounts could not be loaded." }, { status: error instanceof FirebaseAuthRequestError ? error.status : 503, headers });
  }
}
