import { NextResponse } from "next/server";
import { z } from "zod";
import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import { reconsiderSkippedTrendingCreative } from "@/lib/trending/creative-decisions";
import { markDailyTrendingSlotDecided } from "@/lib/trending/unified-daily-feed-db";

export const runtime = "nodejs";

const schema = z.object({
  assignmentId: z.string().uuid(),
  creativeId: z.string().uuid(),
  format: z.enum(["carousel", "hook_video", "wall_text", "reaction"]),
}).strict();

export async function POST(request: Request) {
  try {
    const { uid: userId } = await requireFirebaseUser(request);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ ok: false, error: "Choose a valid skipped post." }, 400);
    const decision = await reconsiderSkippedTrendingCreative({ ...parsed.data, userId });
    // The original skip can still be in the browser outbox. Retire the slot
    // idempotently without allocating another daily post or charging credits.
    await markDailyTrendingSlotDecided({ assignmentId: parsed.data.assignmentId, format: parsed.data.format, userId });
    return json({ ok: true, decision });
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) return json({ ok: false, error: error.message }, error.status);
    console.error("Could not reconsider a skipped Trending post:", error);
    return json({ ok: false, error: "Could not select this skipped post. Try again." }, 409);
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
