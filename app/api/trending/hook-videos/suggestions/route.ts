import { randomUUID } from "node:crypto";

import { getBusinessProfileForUser } from "@/lib/business-profiles/db";
import { getPublicBackgroundJob } from "@/lib/jobs/background-job-contract";
import { getMissingBackgroundJobStorageEnvVars } from "@/lib/jobs/background-jobs";
import { getMissingBackgroundJobCloudTasksEnvVars } from "@/lib/jobs/gcp-cloud-tasks";
import {
  authenticateHookVideoRequest,
  hookVideoErrorResponse,
  hookVideoJson,
} from "@/lib/trending/hook-video-api";
import { enqueueHookSuggestionJob } from "@/lib/trending/hook-suggestion-jobs";
import { HookSuggestionRequestSchema } from "@/lib/trending/hook-video-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await authenticateHookVideoRequest(request);

  if (!auth.ok) {
    return auth.response;
  }

  const parsed = HookSuggestionRequestSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return hookVideoJson(
      { error: "Choose an influencer video and product demo first.", ok: false },
      400,
    );
  }

  try {
    const profile = await getBusinessProfileForUser(auth.user.uid);

    if (!profile) {
      return hookVideoJson(
        {
          code: "business_profile_required",
          error: "Complete your business profile before generating hooks.",
          ok: false,
        },
        409,
      );
    }

    const missing = Array.from(
      new Set([
        ...getMissingBackgroundJobStorageEnvVars(),
        ...getMissingBackgroundJobCloudTasksEnvVars(["hook_text_generation"]),
      ]),
    );

    if (missing.length > 0) {
      return hookVideoJson(
        {
          error: `Hook generation jobs are not configured. Add ${missing.join(", ")}.`,
          ok: false,
        },
        501,
      );
    }

    const idempotencyKey =
      request.headers.get("Idempotency-Key")?.trim().slice(0, 200) ||
      randomUUID();
    const job = await enqueueHookSuggestionJob({
      idempotencyKey,
      input: parsed.data,
      userId: auth.user.uid,
    });

    return hookVideoJson(
      {
        job: getPublicBackgroundJob(job),
        jobId: job.id,
        ok: true,
      },
      job.status === "completed" ? 200 : 202,
    );
  } catch (error) {
    console.error("Could not queue Hook suggestions:", error);
    return hookVideoErrorResponse(error, "Could not start Hook generation.");
  }
}
