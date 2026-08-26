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
const editor = readProjectFile(
  "components/trending/trending-creative-editor.tsx",
);
const hookLayout = readProjectFile("lib/trending/hook-text-layout.ts");
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
  assert.match(workspace, /acceptDisabled=\{\s*activeHookPreviewStatus/);
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

test("does not restart a loaded Hook preview when feed polling recreates its data", () => {
  const hookDeckCard =
    workspace.match(
      /function TrendingHookDeckCard\([\s\S]+?\r?\n}\r?\n\r?\nfunction TrendingWallTextDeckCard/,
    )?.[0] ?? "";

  assert.match(
    hookDeckCard,
    /const previewSessionEndpoint = creative\.previewSessionEndpoint/,
  );
  assert.match(
    hookDeckCard,
    /const previewInfluencerId = creative\.influencerId/,
  );
  assert.match(
    hookDeckCard,
    /const previewSourceKind = creative\.sourceKind/,
  );
  assert.doesNotMatch(hookDeckCard, /\[\s*creative,/);
  assert.match(
    hookDeckCard,
    /setPreviewLoadKey\(\(current\) => current \+ 1\)/,
  );
  assert.match(hookDeckCard, /previewLoadKey=\{previewLoadKey\}/);
  assert.match(card, /key=\{`\$\{previewUrl\}:\$\{previewLoadKey\}`\}/);
});

test("renews protected Hook preview access before the five-minute session expires", () => {
  const hookDeckCard =
    workspace.match(
      /function TrendingHookDeckCard\([\s\S]+?\r?\n}\r?\n\r?\nfunction TrendingWallTextDeckCard/,
    )?.[0] ?? "";

  assert.match(hookDeckCard, /expiresAt: string/);
  assert.match(hookDeckCard, /getHookPreviewRenewalDelay\(data\.expiresAt\)/);
  assert.match(hookDeckCard, /const renewalTimer = window\.setTimeout/);
  assert.match(hookDeckCard, /setPreviewRenewAt\(Date\.now\(\) \+ 10_000\)/);
  assert.match(hookDeckCard, /automaticPreviewRecoveryAttemptedRef/);
  assert.match(
    hookDeckCard,
    /onPreviewError=\{\(\) => \{[\s\S]*setPreviewRetryKey\(\(current\) => current \+ 1\)/,
  );
  assert.match(
    workspace,
    /function TrendingHookComposer[\s\S]*expiresAt: string[\s\S]*getHookPreviewRenewalDelay\(data\.expiresAt\)/,
  );
});

test("keeps Hook source metadata private while reusing the protected preview", () => {
  const composerOpening =
    composer.match(/function ComposerOpeningPreview[\s\S]+?function HookTextStage/)?.[0] ??
    "";
  const scheduleReview = readProjectFile(
    "components/trending/hook-video-schedule-drawer.tsx",
  );

  assert.doesNotMatch(composerOpening, /influencer\.name|video\.title\}<\/p>/);
  assert.match(composerOpening, /poster=\{video\.thumbnailUrl \?\? undefined\}/);
  assert.match(composerOpening, /preload="auto"/);
  assert.doesNotMatch(scheduleReview, /Opening source|influencerName/);
  assert.doesNotMatch(workspace, /previewUrl\?session=/);
  assert.match(previewStream, /Cache-Control": "private, max-age=60"/);
});

test("previews approved Hook audio without exposing it to deck swipe gestures", () => {
  assert.match(workspace, /hookAudio\?: HookPreviewAudio \| null/);
  assert.match(workspace, /hookAudio=\{isActive \? previewAudio : null\}/);
  assert.match(card, /<HookAudioPreview/);
  assert.match(audioPreview, /data-deck-control/);
  assert.match(audioPreview, /video\.currentTime - trimStart/);
  assert.match(audioPreview, /TRENDING_LIBRARY_AUDIO_PLAYBACK_VOLUME/);
  assert.match(audioPreview, /audioElement\.volume = TRENDING_LIBRARY_AUDIO_PLAYBACK_VOLUME/);
  assert.match(audioPreview, /size-8/);
  assert.match(audioPreview, /aria-label=\{soundEnabled \? "Mute Hook audio" : "Play Hook audio"\}/);
});

test("keeps Hook feed and editor typography aligned with the final semibold outlined render", () => {
  const editorHookOverlay =
    editor.match(/function HookOverlayText[\s\S]+?function WallTextOverlayText/)?.[0] ??
    "";

  assert.match(card, /hookFontSize = 52/);
  assert.match(hookLayout, /HOOK_TEXT_FONT_WEIGHT = 600/);
  assert.match(hookLayout, /HOOK_TEXT_OUTLINE_WIDTH = 5/);
  assert.match(hookLayout, /"Segoe UI Emoji"/);
  assert.match(hookLayout, /"Noto Color Emoji"/);
  assert.match(textOverlay, /fontWeight: HOOK_TEXT_FONT_WEIGHT/);
  assert.match(textOverlay, /HOOK_TEXT_OUTLINE_WIDTH/);
  assert.match(editorHookOverlay, /fontWeight: HOOK_TEXT_FONT_WEIGHT/);
  assert.match(editorHookOverlay, /HOOK_TEXT_OUTLINE_WIDTH/);
  assert.doesNotMatch(textOverlay, /font-bold|textShadow/);
  assert.doesNotMatch(editorHookOverlay, /font-bold|font-semibold|textShadow/);
});

test("does not silently reflow an invalid saved Hook layout", () => {
  assert.match(textOverlay, /const hasSavedLayout/);
  assert.match(textOverlay, /if \(hasSavedLayout\)/);
  assert.doesNotMatch(textOverlay, /catch \{\s*try \{/);
  assert.match(textOverlay, /catch \{\s*return null;/);
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
