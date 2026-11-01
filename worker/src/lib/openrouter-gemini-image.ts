import { ProviderRequestNotSubmittedError } from "./generation-provider.js";
import { AI_STUDIO_IMAGE_RATIOS, type AIStudioImageRatio } from "./image-output.js";
import { getRequiredProviderEnv } from "./provider-env.js";
import { harmonizeStartingFrameImage, STARTING_FRAME_HARMONIZER_GRAIN } from "./image-harmonizer.js";

export const OPENROUTER_GEMINI_3_PRO_IMAGE_MODEL = "google/gemini-3-pro-image";
const API_ROOT = "https://openrouter.ai/api/v1";
const MAX_RESPONSE_BYTES = 48 * 1024 * 1024;

export type OpenRouterGeminiImageInput = {
  prompt: string;
  aspectRatio: AIStudioImageRatio;
  referenceImages?: { data: string; mimeType: string }[];
  model?: string;
};

export function buildHookKeyframeStage2Prompt(input: { instructions?: string; supportingImageCount?: number } = {}) {
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
  ].filter(Boolean).join("\n\n");
}

export function buildOpenRouterGeminiImagePayload(input: OpenRouterGeminiImageInput) {
  const prompt = input.prompt.trim();
  if (!prompt || prompt.length > 32_000 || !AI_STUDIO_IMAGE_RATIOS.includes(input.aspectRatio)) {
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
    throw new Error(`OpenRouter image generation failed with HTTP ${response.status}: ${errorText.slice(0, 500)}`);
  }

  const data = (await response.json()) as {
    id?: string;
    model?: string;
    choices?: Array<{
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
    throw new Error("OpenRouter Gemini returned no images in response.");
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
  instructions?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ buffer: Buffer; model: string; requestId?: string }> {
  // Stage 1: Generate clean scene & pose base
  const stage1 = await generateOpenRouterGeminiImage(
    {
      prompt: params.prompt,
      aspectRatio: params.aspectRatio,
      referenceImages: params.referenceImages,
    },
    { apiKey: params.apiKey, fetchImpl: params.fetchImpl },
  );

  let finalBuffer = stage1.buffer;
  let finalModel = stage1.model;
  let finalRequestId = stage1.requestId;

  // Stage 2: Biometric Identity Lock (if influencer identity references are present)
  if (params.referenceImages.length > 1) {
    try {
      const supporting = params.referenceImages.slice(2);
      const stage2Prompt = buildHookKeyframeStage2Prompt({
        instructions: params.instructions,
        supportingImageCount: supporting.length,
      });
      const stage1B64 = stage1.buffer.toString("base64");
      const influencerRef = params.referenceImages[1];

      const stage2 = await generateOpenRouterGeminiImage(
        {
          prompt: stage2Prompt,
          aspectRatio: params.aspectRatio,
          referenceImages: [
            { data: stage1B64, mimeType: "image/png" },
            influencerRef,
            ...supporting,
          ],
        },
        { apiKey: params.apiKey, fetchImpl: params.fetchImpl },
      );

      finalBuffer = stage2.buffer;
      finalModel = stage2.model;
      if (stage2.requestId) finalRequestId = stage2.requestId;
    } catch (stage2Error) {
      console.warn("Stage 2 face lock encountered an issue, gracefully falling back to Stage 1:", stage2Error);
    }
  }

  // Harmonization: Tone balance & organic sensor grain
  try {
    const harmonized = await harmonizeStartingFrameImage(finalBuffer, { grainIntensity: STARTING_FRAME_HARMONIZER_GRAIN });
    finalBuffer = harmonized.buffer;
  } catch (harmError) {
    console.warn("Image harmonization warning, retaining raw buffer:", harmError);
  }

  return {
    buffer: finalBuffer,
    model: finalModel,
    requestId: finalRequestId,
  };
}

/**
 * Direct On-Demand Face Swap via OpenRouter:
 * Takes an existing slide/scene (baseImage) and locks the exact biometric identity
 * of the chosen influencer (influencerImage), followed by organic sensor grain harmonization.
 * Executes in a single fast pass (~8-9 seconds).
 */
export async function performOpenRouterFaceSwap(params: {
  baseImage: { data: string; mimeType: string };
  influencerImage: { data: string; mimeType: string };
  aspectRatio: AIStudioImageRatio;
  instructions?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ buffer: Buffer; model: string; requestId?: string }> {
  const stage2Prompt = buildHookKeyframeStage2Prompt({ instructions: params.instructions });

  const result = await generateOpenRouterGeminiImage(
    {
      prompt: stage2Prompt,
      aspectRatio: params.aspectRatio,
      referenceImages: [params.baseImage, params.influencerImage],
    },
    { apiKey: params.apiKey, fetchImpl: params.fetchImpl },
  );

  let finalBuffer = result.buffer;
  try {
    const harmonized = await harmonizeStartingFrameImage(result.buffer, { grainIntensity: STARTING_FRAME_HARMONIZER_GRAIN });
    finalBuffer = harmonized.buffer;
  } catch (harmError) {
    console.warn("Face swap harmonization warning, retaining raw buffer:", harmError);
  }

  return {
    buffer: finalBuffer,
    model: result.model,
    requestId: result.requestId,
  };
}

