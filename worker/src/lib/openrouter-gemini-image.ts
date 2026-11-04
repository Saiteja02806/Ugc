import { ProviderRequestNotSubmittedError, ProviderImageResponseError } from "./generation-provider.js";
import { startingFrameReferenceInstructions, withStartingFrameReferenceOptions, type StartingFrameReferenceOptions } from "./starting-frame-reference-options.js";
import { AI_STUDIO_IMAGE_RATIOS, assertImageOutputAspectRatio, type AIStudioImageRatio } from "./image-output.js";
import { getRequiredProviderEnv } from "./provider-env.js";
import { harmonizeStartingFrameImage, STARTING_FRAME_HARMONIZER_GRAIN } from "./image-harmonizer.js";

export const OPENROUTER_GEMINI_3_PRO_IMAGE_MODEL = "google/gemini-3-pro-image";
const API_ROOT = "https://openrouter.ai/api/v1";
const MAX_RESPONSE_BYTES = 48 * 1024 * 1024;

export type ImageStageResult = { buffer: Buffer; model: string; requestId?: string };
export type ImageStageRunner = (stage: "scene" | "identity" | "harmonize", input: unknown, action: () => Promise<ImageStageResult>) => Promise<ImageStageResult>;
const directStage: ImageStageRunner = (_stage, _input, action) => action();

const STARTING_FRAME_TEXT_CLEANUP = "STARTING-FRAME TEXT CLEANUP: Return a caption-free photograph. Remove every creator caption, subtitle, hook word, emoji, watermark and graphic overlay, including letter outlines, shadows and fragments. Also remove physical logos, branding and readable text on clothing, props, screens and background surfaces. Reconstruct the actual fabric, skin or scene material beneath the lettering with matching texture and light. Keep the source room, objects, clothing, camera, crop, pose, hands and influencer identity; do not blur, crop, cover text with a box, replace the background, or add replacement lettering. If the input is already clean, keep it clean. This cleanup requirement applies to the final image as well as the scene stage.";

function startingFrameCleanup(outfitPrompt?: string, options?: StartingFrameReferenceOptions) {
  if (options) return STARTING_FRAME_TEXT_CLEANUP.replace("Keep the source room, objects, clothing, camera, crop, pose, hands and influencer identity;",
    options.hairstyle !== undefined
      ? "Preserve the background, outfit and hairstyle selected in USER-SELECTED IMAGE ROLES while reconstructing their surfaces. Keep source camera, crop, pose, hands, props and influencer identity;"
      : "Preserve the background and outfit selected in USER-SELECTED IMAGE ROLES while reconstructing their surfaces. Keep source camera, crop, pose, hands, props and influencer identity;");
  // Keep older accepted jobs' stage inputs byte-for-byte stable.
  return outfitPrompt ? STARTING_FRAME_TEXT_CLEANUP.replace("Keep the source room, objects, clothing, camera, crop, pose, hands and influencer identity;",
    "Preserve the user's explicitly requested outfit while removing its lettering. If no outfit change is requested, keep the source video's outfit. Keep the source room, objects, camera, crop, pose, hands, lighting and influencer identity;") : STARTING_FRAME_TEXT_CLEANUP;
}

function startingFrameOutfitInstructions(prompt?: string) {
  return prompt ? `STARTING-FRAME CUSTOM INSTRUCTIONS:\n${prompt}\n\nOUTFIT PRIORITY: An explicit outfit request in these instructions overrides the default source wardrobe. If requested, use the outfit visible in the influencer reference (Image 2), adapted to the source pose and light. Otherwise retain Image 1's outfit. Identity/reference photos do not override the source room, camera, pose or lighting. Preserve the explicitly selected outfit through identity replacement. Caption and logo removal still applies.` : "";
}

export type OpenRouterGeminiImageInput = {
  prompt: string;
  aspectRatio: AIStudioImageRatio;
  referenceImages?: { data: string; mimeType: string }[];
  model?: string;
  /** Explicit on new character jobs; absent preserves existing callers. */
  imageSize?: "2K";
};

