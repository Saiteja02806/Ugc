import { buildAvatarPrompt, type AvatarPromptInput } from "../lib/avatar-prompt.js";
import {
  createGenerationRequestFingerprint,
  persistProviderSubmissionFailure,
  ProviderSubmissionUncertainError,
} from "../lib/generation-provider.js";
import { generateOpenAiImageBuffer } from "../lib/openai-image.js";
import { getStoredObject, uploadBufferToStorage } from "../lib/storage.js";
import type { BackgroundJobRow, Json } from "../types.js";
import type { WorkerJobContext, WorkerJobOutput } from "./index.js";

const MAX_INPUT_LENGTH = 240;

type GenerateAvatarInput = {
  generationId: string;
  input: AvatarPromptInput;
  projectId: string;
  userId: string;
};

function getInput(job: BackgroundJobRow): GenerateAvatarInput {
  if (!isJsonObject(job.input_json)) {
    throw new Error("generate_avatar input_json must be an object.");
  }

  const avatarInput = job.input_json.input;

  if (!isJsonObject(avatarInput)) {
    throw new Error("generate_avatar requires input.input.");
  }

  return {
    generationId: getPathSegment(job.input_json.generationId, "generationId"),
    input: {
      ageRange: getText(avatarInput.ageRange, "ageRange"),
      background: getText(avatarInput.background, "background"),
      expression: getText(avatarInput.expression, "expression"),
      hair: getText(avatarInput.hair, "hair"),
      persona: getText(avatarInput.persona, "persona"),
    },
    projectId: getPathSegment(job.input_json.projectId, "projectId"),
    userId: getPathSegment(job.input_json.userId, "userId"),
  };
}

export async function runGenerateAvatarJob(
  job: BackgroundJobRow,
  context: WorkerJobContext,
): Promise<WorkerJobOutput> {
  const input = getInput(job);
  const outputKey = `avatars/base/${input.userId}/${input.projectId}/${input.generationId}.png`;
  const existingOutput = await getStoredObject(outputKey);

  if (existingOutput) {
    return buildOutput(input.generationId, existingOutput);
  }

  await context.checkpoint({
    stage: "waiting_for_avatar_provider",
    status: "waiting_external_service",
  });
  const prompt = buildAvatarPrompt(input.input);
  const operationKey = "openai-avatar";
  const requestFingerprint = createGenerationRequestFingerprint({
    generationId: input.generationId,
    outputKey,
    prompt,
  });
  const reservation = await context.store.reserveGenerationProviderOperation({
    jobId: job.id,
    operationKey,
    provider: "openai",
    requestFingerprint,
  });

  if (!reservation.shouldSubmit) {
    throw new ProviderSubmissionUncertainError();
  }

  let generated;

  try {
    generated = await generateOpenAiImageBuffer(prompt);
  } catch (error) {
    return persistProviderSubmissionFailure({
      error,
      jobId: job.id,
      operationKey,
      store: context.store,
    });
  }

  await context.store.markGenerationProviderSucceeded({
    jobId: job.id,
    metadata: { model: generated.model },
    operationKey,
    providerOperationId: generated.requestId ?? undefined,
  });
  await context.checkpoint({
    progress: 90,
    stage: "uploading_avatar",
    status: "uploading_output",
  });
  const uploaded = await uploadBufferToStorage({
    buffer: generated.buffer,
    cacheControl: "public, max-age=31536000, immutable",
    contentType: "image/png",
    key: outputKey,
  });

  await context.store.markGenerationOutputPersisted({
    jobId: job.id,
    metadata: { model: generated.model },
    operationKey,
    outputReference: uploaded.key,
    outputUrl: uploaded.url,
  });

  return buildOutput(input.generationId, uploaded);
}

function buildOutput(
  generationId: string,
  uploaded: { key: string; url: string },
) {
  return {
    generationId,
    key: uploaded.key,
    ok: true,
    provider: "openai",
    url: uploaded.url,
  };
}

function isJsonObject(value: Json | undefined): value is Record<string, Json | undefined> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getText(value: Json | undefined, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`generate_avatar requires input.input.${fieldName}.`);
  }

  return value.trim().slice(0, MAX_INPUT_LENGTH);
}

function getPathSegment(value: Json | undefined, fieldName: string) {
  if (typeof value !== "string") {
    throw new Error(`generate_avatar requires input.${fieldName}.`);
  }

  const cleanValue = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  if (!cleanValue) {
    throw new Error(`generate_avatar requires input.${fieldName}.`);
  }

  return cleanValue;
}
