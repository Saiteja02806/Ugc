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
  type BackgroundJobType,
} from "@/lib/jobs/background-jobs";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";

const allowedJobTypes = new Set<BackgroundJobType>(["test_worker_job"]);
const MAX_TEST_MESSAGE_LENGTH = 500;

type EnqueueJobBody = {
  input?: {
    message?: unknown;
  };
  jobType?: unknown;
  projectId?: unknown;
};

async function readBody(request: Request) {
  try {
    return (await request.json()) as EnqueueJobBody;
  } catch {
    return null;
  }
}

function getString(value: unknown, maxLength = 120) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function getJobType(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  return allowedJobTypes.has(value as BackgroundJobType)
    ? (value as BackgroundJobType)
    : null;
}

function getTestWorkerJobInput(input: EnqueueJobBody["input"]) {
  const message = getString(input?.message, MAX_TEST_MESSAGE_LENGTH);

  return {
    message: message || "hello from app",
  };
}

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function getAuthErrorResponse(error: FirebaseAuthRequestError) {
  return jsonResponse(
    {
      ok: false,
      error:
        error.status === 401
          ? "Sign in before queueing a worker job."
          : error.message,
    },
    error.status,
  );
}

export async function POST(request: Request) {
  let user;

  try {
    user = await requireFirebaseUser(request);
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return getAuthErrorResponse(error);
    }

    console.error("Failed to verify job enqueue requester:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not verify your sign-in session.",
      },
      500,
    );
  }

  const body = await readBody(request);

  if (!body) {
    return jsonResponse(
      {
        ok: false,
        error: "Send job details as JSON.",
      },
      400,
    );
  }

  const jobType = getJobType(body.jobType);

  if (!jobType) {
    return jsonResponse(
      {
        ok: false,
        error: "Only test_worker_job can be queued in this slice.",
      },
      400,
    );
  }

  const missingRuntimeEnv = Array.from(
    new Set([
      ...getMissingBackgroundJobStorageEnvVars(),
      ...getMissingSqsEnvVars([jobType]),
    ]),
  );

  if (missingRuntimeEnv.length > 0) {
    return jsonResponse(
      {
        ok: false,
        error: `Worker enqueue is not configured. Add ${missingRuntimeEnv.join(
          ", ",
        )}.`,
      },
      501,
    );
  }

  const queueName = getQueueNameForJobType(jobType);
  const input = getTestWorkerJobInput(body.input);
  const projectId = getString(body.projectId) || null;
  const job = await createBackgroundJob({
    input,
    jobType,
    projectId,
    queueName,
    userId: user.uid,
  });

  try {
    const message = await sendJobMessage({
      jobId: job.id,
      jobType,
    });
    const updatedJob = await attachAwsMessageToBackgroundJob({
      awsMessageId: message.messageId,
      jobId: job.id,
    });

    return jsonResponse({
      ok: true,
      job: {
        id: updatedJob.id,
        jobType: updatedJob.jobType,
        queueName: updatedJob.queueName,
        status: updatedJob.status,
      },
    });
  } catch (error) {
    console.error("Failed to enqueue worker job:", error);

    try {
      await markBackgroundJobFailed({
        errorMessage:
          error instanceof Error
            ? error.message
            : "Failed to send queue message.",
        jobId: job.id,
      });
    } catch (persistenceError) {
      console.error("Failed to persist worker enqueue failure:", persistenceError);
    }

    return jsonResponse(
      {
        ok: false,
        error: "Could not send the worker job to the queue.",
        jobId: job.id,
      },
      502,
    );
  }
}
