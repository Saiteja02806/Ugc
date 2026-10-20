import { NextResponse } from "next/server";
import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import { readPublishingActivity } from "@/lib/analytics/publishing-activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const url = new URL(request.url);
    const days = Number(url.searchParams.get("days"));
    const offset = Number(url.searchParams.get("offset"));
    const end = url.searchParams.get("end") ?? "";
    const connection = url.searchParams.get("connection") ?? "all";
    if (![7,30,90].includes(days) || !Number.isInteger(offset) || Math.abs(offset) > 840 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(end) || !Number.isFinite(Date.parse(end)) || new Date(end).toISOString().slice(0,10) !== end ||
      (connection !== "all" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(connection))) return json({ ok: false, message: "Choose a valid activity date range." }, 400);
    const dateKeys = Array.from({ length: days }, (_, i) => new Date(Date.parse(`${end}T00:00:00Z`) - (days-i-1)*86400_000).toISOString().slice(0,10));
    return json({ ok: true, activity: await readPublishingActivity(user.uid, dateKeys, offset, connection) });
  } catch (error) {
    return json({ ok: false, message: "Publishing activity could not load." }, error instanceof FirebaseAuthRequestError ? error.status : 502);
  }
}
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } }); }
