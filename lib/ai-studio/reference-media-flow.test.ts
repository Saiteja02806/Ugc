import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const imageApi = readProjectFile("lib/ai-studio/image-generation-api.ts");
const videoApi = readProjectFile("lib/ai-studio/video-generation-api.ts");
const imageWorker = readProjectFile("worker/src/jobs/generate-image.ts");
const videoWorker = readProjectFile("worker/src/jobs/generate-hook-video.ts");
const openAiProvider = readProjectFile("worker/src/lib/openai-image.ts");
const geminiOmniProvider = readProjectFile("worker/src/lib/gemini-omni-video.ts");
const runwayProvider = readProjectFile("worker/src/lib/runway-video.ts");

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

test("uploaded video references reach Runway video-to-video generation", () => {
  assert.match(videoApi, /referenceVideoDurationSeconds,/);
  assert.match(videoApi, /referenceVideoUrl,/);
  assert.match(videoApi, /Choose either a reference image or a reference video/);
  assert.match(videoWorker, /if \(input\.referenceVideoUrl\)/);
  assert.match(videoWorker, /referenceVideoUrl: input\.referenceVideoUrl/);
  assert.match(runwayProvider, /client\.videoToVideo\.create/);
  assert.match(runwayProvider, /model: RUNWAY_VIDEO_TO_VIDEO_MODEL/);
  assert.match(runwayProvider, /videoUri: referenceVideoUrl/);
});

test("optional image references reach Google Omni video generation", () => {
  assert.match(videoApi, /avatarImageUrl,/);
  assert.match(videoWorker, /referenceImageUrl: input\.avatarImageUrl/);
  assert.match(
    geminiOmniProvider,
    /referenceImageUrl\s*\? await downloadReferenceImage\(referenceImageUrl\)/,
  );
  assert.match(geminiOmniProvider, /data: referenceImage\.data/);
  assert.match(geminiOmniProvider, /mime_type: referenceImage\.mimeType/);
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
  assert.match(videoApi, /isExploreRecreate && !avatarImageUrl/);
  assert.match(videoApi, /Add a reference image before recreating an Explore video/);
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
