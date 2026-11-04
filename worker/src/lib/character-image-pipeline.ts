import sharp from "sharp";
import { createHash } from "node:crypto";
import hairMasks from "./character-hair-masks.json" with { type: "json" };
import { generateOpenRouterGeminiImage, type ImageStageRunner } from "./openrouter-gemini-image.js";
import { harmonizeStartingFrameImage, STARTING_FRAME_HARMONIZER_GRAIN } from "./image-harmonizer.js";
import { assertImageOutputAspectRatio, type AIStudioImageRatio } from "./image-output.js";
import { createGenerationRequestFingerprint, ProviderRequestNotSubmittedError } from "./generation-provider.js";

type TraitReference = { index: number; role: "hairstyle" | "accessory" };
export type CharacterIdentityPipeline = { identityReferenceIndex: 0; instructions: string; negativePrompt: string } &
  ({ version: 1 } | { version: 4 } | { version: 2; traitReferences: TraitReference[] } |
    { version: 3; referenceProcessingVersion: 1; traitReferences: (TraitReference & { traitId: string })[] });

export function parseCharacterIdentityPipeline(value: unknown): CharacterIdentityPipeline {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ProviderRequestNotSubmittedError("Invalid character identity pipeline.");
  const input = value as Record<string, unknown>;
  if (![1, 2, 3, 4].includes(input.version as number) || input.identityReferenceIndex !== 0 || typeof input.instructions !== "string" ||
      !input.instructions.trim() || input.instructions.length > 8_000 || typeof input.negativePrompt !== "string" || input.negativePrompt.length > 8_000) {
    throw new ProviderRequestNotSubmittedError("Invalid character identity pipeline.");
  }
  if (input.version === 4 && (Object.hasOwn(input, "traitReferences") || Object.hasOwn(input, "referenceProcessingVersion"))) {
    throw new ProviderRequestNotSubmittedError("Character stage 2 accepts only the scene and primary identity images.");
  }
  if (input.version === 2 || input.version === 3) {
    const refs = input.traitReferences;
    if (!Array.isArray(refs) || refs.length > 9 || refs.some(ref => !ref ||
        !Number.isInteger(ref.index) || ref.index < 1 || ref.index > 9 ||
        (ref.role !== "hairstyle" && ref.role !== "accessory")) ||
        new Set(refs.map(ref => ref.index)).size !== refs.length ||
        refs.filter(ref => ref.role === "hairstyle").length > 1) {
      throw new ProviderRequestNotSubmittedError("Invalid character trait references.");
    }
    if (input.version === 3 && (input.referenceProcessingVersion !== 1 || refs.some(ref =>
      typeof ref.traitId !== "string" || !/^[a-z0-9_]{1,96}$/.test(ref.traitId) ||
      ref.role === "hairstyle" && !Object.hasOwn(hairMasks.traits, ref.traitId)))) {
      throw new ProviderRequestNotSubmittedError("Choose a reviewed character trait reference.");
    }
  }
  return input as CharacterIdentityPipeline;
}

