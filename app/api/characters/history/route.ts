import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import { listCharacterHistoryForUser } from "@/lib/characters/identity";
import { CharacterHistoryCursorError } from "@/lib/characters/history";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const history = await listCharacterHistoryForUser(user.uid, new URL(request.url).searchParams.get("cursor"));
    return Response.json(history, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const publicError = error instanceof FirebaseAuthRequestError || error instanceof CharacterHistoryCursorError;
    if (!publicError) console.error("Could not load character history:", error);
    return Response.json({ ok: false, error: publicError ? error.message : "Could not load your character history. Try again." }, {
      status: error instanceof FirebaseAuthRequestError ? error.status : error instanceof CharacterHistoryCursorError ? 400 : 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