export function buildHookKeyframeStage2Prompt(input: { instructions?: string; supportingImageCount?: number; startingFrameTextCleanup?: boolean; startingFrameOutfitPrompt?: string; referenceOptions?: StartingFrameReferenceOptions } = {}) {
  const instructions = input.instructions?.trim() ?? "";
  const supporting = Math.max(0, Math.floor(input.supportingImageCount ?? 0));
  const supportingLine = supporting === 0
    ? "Image 2 is the only identity photo."
    : supporting === 1
      ? "Image 3 is another photo of the same person as Image 2. Use it only to confirm that person's features from another angle."
      : `Images 3 through ${2 + supporting} are other photos of the same person as Image 2. Use them only to confirm that person's features from other angles.`;
  return [
    "STAGE 2 IDENTITY LOCK:",
    "Image 1 is the scene photograph. Keep its composition, camera, pose, hand placement, jewelry, wardrobe, lighting, background, and any part of the face covered by a hand or object.",
    "Image 2 is the influencer photo. It decides the face.",
    supportingLine,
    "Replace the visible face in Image 1 with the person shown in Image 2. Copy the features that photo actually shows: face shape, eye shape, eye spacing, iris color, brows, nose, lips, jawline, hairline, and natural skin detail. Do not assign a brow color, lip shape, forehead size, freckles, or nose shape that Image 2 does not show.",
    "Relight that face to Image 1 so the face, neck, and hands share the scene light. Keep the identity from Image 2.",
    instructions ? `USER IMAGE INSTRUCTIONS:\n${instructions}` : "",
    input.referenceOptions ? input.startingFrameOutfitPrompt ? `USER CUSTOM INSTRUCTIONS:\n${input.startingFrameOutfitPrompt}` : "" : startingFrameOutfitInstructions(input.startingFrameOutfitPrompt),
    startingFrameReferenceInstructions(input.referenceOptions),
    input.startingFrameTextCleanup ? startingFrameCleanup(input.startingFrameOutfitPrompt, input.referenceOptions) : "",
  ].filter(Boolean).join("\n\n");
}

export function buildOpenRouterGeminiImagePayload(input: OpenRouterGeminiImageInput) {
  const prompt = input.prompt.trim();
  if (!prompt || prompt.length > 32_000 || !AI_STUDIO_IMAGE_RATIOS.includes(input.aspectRatio) || input.imageSize !== undefined && input.imageSize !== "2K") {
    throw new ProviderRequestNotSubmittedError("Gemini Pro requires a prompt of up to 32,000 characters and a supported aspect ratio.");
  }

  const images = input.referenceImages ?? [];
  const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
    { type: "text", text: prompt },
    ...images.map((img) => ({
      type: "image_url" as const,
      image_url: {
        url: img.data.startsWith("data:") ? img.data : `data:${img.mimeType || "image/png"};base64,${img.data}`,
      },
    })),
  ];

  return {
    model: input.model || OPENROUTER_GEMINI_3_PRO_IMAGE_MODEL,
    messages: [
      {
        role: "user",
        content,
      },
    ],
    modalities: ["image"],
    ...(input.imageSize ? { image_config: { aspect_ratio: input.aspectRatio, image_size: input.imageSize } } : {}),
  };
}

