import { NextResponse } from "next/server";
import {
  INTERNAL_FINALIZATION_SIGNATURE_HEADER,
  INTERNAL_FINALIZATION_TIMESTAMP_HEADER,
} from "@/lib/scheduling/finalization-signature";
import { verifyInternalFinalizationRequest } from "@/lib/scheduling/internal-finalization-auth";
import { reconcileWallTextPlanPublications } from "@/lib/trending/wall-text-early-delivery";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();
  if (!body || Buffer.byteLength(body, "utf8") > 4096) return json({ ok: false }, 400);
  if (!verifyInternalFinalizationRequest({
    body,
    signature: request.headers.get(INTERNAL_FINALIZATION_SIGNATURE_HEADER),
    timestamp: request.headers.get(INTERNAL_FINALIZATION_TIMESTAMP_HEADER),
  })) return json({ ok: false }, 401);
  let planId: string;
  try {
    const input = JSON.parse(body);
    if (typeof input.planId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.planId)) {
      return json({ ok: false }, 400);
    }
    planId = input.planId;
  } catch { return json({ ok: false }, 400); }
  try {
    const results = await reconcileWallTextPlanPublications({ planId, limit: 1 });
    return json({ ok: true, results });
  } catch (error) {
    console.error("Wall plan publication reconciliation failed", { planId, error });
    return json({ ok: false }, 500);
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
