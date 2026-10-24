import "server-only";
import { NextResponse } from "next/server";
import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";
import { publicSnapshot, readAnalyticsSnapshot, refreshAnalyticsSnapshot } from "./snapshot-service";
import type { SnapshotOperation } from "./snapshot-store";

export function createAnalyticsRoute(operation: SnapshotOperation) {
  async function handle(request: Request, refresh: boolean) {
    const started = performance.now();
    try {
      const { uid: userId } = await requireFirebaseUser(request);
      const body = refresh ? await request.json().catch(() => ({})) : null;
      const rawDays = refresh ? body?.days : new URL(request.url).searchParams.get("days");
      const days = operation.startsWith("instagram") ? Number(rawDays) : undefined;
      if (days !== undefined && ![7, 30, 90].includes(days)) return json({ ok: false, message: "Choose a supported analytics date range." }, 400);
      const params = { operation, userId, days: days as 7 | 30 | 90 | undefined };
      const authMs = performance.now() - started;
      const result = refresh ? await refreshAnalyticsSnapshot({ ...params, force: body?.force === true }) : publicSnapshot(await readAnalyticsSnapshot(params));
      const durationMs = performance.now() - started;
      console.info("analytics_request_timing", { operation, mode: refresh ? "refresh" : "snapshot", authMs: Math.round(authMs), durationMs: Math.round(durationMs) });
      return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store", "Server-Timing": `auth;dur=${authMs.toFixed(1)},analytics;dur=${(durationMs-authMs).toFixed(1)}` } });
    } catch (error) {
      const status = error instanceof FirebaseAuthRequestError ? error.status : 502;
      if (status >= 500) console.error("Analytics request failed:", error);
      return json({ ok: false, message: status === 401 ? "Sign in before viewing analytics." : "Analytics could not load. Please try again shortly." }, status);
    }
  }
  return { GET: (request: Request) => handle(request, false), POST: (request: Request) => handle(request, true) };
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
