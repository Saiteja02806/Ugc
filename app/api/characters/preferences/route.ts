import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import {
  CharacterPreferenceError,
  CharacterPreferenceRequestSchema,
  getCharacterPreferenceForUser,
  saveCharacterPreferenceForUser,
} from "@/lib/characters/preferences";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  const expected = error instanceof FirebaseAuthRequestError || error instanceof CharacterPreferenceError;
  if (!expected) console.error("Could not manage character preferences.", { errorType: error instanceof Error ? error.name : "Unknown" });
  return Response.json({ ok: false, error: expected ? error.message : "Your character preference is temporarily unavailable. Try again." }, {
    status: expected ? error.status : 503,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const preference = await getCharacterPreferenceForUser(user.uid);
    return Response.json({ ok: true, preference }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const text = await request.text();
    if (text.length > 1_000) throw new CharacterPreferenceError("Choose male or female, or skip this choice.", 400);
    let body: unknown;
    try { body = JSON.parse(text); }
    catch { throw new CharacterPreferenceError("Choose male or female, or skip this choice.", 400); }
    const parsed = CharacterPreferenceRequestSchema.safeParse(body);
    if (!parsed.success) throw new CharacterPreferenceError("Choose male or female, or skip this choice.", 400);
    const preference = await saveCharacterPreferenceForUser(user.uid, parsed.data);
    return Response.json({ ok: true, preference }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
