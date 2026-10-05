import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import { initializeAccountTimeZone } from "@/lib/scheduling/account-timezone-db";
import { ScheduleTimeError, validateTimeZone } from "@/lib/scheduling/schedule-time";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || !("timezone" in body) || typeof body.timezone !== "string") {
      return json({ ok: false, message: "Choose a valid time zone." }, 400);
    }
    const timezone = await initializeAccountTimeZone(user.uid, validateTimeZone(body.timezone));
    return json({ ok: true, timezone });
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) return json({ ok: false, message: error.message }, error.status);
    if (error instanceof ScheduleTimeError) return json({ ok: false, message: error.message }, 400);
    return json({ ok: false, message: "Could not load your account time zone." }, 503);
  }
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
