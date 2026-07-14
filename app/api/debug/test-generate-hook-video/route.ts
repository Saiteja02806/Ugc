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
import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";

const HOOK_VIDEO_JOB_TYPE = "generate_hook_video";

export const runtime = "nodejs";

const defaultHookInput = {
  cameraStyle: "iphone_selfie",
  emotion: "surprised",
  hookIdea: "I did not expect this app to save me this much time.",
  productDescription: "A useful digital product for busy creators.",
  productName: "UGC product",
};

const providerOptions = new Set(["veo", "runway"]);
const emotionOptions = new Set([
  "surprised",
  "excited",
  "curious",
  "skeptical",
  "confident",
]);
const cameraStyleOptions = new Set([
  "iphone_selfie",
  "tiktok_ugc",
  "home_office",
  "desk_setup",
]);

function cleanText(value: unknown, fallback: string, maxLength = 500) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

function cleanOptionalText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function cleanChoice<T extends string>(
  value: unknown,
  options: Set<string>,
  fallback: T,
) {
  return typeof value === "string" && options.has(value) ? (value as T) : fallback;
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

function cleanHttpsUrl(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  try {
    const url = new URL(trimmed);

    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function getMissingRuntimeEnv() {
  return Array.from(
    new Set([
      ...getMissingBackgroundJobStorageEnvVars(),
      ...getMissingSqsEnvVars([HOOK_VIDEO_JOB_TYPE]),
    ]),
  );
}

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const body = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    const videoId = crypto.randomUUID();
    const userId = user.uid;
    const projectId = cleanPathSegment(body?.projectId, "test-project-001");
    const provider = cleanChoice(body?.provider, providerOptions, "veo");
    const missingRuntimeEnv = getMissingRuntimeEnv();

    if (missingRuntimeEnv.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `AWS hook video generation is not configured. Add ${missingRuntimeEnv.join(
            ", ",
          )}.`,
        },
        { status: 501 },
      );
    }

    const backgroundJob = await createBackgroundJob({
      input: {
        avatarImageUrl: cleanHttpsUrl(body?.avatarImageUrl),
        cameraStyle: cleanChoice(
          body?.cameraStyle,
          cameraStyleOptions,
          defaultHookInput.cameraStyle,
        ),
        emotion: cleanChoice(
          body?.emotion,
          emotionOptions,
          defaultHookInput.emotion,
        ),
        hookIdea: cleanText(body?.hookIdea, defaultHookInput.hookIdea, 1_000),
        productDescription:
          cleanOptionalText(body?.productDescription, 500) ??
          defaultHookInput.productDescription,
        productName:
          cleanOptionalText(body?.productName, 120) ??
          defaultHookInput.productName,
        projectId,
        provider,
        userId,
        videoId,
      },
      jobType: HOOK_VIDEO_JOB_TYPE,
      projectId,
      queueName: getQueueNameForJobType(HOOK_VIDEO_JOB_TYPE),
      userId,
    });

    try {
      const message = await sendJobMessage({
        jobId: backgroundJob.id,
        jobType: HOOK_VIDEO_JOB_TYPE,
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
            : "Could not enqueue hook video generation.",
        jobId: backgroundJob.id,
      }).catch((persistenceError) => {
        console.error(
          "Failed to persist hook video enqueue failure:",
          persistenceError,
        );
      });

      throw error;
    }

    return NextResponse.json({
      ok: true,
      message: "Hook video generation queued in AWS",
      jobId: backgroundJob.id,
      videoId,
    });
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    console.error("Failed to queue hook video job:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to queue hook video job",
      },
      { status: 500 },
    );
  }
}
