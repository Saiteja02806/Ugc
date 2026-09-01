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
const referenceUploader = readProjectFile(
  "components/generation/reference-media-upload.tsx",
);
const resultSurface = readProjectFile(
  "components/generation/ai-studio-results.tsx",
);
const resultActions = readProjectFile(
  "components/generation/ai-studio-result-actions.tsx",
);
const videoWorkspace = readProjectFile(
  "components/video/video-generation-workspace.tsx",
);
const creatorReferencePicker = readProjectFile(
  "components/video/creator-reference-picker.tsx",
);
const videoGenerationApi = readProjectFile(
  "lib/ai-studio/video-generation-api.ts",
);
const billingSubscription = readProjectFile(
  "lib/billing/subscription-db.ts",
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
    /"mx-auto w-full border bg-card/,
  );
  assert.match(
    composer,
    /layout === "unified"[\s\S]*?"max-w-\[944px\] rounded-\[24px\] border-border/,
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
    /: "max-w-\[1024px\] rounded-\[20px\]/,
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
  assert.match(imageWorkspace, /AiStudioRatioPicker/);
  assert.match(imageWorkspace, /ariaLabel="Number of images"/);
  assert.match(imageWorkspace, /generateLabel="Generate image"/);
  assert.match(videoWorkspace, /layout="unified"/);
});

