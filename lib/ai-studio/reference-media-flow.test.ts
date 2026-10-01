import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const imageApi = readProjectFile("lib/ai-studio/image-generation-api.ts");
const videoApi = readProjectFile("lib/ai-studio/video-generation-api.ts");
const imageWorker = readProjectFile("worker/src/jobs/generate-image.ts");
const videoWorker = readProjectFile("worker/src/jobs/generate-hook-video.ts");
const openAiProvider = readProjectFile("worker/src/lib/openai-image.ts");
const geminiOmniProvider = readProjectFile("worker/src/lib/gemini-omni-video.ts");
const seedanceProvider = readProjectFile("worker/src/lib/runway-seedance-video.ts");
const providerRouting = readProjectFile("worker/src/lib/hook-video-provider.ts");

test("uploaded image references reach the image provider", () => {
  assert.match(imageApi, /input: \{[\s\S]*?referenceImageUrl,/);
  assert.match(imageWorker, /referenceImageUrl: input\.referenceImageUrl \?\? null/);
  assert.match(
    imageWorker,
    /generateOpenAiImageBuffer\([\s\S]*?input\.referenceImageUrl/,
  );
  assert.match(openAiProvider, /client\.images\.edit/);
  assert.match(openAiProvider, /downloadReferenceImage\(referenceImageUrl\)/);
});

test("Kling limits new references while legacy Seedance video jobs remain recoverable", () => {
  assert.match(videoApi, /referenceVideoDurationSeconds,/);
  assert.match(videoApi, /referenceVideoUrl,/);
  assert.match(videoApi, /Video references are unavailable for the current video models/);
  assert.match(videoApi, /const maxReferences = model === "kling_3_0" \? 2 : 6/);
  assert.match(providerRouting, /input\.model === "kling_3_0"\) return "runway"/);
  assert.match(providerRouting, /input\.model === "seedance_2_5"\) return "runway"/);
  assert.match(videoWorker, /referenceVideoUrl: input\.referenceVideoUrl/);
  assert.match(videoWorker, /referenceImageUrls: input\.referenceImageUrls/);
  assert.match(seedanceProvider, /model: "seedance2_5"/);
  assert.match(seedanceProvider, /promptVideo: params\.referenceVideoUrl/);
  assert.match(seedanceProvider, /references: imageUrls\.map/);
});

test("optional image references reach Google Omni video generation", () => {
  assert.match(videoApi, /avatarImageUrl,/);
  assert.match(videoApi, /referenceImageUrls/);
  assert.match(videoWorker, /referenceImageUrls: input\.referenceImageUrls/);
  assert.match(
    geminiOmniProvider,
    /Promise\.all\(imageUrls\.map\(downloadReferenceImage\)\)/,
  );
  assert.match(geminiOmniProvider, /data: image\.data/);
  assert.match(geminiOmniProvider, /mime_type: image\.mimeType/);
});

test("prompt-only generation remains valid", () => {
  assert.match(imageApi, /referenceImageUrl = cleanTrustedHttpsUrl/);
  assert.match(videoApi, /referenceVideoUrl = cleanHttpsUrl/);
  assert.doesNotMatch(imageApi, /Add a reference image before generating/);
  assert.doesNotMatch(videoApi, /Add a reference video before generating/);
});

test("only recognized Explore recreations require an image reference", () => {
  assert.match(videoApi, /isExploreHookVideoId\(body\?\.referenceId\)/);
  assert.match(videoApi, /body\?\.referenceType === "hook"/);
  assert.match(videoApi, /isExploreWallTextVideoId\(body\?\.referenceId\)/);
  assert.match(videoApi, /body\?\.referenceType === "wall_text"/);
  assert.match(videoApi, /isExploreRecreate && referenceImageUrls\.length === 0/);
  assert.match(videoApi, /Add a reference image before recreating an Explore video/);
});

test("Wall of Text Recreate carries its reference context and sends the chosen image to generation", () => {
  const videoWorkspace = readProjectFile(
    "components/video/video-generation-workspace.tsx",
  );

  assert.match(videoWorkspace, /refTypeParam === "wall_text"/);
  assert.match(videoWorkspace, /referenceId: referenceContext\?\.id \?\? null/);
  assert.match(videoWorkspace, /referenceType: referenceContext\?\.type \?\? null/);
  assert.match(videoWorkspace, /referenceUrl: referenceContext\?\.sourceUrl \?\? null/);
  assert.match(
    videoWorkspace,
    /referenceContext\?\.type === "hook" \|\| referenceContext\?\.type === "wall_text"/,
  );
  assert.match(videoWorkspace, /<ReferenceFilesUpload[\s\S]*?selections=\{referenceFiles\}/);
  assert.match(videoWorkspace, /referenceImageUrls: referenceImages\.map\(\(image\) => image\.asset\.url\)/);
  assert.match(videoWorker, /referenceImageUrls: input\.referenceImageUrls/);
  assert.match(
    geminiOmniProvider,
    /Promise\.all\(imageUrls\.map\(downloadReferenceImage\)\)/,
  );
});

test("AI Studio video generation sends the user's prompt without a UGC template", () => {
  assert.match(videoApi, /hookIdea: prompt,[\s\S]*?promptMode: "direct"/);
  assert.doesNotMatch(videoApi, /productName: "UGCPilot"/);
  assert.doesNotMatch(videoApi, /productDescription: "Short-form creator content\."/);
  assert.doesNotMatch(videoApi, /cameraStyle: "iphone_selfie"/);
  assert.doesNotMatch(videoApi, /emotion: "confident"/);
  assert.match(
    videoWorker,
    /const prompt = buildVideoGenerationPrompt\(input\)/,
  );
});

function readProjectFile(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}
