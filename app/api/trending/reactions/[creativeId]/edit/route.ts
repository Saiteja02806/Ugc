import { NextResponse } from "next/server";
import { z } from "zod";
import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import { SchedulingRequestError } from "@/lib/scheduling/errors";
import { ReactionTextEditRequestSchema } from "@/lib/trending/reaction-edit-contract";
import { loadReactionTextEdit, saveReactionTextEdit } from "@/lib/trending/reaction-edits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ creativeId: string }> };

export async function GET(request: Request, context: Context) {
  return handle(request, context, false);
}
export async function PATCH(request: Request, context: Context) {
  return handle(request, context, true);
}
async function handle(request: Request, context: Context, save: boolean) {
  try {
    const userId = (await requireFirebaseUser(request)).uid;
    const { creativeId } = await context.params;
    if (!z.string().uuid().safeParse(creativeId).success) return json({ ok: false, message: "Choose a valid Reaction Reel." }, 400);
    if (save) {
      const input = ReactionTextEditRequestSchema.safeParse(await request.json().catch(() => null));
      if (!input.success) return json({ ok: false, message: "Use 5–20 words across up to three lines." }, 400);
      const edit = await saveReactionTextEdit({ ...input.data, creativeId, userId });
      return json({ ok: true, edit });
    }
    const assignmentId = new URL(request.url).searchParams.get("assignmentId");
    if (!z.string().uuid().safeParse(assignmentId).success) return json({ ok: false, message: "Choose a valid Reaction Reel." }, 400);
    return json({ ok: true, edit: await loadReactionTextEdit({ assignmentId: assignmentId!, creativeId, userId }) });
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError || error instanceof SchedulingRequestError) {
      return json({ ok: false, message: error.message }, error.status);
    }
    console.error("Reaction text edit failed", error);
    return json({ ok: false, message: "Could not save or prepare this Reaction Reel. Reopen Edit to retry." }, 500);
  }
}
function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });
}
