import { NextResponse } from "next/server";

import {
  BusinessProfileSetupInputSchema,
  processBusinessProfileSetupJob,
} from "@/lib/business-profiles/setup";
import { getBackgroundJobById, type Json } from "@/lib/jobs/background-jobs";
import {
  INTERNAL_FINALIZATION_SIGNATURE_HEADER,
  INTERNAL_FINALIZATION_TIMESTAMP_HEADER,
} from "@/lib/scheduling/finalization-signature";
import {
  getMissingInternalFinalizationEnvVars,
  verifyInternalFinalizationRequest,
} from "@/lib/scheduling/internal-finalization-auth";
import { WebsiteAnalysisError } from "@/lib/website-analysis/errors";
import { processWebsiteAnalysisJob } from "@/lib/website-analysis/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_LENGTH = 2_048;

export async function POST(request: Request) {
  if (getMissingInternalFinalizationEnvVars().length > 0) {
    return json({ error: "Internal job auth is not configured.", ok: false }, 503);
  }

  const rawBody = await request.text();

  if (!rawBody || Buffer.byteLength(rawBody, "utf8") > MAX_BODY_LENGTH) {
    return json({ error: "Invalid request body.", ok: false }, 400);
  }

  if (
    !verifyInternalFinalizationRequest({
      body: rawBody,
      signature: request.headers.get(INTERNAL_FINALIZATION_SIGNATURE_HEADER),
      timestamp: request.headers.get(INTERNAL_FINALIZATION_TIMESTAMP_HEADER),
    })
  ) {
    return json({ error: "Unauthorized.", ok: false }, 401);
  }

  const jobId = parseJobId(rawBody);

  if (!jobId) {
    return json({ error: "Invalid media analysis job input.", ok: false }, 400);
  }

  try {
    const job = await getBackgroundJobById(jobId);

    if (
      !job ||
      job.jobType !== "media_analysis" ||
      !job.userId ||
      !["processing", "waiting_external_service"].includes(job.status)
    ) {
      return json({ error: "Media analysis job is not executable.", ok: false }, 409);
    }

    const input = getRecord(job.input);
    const operation = getString(input?.operation);
    const inputUserId = getString(input?.userId);

    if (!input || inputUserId !== job.userId) {
      return json({ error: "Media analysis job ownership does not match.", ok: false }, 409);
    }

    if (operation === "business_profile_setup") {
      const parsed = BusinessProfileSetupInputSchema.safeParse(input);

      if (!parsed.success) {
        return json({ error: "Business profile job input is invalid.", ok: false }, 400);
      }

      const result = await processBusinessProfileSetupJob({
        input: parsed.data,
        jobId: job.id,
        userId: job.userId,
      });

      return json({ ...result, ok: true });
    }

    if (operation === "website_analysis") {
      const projectId = getString(input.projectId);
      const websiteUrl = getString(input.websiteUrl);

      if (!projectId || !websiteUrl) {
        return json({ error: "Website analysis job input is invalid.", ok: false }, 400);
      }

      const result = await processWebsiteAnalysisJob({
        jobId: job.id,
        projectId,
        userId: job.userId,
        websiteUrl,
      });

      return json({ ...result, operation, ok: true });
    }

    return json({ error: "Unsupported media analysis operation.", ok: false }, 400);
  } catch (error) {
    const status = error instanceof WebsiteAnalysisError ? error.status : 500;

    console.error("Background media analysis failed:", error);
    return json(
      {
        error:
          error instanceof WebsiteAnalysisError
            ? error.message
            : "Media analysis failed.",
        ok: false,
      },
      status,
    );
  }
}

function parseJobId(rawBody: string) {
  try {
    const value = JSON.parse(rawBody) as { jobId?: unknown };

    return getString(value.jobId);
  } catch {
    return "";
  }
}

function getRecord(value: Json | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function getString(value: Json | unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
