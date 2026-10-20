import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import { parsePublishingPreferencesUpdate, type PublishingPreferences } from "@/lib/scheduling/publishing-preferences";
import { getPublishingPreferences, savePublishingPreferences } from "@/lib/scheduling/publishing-preferences-db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    return json({ ok: true, preferences: responsePreferences(request, await getPublishingPreferences(user.uid)) });
  } catch (error) { return failure(error); }
}

export async function PUT(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const body: unknown = await request.json().catch(() => null);
    let preferences;
    try { preferences = parsePublishingPreferencesUpdate(body); }
    catch { return json({ ok: false, message: "Choose valid publishing defaults." }, 400); }
    return json({ ok: true, preferences: responsePreferences(request, await savePublishingPreferences(user.uid, preferences)) });
  } catch (error) { return failure(error); }
}

function failure(error: unknown) {
  return error instanceof FirebaseAuthRequestError
    ? json({ ok: false, message: error.message }, error.status)
    : json({ ok: false, message: "Could not load or save publishing preferences. Please try again." }, 503);
}

function responsePreferences(request: Request, preferences: PublishingPreferences) {
  // Already-open clients validate their original response fields strictly.
  const schema = new URL(request.url).searchParams.get("schema");
  if (schema === "3") return preferences;
  if (schema === "2") {
    return Object.fromEntries(Object.entries(preferences).filter(([key]) => key !== "tiktokBrandOrganic"));
  }
  return { containsSyntheticMedia: preferences.containsSyntheticMedia };
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
