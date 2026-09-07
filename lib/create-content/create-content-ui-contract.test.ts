import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspaceSource = await readFile(
  new URL(
    "../../components/create-content/create-content-workspace.tsx",
    import.meta.url,
  ),
  "utf8",
);

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

test("AI chat is a full-height sidebar with an explicit Add-to-video action", () => {
  assert.match(workspaceSource, /function AiChatDrawer/);
  assert.match(workspaceSource, /aria-labelledby="create-content-ai-chat-title"/);
  assert.match(workspaceSource, /sm:right-0 sm:h-auto sm:w-\[min\(100vw,440px\)\]/);
  assert.match(workspaceSource, /Add to this video/);
  assert.match(workspaceSource, /createCenteredTextPosition\(\)/);
});

test("AI chat opens from one circular, single-sparkle trigger", () => {
  assert.match(workspaceSource, /aria-label="Open AI chat"/);
  assert.match(workspaceSource, /className="size-10 rounded-full shadow-sm hover:shadow-md"/);
  assert.match(workspaceSource, /<Sparkle className="size-\[17px\]" aria-hidden="true" \/>/);
});
