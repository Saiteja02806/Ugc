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

test("places Edit in the page header and keeps circular decisions below the card", () => {
  assert.match(actions, /export function CreativeDecisionActions/);
  assert.match(actions, /variant="creative-reject"/);
  assert.match(actions, /aria-label="Reject this creative"/);
  assert.match(actions, /title="Reject"/);
  assert.match(actions, /aria-label="Accept this creative"/);
  assert.match(actions, /title="Accept"/);
  assert.match(actions, /export function CreativeEditAction/);
  assert.match(actions, /variant="creative-edit"/);
  assert.match(actions, />\s*Edit\s*</);
  assert.equal((workspace.match(/<CreativeDecisionActions/g) ?? []).length, 1);
  assert.equal((workspace.match(/<CreativeEditAction/g) ?? []).length, 1);
  assert.match(workspace, /createPortal\([\s\S]*<CreativeEditAction/);
  assert.match(workspace, /ref=\{setHeaderActionsRoot\}/);
});

test("uses two accessible circular decision targets and a separate Edit pill", () => {
  assert.match(actions, /flex items-center justify-center gap-4 sm:gap-5/);
  assert.equal((actions.match(/size="creative-icon"/g) ?? []).length, 2);
  assert.equal((actions.match(/size="creative-edit"/g) ?? []).length, 1);
  assert.match(buttons, /"creative-icon":\s*\n\s*"size-14[^"]*sm:size-16/);
  assert.match(buttons, /"creative-edit":\s*\n\s*"h-11[^"]*sm:h-12/);
  assert.doesNotMatch(actions, /size="creative-action"/);
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

test("labels every Trending card with its content format above the creative", () => {
  assert.match(workspace, /function TrendingFormatPill/);
  assert.match(workspace, /<TrendingFormatPill format=\{activeCandidate\.format\} \/>/);
  assert.match(workspace, /data-trending-format-pill/);
  assert.match(workspace, /\? "Hook video"/);
  assert.match(workspace, /\? "Wall-of-text video"/);
  assert.match(workspace, /: "Carousel"/);
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

test("follows the next creative ID across refreshes, blocks duplicates, and restores on save failure", () => {
  assert.match(workspace, /decisionLockRef\.current = true/);
  assert.match(
    workspace,
    /visibleCandidates\[activeItemIndex \+ 1\]\?\.item\.id \?\? null/,
  );
  assert.match(
    workspace,
    /dismissCandidate\(candidate\);[\s\S]*setActiveItemId\(nextCandidateId\);[\s\S]*commitCreativeDecision/,
  );
  assert.match(
    workspace,
    /getTrendingFeedActiveItemIndex\(\s*visibleCandidates,\s*activeItemId,\s*\(candidate\) => candidate\.item\.id,/,
  );
  assert.match(
    workspace,
    /await persistTrendingCreativeDecision[\s\S]*catch \(error\)[\s\S]*restoreCandidate\(candidate\)[\s\S]*setActiveItemId\(candidate\.item\.id\)/,
  );
  assert.doesNotMatch(workspace, /setActiveItemIndex\(/);
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
