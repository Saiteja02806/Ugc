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
const videoGenerationApi = readProjectFile(
  "lib/ai-studio/video-generation-api.ts",
);
const promptHelper = composer.slice(
  composer.indexOf("<FieldDescription"),
  composer.indexOf("</FieldDescription>") + "</FieldDescription>".length,
);

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
  assert.match(imageWorkspace, /ariaLabel="Image aspect ratio"/);
  assert.match(imageWorkspace, /ariaLabel="Number of images"/);
  assert.match(composer, /<select/);
  assert.match(composer, /onChange=\{\(event\) => onChange/);
  assert.match(imageWorkspace, />\s*Enhance\s*</);
  assert.match(imageWorkspace, /generateLabel="Generate image"/);
  assert.match(videoWorkspace, /layout="unified"/);
});

test("image and video controls send selected settings to generation APIs", () => {
  assert.match(imageWorkspace, /body: JSON\.stringify\(\{[\s\S]*?aspectRatio,[\s\S]*?quantity,/);
  assert.match(videoWorkspace, /body: JSON\.stringify\(\{[\s\S]*?aspectRatio,[\s\S]*?quantity,/);
  assert.match(videoWorkspace, /ariaLabel="Video aspect ratio"/);
  assert.match(videoWorkspace, /ariaLabel="Number of videos"/);
});

test("video reference images start empty without exposing creator video folders", () => {
  assert.match(videoWorkspace, /: null,\s*\);/);
  assert.match(videoWorkspace, /function ReferenceImagePicker/);
  assert.match(videoWorkspace, /referenceImages=\{avatarOptions\}/);
  assert.match(videoWorkspace, /Choose a reference image/);
  assert.match(videoWorkspace, /Choose reference image \$\{index \+ 1\}/);
  assert.doesNotMatch(videoWorkspace, /groupAvatarsByCreator/);
  assert.doesNotMatch(videoWorkspace, /function AvatarFolderGroup/);
  assert.doesNotMatch(videoWorkspace, /Open a creator folder/);
  assert.doesNotMatch(videoWorkspace, /Choose optional source video/);
  assert.doesNotMatch(
    videoWorkspace,
    /: nextPersonalAssets\[0\]\?\.id \?\?\s*nextAvatarLibrary\[0\]\?\.asset\.id/,
  );
  assert.match(videoWorkspace, /No reference image/);
  assert.doesNotMatch(videoWorkspace, /No reference video/);
  assert.match(videoWorkspace, /Generate directly from your prompt/);
  assert.match(
    videoWorkspace,
    /avatarImageUrl: selectedAvatar\?\.thumbnailUrl \?\? null/,
  );
  assert.match(
    videoWorkspace,
    /generateDisabled=\{\s*generationLocked \|\|\s*!prompt\.trim\(\) \|\|\s*isGenerating\s*\}/,
  );
  assert.doesNotMatch(
    videoWorkspace,
    /Choose a source video before generating/,
  );
  assert.doesNotMatch(
    videoGenerationApi,
    /Choose a presenter with a preview image/,
  );
  assert.match(
    videoGenerationApi,
    /input: \{[\s\S]*?avatarImageUrl,[\s\S]*?batchIndex/,
  );
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
