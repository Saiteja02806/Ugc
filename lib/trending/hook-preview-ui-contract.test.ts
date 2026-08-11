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
const previewSession = readProjectFile(
  "app/api/trending/hook-videos/videos/[videoId]/preview-session/route.ts",
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

test("shows an explicit pending state while a decision is being saved", () => {
  assert.match(workspace, /aria-busy=\{Boolean\(pendingDecisionItemId\)\}/);
  assert.match(workspace, /role="status"[\s\S]+Saving choice…/);
});

test("returns only validated Locked Hook audio to the authenticated preview", () => {
  assert.match(previewSession, /getLockedHookAudioForVideo/);
  assert.match(previewSession, /body\.sourceKind === "catalog"/);
  assert.match(previewSession, /isTrustedStorageUrl\(hookAudio\.audioUrl\)/);
  assert.match(previewSession, /hookAudio,[\s\S]+previewUrl/);
});

test("previews approved Hook audio without exposing it to deck swipe gestures", () => {
  assert.match(workspace, /hookAudio\?: HookPreviewAudio \| null/);
  assert.match(workspace, /hookAudio=\{isActive \? previewAudio : null\}/);
  assert.match(card, /<HookAudioPreview/);
  assert.match(audioPreview, /data-deck-control/);
  assert.match(audioPreview, /video\.currentTime - trimStart/);
  assert.match(audioPreview, /aria-label=\{soundEnabled \? "Mute Hook audio" : "Play Hook audio"\}/);
});

test("keeps the Hook feed typography aligned with the final bold outlined render", () => {
  assert.match(card, /hookFontSize = 60/);
  assert.match(textOverlay, /font-bold/);
  assert.match(textOverlay, /WebkitTextStroke/);
  assert.match(textOverlay, /"Segoe UI Emoji"/);
  assert.match(textOverlay, /"Noto Color Emoji"/);
});

function readProjectFile(relativePath: string) {
  return readFileSync(
    new URL(`../../${relativePath}`, import.meta.url),
    "utf8",
  );
}
