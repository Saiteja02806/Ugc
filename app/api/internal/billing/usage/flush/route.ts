import { NextResponse } from "next/server";

import { flushPendingBillingUsageEvents } from "@/lib/billing/subscription-db";
import {
  getMissingCloudTasksOidcEnvVars,
  verifyCloudTasksOidcRequest,
} from "@/lib/scheduling/cloud-tasks-oidc-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const missing = getMissingCloudTasksOidcEnvVars();

  if (missing.length > 0) {
    console.error("Billing usage flush is not configured", { missing });
    return json({ ok: false, error: "Billing usage flush is not configured." }, 503);
  }

  const authorized = await verifyCloudTasksOidcRequest({
    audience: getRequestAudience(request.url),
    authorization: request.headers.get("authorization"),
  });

  if (!authorized) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  const limit = clampLimit(new URL(request.url).searchParams.get("limit"));

  try {
    const result = await flushPendingBillingUsageEvents(limit);
    return json({ ok: true, ...result });
  } catch (error) {
    console.error("Billing usage flush failed:", error);
    return json({ ok: false, error: "Billing usage flush failed." }, 500);
  }
}

function getRequestAudience(requestUrl: string) {
  const explicitAudience = process.env.GCP_BILLING_USAGE_FLUSH_AUDIENCE?.trim();

  if (explicitAudience) {
    return explicitAudience;
  }

  const url = new URL(requestUrl);
  url.search = "";
  url.hash = "";
  return url.toString();
}

function clampLimit(rawValue: string | null) {
  const value = Number.parseInt(rawValue || "", 10);
  return Number.isFinite(value) ? Math.max(1, Math.min(value, 100)) : 50;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
