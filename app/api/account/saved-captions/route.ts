import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import { parseSavedCaptionLibrary } from "@/lib/scheduling/saved-captions";
import { getSavedCaptions, saveCaptionLibrary, SavedCaptionConflictError } from "@/lib/scheduling/saved-captions-db";

export const runtime = "nodejs";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Authorization" } });
function failure(error: unknown) {
  if (error instanceof FirebaseAuthRequestError) return json({ ok: false, message: error.message }, error.status);
  if (error instanceof SavedCaptionConflictError) return json({ ok: false, message: error.message }, 409);
  return json({ ok: false, message: "Saved captions are unavailable. Your post caption is kept; try again." }, 503);
}
export async function GET(request: Request) {
  try { const user = await requireFirebaseUser(request); return json({ ok: true, library: await getSavedCaptions(user.uid) }); }
  catch (error) { return failure(error); }
}
export async function PUT(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const raw = await request.text();
    if (raw.length > 650_000) return json({ ok: false, message: "Save up to 20 captions, each within 5,000 characters." }, 413);
    let input;
    try { input = parseSavedCaptionLibrary(JSON.parse(raw)); }
    catch { return json({ ok: false, message: "Save up to 20 unique captions, each within 5,000 characters, and choose a valid default." }, 400); }
    return json({ ok: true, library: await saveCaptionLibrary(user.uid, input) });
  } catch (error) { return failure(error); }
}
