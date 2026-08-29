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
const firstVisitGuide = readProjectFile(
  "components/trending/trending-first-visit-walkthrough.tsx",
);
const firstVisitPreview = readProjectFile(
  "app/e2e/trending-walkthrough-preview/page.tsx",
);
const existingWalkthroughBackfill = readProjectFile(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260828113000_backfill_existing_trending_walkthroughs.sql",
);
const nextConfig = readProjectFile("next.config.ts");

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
  assert.match(
    contentMixDialog,
    /Editing an individual creative remains under\s+Edit/,
  );
  assert.match(contentMixDialog, /type="range"/);
  assert.doesNotMatch(contentMixDialog, /Your Free mix is fixed/);
  assert.doesNotMatch(contentMixDialog, /View plans/);
  assert.match(contentMixDialog, /className="mt-4 flex h-1\.5/);
  assert.match(contentMixDialog, /\[&::-webkit-slider-runnable-track\]:h-1\.5/);
  assert.match(contentMixDialog, /\[&::-webkit-slider-thumb\]:size-3\.5/);
  assert.match(contentMixDialog, /rounded-xl border border-border\/70 bg-card/);
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

test("teaches new Trending users the difference between editing one post and adjusting future content", () => {
  assert.match(actions, /data-trending-edit-control/);
  assert.match(firstVisitGuide, /type WalkthroughPhase = "preview" \| "controls"/);
  assert.match(firstVisitGuide, /selector: "\[data-trending-edit-control\]"/);
  assert.match(firstVisitGuide, /selector: "\[data-trending-adjust-control\]"/);
  assert.match(firstVisitGuide, /Edit this post/);
  assert.match(firstVisitGuide, /This affects this post only\./);
  assert.match(firstVisitGuide, /Adjust future content/);
  assert.match(firstVisitGuide, /This shapes future posts and does not change this one\./);
  assert.match(firstVisitGuide, /waiting_for_edit/);
  assert.match(firstVisitGuide, /new MutationObserver\(sync\)/);
  assert.match(firstVisitGuide, /createPortal\(/);
  assert.match(firstVisitGuide, /data-trending-walkthrough-control-guide/);
  assert.match(firstVisitGuide, /data-trending-walkthrough-control-step=\{step\}/);
  assert.doesNotMatch(firstVisitGuide, /setTimeout\(onComplete, 3_800\)/);
  assert.match(firstVisitGuide, /trending-walkthrough-control-highlight/);
  assert.match(existingWalkthroughBackfill, /update public\.business_profiles/i);
  assert.match(
    existingWalkthroughBackfill,
    /set trending_walkthrough_completed_at = now\(\)[\s\S]+where trending_walkthrough_completed_at is null/i,
  );
  assert.match(firstVisitGuide, /WALKTHROUGH_DEMO_SOURCE = "\/marketing\/showcase-part2\/demo-preview\.mp4"/);
  assert.match(firstVisitGuide, /src=\{WALKTHROUGH_DEMO_SOURCE\}/);
  assert.match(firstVisitGuide, /data-trending-walkthrough-skip/);
  assert.match(firstVisitGuide, /aria-label="Skip walkthrough"/);
  assert.match(firstVisitGuide, /WALKTHROUGH_DESKTOP_QUERY = "\(min-width: 1024px\)"/);
  assert.match(firstVisitGuide, /window\.matchMedia\(WALKTHROUGH_DESKTOP_QUERY\)/);
  assert.match(firstVisitGuide, /if \(preview \|\| !desktopEligible\) return/);
  assert.match(
    firstVisitGuide,
    /if \(!desktopEligible \|\| visibility !== "visible"\) return null/,
  );
  assert.match(firstVisitGuide, /onClick=\{onSkip\}/);
  assert.match(firstVisitGuide, /const showControlGuide = useCallback\(\(\) => \{\s*setPhase\("controls"\);\s*\}, \[\]\);/);
  assert.match(firstVisitGuide, /<WalkthroughCanvas[\s\S]*onSkip=\{showControlGuide\}/);
  assert.doesNotMatch(firstVisitGuide, /<WalkthroughCanvas[\s\S]*onSkip=\{finish\}/);
  assert.match(firstVisitGuide, /How our Trending feed works/);
  assert.match(firstVisitGuide, /border-b border-white\/\[0\.08\]/);
  assert.match(firstVisitGuide, /data-walkthrough-stage/);
  assert.doesNotMatch(firstVisitGuide, /data-walkthrough-generation-progress/);
  assert.match(
    firstVisitGuide,
    /absolute bottom-\[-0\.75rem\] right-\[-1rem\] z-40 flex w-\[640px\] items-end justify-end/,
  );
  assert.match(firstVisitGuide, /h-8 shrink-0 items-center/);
  assert.match(firstVisitGuide, /data-walkthrough-floating-panel/);
  assert.doesNotMatch(firstVisitGuide, /width: "min\(640px, 48%\)"/);
  assert.match(
    firstVisitGuide,
    /left:76%;top:74\.5%;transform:scale\(\.82\)/,
  );
  assert.match(
    firstVisitGuide,
    /height: "min\(500px, calc\(100dvh - 10rem\)\)"/,
  );
  assert.doesNotMatch(firstVisitGuide, /relative aspect-video w-full/);
  assert.match(firstVisitGuide, /setPhase\("controls"\)/);
  assert.doesNotMatch(firstVisitGuide, /backdrop-blur-\[0\.5px\]/);
  assert.doesNotMatch(firstVisitGuide, /0 0 0 100vmax/);
  assert.match(firstVisitGuide, /w-\[640px\]/);
  assert.match(firstVisitGuide, /size-full object-contain/);
  assert.match(firstVisitGuide, /data-walkthrough-next-action=\{nextAction\}/);
  assert.match(firstVisitGuide, /format === "hook" \? "Add demo" : "Schedule post"/);
  assert.match(firstVisitGuide, /trendingWalkthroughSceneEnter/);
  assert.match(firstVisitGuide, /trendingWalkthroughSceneExit/);
  assert.match(firstVisitGuide, /for \(const source of SLIDES\)/);
  assert.match(firstVisitGuide, /loading="eager"/);
  assert.match(firstVisitGuide, /trendingWalkthroughMediaFade/);
  assert.match(firstVisitGuide, /You&apos;re ready/);
  assert.match(firstVisitPreview, /h-dvh min-h-0 flex-col overflow-hidden/);
  assert.match(firstVisitPreview, /data-trending-feed-transition/);
  assert.match(firstVisitPreview, /Generating for you/);
  assert.match(
    firstVisitPreview,
    /4 content pieces are being prepared\. New content will appear/,
  );
  assert.match(
    workspace,
    /<div className="min-w-0 flex-1">[\s\S]*<TrendingFeedGallery[\s\S]*<TrendingFirstVisitWalkthrough/,
  );
  assert.match(
    firstVisitGuide,
    /data-walkthrough-format-label[\s\S]*data-walkthrough-media-frame/,
  );
  assert.match(firstVisitGuide, /setReducedMotion\(!preview && query\.matches\)/);
  assert.match(firstVisitGuide, /trending-walkthrough-reduced-motion/);
  assert.match(firstVisitGuide, /const scheduleNextStep = \(\) =>/);
  assert.match(firstVisitGuide, /data-walkthrough-step=\{step\.kind\}/);
  assert.match(nextConfig, /allowedDevOrigins: \["127\.0\.0\.1"\]/);
  assert.match(firstVisitGuide, /method: "POST"/);
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

test("labels every Trending card with its content format", () => {
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

test("keeps swiped cards dismissed when the Hook composer temporarily replaces the deck", () => {
  assert.match(workspace, /excludeDecidedTrendingFeedItems/);
  assert.match(
    workspace,
    /const enqueueDecision = useCallback\([\s\S]*setTrendingItems\([\s\S]*excludeDecidedTrendingFeedItems[\s\S]*item\.assignmentId/,
  );
  assert.match(
    workspace,
    /inMemoryTrendingFeed = \{[\s\S]*items: excludeDecidedTrendingFeedItems/,
  );
});

test("raises only the Slideshow label above its stacked preview", () => {
  assert.match(
    workspace,
    /function getTrendingFormatPillPositionClass\(\)\s*\{[\s\S]*bottom-\[calc\(100%\+72px\)\]/,
  );
  assert.equal(
    (
      workspace.match(
        /positionClassName="left-0 bottom-\[calc\(100%\+14px\)\]"/g,
      ) ?? []
    ).length,
    2,
  );
});

test("centers a card-sized review frame over visible inert next-card layers", () => {
  assert.match(
    workspace,
    /CAROUSEL_REVIEW_CARD_WIDTH_CLASS\s*=\s*\n\s*"w-\[min\(78vw,270px,calc\(\(100dvh-348px\)\*0\.8\)\)\]"/,
  );
  assert.match(
    workspace,
    /VERTICAL_REVIEW_CARD_WIDTH_CLASS\s*=\s*\n\s*"w-\[min\(76vw,230px,calc\(\(100dvh-348px\)\*0\.5625\)\)\]"/,
  );
  assert.match(
    workspace,
    /className="relative flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-x-clip overflow-y-visible pb-\[107px\] pt-\[94px\]"/,
  );
  assert.match(workspace, /data-trending-review-frame/);
  assert.match(workspace, /getTrendingReviewCardFrameClass\(activeCandidate\.format\)/);
  assert.doesNotMatch(workspace, /w-full max-w-3xl flex-col items-center/);
  assert.match(
    workspace,
    /data-trending-card-state=\{getTrendingDeckCardState\(depth\)\}/,
  );
  assert.match(
    workspace,
    /pointer-events-none absolute inset-0 overflow-visible/,
  );
  assert.match(
    workspace,
    /absolute left-1\/2 top-full z-40 w-max -translate-x-1\/2/,
  );
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

test("fills the fixed slideshow frame without side gutters", () => {
  assert.match(
    workspace,
    /function CarouselDeckCard[\s\S]*className="size-full pointer-events-none object-cover"/,
  );
  assert.doesNotMatch(
    workspace,
    /function CarouselDeckCard[\s\S]*className="size-full pointer-events-none object-contain"/,
  );
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

test("anchors Wall-of-Text actions at the top of the accepted Reel", () => {
  assert.match(wallTextDetail, /grid w-full max-w-2xl items-start/);
  assert.match(wallTextDetail, /data-wall-text-action-rail/);
  assert.match(wallTextDetail, /className="min-w-0 self-start"/);
  assert.match(wallTextDetail, /Next step[\s\S]*Keep this Reel moving/);
  assert.match(
    wallTextDetail,
    /Create a Schedule[\s\S]*Choose an account and publish time/,
  );
});

test("keeps the Carousel format pill above its centered media stack", () => {
  assert.match(
    workspace,
    /pointer-events-none absolute left-0 z-40 flex w-full items-center justify-start/,
  );
  assert.match(workspace, /bottom-\[calc\(100%\+72px\)\]/);
  assert.doesNotMatch(workspace, /bottom-\[calc\(100%\+40px\)\]/);
  assert.doesNotMatch(workspace, /hasTallerVerticalBackground/);
  assert.match(workspace, /pb-\[107px\] pt-\[94px\]/);
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

test("keeps Hook and Wall-of-Text pills close above their video frame", () => {
  assert.match(workspace, /type TrendingDeckPresentation = "centered" \| "video_peek"/);
  assert.match(workspace, /VIDEO_PEEK_CARD_STYLES/);
  assert.match(workspace, /translateX: 12/);
  assert.doesNotMatch(workspace, /translateX: 178/);
  assert.match(
    workspace,
    /interpolateDeckValue\(\s*inactiveTranslateX,\s*promotedTranslateX,\s*revealProgress,\s*\)/,
  );
  assert.match(workspace, /presentation === "video_peek" && !isActive/);
  assert.match(workspace, /activeFormat !== "carousel"/);
  assert.match(workspace, /nextCandidate && nextCandidate\.format !== "carousel"/);
  assert.equal(
    (
      workspace.match(
        /positionClassName="left-0 bottom-\[calc\(100%\+14px\)\]"/g,
      ) ?? []
    ).length,
    2,
  );
  assert.doesNotMatch(workspace, /positionClassName="left-2\.5 top-2\.5 w-auto"/);
  assert.match(workspace, /data-trending-video-peek=\{[\s\S]*presentation === "video_peek"/);
  assert.match(workspace, /activeCandidate\.format === "carousel" \? \(/);
});

test("locks Hook and Wall-of-Text to the same responsive 9:16 frame", () => {
  assert.match(
    workspace,
    /VERTICAL_REVIEW_CARD_FRAME_CLASS\s*=\s*\n\s*`\$\{VERTICAL_REVIEW_CARD_WIDTH_CLASS\} aspect-\[9\/16\]`/,
  );
  assert.equal(
    (workspace.match(/data-trending-vertical-frame/g) ?? []).length,
    2,
  );
  assert.equal(
    (workspace.match(/VERTICAL_REVIEW_CARD_FRAME_CLASS,/g) ?? []).length,
    2,
  );
  assert.match(
    workspace,
    /relative size-full overflow-hidden rounded-\[20px\] bg-\[#171717\]/,
  );
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
  assert.match(workspace, /aria-label="Loading trending content"/);
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

test("shows ready ideas while other daily slots are still preparing or failed", () => {
  assert.match(workspace, /setTrendingFeedState\(data\.feed\?\.state \?\? null\)/);
  assert.match(
    workspace,
    /preparing=\{trendingFeedState === "preparing"\}/,
  );
  assert.match(
    workspace,
    /const showSkeleton = loading/,
  );
  assert.match(
    workspace,
    /items\.length === 0 && \(preparing \|\| pendingSlotCount > 0\)[\s\S]*TrendingPreparingEmptyState/,
  );
  assert.match(
    workspace,
    /if \(!loading && error && items\.length === 0\)/,
  );
  assert.match(
    workspace,
    /data\.feed\?\.state === "failed" && nextVisibleItems\.length === 0/,
  );
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
