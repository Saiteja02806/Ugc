import { NextResponse } from "next/server";

import { replenishTrendingCarouselFeedCyclePage } from "@/lib/trending/daily-replenishment-sweep";
import { isValidReplenishmentCycleId } from "@/lib/trending/replenishment-page-logic";
import {
  isCarouselReplenishmentBodyWithinLimit,
  validateCarouselReplenishmentContentLength,
} from "@/lib/trending/replenishment-request";
import {
  CAROUSEL_REPLENISHMENT_SIGNATURE_HEADER,
  CAROUSEL_REPLENISHMENT_TIMESTAMP_HEADER,
  getCarouselReplenishmentSecret,
  verifyCarouselReplenishmentSignature,
} from "@/lib/trending/replenishment-signature";

export const runtime = "nodejs";
export const maxDuration = 60;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const contentLength = validateCarouselReplenishmentContentLength(
    request.headers.get("content-length"),
  );

  if (!contentLength.ok) {
    return json(
      {
        ok: false,
        message:
          contentLength.status === 411
            ? "Content-Length is required."
            : "Request body is too large.",
      },
      contentLength.status,
    );
  }

  const body = await request.text();

  if (
    !isCarouselReplenishmentBodyWithinLimit(body) ||
    Buffer.byteLength(body, "utf8") !== contentLength.contentLength
  ) {
    return json({ ok: false, message: "Request body length is invalid." }, 400);
  }

  const secret = getCarouselReplenishmentSecret();

  if (
    !secret ||
    !verifyCarouselReplenishmentSignature({
      body,
      secret,
      signature: request.headers.get(CAROUSEL_REPLENISHMENT_SIGNATURE_HEADER),
      timestamp: request.headers.get(CAROUSEL_REPLENISHMENT_TIMESTAMP_HEADER),
    })
  ) {
    return json({ ok: false, message: "Unauthorized." }, 401);
  }

  let payload: { cycleId?: unknown; limit?: unknown } = {};

  try {
    payload = body ? (JSON.parse(body) as typeof payload) : {};
  } catch {
    return json({ ok: false, message: "Request body must be valid JSON." }, 400);
  }

  const limit =
    typeof payload.limit === "number" && Number.isFinite(payload.limit)
      ? payload.limit
      : 5;
  const cycleId = payload.cycleId;

  if (!isValidReplenishmentCycleId(cycleId)) {
    return json(
      { ok: false, message: "Cycle ID must be a canonical ISO timestamp." },
      400,
    );
  }

  const result = await replenishTrendingCarouselFeedCyclePage({
    limit,
    requestedCycleId: cycleId,
  });

  return json({ ok: true, ...result });
}
