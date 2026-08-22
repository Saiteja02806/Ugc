import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const composer = readProjectFile(
  "components/generation/ai-studio-composer.tsx",
);
const imageWorkspace = readProjectFile(
  "components/workspace/ugc-chat-workspace.tsx",
);
const studioWorkspace = readProjectFile(
  "components/generation/ai-studio-workspace.tsx",
);
const resultSurface = readProjectFile(
  "components/generation/ai-studio-results.tsx",
);
const videoWorkspace = readProjectFile(
  "components/video/video-generation-workspace.tsx",
);
const promptHelper = composer.slice(
  composer.indexOf("<FieldDescription"),
  composer.indexOf("</FieldDescription>") + "</FieldDescription>".length,
);
const accessHook = readProjectFile(
  "components/generation/use-ai-studio-access.ts",
);
const routeLoading = readProjectFile("app/ai-studio/loading.tsx");

test("the image prompt uses one unified composer surface", () => {
  assert.match(imageWorkspace, /layout="unified"/);
  assert.match(composer, /data-layout=\{layout\}/);
  assert.match(
    composer,
    /"mx-auto w-full border bg-card shadow-floating"/,
  );
  assert.match(
    composer,
    /layout === "unified"[\s\S]*?"max-w-\[944px\] rounded-\[24px\] border-border-strong p-0/,
  );
  assert.match(
    composer,
    /"max-h-36 min-h-10 rounded-none px-0 py-0 text-base font-normal leading-7"/,
  );
  assert.match(composer, /layout === "unified"\s*\?\s*"flex"/);
});

test("the unified composer is narrower without squeezing standard layouts", () => {
  assert.match(
    composer,
    /layout === "unified"[\s\S]*?\? "max-w-\[944px\]/,
  );
  assert.match(
    composer,
    /: "max-w-\[1024px\] rounded-\[var\(--radius-panel\)\]/,
  );
});

test("the unified composer stays compact while supporting multiline prompts", () => {
  assert.match(
    composer,
    /const minimumHeight = layout === "unified" \? 40 : 64;/,
  );
  assert.match(
    composer,
    /const maximumHeight = layout === "unified" \? 144 : 128;/,
  );
  assert.match(
    composer,
    /layout === "unified"\s*\? "gap-y-1 px-4 pb-1 pt-3 sm:px-5"/,
  );
  assert.doesNotMatch(composer, /max-h-60 min-h-28/);
});

test("the unified toolbar keeps settings and Generate inside the same form", () => {
  assert.match(composer, /<form[\s\S]*?\{settings\}[\s\S]*?type="submit"/);
  assert.match(composer, /layout === "unified" && "px-3 pb-2 sm:px-4 sm:pb-3"/);
  assert.match(imageWorkspace, /label="4:5 portrait"/);
  assert.match(imageWorkspace, /label="1 image"/);
  assert.match(imageWorkspace, />\s*Enhance\s*</);
  assert.match(imageWorkspace, /generateLabel="Generate image"/);
  assert.match(videoWorkspace, /layout="unified"/);
});

test("the unified composer does not add an accent glow when the prompt is focused", () => {
  assert.doesNotMatch(composer, /focus-within:ring-3/);
  assert.doesNotMatch(composer, /focus-within:ring-ring/);
});

test("video results keep the prompt visible with custom playback controls", () => {
  const videoResultCard = videoWorkspace.slice(
    videoWorkspace.indexOf("function VideoResultCard"),
    videoWorkspace.indexOf("function formatVideoDuration"),
  );

  assert.match(
    videoWorkspace,
    /gridClassName="grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1 2xl:grid-cols-1"/,
  );
  assert.doesNotMatch(videoWorkspace, /getCreativeAssetEditorHref|handleEditVideo/);
  assert.doesNotMatch(videoWorkspace, /setPrompt\(""\);/);
  assert.match(videoResultCard, /video\.prompt/);
  assert.doesNotMatch(videoResultCard, /\bcontrols\b/);
  assert.match(
    videoResultCard,
    /aria-label=\{isPlaying \? "Pause video" : "Play video"\}/,
  );
  assert.match(
    videoResultCard,
    /aria-label=\{isMuted \? "Unmute video" : "Mute video"\}/,
  );
});

test("generation progress has a visible in-place loading state", () => {
  assert.match(resultSurface, /status\?\.tone === "progress"/);
  assert.match(resultSurface, /<EmptyMedia variant="icon"/);
  assert.match(resultSurface, /animate-spin/);
});

test("image and video generation stay visible while a job is running", () => {
  assert.match(imageWorkspace, /<OptimisticImageCard prompt=\{activePrompt\}/);
  assert.match(videoWorkspace, /<OptimisticVideoCard/);
  assert.match(
    imageWorkspace,
    /hasResults=\{generatedAssets\.length > 0 \|\| isGenerating\}/,
  );
  assert.match(
    videoWorkspace,
    /hasResults=\{generatedVideos\.length > 0 \|\| isGenerating\}/,
  );
  assert.match(imageWorkspace, /isNew=\{asset\.id === latestCompletedId\}/);
  assert.match(videoWorkspace, /isNew=\{video\.id === latestCompletedVideoId\}/);
});

test("AI Studio access is cached per account without window-focus flicker", () => {
  assert.match(accessHook, /useQuery\(\{/);
  assert.match(
    accessHook,
    /queryKey: \["ai-studio-access", user\?\.uid \?\? "signed-out"\]/,
  );
  assert.match(accessHook, /refetchOnWindowFocus: false/);
  assert.match(accessHook, /signal,/);
});

test("the route has a screen-shaped loading fallback", () => {
  assert.match(routeLoading, /aria-label="Loading AI Studio"/);
  assert.match(routeLoading, /max-w-\[1560px\]/);
  assert.match(routeLoading, /aspect-\[4\/5\]/);
});

test("access guidance appears once inside the composer", () => {
  assert.match(promptHelper, /accessMessage \?\?/);
  assert.doesNotMatch(composer, /generationLocked \? \(\s*<p/);
  assert.match(studioWorkspace, /if \(state !== "pro"\) \{\s*return null;/);
  assert.doesNotMatch(studioWorkspace, /Pro access required/);
});

test("the redesign preserves prompt and submission behavior", () => {
  assert.match(composer, /onSubmit=\{onSubmit\}/);
  assert.match(composer, /onKeyDown=\{onTextareaKeyDown\}/);
  assert.match(composer, /prompt\.length > maxLength/);
  assert.match(composer, /disabled=\{generateDisabled \|\| promptTooLong\}/);
  assert.match(imageWorkspace, /onClick=\{handleEnhancePrompt\}/);
});

function readProjectFile(relativePath: string) {
  return readFileSync(
    new URL(`../../${relativePath}`, import.meta.url),
    "utf8",
  );
}