test("image and video controls send selected settings to generation APIs", () => {
  assert.match(imageWorkspace, /body: JSON\.stringify\(\{[\s\S]*?aspectRatio,[\s\S]*?quantity,/);
  assert.match(videoWorkspace, /body: JSON\.stringify\(\{[\s\S]*?aspectRatio,[\s\S]*?quantity,/);
  assert.match(imageWorkspace, /ariaLabel="Image model"/);
  assert.match(imageWorkspace, /Nano Banana 2/);
  assert.match(imageWorkspace, /GPT Image/);
  assert.match(imageWorkspace, /model,[\s\S]*?quantity,/);
  assert.match(videoWorkspace, /ariaLabel="Video model"/);
  assert.match(videoWorkspace, /Google Omni/);
  assert.match(videoWorkspace, /ariaLabel="Video duration"/);
  assert.match(videoWorkspace, /durationSeconds,[\s\S]*?model,/);
  assert.match(
    videoGenerationApi,
    /getGenerationCreditCost\("video", durationSeconds\)/,
  );
  assert.match(videoWorkspace, /AiStudioRatioPicker/);
  assert.match(videoWorkspace, /allowedRatios=\{\["9:16", "16:9"\]\}/);
  assert.match(videoWorkspace, /ariaLabel="Number of videos"/);
});

test("model selectors are text-only", () => {
  const imageModelSelect = imageWorkspace.slice(
    imageWorkspace.indexOf('ariaLabel="Image model"'),
    imageWorkspace.indexOf('ariaLabel="Number of images"'),
  );
  const videoModelSelect = videoWorkspace.slice(
    videoWorkspace.indexOf('ariaLabel="Video model"'),
    videoWorkspace.indexOf('ariaLabel="Video duration"'),
  );

  assert.doesNotMatch(imageModelSelect, /icon=\{<Sparkles/);
  assert.doesNotMatch(videoModelSelect, /icon=\{<Sparkles/);
});

test("video duration displays and enforces four credits per second", () => {
  assert.match(
    videoWorkspace,
    /label: `\$\{duration\} sec · \$\{duration \* creditsPerSecond\} credits`/,
  );
  assert.match(
    videoWorkspace,
    /creditsPerSecond = DEFAULT_VIDEO_GENERATION_CREDITS_PER_SECOND/,
  );
  assert.match(videoWorkspace, /hasInsufficientCredits/);
  assert.match(imageWorkspace, /hasInsufficientCredits/);
  assert.match(
    billingSubscription,
    /videoGenerationCreditsPerSecond: getVideoGenerationCreditsPerSecond\(\)/,
  );
});

test("image defaults to 9:16 and workspaces use the public canonical job names", () => {
  assert.match(
    imageWorkspace,
    /useState<AIStudioImageAspectRatio>\("9:16"\)/,
  );
  assert.match(imageWorkspace, /job\.jobType === "image_generation"/);
  assert.match(videoWorkspace, /job\.jobType === "video_generation"/);
});

test("quantity controls lock with the rest of each generation composer", () => {
  assert.match(
    imageWorkspace,
    /ariaLabel="Number of images"\s+disabled=\{generationLocked \|\| isGenerating\}/,
  );
  assert.match(
    videoWorkspace,
    /ariaLabel="Number of videos"\s+disabled=\{generationLocked \|\| isGenerating\}/,
  );
  assert.match(composer, /disabled=\{disabled\}[\s\S]*?aria-expanded=\{open\}/);
});

test("setting pills use themed popovers instead of native select menus", () => {
  const settingSelect = composer.slice(
    composer.indexOf("export function AiStudioSettingSelect"),
    composer.indexOf("export type AIStudioAspectRatio"),
  );

  assert.doesNotMatch(settingSelect, /<select|<option/);
  assert.match(settingSelect, /<Popover open=\{open\} onOpenChange=\{setOpen\}>/);
  assert.match(settingSelect, /role="listbox"/);
  assert.match(settingSelect, /role="option"/);
  assert.match(settingSelect, /aria-selected=\{isSelected\}/);
  assert.match(settingSelect, /bg-brand-soft font-semibold text-primary/);
});

test("every image and video settings dropdown uses the shared themed pill", () => {
  assert.equal(
    imageWorkspace.match(/<AiStudioSettingSelect\b/g)?.length,
    2,
  );
  assert.equal(
    videoWorkspace.match(/<AiStudioSettingSelect\b/g)?.length,
    3,
  );

  for (const ariaLabel of ["Image model", "Number of images"]) {
    assert.match(imageWorkspace, new RegExp(`ariaLabel="${ariaLabel}"`));
  }

  for (const ariaLabel of [
    "Video model",
    "Video duration",
    "Number of videos",
  ]) {
    assert.match(videoWorkspace, new RegExp(`ariaLabel="${ariaLabel}"`));
  }

  assert.doesNotMatch(imageWorkspace, /<select|<option/);
  assert.doesNotMatch(videoWorkspace, /<select|<option/);
});

test("video references start empty and offer optional creator references", () => {
  assert.match(videoWorkspace, /useState<AIStudioReferenceMedia \| null>\(null\)/);
  assert.match(videoWorkspace, /useState<string \| null>\(null\)/);
  assert.match(videoWorkspace, /<CreatorReferencePicker/);
  assert.match(videoWorkspace, /referenceControls=\{/);
  assert.match(creatorReferencePicker, />\s*Creators\s*</);
  assert.match(creatorReferencePicker, />\s*Optional\s*</);
  assert.match(creatorReferencePicker, /Pick a creator reference or upload your own image/);
  assert.match(creatorReferencePicker, /onChange\(nextSelection\)/);
  assert.match(creatorReferencePicker, /uploadAIStudioReferenceMedia\(file, "image"\)/);
  assert.match(creatorReferencePicker, /<ImagePlus className="size-3.5"/);
  assert.doesNotMatch(videoWorkspace, /groupAvatarsByCreator/);
  assert.doesNotMatch(videoWorkspace, /function AvatarFolderGroup/);
  assert.doesNotMatch(videoWorkspace, /Open a creator folder/);
  assert.doesNotMatch(videoWorkspace, /Choose optional source video/);
  assert.doesNotMatch(
    videoWorkspace,
    /Choose optional reference image/,
  );
  assert.doesNotMatch(videoWorkspace, /No reference video/);
  assert.match(
    videoWorkspace,
    /avatarImageUrl: activeReferenceImageUrl/,
  );
  assert.match(
    videoWorkspace,
    /generateDisabled=\{[\s\S]*?generationLocked \|\|[\s\S]*?hasInsufficientCredits \|\|[\s\S]*?!prompt\.trim\(\) \|\|[\s\S]*?isGenerating[\s\S]*?\}/,
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

test("AI Studio supports optional direct image and video reference uploads", () => {
  assert.match(imageWorkspace, /allowedKinds=\{\["image"\]\}/);
  assert.match(imageWorkspace, /referenceImageUrl: referenceImage\?\.asset\.url \?\? null/);
  assert.match(videoWorkspace, /allowedKinds=\{\["image", "video"\]\}/);
  assert.match(videoWorkspace, /referenceVideoUrl: uploadedReferenceVideo\?\.asset\.url \?\? null/);
  assert.match(videoWorkspace, /referenceVideoDurationSeconds:/);
  assert.match(
    videoWorkspace,
    /generateDisabled=\{[\s\S]*?generationLocked \|\|[\s\S]*?hasInsufficientCredits \|\|[\s\S]*?!prompt\.trim\(\) \|\|[\s\S]*?isGenerating[\s\S]*?\}/,
  );
});

test("video composer keeps compact controls in the requested order", () => {
  const videoSettings = videoWorkspace.slice(
    videoWorkspace.indexOf("settings={"),
    videoWorkspace.indexOf("        }\n      />", videoWorkspace.indexOf("settings={")),
  );

  assert.match(composer, /triggerLabel\?: string/);
  assert.match(composer, /triggerLabel: "9:16"/);
  assert.match(videoSettings, /ariaLabel="Video model"[\s\S]*?ariaLabel="Video duration"[\s\S]*?ariaLabel="Number of videos"[\s\S]*?<AiStudioRatioPicker/);
  assert.match(videoSettings, /label: `\$\{count\} video\$\{count === 1 \? "" : "s"\}`,[\s\S]*?triggerLabel: String\(count\)/);
});

test("image and video use one compact leading attachment control", () => {
  assert.match(imageWorkspace, /leadingControl=\{[\s\S]*?<ReferenceMediaUpload/);
  assert.match(videoWorkspace, /leadingControl=\{[\s\S]*?<ReferenceMediaUpload/);
  assert.match(referenceUploader, /<Plus className="size-4"/);
  assert.match(referenceUploader, /type="file"[\s\S]*?accept=\{accepts\}/);
  assert.doesNotMatch(referenceUploader, />\s*Upload image\s*</);
  assert.doesNotMatch(referenceUploader, />\s*Upload video\s*</);
  assert.doesNotMatch(referenceUploader, /generate without a reference/);
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

test("completed image and video results expose download and open actions", () => {
  assert.match(imageWorkspace, /<AiStudioResultActions[\s\S]*?kind="image"/);
  assert.match(videoWorkspace, /<AiStudioResultActions[\s\S]*?kind="video"/);
  assert.match(resultActions, /download=\{fileName\}/);
  assert.match(resultActions, /aria-label=\{`Open \$\{title\} in a new tab`\}/);
});

test("the active reference control accepts a pasted image into the composer", () => {
  assert.match(
    referenceUploader,
    /composerForm\.addEventListener\("paste", handlePaste\)/,
  );
  assert.match(referenceUploader, /clipboardData\?\.items/);
  assert.doesNotMatch(referenceUploader, /event\.preventDefault\(\)/);
  assert.match(referenceUploader, /active = true/);
  assert.match(referenceUploader, /src=\{selection\.asset\.url\}/);
  assert.match(referenceUploader, /width=\{36\}[\s\S]*?height=\{36\}/);
  assert.match(referenceUploader, /Image reference/);
  assert.match(imageWorkspace, /<ReferenceMediaUpload[\s\S]*?active=\{active\}/);
  assert.match(videoWorkspace, /<ReferenceMediaUpload[\s\S]*?active=\{active\}/);
});

test("generation progress has a visible in-place loading state", () => {
  assert.match(resultSurface, /status\?\.tone === "progress"/);
  assert.match(resultSurface, /<EmptyMedia variant="icon"/);
  assert.match(resultSurface, /animate-spin/);
});

test("image and video previews stay compact enough for the active viewport", () => {
  assert.match(
    imageWorkspace,
    /"9:16": "max-w-\[min\(240px,26dvh\)\]"/,
  );
  assert.match(
    imageWorkspace,
    /getImagePreviewWidthClassName\(aspectRatio\)/,
  );
  assert.match(
    imageWorkspace,
    /getImagePreviewWidthClassName\(asset\.aspectRatio\)/,
  );
  assert.match(
    videoWorkspace,
    /"9:16": "max-w-\[min\(216px,24dvh\)\]"/,
  );
  assert.match(
    videoWorkspace,
    /getVideoPreviewWidthClassName\(aspectRatio\)/,
  );
  assert.match(
    videoWorkspace,
    /getVideoPreviewWidthClassName\(video\.ratio\)/,
  );
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
});

function readProjectFile(relativePath: string) {
  return readFileSync(
    new URL(`../../${relativePath}`, import.meta.url),
    "utf8",
  );
}
