import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [workspaceSource, createContentPageSource, appSidebarSource, proxySource] =
  await Promise.all([
    readFile(
      new URL(
        "../../components/create-content/create-content-workspace.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../../app/create-content/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../../components/layout/app-sidebar.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../../proxy.ts", import.meta.url), "utf8"),
  ]);

test("Create Content removes the redundant page header so the workspace and chat use the viewport", () => {
  assert.doesNotMatch(workspaceSource, /Your video workspace/);
  assert.doesNotMatch(workspaceSource, /Choose a vertical video to create content for it\./);
  assert.doesNotMatch(workspaceSource, /<header className="flex flex-col gap-3 border-b/);
});

test("Create Content is available locally but not exposed by the production page or sidebar", () => {
  assert.match(createContentPageSource, /import \{ notFound \} from "next\/navigation"/);
  assert.match(
    createContentPageSource,
    /if \(process\.env\.NODE_ENV === "production"\) \{[\s\S]*?notFound\(\);/,
  );
  assert.match(
    appSidebarSource,
    /const isCreateContentScreenEnabled = process\.env\.NODE_ENV !== "production"/,
  );
  assert.match(
    appSidebarSource,
    /item\.key !== "create-content" \|\| isCreateContentScreenEnabled/,
  );
  assert.match(proxySource, /matcher: "\/create-content"/);
  assert.match(
    proxySource,
    /if \(process\.env\.NODE_ENV === "production"\) \{[\s\S]*?status: 404/,
  );
});

test("Create Content uses the same video text renderers as Trending", () => {
  assert.match(
    workspaceSource,
    /import \{ HookTextOverlay \} from "@\/components\/trending\/hook-text-overlay"/,
  );
  assert.match(
    workspaceSource,
    /import \{ WallTextOverlay \} from "@\/components\/trending\/wall-text-overlay"/,
  );
  assert.match(workspaceSource, /<HookTextOverlay position=\{position\} text=\{card\.overlay\.text\} \/>/);
  assert.match(workspaceSource, /<WallTextOverlay content=\{wallContent\} layout=\{wallLayout\} \/>/);
});

test("text editing is a full-height side drawer, not an inline panel", () => {
  assert.match(workspaceSource, /function TextEditorDrawer/);
  assert.match(workspaceSource, /className="fixed inset-0 z-50"/);
  assert.match(workspaceSource, /sm:right-0 sm:h-auto sm:w-\[min\(100vw,440px\)\]/);
});

test("editing existing copy validates against the final Wall or Hook renderer", () => {
  const editorSource = workspaceSource.slice(
    workspaceSource.indexOf("function TextEditorDrawer"),
    workspaceSource.indexOf("function AiChatPanel"),
  );

  assert.match(
    editorSource,
    /normalizeAndValidateGeneratedCreateContentText\(\{[\s\S]*format: card\.overlay\.format,[\s\S]*text: normalizedText/,
  );
  assert.match(editorSource, /This text cannot be rendered safely\./);
});

test("AI chat is a persistent parallel workspace panel with an explicit Add-to-video action", () => {
  assert.match(workspaceSource, /function AiChatPanel/);
  assert.match(workspaceSource, /aria-label="Ask AI workspace"/);
  assert.match(
    workspaceSource,
    /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(22\.5rem,clamp\(22\.5rem,30vw,26rem\)\)\]/,
  );
  assert.match(workspaceSource, /lg:grid-cols-\[minmax\(0,1fr\)_3\.25rem\]/);
  assert.match(workspaceSource, /lg:sticky lg:top-6 lg:h-\[calc\(100dvh-3rem\)\]/);
  assert.match(workspaceSource, /lg:border-l lg:border-border/);
  assert.match(workspaceSource, /Add to selected video/);
  assert.match(workspaceSource, /createCenteredTextPosition\(\)/);
});

test("AI chat does not block the Create Content workspace", () => {
  const aiPanelSource = workspaceSource.slice(
    workspaceSource.indexOf("function AiChatPanel"),
    workspaceSource.indexOf("function GeneratedCopyOptionCard"),
  );

  assert.doesNotMatch(workspaceSource, /isAiDrawerOpen/);
  assert.doesNotMatch(aiPanelSource, /aria-modal="true"/);
  assert.doesNotMatch(aiPanelSource, /backdrop-blur-\[2px\]/);
  assert.match(workspaceSource, /function focusAiComposer/);
  assert.match(workspaceSource, /onSchedule=\{\(\) => void scheduleActiveVideo\(\)\}/);
  assert.match(workspaceSource, /aiComposerRef\.current\?\.focus/);
});

test("Create Content uses the same uncluttered video treatment as Trending", () => {
  assert.match(workspaceSource, /autoPlay\s+loop\s+muted\s+playsInline/);
  assert.doesNotMatch(workspaceSource, /\n\s+controls\s*\n/);
  assert.doesNotMatch(workspaceSource, /formatDuration\(/);
});

test("Ask AI uses rounded format pills and one rounded chat composer", () => {
  assert.match(workspaceSource, /className="h-9 rounded-full px-4"/);
  assert.match(workspaceSource, /rounded-\[20px\] border border-border-strong bg-background p-1\.5/);
});

test("Ask AI and Write manually use the dock surface instead of nested intro cards", () => {
  assert.doesNotMatch(workspaceSource, /What would you like to create\?/);
  assert.doesNotMatch(workspaceSource, /Write your own copy/);
  assert.doesNotMatch(
    workspaceSource,
    /rounded-\[22px\] border border-border bg-background\/65 p-5 shadow-\[0_12px_30px/,
  );
  assert.match(
    workspaceSource,
    /Describe the angle, audience, or feeling you want the copy to/,
  );
});

test("Create Content keeps source-video selection compact and separate from swiping", () => {
  assert.match(workspaceSource, /function VideoPicker/);
  assert.match(workspaceSource, /Videos · \{assets\.length\}/);
  assert.match(workspaceSource, /Choose a video/);
  assert.doesNotMatch(workspaceSource, /function VideoFilmstrip/);
});

test("Create Content supports manual copy using the same validation and renderer path", () => {
  assert.match(workspaceSource, /function ManualCopyComposer/);
  assert.match(workspaceSource, /Write manually/);
  assert.match(workspaceSource, /create-content-manual-copy/);
  assert.match(
    workspaceSource,
    /normalizeAndValidateGeneratedCreateContentText\(\{[\s\S]*format,[\s\S]*text: normalizedText/,
  );
  assert.match(workspaceSource, /Confirm replace/);
  assert.match(workspaceSource, /createCenteredTextPosition\(\)/);
});

test("Create Content uses the existing Trending controls and local skip and schedule gestures", () => {
  assert.match(workspaceSource, /function skipActiveVideo/);
  assert.match(workspaceSource, /Swipe left to skip or right to schedule/);
  assert.match(workspaceSource, /function SwipeActionLane/);
  assert.match(
    workspaceSource,
    /import \{ CreativeDecisionActions \} from "@\/components\/trending\/creative-card-actions"/,
  );
  assert.match(workspaceSource, /<CreativeDecisionActions/);
  assert.doesNotMatch(workspaceSource, /function VideoDecisionBar/);
  assert.match(workspaceSource, /event\.currentTarget\.setPointerCapture\(event\.pointerId\)/);
  assert.match(workspaceSource, /Math\.abs\(distance\) < SWIPE_THRESHOLD_PX/);
  assert.match(workspaceSource, /void scheduleActiveVideo\(\)/);
});

test("Ask AI collapses into a persistent dock without changing the video card contract", () => {
  assert.match(workspaceSource, /const \[isAssistantDocked, setIsAssistantDocked\] = useState\(true\)/);
  assert.match(workspaceSource, /aria-label="Hide Ask AI"/);
  assert.match(workspaceSource, /aria-label="Show Ask AI"/);
  assert.match(workspaceSource, /onDockChange\(false\)/);
  assert.match(workspaceSource, /onDockChange\(true\)/);
  assert.match(workspaceSource, /setIsAssistantDocked\(true\)/);
  assert.match(workspaceSource, /isDocked \? "lg:flex" : "lg:hidden"/);
  assert.match(workspaceSource, /aspect-\[9\/16\]/);
});

test("AI generation remains available when no video is selected and does not reset on selection", () => {
  const aiPanelSource = workspaceSource.slice(
    workspaceSource.indexOf("function AiChatPanel"),
    workspaceSource.indexOf("function ManualCopyComposer"),
  );

  assert.doesNotMatch(workspaceSource, /<AiChatPanel\s+key=/);
  assert.doesNotMatch(aiPanelSource, /sourceMediaAssetId/);
  assert.match(workspaceSource, /hasSelectedVideo=\{Boolean\(activeAsset\)\}/);
  assert.match(workspaceSource, /Choose a video before adding this copy\./);
});