export function buildCharacterIdentityStagePrompt(pipeline: CharacterIdentityPipeline, legacyHairCrop = false) {
  if (pipeline.version === 4) return [
    "CHARACTER STAGE 2: PRIMARY FACIAL IDENTITY.",
    "Exactly two images are supplied. Image 1 is the stage 1 scene. Preserve its background, camera, framing, body, pose, hands, clothing, hairstyle, hair color, selected accessories and lighting. Keep both feet when visible. Do not copy Image 2's hair, outfit, accessories or background.",
    "Image 2 is the ONLY facial identity authority. Correct the visible face in Image 1 to this person, preserving their distinctive facial geometry, brows, nose, lips, jaw and facial hair. Do not average the two faces or beautify the primary person. Adapt the primary face to Image 1's head pose, expression, light and existing occlusions.",
    pipeline.instructions,
    "Change only the visible facial region and explicitly selected facial overrides. Keep scene hairstyle and selected objects intact, including any hand or accessory overlapping the face. Return one photograph with the same composition and aspect ratio.",
    pipeline.negativePrompt ? `Negative constraints: Avoid ${pipeline.negativePrompt}.` : "",
  ].filter(Boolean).join("\n\n");
  return [
    "CHARACTER STAGE 2: PRIMARY FACIAL IDENTITY.",
    pipeline.version === 1
      ? "Image 1 is the generated scene. Keep its background, camera, framing, body, pose, clothing, hair and lighting. Keep both feet visible when present. Change only the face to the person in Image 2, adapted to the scene pose and light."
      : "Image 1 supplies background, camera, framing, body, pose, clothing and lighting. Preserve these and both feet when visible. Correct the face, selected hairstyle and accessories as instructed below, even when Image 1 is wrong. Selected eye and hair colors override reference colors.",
    "Image 2 is the ONLY facial identity authority. Preserve its distinctive facial geometry and facial hair, including the moustache. Do not beautify, replace or average that person. Do not copy its background, outfit or accessories.",
    ...(pipeline.version !== 1 ? pipeline.traitReferences.map((ref, i) =>
      `Image ${i + 3} supplies ONLY the selected ${ref.role}. ${ref.role === "hairstyle" ? "Match haircut length, silhouette, strand texture and fringe; apply the selected hair color." + (pipeline.version === 3 ? " Ignore neutral isolation patches and all non-hair content. Never transfer this person's facial identity." : legacyHairCrop ? " This reference shows hair only; do not generate any face or facial features from it." : "") : "Apply the selected accessory's shape, material and placement."} Ignore this reference person's face, facial hair, skin, eyes, clothing and background; never blend their identity with Image 2.`) : []),
    pipeline.version === 3 ? "Neutral patches are reference-isolation aids, never subject appearance. Reconstruct the face in Image 1 from Image 2 and do not reproduce any patch." : "",
    pipeline.instructions,
    "Relight the face to the scene while preserving skin detail. Return one photograph with the same composition and aspect ratio.",
    pipeline.negativePrompt ? `Negative constraints: Avoid ${pipeline.negativePrompt}.` : "",
  ].filter(Boolean).join("\n\n");
}

export async function suppressCharacterReferenceFace(buffer: Buffer, ellipse: readonly number[]) {
  if (ellipse.length !== 5 || ellipse.some(value => !Number.isFinite(value) || value < 0 || value > 1) || ellipse[2] === 0 || ellipse[3] === 0) {
    throw new ProviderRequestNotSubmittedError("Invalid reviewed face-isolation region.");
  }
  const { width, height } = await sharp(buffer, { limitInputPixels: 25_000_000 }).metadata();
  if (!width || !height) throw new ProviderRequestNotSubmittedError("The selected reference image is unreadable.");
  const [cx, cy, rx, ry, top] = ellipse;
  const overlay = Buffer.from(`<svg width="${width}" height="${height}"><defs><clipPath id="face"><rect x="0" y="${top * height}" width="${width}" height="${height}"/></clipPath></defs><ellipse clip-path="url(#face)" cx="${cx * width}" cy="${cy * height}" rx="${rx * width}" ry="${ry * height}" fill="#808080"/></svg>`);
  return sharp(buffer).composite([{ input: overlay }]).png().toBuffer();
}

/** Reviewed, hash-bound face suppression; retains the complete reference frame and long hair. */
export async function prepareReviewedCharacterHair(image: { data: string; mimeType: string }, traitId: string) {
  const entry = (hairMasks.traits as Record<string, { preparedSha256: string; ellipse: number[] }>)[traitId];
  if (!entry || !Object.hasOwn(hairMasks.traits, traitId)) throw new ProviderRequestNotSubmittedError("This hairstyle has no reviewed identity-isolation region.");
  const buffer = Buffer.from(image.data.replace(/^data:image\/[a-z]+;base64,/, ""), "base64");
  if (createHash("sha256").update(buffer).digest("hex") !== entry.preparedSha256) {
    throw new ProviderRequestNotSubmittedError("The hairstyle image does not match its reviewed isolation region.");
  }
  const prepared = await suppressCharacterReferenceFace(buffer, entry.ellipse);
  return { data: prepared.toString("base64"), mimeType: "image/png" };
}

