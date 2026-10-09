import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import { listCharactersForUser } from "@/lib/characters/identity";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const characters = await listCharactersForUser(user.uid);
    return Response.json({ ok: true, characters }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (!(error instanceof FirebaseAuthRequestError)) console.error("Could not list AI characters:", error);
    return Response.json({ ok: false, error: error instanceof FirebaseAuthRequestError ? error.message : "Could not load your characters. Try again." }, {
      status: error instanceof FirebaseAuthRequestError ? error.status : 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
