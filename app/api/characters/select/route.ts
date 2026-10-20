import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import {
  CharacterIdentityError,
  CharacterSelectionRequestSchema,
  selectCharacterForUser,
} from "@/lib/characters/identity";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const body = CharacterSelectionRequestSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return Response.json({ ok: false, error: "Choose a generated character and an optional name of up to 80 characters." }, {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      });
    }
    const character = await selectCharacterForUser({ ...body.data, userId: user.uid });
    return Response.json({ ok: true, character }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const expected = error instanceof FirebaseAuthRequestError || error instanceof CharacterIdentityError;
    if (!expected) console.error("Could not save AI character:", error);
    return Response.json({ ok: false, error: expected ? error.message : "Could not save your character. Try again." }, {
      status: expected ? error.status : 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