export async function generateOpenRouterGeminiImage(
  input: OpenRouterGeminiImageInput,
  options: {
    apiKey?: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<{ buffer: Buffer; model: string; requestId?: string }> {
  const apiKey = getRequiredProviderEnv("OPENROUTER_API_KEY", {
    OPENROUTER_API_KEY: options.apiKey ?? process.env.OPENROUTER_API_KEY,
  });

  const payload = buildOpenRouterGeminiImagePayload(input);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 60_000;

  const response = await fetchImpl(`${API_ROOT}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://ugcpilot.com",
      "X-Title": "Vidmake",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw Object.assign(new Error(`OpenRouter image generation failed with HTTP ${response.status}: ${errorText.slice(0, 500)}`), { status: response.status });
  }

  const data = (await response.json()) as {
    id?: string;
    model?: string;
    choices?: Array<{
      finish_reason?: string;
      message?: {
        images?: Array<{
          image_url?: { url?: string };
          url?: string;
        }>;
      };
    }>;
  };

  const images = data.choices?.[0]?.message?.images;
  if (!images || images.length === 0) {
    const finish = data.choices?.[0]?.finish_reason;
    const finishReason = typeof finish === "string" && /^[a-z_]{1,40}$/.test(finish) ? finish : null;
    const requestId = typeof data.id === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(data.id) ? data.id : null;
    throw new ProviderImageResponseError(["stop", "content_filter", "length", "error"].includes(finishReason ?? ""), finishReason, requestId);
  }

  const rawUrl = images[0].image_url?.url || images[0].url;
  if (!rawUrl) {
    throw new Error("OpenRouter Gemini image URL was empty.");
  }

  const b64Data = rawUrl.replace(/^data:image\/[a-z]+;base64,/, "");
  const buffer = Buffer.from(b64Data, "base64");

  if (buffer.byteLength === 0 || buffer.byteLength > MAX_RESPONSE_BYTES) {
    throw new Error(`Invalid OpenRouter image buffer size: ${buffer.byteLength} bytes.`);
  }

  return {
    buffer,
    model: data.model || payload.model,
    requestId: data.id,
  };
}

/**
 * 2-Stage Hook Keyframe Pipeline via OpenRouter:
 * Stage 1: Full Scene & Pose Base (erasing text banners, preserving room lighting and jewelry).
 * Stage 2: Biometric Face Lock (locking the exact influencer facial biometrics onto the clean scene).
 * Harmonization: CIE LAB face-region luminance match, then 1.2% Gaussian grain.
 */
export async function generateOpenRouterGeminiHookKeyframe(params: {
  prompt: string;
  aspectRatio: AIStudioImageRatio;
  referenceImages: { data: string; mimeType: string }[];
  identityReferenceStartIndex?: number;
  /** New versioned starting-frame jobs only; absent keeps accepted stage inputs stable. */
  imageSize?: "2K";
  /** Frozen on new jobs only; absent preserves historical stage fingerprints. */
  startingFrameTextCleanup?: boolean;
  startingFrameOutfitPrompt?: string;
  referenceOptions?: StartingFrameReferenceOptions;
  runStage?: ImageStageRunner;
  instructions?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ buffer: Buffer; model: string; requestId?: string }> {
  const identityIndex = params.identityReferenceStartIndex ?? 1;
  if (!Number.isInteger(identityIndex) || identityIndex < 1 || !params.referenceImages[identityIndex]) {
    throw new ProviderRequestNotSubmittedError("Choose a verified scene and influencer photo before preparing a starting frame.");
  }
  const run = params.runStage ?? directStage;
  const scenePrompt = [withStartingFrameReferenceOptions(params.prompt, params.referenceOptions),
    params.referenceOptions ? "" : startingFrameOutfitInstructions(params.startingFrameOutfitPrompt),
    params.startingFrameTextCleanup ? startingFrameCleanup(params.startingFrameOutfitPrompt, params.referenceOptions) : ""].filter(Boolean).join("\n\n");
  const sceneInput = { prompt: scenePrompt,
    ...(params.imageSize ? { imageSize: params.imageSize } : {}),
    aspectRatio: params.aspectRatio, referenceImages: params.referenceImages };
  const stage1 = await run("scene", sceneInput, () => generateOpenRouterGeminiImage(sceneInput,
    { apiKey: params.apiKey, fetchImpl: params.fetchImpl }));
  if (params.imageSize) await assertImageOutputAspectRatio(stage1.buffer, params.aspectRatio);
  const stage2Input = {
    ...(params.imageSize ? { imageSize: params.imageSize } : {}),
    prompt: buildHookKeyframeStage2Prompt({ instructions: params.instructions, supportingImageCount: params.referenceImages.length - identityIndex - 1,
      startingFrameTextCleanup: params.startingFrameTextCleanup, startingFrameOutfitPrompt: params.startingFrameOutfitPrompt, referenceOptions: params.referenceOptions }),
    aspectRatio: params.aspectRatio,
    referenceImages: [
      { data: stage1.buffer.toString("base64"), mimeType: "image/png" },
      ...params.referenceImages.slice(identityIndex),
    ],
  };
  const stage2 = await run("identity", stage2Input, () => generateOpenRouterGeminiImage(stage2Input,
    { apiKey: params.apiKey, fetchImpl: params.fetchImpl }));
  if (params.imageSize) await assertImageOutputAspectRatio(stage2.buffer, params.aspectRatio);
  return run("harmonize", { image: stage2.buffer.toString("base64"), grain: STARTING_FRAME_HARMONIZER_GRAIN }, async () => ({
    ...stage2, buffer: (await harmonizeStartingFrameImage(stage2.buffer, { grainIntensity: STARTING_FRAME_HARMONIZER_GRAIN })).buffer,
  }));
}

/**
 * Direct On-Demand Face Swap via OpenRouter:
 * Takes an existing slide/scene (baseImage) and locks the exact biometric identity
 * of the chosen influencer (influencerImage), followed by organic sensor grain harmonization.
 * Executes in a single fast pass (~8-9 seconds).
 */
export async function performOpenRouterFaceSwap(params: {
  runStage?: ImageStageRunner;
  baseImage: { data: string; mimeType: string };
  influencerImage: { data: string; mimeType: string };
  supportingIdentityImages?: { data: string; mimeType: string }[];
  aspectRatio: AIStudioImageRatio;
  instructions?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ buffer: Buffer; model: string; requestId?: string }> {
  const run = params.runStage ?? directStage;
  const stage2Input = {
    prompt: buildHookKeyframeStage2Prompt({ instructions: params.instructions }) + (params.supportingIdentityImages?.length ? "\nImages 3 onward are supporting photographs of the SAME person as Image 2. Use them only to clarify facial identity. Image 2 remains primary. Preserve Image 1 scene, clothing, composition and pose; do not copy supporting-photo backgrounds, outfits or poses." : ""),
    aspectRatio: params.aspectRatio,
    referenceImages: [params.baseImage, params.influencerImage, ...(params.supportingIdentityImages ?? [])],
  };
  const result = await run("identity", stage2Input, () => generateOpenRouterGeminiImage(stage2Input,
    { apiKey: params.apiKey, fetchImpl: params.fetchImpl }));
  return run("harmonize", { image: result.buffer.toString("base64"), grain: STARTING_FRAME_HARMONIZER_GRAIN }, async () => ({
    ...result, buffer: (await harmonizeStartingFrameImage(result.buffer, { grainIntensity: STARTING_FRAME_HARMONIZER_GRAIN })).buffer,
  }));
}
