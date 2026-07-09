import { buildAvatarPrompt, type AvatarPromptInput } from "../lib/avatar-prompt.js";
import { generateOpenAiImageBuffer } from "../lib/openai-image.js";
import { uploadBufferToS3 } from "../lib/s3.js";
import type { BackgroundJobRow, Json } from "../types.js";
import type { WorkerJobOutput } from "./index.js";

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
): Promise<WorkerJobOutput> {
  const input = getInput(job);
  const imageBuffer = await generateOpenAiImageBuffer(
    buildAvatarPrompt(input.input),
  );
  const uploaded = await uploadBufferToS3({
    buffer: imageBuffer,
    cacheControl: "public, max-age=31536000, immutable",
    contentType: "image/png",
    key: `avatars/base/${input.userId}/${input.projectId}/${input.generationId}.png`,
  });

  return {
    generationId: input.generationId,
    key: uploaded.key,
    ok: true,
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
