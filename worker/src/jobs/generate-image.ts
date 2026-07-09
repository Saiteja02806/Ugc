import { generateOpenAiImageBuffer } from "../lib/openai-image.js";
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
  const imageBuffer = await generateOpenAiImageBuffer(input.prompt);

  const uploaded = await uploadBufferToS3({
    buffer: imageBuffer,
    cacheControl: "public, max-age=31536000, immutable",
    contentType: "image/png",
    key: `image-tests/${input.generationId}.png`,
  });

  return {
    generationId: input.generationId,
    key: uploaded.key,
    ok: true,
    url: uploaded.url,
  };
}
