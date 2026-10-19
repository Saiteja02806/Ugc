import { NextResponse } from "next/server";
import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import { readQuotaReviewHistory } from "@/lib/trending/quota-review-history-server";

export const runtime = "nodejs";
export const maxDuration = 60;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  try {
    const { uid } = await requireFirebaseUser(request);
    const query = new URL(request.url).searchParams;
    const feedId = query.get("feedId") ?? "";
    const rawBefore = query.get("before");
    const before = rawBefore === null ? null : Number(rawBefore);
    if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(feedId) ||
      (before !== null && (!/^\d+$/.test(rawBefore!) || !Number.isSafeInteger(before)))) {
      return json({ ok: false, message: "Invalid saved quota or history position." }, 400);
    }
    const result = await readQuotaReviewHistory(uid, feedId, before);
    return result ? json({ ok: true, ...result }) : json({ ok: false, message: "This saved quota was not found." }, 404);
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) return json({ ok: false, message: error.message }, error.status);
    console.error("Could not recover Trending quota history:", error);
    return json({ ok: false, message: "Earlier posts could not be loaded. Please try again." }, 500);
  }
}
