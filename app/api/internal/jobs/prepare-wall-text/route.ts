import { NextResponse } from "next/server";

import { getBusinessProfileForUser } from "@/lib/business-profiles/db";
import {
  INTERNAL_FINALIZATION_SIGNATURE_HEADER,
  INTERNAL_FINALIZATION_TIMESTAMP_HEADER,
} from "@/lib/scheduling/finalization-signature";
import {
  getMissingInternalFinalizationEnvVars,
  verifyInternalFinalizationRequest,
} from "@/lib/scheduling/internal-finalization-auth";
import {
  prepareTrendingWallTextIdeas,
  TrendingWallTextPreparationError,
} from "@/lib/trending/trending-wall-text-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_LENGTH = 4_096;

type PrepareWallTextInput = {
  businessProfileId?: unknown;
  businessProfileVersion?: unknown;
  refillKey?: unknown;
  requestedCount?: unknown;
  requestKey?: unknown;
  userId?: unknown;
};

export async function POST(request: Request) {
  if (getMissingInternalFinalizationEnvVars().length > 0) {
    return json({ ok: false, error: "Internal job auth is not configured." }, 503);
  }

  const rawBody = await request.text();

  if (!rawBody || Buffer.byteLength(rawBody, "utf8") > MAX_BODY_LENGTH) {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  if (
    !verifyInternalFinalizationRequest({
      body: rawBody,
      signature: request.headers.get(INTERNAL_FINALIZATION_SIGNATURE_HEADER),
      timestamp: request.headers.get(INTERNAL_FINALIZATION_TIMESTAMP_HEADER),
    })
  ) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  const input = parseInput(rawBody);

  if (!input) {
    return json({ ok: false, error: "Invalid Wall-of-text job input." }, 400);
  }

  try {
    const profile = await getBusinessProfileForUser(input.userId);

    if (
      !profile ||
      profile.id !== input.businessProfileId ||
      profile.profileVersion !== input.businessProfileVersion
    ) {
      return json({ ok: false, error: "Business Profile changed." }, 409);
    }

    const ideas = await prepareTrendingWallTextIdeas(profile, {
      mode: input.refillKey ? "refill" : "initial",
      requestedCount: input.requestedCount,
      requestKey: input.requestKey,
    });

    return json({ ideaCount: ideas.length, ok: true });
  } catch (error) {
    if (error instanceof TrendingWallTextPreparationError) {
      return json({ ok: false, error: error.message }, error.status);
    }

    console.error("Background Wall-of-text preparation failed:", error);
    return json({ ok: false, error: "Wall-of-text preparation failed." }, 500);
  }
}

function parseInput(rawBody: string) {
  try {
    const input = JSON.parse(rawBody) as PrepareWallTextInput;
    const businessProfileId = getString(input.businessProfileId);
    const refillKey = getOptionalString(input.refillKey);
    const userId = getString(input.userId);
    const businessProfileVersion = input.businessProfileVersion;
    const requestedCount =
      input.requestedCount === null || input.requestedCount === undefined
        ? 6
        : input.requestedCount;
    const requestKey =
      getString(input.requestKey) ||
      (businessProfileId &&
      typeof businessProfileVersion === "number" &&
      Number.isInteger(businessProfileVersion) &&
      businessProfileVersion > 0
        ? [
            "legacy-wall-job",
            businessProfileId,
            `v${businessProfileVersion}`,
            ...(refillKey ? [`refill-${refillKey}`] : []),
          ].join(":")
        : "");

    return businessProfileId &&
      userId &&
      typeof businessProfileVersion === "number" &&
      Number.isInteger(businessProfileVersion) &&
      businessProfileVersion > 0 &&
      typeof requestedCount === "number" &&
      Number.isInteger(requestedCount) &&
      requestedCount >= 1 &&
      requestedCount <= 50 &&
      requestKey
      ? {
          businessProfileId,
          businessProfileVersion,
          refillKey,
          requestedCount,
          requestKey,
          userId,
        }
      : null;
  } catch {
    return null;
  }
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 200)
    : "";
}

function getOptionalString(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 200)
    : null;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
