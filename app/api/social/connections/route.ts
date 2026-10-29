import { after, NextResponse } from "next/server";
import { enqueueAnalyticsSyncJob } from "@/lib/analytics/jobs";
import { refreshAnalyticsSnapshot } from "@/lib/analytics/snapshot-service";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  listSocialConnections,
  logSocialOAuthTrace,
  type SocialOAuthTraceContext,
} from "@/lib/social/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const trace = getOAuthTraceContext(request);
  const started = performance.now();

  try {
    const user = await requireFirebaseUser(request);
    const authenticated = performance.now();
    const connections = await listSocialConnections(user.uid, trace);
    const readAt = performance.now();
    // Analytics defaults to Instagram. Keep connected TikTok snapshots current
    // during that visit too, without waiting on provider work in this response.
    // Other account pickers retain their existing read-only metrics behavior.
    if (new URL(request.url).searchParams.get("analytics") === "1" &&
        connections.some(connection => connection.platform === "tiktok" && connection.status === "connected")) {
      after(async () => {
        try {
          await refreshAnalyticsSnapshot({ userId: user.uid, operation: "tiktok_videos", force: false });
        } catch (error) {
          console.error("TikTok analytics background refresh could not start:", error);
        }
      });
    }
    if (connections.some(connection => connection.profileNeedsRefresh)) {
      after(async () => {
        try {
          await enqueueAnalyticsSyncJob({ userId: user.uid, operation: "connection_profiles" });
        } catch (error) {
          console.error("Account profiles could not be queued for renewal:", error);
        }
      });
    }

    logSocialOAuthTrace(trace, "connected_accounts_api_response", {
      hasConnectedAccount: connections.some(
        (connection) => connection.status === "connected",
      ),
      httpStatus: 200,
      userIdPresent: Boolean(user.uid),
    });

    return NextResponse.json(
      { ok: true, connections },
      { headers: { "Cache-Control": "private, no-store", "Server-Timing": `auth;dur=${(authenticated-started).toFixed(1)},connections;dur=${(readAt-authenticated).toFixed(1)}` } },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not load social connections.";
    const status = error instanceof FirebaseAuthRequestError ? error.status : 500;

    logSocialOAuthTrace(trace, "connected_accounts_api_response", {
      hasConnectedAccount: false,
      httpStatus: status,
      userIdPresent: false,
    });

    return NextResponse.json(
      { ok: false, message },
      { headers: { "Cache-Control": "no-store" }, status },
    );
  }
}

function getOAuthTraceContext(request: Request): SocialOAuthTraceContext | undefined {
  const correlationId = request.headers
    .get("x-ugc-oauth-correlation-id")
    ?.trim();

  if (!correlationId) {
    return undefined;
  }

  return {
    callbackHost:
      request.headers.get("x-ugc-oauth-callback-host")?.trim() ||
      new URL(request.url).host,
    correlationId,
    stage: "connected_accounts_api_response",
  };
}
