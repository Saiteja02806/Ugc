import { generateOpenAiImageBuffer } from "../lib/openai-image.js";
import {
  AI_STUDIO_IMAGE_HEIGHT,
  AI_STUDIO_IMAGE_RATIO,
  AI_STUDIO_IMAGE_WIDTH,
  prepareAIStudioImageOutput,
} from "../lib/image-output.js";
import { uploadBufferToS3 } from "../lib/s3.js";
import type { BackgroundJobRow } from "../types.js";
import type { WorkerJobOutput } from "./index.js";

const MAX_PROMPT_LENGTH = 2_000;
type GenerateImageInput = {
  generationId: string;
  prompt: string;
};

function getInput(job: BackgroundJobRow): GenerateImageInput {
  if (!job.input_json || typeof job.input_json !== "object" || Array.isArray(job.input_json)) {
    throw new Error("generate_image input_json must be an object.");
  }

  const generationId = job.input_json.generationId;
  const prompt = job.input_json.prompt;

  if (typeof generationId !== "string" || !generationId.trim()) {
    throw new Error("generate_image requires input.generationId.");
  }

  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("generate_image requires input.prompt.");
  }

  if (prompt.trim().length > MAX_PROMPT_LENGTH) {
    throw new Error(`generate_image prompt exceeds ${MAX_PROMPT_LENGTH} characters.`);
  }

  return {
    generationId: generationId.trim(),
    prompt: prompt.trim(),
  };
}

export async function runGenerateImageJob(
  job: BackgroundJobRow,
): Promise<WorkerJobOutput> {
  const input = getInput(job);
  const userId = getPathSegment(job.user_id, "user");
  const projectId = getPathSegment(job.project_id, "default");
  const generatedImageBuffer = await generateOpenAiImageBuffer(input.prompt);
  const imageBuffer = await prepareAIStudioImageOutput(generatedImageBuffer);

  const uploaded = await uploadBufferToS3({
    buffer: imageBuffer,
    cacheControl: "public, max-age=31536000, immutable",
    contentType: "image/png",
    key: `images/generated/${userId}/${projectId}/${input.generationId}.png`,
  });

  return {
    generationId: input.generationId,
    height: AI_STUDIO_IMAGE_HEIGHT,
    key: uploaded.key,
    ok: true,
    ratio: AI_STUDIO_IMAGE_RATIO,
    url: uploaded.url,
    width: AI_STUDIO_IMAGE_WIDTH,
  };
}

function getPathSegment(value: string | null, fallback: string) {
  return value
    ?.trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || fallback;
}
