import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actions = readProjectFile(
  "components/trending/creative-card-actions.tsx",
);
const workspace = readProjectFile(
  "components/trending/trending-workspace.tsx",
);
const editor = readProjectFile(
  "components/trending/trending-creative-editor.tsx",
);
const buttons = readProjectFile("components/ui/button.tsx");
const sidebar = readProjectFile("components/layout/app-sidebar.tsx");

test("renders one shared reject, edit, and accept control in that order", () => {
  assert.match(actions, /variant="creative-reject"/);
  assert.match(actions, /aria-label="Reject this creative"/);
  assert.match(actions, />\s*Reject\s*</);
  assert.match(actions, />\s*Edit\s*</);
  assert.match(actions, /aria-label="Accept this creative"/);
  assert.match(actions, />\s*Accept\s*</);
  assert.ok(
    actions.indexOf("creative-reject") < actions.indexOf("creative-edit") &&
      actions.indexOf("creative-edit") < actions.indexOf("creative-accept"),
  );
  assert.equal((workspace.match(/<CreativeCardActions/g) ?? []).length, 1);
});

test("uses three equal labeled touch targets instead of icon-only controls", () => {
  assert.match(actions, /grid-cols-3/);
  assert.equal((actions.match(/size="creative-action"/g) ?? []).length, 3);
  assert.match(buttons, /"creative-action":\s*\n\s*"h-11[^"]*sm:h-12/);
  assert.doesNotMatch(actions, /size="creative-icon"/);
});

test("keeps reject and accept controls neutral with restrained semantic color", () => {
  assert.match(
    buttons,
    /"creative-reject":\s*\n\s*"border-border-strong bg-card text-error/,
  );
  assert.match(
    buttons,
    /"creative-accept":\s*\n\s*"border-border-strong bg-card text-success/,
  );
  assert.doesNotMatch(buttons, /"creative-reject":\s*\n\s*"bg-error /);
  assert.doesNotMatch(buttons, /"creative-accept":\s*\n\s*"bg-success /);
});

test("button, keyboard, and physical swipe decisions converge on one handler", () => {
  assert.match(
    workspace,
    /function completeCandidateSwipe[\s\S]*requestCreativeDecision/,
  );
  assert.match(workspace, /onAccept=\{\(\) => requestCreativeDecision\("accepted"\)\}/);
  assert.match(workspace, /onReject=\{\(\) => requestCreativeDecision\("rejected"\)\}/);
  assert.match(workspace, /event\.key === "ArrowLeft"[\s\S]*completeCandidateSwipe\("left"\)/);
  assert.match(workspace, /event\.key === "ArrowRight"[\s\S]*completeCandidateSwipe\("right"\)/);
});

test("keeps the outgoing card mounted until its transform transition finishes", () => {
  assert.match(workspace, /onTransitionEnd=\{isActive \? onExitTransitionEnd/);
  assert.match(
    workspace,
    /event\.propertyName === "transform"[\s\S]*settleSwipeExit\(\)/,
  );
  assert.match(
    workspace,
    /completion\(\);[\s\S]*resetDrag\(\);/,
  );
  assert.doesNotMatch(
    workspace,
    /key=\{candidates\.map\(\(candidate\) => candidate\.item\.id\)\.join\("\|"\)\}/,
  );
});

test("optimistically advances, blocks duplicate decisions, and restores on save failure", () => {
  assert.match(workspace, /decisionLockRef\.current = true/);
  assert.match(
    workspace,
    /setActiveItemIndex\(candidateIndex \+ 1\);[\s\S]*commitCreativeDecision/,
  );
  assert.match(
    workspace,
    /await persistTrendingCreativeDecision[\s\S]*catch \(error\)[\s\S]*setActiveItemIndex\(candidateIndex\)/,
  );
  assert.match(workspace, /disabled=\{Boolean\(exitDirection \|\| pendingDecisionItemId\)\}/);
});

test("Edit opens the real editor and the tick persists text and drag position", () => {
  assert.match(workspace, /setEditorCandidate\(activeCandidate\)/);
  assert.match(workspace, /<TrendingCreativeEditor/);
  assert.doesNotMatch(workspace, /Editing will be available soon/);
  assert.match(editor, /method: "PATCH"/);
  assert.match(editor, /Confirm and save creative edit/);
  assert.match(editor, /onPointerDown=\{handlePointerDown\}/);
  assert.match(editor, /onPointerMove=\{handlePointerMove\}/);
  assert.match(editor, /textPosition: slide\.textPosition/);
  assert.match(editor, /expectedRevision: edit\.revision/);
});

test("Carousel editing previews the bubble treatment on the clean source image", () => {
  assert.match(editor, /src=\{slide\.backgroundUrl \|\| slide\.renderedUrl\}/);
  assert.match(editor, /function CarouselBubbleText/);
  assert.match(editor, /<feDropShadow/);
  assert.match(editor, /fill="#ffffff"/);
  assert.doesNotMatch(
    editor,
    /w-\[82cqw\] text-center text-white \[text-shadow:/,
  );
  assert.match(editor, /Rendered when Supporting text is empty\./);
});

test("Trending editor footer uses the dialog surface instead of the muted strip", () => {
  assert.match(editor, /<DialogFooter className="[^"]*bg-card[^"]*"/);
});

test("shows only the simple ready-state message and hides customer job operations", () => {
  assert.match(workspace, /We’re preparing new content for you\./);
  assert.doesNotMatch(workspace, /worker did not finish|slides ready|Retry generation/);
  assert.doesNotMatch(sidebar, /Creating in background|jobs running|useActiveBackgroundJobs/);
});

function readProjectFile(relativePath: string) {
  return readFileSync(
    new URL(`../../${relativePath}`, import.meta.url),
    "utf8",
  );
}
