import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [workspaceSource, createContentPageSource, appSidebarSource] =
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
  assert.match(workspaceSource, /aria-labelledby="create-content-ai-chat-title"/);
  assert.match(
    workspaceSource,
    /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(20rem,40%\)\]/,
  );
  assert.match(workspaceSource, /xl:grid-cols-\[minmax\(0,1fr\)_27\.5rem\]/);
  assert.match(workspaceSource, /lg:sticky lg:top-6 lg:h-\[calc\(100dvh-3rem\)\]/);
  assert.match(workspaceSource, /Add to this video/);
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
  assert.match(workspaceSource, /rounded-\[22px\] border border-border-strong bg-background p-1\.5/);
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

test("Create Content uses Trending-style skip and schedule gestures", () => {
  assert.match(workspaceSource, /function skipActiveVideo/);
  assert.match(workspaceSource, /Swipe left to skip or right to schedule/);
  assert.match(workspaceSource, /rejectCaption="Skip"/);
  assert.match(workspaceSource, /acceptCaption=\{activeCard \? "Schedule" : "Create copy"\}/);
  assert.match(workspaceSource, /void scheduleActiveVideo\(\)/);
});
