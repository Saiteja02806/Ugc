import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actions = readProjectFile(
  "components/trending/creative-card-actions.tsx",
);
const workspace = readProjectFile(
  "components/trending/trending-workspace.tsx",
);
const skeletonStyles = readProjectFile(
  "components/trending/trending-post-skeleton.module.css",
);
const editor = readProjectFile(
  "components/trending/trending-creative-editor.tsx",
);
const contentMixDialog = readProjectFile(
  "components/trending/trending-content-mix-dialog.tsx",
);
const buttons = readProjectFile("components/ui/button.tsx");
const hookCard = readProjectFile("components/trending/hook-video-card.tsx");
const hookDeck = readProjectFile("components/trending/hook-video-deck.tsx");
const hookAudio = readProjectFile(
  "components/trending/hook-audio-preview.tsx",
);
const wallAudio = readProjectFile(
  "components/trending/wall-text-audio-preview.tsx",
);
const wallTextDetail = readProjectFile(
  "components/trending/wall-text-detail-view.tsx",
);
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

test("uses two accessible circular decision targets and a compact Edit pill", () => {
  assert.match(actions, /flex items-center justify-center gap-4 sm:gap-5/);
  assert.equal((actions.match(/size="creative-icon"/g) ?? []).length, 2);
  assert.equal((actions.match(/size="creative-edit"/g) ?? []).length, 1);
  assert.match(buttons, /"creative-icon":\s*\n\s*"size-14[^"]*sm:size-16/);
  assert.match(
    buttons,
    /"creative-edit":\s*\n\s*"h-9[^"]*px-3\.5[^"]*text-sm/,
  );
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

test("restores Adjust as the global content-mix action beside item-level Edit", () => {
  assert.match(workspace, /data-trending-adjust-control/);
  assert.match(workspace, /aria-label="Adjust Trending content mix"/);
  assert.match(workspace, />\s*Adjust\s*</);
  assert.match(
    workspace,
    /data-trending-adjust-control[\s\S]*variant="creative-edit"[\s\S]*size="creative-edit"/,
  );
  assert.match(
    workspace,
    /<Button[\s\S]*data-trending-adjust-control[\s\S]*<div ref=\{setHeaderActionsRoot\}/,
  );
  assert.match(
    workspace,
    /import\("@\/components\/trending\/trending-content-mix-dialog"\)/,
  );
  assert.match(contentMixDialog, /fetch\("\/api\/trending\/content-mix"/);
  assert.match(contentMixDialog, /method: "PUT"/);
  assert.match(contentMixDialog, />\s*Adjust content mix\s*</);
  assert.match(contentMixDialog, /Editing an individual creative remains under Edit/);
  assert.match(contentMixDialog, /type="range"/);
  assert.match(contentMixDialog, /Your Free mix is fixed/);
  assert.match(contentMixDialog, /barClass: "bg-primary"/);
  assert.match(contentMixDialog, /barClass: "bg-accent-purple"/);
  assert.match(contentMixDialog, /barClass: "bg-info"/);
  assert.match(contentMixDialog, /"--mix-accent": accentColor/);
  assert.match(contentMixDialog, /iconSurfaceClass/);
  assert.match(
    contentMixDialog,
    /mix\[format\] \/ Math\.max\(payload\.limits\[format\], 1\)/,
  );
});

test("keeps review cards, audio controls, and creative actions flat", () => {
  assert.doesNotMatch(
    buttons,
    /"creative-(?:reject|accept|edit)":\s*\n\s*"[^"]*shadow/,
  );
  assert.doesNotMatch(actions, /shadow-(?:none|xs|sm)/);
  assert.match(
    hookCard,
    /rounded-\[20px\] border border-border\/80 bg-foreground-strong/,
  );
  assert.doesNotMatch(hookCard, /shadow-\[/);
  assert.doesNotMatch(hookDeck, /shadow-\[0_10px_26px/);

  for (const audioControl of [hookAudio, wallAudio]) {
    assert.match(audioControl, /size-8[^\"]*border-white\/20 bg-black\/60/);
    assert.doesNotMatch(audioControl, /(?:shadow-|backdrop-blur)/);
    assert.match(audioControl, /focus-visible:ring-2 focus-visible:ring-white/);
  }

  assert.doesNotMatch(
    workspace,
    /shadow-\[0_14px_30px_rgba\(0,0,0,0\.32\)\]/,
  );
  assert.doesNotMatch(
    workspace,
    /data-trending-edited-badge[\s\S]{0,350}(?:shadow-|backdrop-blur)/,
  );
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
  assert.match(
    workspace,
    /h-\[22px\][^"]*px-2[^"]*text-\[10px\]/,
  );
  assert.match(workspace, /cn\("size-3 shrink-0", iconColor\)/);
});

test("centers the active creative over visible inert next-card layers", () => {
  assert.match(
    workspace,
    /CAROUSEL_REVIEW_CARD_WIDTH_CLASS\s*=\s*\n\s*"w-\[min\(78vw,270px,calc\(\(100dvh-238px\)\*0\.8\)\)\]"/,
  );
  assert.match(
    workspace,
    /VERTICAL_REVIEW_CARD_WIDTH_CLASS\s*=\s*\n\s*"w-\[min\(76vw,230px,calc\(\(100dvh-238px\)\*0\.5625\)\)\]"/,
  );
  assert.match(
    workspace,
    /className="relative flex min-h-0 w-full flex-1 flex-col items-center justify-center"/,
  );
  assert.match(
    workspace,
    /data-trending-card-state=\{getTrendingDeckCardState\(depth\)\}/,
  );
  assert.match(
    workspace,
    /pointer-events-none absolute inset-0 overflow-visible/,
  );
  assert.match(workspace, /overflow-x-clip overflow-y-visible/);
  assert.equal(
    (workspace.match(/data-trending-card-state=/g) ?? []).length,
    3,
  );
  assert.equal(
    (workspace.match(/inert=\{isActive \? undefined : true\}/g) ?? []).length,
    3,
  );
  assert.match(workspace, /function getTrendingDeckSlots/);
  assert.match(workspace, /depth === 1 \? "next" : "preload"/);
  assert.match(workspace, /Math\.abs\(dragX\) \/ SWIPE_THRESHOLD_PX/);
  assert.match(workspace, /dragX=\{dragX\}/);
  assert.match(workspace, /isDragging=\{isDragging\}/);
  assert.doesNotMatch(workspace, /size-px overflow-hidden opacity-0/);
});

test("keeps actual upcoming media ready behind either swipe direction", () => {
  assert.match(
    workspace,
    /const revealProgress = isActive[\s\S]*Math\.abs\(dragX\)/,
  );
  assert.match(workspace, /previewUrl=\{previewUrl\}/);
  assert.match(workspace, /preload=\{depth <= 1 \? "auto" : "metadata"\}/);
  assert.match(workspace, /src=\{editedRenderedUrl \?\? activeSlide\.renderedUrl\}/);
  assert.doesNotMatch(workspace, /dragX > 0 \?/);
});

test("keeps the Wall-of-Text accepted view compact and action-only", () => {
  assert.match(wallTextDetail, /max-w-\[220px\]/);
  assert.match(
    wallTextDetail,
    /"Create a Schedule"[\s\S]*"Save to Creative Assets"/,
  );
  assert.match(wallTextDetail, /onClick=\{\(\) => void onSchedule\(\)\}/);
  assert.doesNotMatch(wallTextDetail, /Review the complete overlay/);
  assert.doesNotMatch(wallTextDetail, /Wall-text Reel<\/p>/);
  assert.doesNotMatch(wallTextDetail, /Overlay copy/);
  assert.doesNotMatch(wallTextDetail, /getWallTextRenderBlocks/);
});

test("attaches a slightly larger but compact flat format label to the card", () => {
  assert.match(
    workspace,
    /pointer-events-none z-10 mb-1\.5 flex items-center justify-start/,
  );
  assert.match(
    workspace,
    /inline-flex h-\[22px\][^\"]*border-border\/60 bg-card\/80[^\"]*text-\[10px\] font-medium/,
  );
  assert.match(workspace, /const iconColor = isHook/);
  assert.match(workspace, /className=\{cn\("size-3 shrink-0", iconColor\)\}/);
  assert.doesNotMatch(
    workspace,
    /data-trending-format-pill[\s\S]{0,400}(?:shadow-|drop-shadow|backdrop-blur|ring-)/,
  );
  assert.doesNotMatch(actions, /shadow-(?:none|xs|sm)/);
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

test("Carousel editing starts from the exact render and keeps live previews structure-aware", () => {
  assert.match(editor, /data-carousel-editor-preview=\{/);
  assert.match(editor, /showExactRender \? "exact-render" : "live-render"/);
  assert.match(editor, /function getExactCarouselPreviewUrl/);
  assert.match(editor, /function Structure2StoryText/);
  assert.match(editor, /color: "#141518"/);
  assert.match(editor, /fontWeight: 600/);
  assert.match(editor, /function CarouselEditorBackground/);
  assert.match(editor, /story_product_reveal/);
  assert.match(editor, /function CarouselBubbleText/);
  assert.match(editor, /fill="#ffffff"/);
  assert.doesNotMatch(editor, /<feDropShadow/);
  assert.match(editor, /Rendered as the bottom action label\./);
});

test("Carousel editor presents a quiet Hook library folder", () => {
  assert.match(editor, />\s*Hook library\s*</);
  assert.match(editor, /<Folder className="size-4"/);
  assert.doesNotMatch(editor, />\s*Hyper Hooks\s*</);
});

test("Trending editor footer uses the dialog surface instead of the muted strip", () => {
  assert.match(editor, /<DialogFooter className="[^"]*bg-card[^"]*"/);
});

test("shows one dark 9:16 post skeleton while Trending prepares content", () => {
  assert.match(workspace, /function TrendingPostSkeleton/);
  assert.match(
    workspace,
    /VERTICAL_REVIEW_CARD_WIDTH_CLASS,[\s\S]{0,180}aspect-\[9\/16\] rounded-\[20px\]/,
  );
  assert.match(
    workspace,
    /VERTICAL_REVIEW_CARD_WIDTH_CLASS, "mb-1\.5 h-5"/,
  );
  assert.match(workspace, /className="mt-3\.5 h-14 sm:mt-4 sm:h-\[86px\]"/);
  assert.match(workspace, /aria-label="Loading trending content ideas"/);
  assert.doesNotMatch(workspace, /CarouselLoadingStackVisual/);
  assert.doesNotMatch(workspace, /LOADING_STACK_PLACEHOLDERS/);
  assert.doesNotMatch(workspace, /Preparing ideas/);
  assert.doesNotMatch(workspace, /Glossy light-sweep wave/);
  assert.doesNotMatch(workspace, /animate-pulse[^"]*bg-\[#151517\]/);
  assert.match(skeletonStyles, /background: #18191c/);
  assert.match(skeletonStyles, /width: 32%/);
  assert.match(skeletonStyles, /rgb\(255 255 255 \/ 5\.5%\) 50%/);
  assert.match(skeletonStyles, /animation: trending-post-shimmer 2s linear infinite/);
  assert.match(skeletonStyles, /transform: translate3d\(-120%, 0, 0\)/);
  assert.match(skeletonStyles, /transform: translate3d\(420%, 0, 0\)/);
  assert.match(skeletonStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(skeletonStyles, /box-shadow: 0 4px 16px rgb\(0 0 0 \/ 8%\)/);
  assert.match(skeletonStyles, /animation-play-state: paused/);
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
  assert.match(workspace, /const showSkeleton = loading \|\| preparing/);
  assert.match(workspace, /<TrendingPostSkeleton active=\{showSkeleton\} \/>/);
  assert.match(workspace, /inert=\{showSkeleton \? true : undefined\}/);
  assert.match(workspace, /transition-opacity duration-200 ease-linear/);
  assert.match(
    workspace,
    /showSkeleton \? "pointer-events-none opacity-0" : "opacity-100"/,
  );
});

function readProjectFile(relativePath: string) {
  return readFileSync(
    new URL(`../../${relativePath}`, import.meta.url),
    "utf8",
  );
}
