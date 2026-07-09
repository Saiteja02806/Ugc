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

type GenerateRequest = {
  prompt?: unknown;
};

const MAX_PROMPT_LENGTH = 2_000;
const IMAGE_JOB_TYPE = "generate_image";

export const runtime = "nodejs";

function cleanPrompt(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, MAX_PROMPT_LENGTH) : "";
}

function getMissingRuntimeEnv() {
  return Array.from(
    new Set([
      ...getMissingBackgroundJobStorageEnvVars(),
      ...getMissingSqsEnvVars([IMAGE_JOB_TYPE]),
    ]),
  );
}

export async function POST(request: Request) {
  let body: GenerateRequest;

  try {
    body = (await request.json()) as GenerateRequest;
  } catch {
    return Response.json(
      {
        ok: false,
        message: "Send a prompt before testing OpenAI image generation.",
      },
      { status: 400 },
    );
  }

  const prompt = cleanPrompt(body.prompt);

  if (!prompt) {
    return Response.json(
      {
        ok: false,
        message: "Add a prompt before generating an image.",
      },
      { status: 400 },
    );
  }

  const missingRuntimeEnv = getMissingRuntimeEnv();

  if (missingRuntimeEnv.length > 0) {
    return Response.json(
      {
        ok: false,
        message: `AWS image generation is not configured. Add ${missingRuntimeEnv.join(
          ", ",
        )} in .env.local and restart Next.js.`,
      },
      { status: 501 },
    );
  }

  try {
    const generationId = crypto.randomUUID();
    const backgroundJob = await createBackgroundJob({
      input: {
        generationId,
        prompt,
      },
      jobType: IMAGE_JOB_TYPE,
      queueName: getQueueNameForJobType(IMAGE_JOB_TYPE),
    });

    try {
      const message = await sendJobMessage({
        jobId: backgroundJob.id,
        jobType: IMAGE_JOB_TYPE,
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
            : "Could not enqueue image generation.",
        jobId: backgroundJob.id,
      }).catch((persistenceError) => {
        console.error(
          "Failed to persist image generation enqueue failure:",
          persistenceError,
        );
      });

      throw error;
    }

    return Response.json({
      ok: true,
      message: "AWS image generation started.",
      generationId,
      jobId: backgroundJob.id,
    });
  } catch (error) {
    console.error("Failed to start image test generation:", error);

    return Response.json(
      {
        ok: false,
        message:
          "Could not queue the OpenAI image generation worker.",
      },
      { status: 502 },
    );
  }
}
