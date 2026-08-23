import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readProjectFile(
  "components/trending/trending-workspace.tsx",
);
const card = readProjectFile("components/trending/hook-video-card.tsx");
const audioPreview = readProjectFile(
  "components/trending/hook-audio-preview.tsx",
);
const textOverlay = readProjectFile(
  "components/trending/hook-text-overlay.tsx",
);
const composer = readProjectFile(
  "components/trending/hook-video-composer.tsx",
);
const previewSession = readProjectFile(
  "app/api/trending/hook-videos/videos/[videoId]/preview-session/route.ts",
);
const previewStream = readProjectFile(
  "app/api/trending/hook-videos/preview/[videoId]/route.ts",
);

test("blocks Hook acceptance until the protected video preview is playable", () => {
  assert.match(workspace, /type HookPreviewStatus = "error" \| "loading" \| "ready"/);
  assert.match(
    workspace,
    /activeCandidate\.format === "hook_video"[\s\S]+activeHookPreviewStatus !== "ready"/,
  );
  assert.match(
    workspace,
    /const started = requestCreativeDecision[\s\S]+if \(!started\) \{[\s\S]+resetDrag\(\)/,
  );
  assert.match(workspace, /onPreviewReady=\{\(\) => \{[\s\S]+"ready"/);
  assert.match(workspace, /acceptDisabled=\{activeHookPreviewStatus/);
});

test("does not block the deck while a decision is being saved", () => {
  assert.doesNotMatch(workspace, /pendingDecisionItemId/);
  assert.doesNotMatch(workspace, /Saving choice…/);
  assert.match(workspace, /enqueueDecision/);
});

test("returns only validated Locked Hook audio to the authenticated preview", () => {
  assert.match(previewSession, /getLockedHookAudioForVideo/);
  assert.match(previewSession, /body\.sourceKind === "catalog"/);
  assert.match(previewSession, /isTrustedStorageUrl\(hookAudio\.audioUrl\)/);
  assert.match(previewSession, /hookAudio,[\s\S]+previewUrl/);
});

test("keeps protected preview sessions independent so upcoming Hooks can prefetch", () => {
  assert.match(previewSession, /getHookVideoPreviewCookieName\(videoId\)/);
  assert.match(previewStream, /getHookVideoPreviewCookieName\(videoId\)/);
  assert.doesNotMatch(workspace, /if \(!isActive\) \{\s*return;\s*\}[\s\S]*loadPreview/);
  assert.match(workspace, /previewUrl=\{previewUrl\}/);
  assert.match(card, /preload="auto"/);
  assert.match(card, /autoPlay=\{active\}/);
});

test("previews approved Hook audio without exposing it to deck swipe gestures", () => {
  assert.match(workspace, /hookAudio\?: HookPreviewAudio \| null/);
  assert.match(workspace, /hookAudio=\{isActive \? previewAudio : null\}/);
  assert.match(card, /<HookAudioPreview/);
  assert.match(audioPreview, /data-deck-control/);
  assert.match(audioPreview, /video\.currentTime - trimStart/);
  assert.match(audioPreview, /TRENDING_LIBRARY_AUDIO_PLAYBACK_VOLUME/);
  assert.match(audioPreview, /audioElement\.volume = TRENDING_LIBRARY_AUDIO_PLAYBACK_VOLUME/);
  assert.match(audioPreview, /size-9/);
  assert.match(audioPreview, /aria-label=\{soundEnabled \? "Mute Hook audio" : "Play Hook audio"\}/);
});

test("keeps the Hook feed typography aligned with the final bold outlined render", () => {
  assert.match(card, /hookFontSize = 60/);
  assert.match(textOverlay, /font-bold/);
  assert.match(textOverlay, /WebkitTextStroke/);
  assert.match(textOverlay, /"Segoe UI Emoji"/);
  assert.match(textOverlay, /"Noto Color Emoji"/);
});

test("uses protected custom controls in the Hook review instead of browser video controls", () => {
  assert.match(composer, /function ProtectedReviewVideo/);
  assert.match(composer, /controlsList="nodownload noremoteplayback"/);
  assert.match(composer, /disablePictureInPicture/);
  assert.match(composer, /onContextMenu=\{\(event\) => event\.preventDefault\(\)\}/);
  assert.doesNotMatch(
    composer.match(/function ReviewComposition[\s\S]+?function ReviewAsset/)?.[0] ?? "",
    /<video[\s\S]+?\scontrols(?:\s|>)/,
  );
});

test("keeps recommended Hook timing hidden until the user opens Trim", () => {
  assert.match(composer, /aria-controls="opening-trim-controls"/);
  assert.match(composer, /aria-expanded=\{trimOpen\}/);
  assert.match(
    composer,
    /\{trimOpen && duration !== null \? \([\s\S]+name="opening-trim-start"[\s\S]+name="opening-trim-end"/,
  );
});

function readProjectFile(relativePath: string) {
  return readFileSync(
    new URL(`../../${relativePath}`, import.meta.url),
    "utf8",
  );
}