export async function buildCharacterIdentityStageInput(params: {
  scene: Buffer; aspectRatio: AIStudioImageRatio; referenceImages: { data: string; mimeType: string }[];
  pipeline: CharacterIdentityPipeline; legacyIdentityFingerprint?: string;
}) {
  if (!params.referenceImages[0]) throw new ProviderRequestNotSubmittedError("A primary character face is required.");
  const make = (traits: { data: string; mimeType: string }[], legacyCrop = false) => ({
    prompt: buildCharacterIdentityStagePrompt(params.pipeline, legacyCrop), aspectRatio: params.aspectRatio, imageSize: "2K" as const,
    referenceImages: [{ data: params.scene.toString("base64"), mimeType: "image/png" }, params.referenceImages[0], ...traits],
  });
  const refs = params.pipeline.version === 2 || params.pipeline.version === 3 ? params.pipeline.traitReferences : [];
  const images = refs.map(ref => {
    const image = params.referenceImages[ref.index];
    if (!image) throw new ProviderRequestNotSubmittedError("Missing selected character trait reference.");
    return image;
  });
  if (params.pipeline.version === 3) {
    const reviewed = await Promise.all(params.pipeline.traitReferences.map((ref, i) => ref.role === "hairstyle"
      ? prepareReviewedCharacterHair(images[i], ref.traitId) : images[i]));
    return make(reviewed);
  }
  const original = make(images);
  if (params.pipeline.version !== 2 || !params.legacyIdentityFingerprint) return original;
  const matches = (input: typeof original) => createGenerationRequestFingerprint({ version: 1, stage: "identity", input }) === params.legacyIdentityFingerprint;
  if (matches(original)) return original;
  // A historical unversioned edit briefly changed v2. Recover only a receipt-exact candidate.
  const cropped = make(await Promise.all(refs.map((ref, i) => prepareStage2TraitImage(images[i], ref.role))), true);
  if (matches(cropped)) return cropped;
  throw new ProviderRequestNotSubmittedError("The saved character identity stage cannot be reconstructed. No generation was resubmitted.");
}

/** Historical unversioned v2 crop only. New jobs use reviewed, failure-explicit isolation. */
export async function prepareStage2TraitImage(image: { data: string; mimeType: string }, role: "hairstyle" | "accessory") {
  if (role !== "hairstyle") return image;
  try {
    const buffer = Buffer.from(image.data, "base64");
    const meta = await sharp(buffer).metadata();
    if (!meta.width || !meta.height) return image;
    // Crop the top 35% of the portrait where only hair is present, removing facial features (eyes, nose, mouth)
    const hairHeight = Math.max(1, Math.round(meta.height * 0.35));
    const croppedBuffer = await sharp(buffer)
      .extract({ left: 0, top: 0, width: meta.width, height: hairHeight })
      .toBuffer();
    return { data: croppedBuffer.toString("base64"), mimeType: image.mimeType };
  } catch {
    return image;
  }
}

export async function generateCharacterIdentityImage(params: {
  prompt: string; aspectRatio: AIStudioImageRatio;
  referenceImages: { data: string; mimeType: string }[];
  pipeline: CharacterIdentityPipeline; runStage: ImageStageRunner; legacyIdentityFingerprint?: string;
}) {
  if (!params.referenceImages[0]) throw new ProviderRequestNotSubmittedError("A primary character face is required.");
  const pipeline = parseCharacterIdentityPipeline(params.pipeline);
  // Validate/prepare every trait before starting either paid stage.
  await buildCharacterIdentityStageInput({ ...params, pipeline, scene: Buffer.alloc(0), legacyIdentityFingerprint: undefined });
  const sceneInput = { prompt: params.prompt, aspectRatio: params.aspectRatio, imageSize: "2K" as const, referenceImages: params.referenceImages };
  const scene = await params.runStage("scene", sceneInput, () => generateOpenRouterGeminiImage(sceneInput, { timeoutMs: 120_000 }));
  await assertImageOutputAspectRatio(scene.buffer, params.aspectRatio);
  const identityInput = await buildCharacterIdentityStageInput({ ...params, pipeline, scene: scene.buffer });
  const identity = await params.runStage("identity", identityInput, () => generateOpenRouterGeminiImage(identityInput, { timeoutMs: 120_000 }));
  await assertImageOutputAspectRatio(identity.buffer, params.aspectRatio);
  return params.runStage("harmonize", { image: identity.buffer.toString("base64"), grain: STARTING_FRAME_HARMONIZER_GRAIN }, async () => ({
    ...identity, buffer: (await harmonizeStartingFrameImage(identity.buffer)).buffer,
  }));
}
