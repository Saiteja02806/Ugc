import { NextResponse } from "next/server";
import {
  INTERNAL_FINALIZATION_SIGNATURE_HEADER,
  INTERNAL_FINALIZATION_TIMESTAMP_HEADER,
} from "@/lib/scheduling/finalization-signature";
import { verifyInternalFinalizationRequest } from "@/lib/scheduling/internal-finalization-auth";
import { verifyCloudTasksOidcRequest } from "@/lib/scheduling/cloud-tasks-oidc-auth";
import { reconcileWallTextPlanPublications } from "@/lib/trending/wall-text-early-delivery";
import { wallTextPublicationNeedsRetry } from "@/lib/trending/wall-text-publication-delivery";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();
  if (!body || Buffer.byteLength(body, "utf8") > 4096) return json({ ok: false }, 400);
  const signedWorkerRequest = verifyInternalFinalizationRequest({
    body,
    signature: request.headers.get(INTERNAL_FINALIZATION_SIGNATURE_HEADER),
    timestamp: request.headers.get(INTERNAL_FINALIZATION_TIMESTAMP_HEADER),
  });
  const cloudTaskRequest = signedWorkerRequest
    ? false
    : await verifyCloudTasksOidcRequest({
        audience: getRequestAudience(request.url),
        authorization: request.headers.get("authorization"),
      });
  if (!signedWorkerRequest && !cloudTaskRequest) return json({ ok: false }, 401);
  let planId: string;
  let publicationId: string | undefined;
  try {
    const input = JSON.parse(body);
    if (typeof input.planId !== "string" ||
      !isUuid(input.planId) ||
      (input.publicationId !== undefined &&
        (typeof input.publicationId !== "string" || !isUuid(input.publicationId)))) {
      return json({ ok: false }, 400);
    }
    planId = input.planId;
    publicationId = input.publicationId;
  } catch { return json({ ok: false }, 400); }
  try {
    const results = await reconcileWallTextPlanPublications({ planId, publicationId, limit: 1 });
    if (wallTextPublicationNeedsRetry(results)) {
      return json({
        message: "Wall plan publication is pending retry.",
        ok: false,
        results,
      }, 503);
    }
    return json({ ok: true, results });
  } catch (error) {
    console.error("Wall plan publication reconciliation failed", { planId, error });
    return json({ ok: false }, 500);
  }
}

function getRequestAudience(requestUrl: string) {
  const configuredAudience = process.env.GCP_WALL_TEXT_PUBLICATION_AUDIENCE?.trim();
  if (configuredAudience) return configuredAudience;
  const url = new URL(requestUrl);
  url.search = "";
  url.hash = "";
  return url.toString();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
