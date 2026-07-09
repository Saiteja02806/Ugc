import { NextResponse } from "next/server";

import {
  getMissingSqsEnvVars,
  getQueueNameForJobType,
  sendJobMessage,
} from "@/lib/aws/sqs";
import {
  attachAwsMessageToBackgroundJob,
  createBackgroundJob,
  getMissingBackgroundJobStorageEnvVars,
  markBackgroundJobFailed,
} from "@/lib/jobs/background-jobs";

const AVATAR_JOB_TYPE = "generate_avatar";

export const runtime = "nodejs";

const defaultInput = {
  persona: "SaaS productivity creator",
  ageRange: "Late 20s",
  hair: "curly dark brown hair",
  expression: "surprised",
  background: "modern home office",
};

function cleanText(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return fallback;
  }

  return trimmed.slice(0, 240);
}

function cleanPathSegment(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleanValue = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return cleanValue || fallback;
}

function getMissingRuntimeEnv() {
  return Array.from(
    new Set([
      ...getMissingBackgroundJobStorageEnvVars(),
      ...getMissingSqsEnvVars([AVATAR_JOB_TYPE]),
    ]),
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          projectId?: unknown;
          input?: Record<string, unknown>;
        }
      | null;
    const rawInput = body?.input ?? {};
    const generationId = crypto.randomUUID();
    const userId = "test-user-001";
    const projectId = cleanPathSegment(body?.projectId, "test-project-001");
    const input = {
      persona: cleanText(rawInput.persona, defaultInput.persona),
      ageRange: cleanText(rawInput.ageRange, defaultInput.ageRange),
      hair: cleanText(rawInput.hair, defaultInput.hair),
      expression: cleanText(rawInput.expression, defaultInput.expression),
      background: cleanText(rawInput.background, defaultInput.background),
    };
    const missingRuntimeEnv = getMissingRuntimeEnv();

    if (missingRuntimeEnv.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `AWS avatar generation is not configured. Add ${missingRuntimeEnv.join(
            ", ",
          )}.`,
        },
        { status: 501 },
      );
    }

    const backgroundJob = await createBackgroundJob({
      input: {
        generationId,
        input,
        projectId,
        userId,
      },
      jobType: AVATAR_JOB_TYPE,
      projectId,
      queueName: getQueueNameForJobType(AVATAR_JOB_TYPE),
      userId,
    });

    try {
      const message = await sendJobMessage({
        jobId: backgroundJob.id,
        jobType: AVATAR_JOB_TYPE,
      });

      await attachAwsMessageToBackgroundJob({
        awsMessageId: message.messageId,
        jobId: backgroundJob.id,
      });
    } catch (error) {
      await markBackgroundJobFailed({
        errorMessage:
          error instanceof Error
            ? error.message
            : "Could not enqueue avatar generation.",
        jobId: backgroundJob.id,
      }).catch((persistenceError) => {
        console.error(
          "Failed to persist avatar enqueue failure:",
          persistenceError,
        );
      });

      throw error;
    }

    return NextResponse.json({
      ok: true,
      message: "Avatar image generation queued in AWS",
      generationId,
      jobId: backgroundJob.id,
    });
  } catch (error) {
    console.error("Failed to queue avatar image job:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to queue avatar image job",
      },
      { status: 500 },
    );
  }
}
