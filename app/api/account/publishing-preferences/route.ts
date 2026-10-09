import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import { parsePublishingPreferences } from "@/lib/scheduling/publishing-preferences";
import { getPublishingPreferences, savePublishingPreferences } from "@/lib/scheduling/publishing-preferences-db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    return json({ ok: true, preferences: await getPublishingPreferences(user.uid) });
  } catch (error) { return failure(error); }
}

export async function PUT(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const body: unknown = await request.json().catch(() => null);
    let preferences;
    try { preferences = parsePublishingPreferences(body); }
    catch { return json({ ok: false, message: "Choose a valid AI content disclosure default." }, 400); }
    return json({ ok: true, preferences: await savePublishingPreferences(user.uid, preferences) });
  } catch (error) { return failure(error); }
}

function failure(error: unknown) {
  return error instanceof FirebaseAuthRequestError
    ? json({ ok: false, message: error.message }, error.status)
    : json({ ok: false, message: "Could not load or save publishing preferences. Please try again." }, 503);
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
