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
  assert.match(workspace, /event\.key === "e" \|\| event\.key === "E"/);
  assert.match(workspace, /data-trending-edited-badge/);
});

test("labels every Trending card with its content format above the creative", () => {
  assert.match(workspace, /function TrendingFormatPill/);
  assert.match(workspace, /<TrendingFormatPill/);
  assert.match(workspace, /data-trending-format-pill/);
  assert.match(workspace, /"Reel Hook"/);
  assert.match(workspace, /"Wall-of-Text"/);
  assert.match(workspace, /Slideshow/);
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

test("advances locally and sends decisions through a durable background outbox", () => {
  assert.match(workspace, /decisionLockRef\.current = true/);
  assert.match(
    workspace,
    /visibleCandidates\[activeItemIndex \+ 1\]\?\.item\.id \?\? null/,
  );
  assert.match(
    workspace,
    /dismissCandidate\(candidate\);[\s\S]*setActiveItemId\(nextCandidateId\);[\s\S]*decisionLockRef\.current = false;[\s\S]*enqueueDecision/,
  );
  assert.match(
    workspace,
    /getTrendingFeedActiveItemIndex\(\s*visibleCandidates,\s*activeItemId,\s*\(candidate\) => candidate\.item\.id,/,
  );
  assert.match(
    workspace,
    /function useTrendingDecisionOutbox[\s\S]*persistTrendingDecisionOutboxEntry/,
  );
  assert.match(workspace, /window\.localStorage\.setItem/);
  assert.match(workspace, /!data\.dailyFeedSlotId/);
  assert.doesNotMatch(workspace, /restoreCandidate\(candidate\)/);
  assert.doesNotMatch(workspace, /Saving choice…/);
  assert.doesNotMatch(
    workspace,
    /\/api\/trending\/(hook-videos|wall-text)\/feed\/prepare/,
  );
  assert.doesNotMatch(workspace, /setActiveItemIndex\(/);
  assert.match(workspace, /disabled=\{Boolean\(exitDirection\)\}/);
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

test("defers the large Trending editor until Edit is opened", () => {
  assert.match(workspace, /const TrendingCreativeEditor = dynamic\(/);
  assert.match(
    workspace,
    /import\("@\/components\/trending\/trending-creative-editor"\)/,
  );
  assert.doesNotMatch(
    workspace,
    /import \{ TrendingCreativeEditor \} from "@\/components\/trending\/trending-creative-editor"/,
  );
  assert.match(
    workspace,
    /editorCandidate \? \([\s\S]*?<TrendingCreativeEditor[\s\S]*?item=\{editorCandidate\.item\}/,
  );
  assert.match(workspace, /function TrendingCreativeEditorLoading\(\)/);
});

test("defers the Trending Hook composer until an accepted Hook opens it", () => {
  assert.match(workspace, /const HookVideoComposer = dynamic\(/);
  assert.match(
    workspace,
    /import\("@\/components\/trending\/hook-video-composer"\)/,
  );
  assert.doesNotMatch(
    workspace,
    /import \{ HookVideoComposer \} from "@\/components\/trending\/hook-video-composer"/,
  );
  assert.match(
    workspace,
    /if \(hookComposition\)[\s\S]*<TrendingHookComposer[\s\S]*item=\{hookComposition\.item\}/,
  );
  assert.match(
    workspace,
    /function TrendingHookComposer[\s\S]*useState<HookVideoFlowState>[\s\S]*<HookVideoComposer/,
  );
  assert.match(workspace, /function HookVideoComposerLoading\(\)/);
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

test("shows one dark 9:16 post skeleton while Trending prepares content", () => {
  assert.match(workspace, /function TrendingPostSkeleton/);
  assert.match(
    workspace,
    /aspect-\[9\/16\] w-\[min\(76vw,248px\)\][^\"]*rounded-\[20px\]/,
  );
  assert.match(workspace, /aria-label="Loading trending content ideas"/);
  assert.doesNotMatch(workspace, /CarouselLoadingStackVisual/);
  assert.doesNotMatch(workspace, /LOADING_STACK_PLACEHOLDERS/);
  assert.doesNotMatch(workspace, /Preparing ideas/);
  assert.doesNotMatch(workspace, /Glossy light-sweep wave/);
  assert.match(workspace, /animate-pulse[^"]*bg-\[#151517\]/);
  assert.doesNotMatch(workspace, /We’re preparing new content for you\./);
  assert.doesNotMatch(workspace, /Your next ideas are being prepared\./);
  assert.doesNotMatch(workspace, /Ready posts will appear here automatically/);
  assert.doesNotMatch(workspace, /worker did not finish|slides ready|Retry generation/);
  assert.doesNotMatch(sidebar, /Creating in background|jobs running|useActiveBackgroundJobs/);
});

test("holds partial daily results behind the skeleton until the pack is complete", () => {
  assert.match(workspace, /setTrendingFeedState\(data\.feed\?\.state \?\? null\)/);
  assert.match(
    workspace,
    /preparing=\{trendingFeedState === "preparing"\}/,
  );
  assert.match(
    workspace,
    /if \(preparing\) \{\s*return <TrendingPostSkeleton \/>;\s*\}/,
  );
});

function readProjectFile(relativePath: string) {
  return readFileSync(
    new URL(`../../${relativePath}`, import.meta.url),
    "utf8",
  );
}
