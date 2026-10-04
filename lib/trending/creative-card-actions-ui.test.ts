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
const sidebar = readProjectFile("components/layout/app-sidebar.tsx");
const firstVisitGuide = readProjectFile(
  "components/trending/trending-first-visit-walkthrough.tsx",
);
const firstVisitPreview = readProjectFile(
  "app/e2e/trending-walkthrough-preview/page.tsx",
);
const swipeGuide = readProjectFile(
  "components/trending/trending-swipe-guide.tsx",
);
const existingWalkthroughBackfill = readProjectFile(
  "supabase/migration_archive/pre_baseline_20260829/canonical_history/20260828113000_backfill_existing_trending_walkthroughs.sql",
);
const nextConfig = readProjectFile("next.config.ts");
const hookLibrary = readProjectFile("components/library/hook-video-library-tab.tsx");
const wallLibrary = readProjectFile("components/library/wall-text-library-tab.tsx");
const hookDraftRoute = readProjectFile(
  "app/api/trending/hook-videos/drafts/route.ts",
);

test("places Edit in the page header and keeps circular decisions below the card", () => {
  assert.match(actions, /export function CreativeDecisionActions/);
  assert.match(actions, /variant="creative-reject"/);
  assert.match(actions, /rejectAriaLabel = interaction === "post" \? "Skip to the next post"/);
  assert.match(actions, /aria-label=\{rejectAriaLabel\}/);
  assert.match(actions, /rejectTitle = interaction === "post" \? "Skip to the next post"/);
  assert.match(actions, /title=\{rejectTitle\}/);
  assert.match(actions, /acceptAriaLabel = interaction === "post" \? "Like and schedule this post"/);
  assert.match(actions, /aria-label=\{acceptAriaLabel\}/);
  assert.match(actions, /acceptTitle = interaction === "post" \? "Like and schedule"/);
  assert.match(actions, /title=\{acceptTitle\}/);
  assert.match(actions, /export function CreativeEditAction/);
  assert.match(actions, /variant="creative-edit"/);
  assert.match(actions, />\s*Edit\s*</);
  assert.equal((workspace.match(/<CreativeDecisionActions/g) ?? []).length, 1);
  assert.equal((workspace.match(/<CreativeEditAction/g) ?? []).length, 1);
  assert.match(workspace, /createPortal\([\s\S]*<CreativeEditAction/);
  assert.match(workspace, /ref=\{setHeaderActionsRoot\}/);
});

test("keeps Hook video decisions below the review frame on compact laptops", () => {
  assert.match(workspace, /<PostInteractionFeed[\s\S]*<CreativeDecisionActions/);
  assert.match(workspace, /h-\[min\(680px,calc\(100dvh-296px\)\)\]/);
});

test("Reaction Reels expose text-only editing and show preparation instead of accepting an old preview", () => {
  const editAction = workspace.slice(workspace.indexOf("function handleEditActiveCandidate()"), workspace.indexOf("function handleDeckKeyDown("));
  assert.doesNotMatch(editAction, /format === "reaction"/);
  assert.match(workspace, /activeCandidate && headerActionsRoot/);
  assert.match(workspace, /editorCandidate\?\.format === "reaction"[\s\S]*<ReactionTextEditor/);
  assert.match(workspace, /import\("@\/components\/trending\/reaction-text-editor"\)/);
  assert.match(workspace, /creative\.textEditState === "preparing" \? "Preparing video"/);
  assert.match(workspace, /activeCandidate\.item\.creative\.textEditState !== "ready"[\s\S]*return false/);
});

test("keeps original Reaction Reel audio playable in Trending", () => {
  const reactionCard = workspace.slice(
    workspace.indexOf("function TrendingReactionDeckCard("),
    workspace.indexOf("function CarouselDeckCard("),
  );

  assert.match(reactionCard, /muted=\{!soundEnabled\}/);
  assert.match(
    reactionCard,
    /aria-label=\{soundEnabled \? "Mute Reaction audio" : "Play Reaction audio"\}/,
  );
  assert.match(reactionCard, /video\.muted = !nextSoundEnabled/);
  assert.match(reactionCard, /data-deck-control/);
});

test("uses two accessible circular decision targets and a compact Edit pill", () => {
  assert.match(actions, /flex items-center justify-center gap-4 sm:gap-5/);
  assert.match(actions, /LAPTOP_AND_DESKTOP_DECISION_BUTTON_CLASS/);
  assert.match(
    actions,
    /min-\[1024px\]:size-\[clamp\(3\.5rem,calc\(\(100dvh-252px\)\*0\.155\),clamp\(4\.75rem,calc\(124\.5px-3\.25vw\),5rem\)\)\]/,
  );
  assert.match(actions, /reviewLayout\.compactHeightDecisionButton/);
  assert.match(actions, /reviewLayout\.compactHeightDecisionGroup/);
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
  assert.match(contentMixDialog, /barClass: "bg-success"/);
  assert.match(contentMixDialog, /barClass: "bg-info"/);
  assert.match(contentMixDialog, /"--mix-accent": accentColor/);
  assert.match(contentMixDialog, /iconSurfaceClass/);
  assert.match(
    contentMixDialog,
    /getMixValue\(mix, format\)[\s\S]*Math\.max\(getMixValue\(payload\.limits, format\), 1\)/,
  );
});

test("keeps the retired walkthrough assets available only for development previews", () => {
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
  assert.doesNotMatch(workspace, /TrendingFirstVisitWalkthrough/);
  assert.doesNotMatch(workspace, /TrendingApplicationDemo/);
  assert.doesNotMatch(workspace, /SHOW_TRENDING_FIRST_VISIT_WALKTHROUGH/);
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

test("preserves the already-applied walkthrough backfill contract", () => {
  assert.match(existingWalkthroughBackfill, /update public\.business_profiles/i);
  assert.match(existingWalkthroughBackfill, /set trending_walkthrough_completed_at = now\(\)[\s\S]+where trending_walkthrough_completed_at is null/i);
});

test("shows new Trending accounts a safe first-post interaction guide", () => {
  assert.match(swipeGuide, /data-trending-swipe-guide/);
  assert.match(swipeGuide, /Double-tap to schedule/);
  assert.match(swipeGuide, /Scroll to skip/);
  assert.match(swipeGuide, /Tap once to start/);
  assert.match(swipeGuide, /motion-safe:animate-pulse/);
  assert.match(workspace, /onStart=\{dismissSwipeGuide\}/);
  assert.match(workspace, /fetch\("\/api\/trending\/walkthrough"/);
  assert.match(workspace, /function requestCreativeDecision[\s\S]*if \(dismissSwipeGuide\(\)\) \{\s*return false;/);
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
  assert.match(workspace, /"Reaction Reel"/);
  assert.match(workspace, /isReaction[\s\S]*\? Sparkles/);
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

test("keeps only explicitly saved Hook videos in Creative Assets", () => {
  assert.match(
    workspace,
    /candidate\.format === "carousel"[\s\S]*saveCarouselToLibrary\(candidate\)[\s\S]*completeCreativeDecision/,
  );
  assert.match(
    workspace,
    /Could not save this carousel\. It is still in Trending\./,
  );
  assert.match(hookDraftRoute, /drafts: await listSavedHookVideoDrafts\(auth\.user\.uid\)/);
  assert.doesNotMatch(hookDraftRoute, /accepted:/);
  assert.doesNotMatch(hookLibrary, /Continue creating/);
  assert.doesNotMatch(hookLibrary, /resumeHookAssignmentId=/);
  assert.doesNotMatch(workspace, /resumeHookAssignmentId|resumeHookItem/);
  assert.match(wallLibrary, /async function prepareDraft\(assignmentId: string\)/);
  assert.match(wallLibrary, /Ready to prepare/);
  assert.match(wallLibrary, /\{preparing \? "Preparing" : "Prepare"\}/);
});

test("keeps scheduling and recovery controls mounted after the final ready post", () => {
  const gallery = workspace.slice(
    workspace.indexOf("function TrendingFeedGallery("),
    workspace.indexOf("function TrendingIncompleteEmptyState("),
  );
  const feed = workspace.slice(
    workspace.indexOf("function TrendingFeed({"),
    workspace.indexOf("function TrendingHookComposer("),
  );

  assert.match(
    workspace,
    /const trendingFeedSessionKey = `\$\{user\?\.uid \?\? "signed-out"\}:\$\{currentBrowserLocalDate\}`;/,
  );
  assert.match(
    gallery,
    /hasPresentedFeed: boolean;/,
  );
  assert.match(
    workspace,
    /const \[presentedTrendingFeedSessionKey, setPresentedTrendingFeedSessionKey\] = useState\(/,
  );
  assert.match(
    workspace,
    /const hasPresentedTrendingFeed =\s*presentedTrendingFeedSessionKey === trendingFeedSessionKey;/,
  );
  assert.match(
    workspace,
    /if \(nextVisibleItems\.length > 0\) \{\s*setPresentedTrendingFeedSessionKey\(`\$\{userId\}:\$\{currentLocalDate\}`\);/,
  );
  assert.match(
    workspace,
    /setPresentedTrendingFeedSessionKey\(null\);/,
  );
  assert.match(
    workspace,
    /<TrendingFeedGallery[\s\S]*key=\{trendingFeedSessionKey\}[\s\S]*hasPresentedFeed=\{hasPresentedTrendingFeed\}/,
  );
  assert.match(
    gallery,
    /const retainingReviewShell = hasPresentedFeed && items\.length === 0;/,
  );
  assert.match(
    gallery,
    /const shouldRenderFeed = items\.length > 0 \|\| hasPresentedFeed;/,
  );
  assert.match(gallery, /\{shouldRenderFeed \? \(\s*<TrendingFeed/);
  assert.match(feed, /<TrendingDeck[\s\S]*candidates=\{candidates\}/);
  assert.doesNotMatch(feed, /\{candidates\.length > 0 \? \(/);
  assert.match(
    workspace,
    /candidate\.format === "wall_text"[\s\S]*setPendingWallTextScheduleCandidate\(candidate\)/,
  );
  assert.match(workspace, /setActionCandidate\(candidate\)/);
});

test("keeps the Slideshow label above its post in the scrolling feed", () => {
  assert.match(workspace, /format="carousel" positionClassName="bottom-\[calc\(100%\+24px\)\]"/);
  assert.match(workspace, /function renderFeedCandidate[\s\S]*return <div className="relative flex w-full items-center justify-center pt-10"/);
  assert.match(workspace, /content: renderFeedCandidate\(slot.candidate, slot.depth, slot.itemIndex\)/);
});

test("shows real upcoming posts without enabling their controls or autoplay", () => {
  assert.match(workspace, /presentation="feed"/);
  assert.match(workspace, /isActive \|\| presentation === "feed"/);
  assert.match(workspace, /inert=\{isActive \? undefined : true\}/);
  assert.match(workspace, /aria-hidden=\{isActive \? undefined : "true"\}/);
  assert.match(workspace, /onPointerDown=\{ignorePostPointer\}/);
});

test("grows every review format across practical laptop viewport profiles", () => {
  const clamp = (minimum: number, value: number, maximum: number) =>
    Math.min(Math.max(value, minimum), maximum);
  const carouselWidth = (width: number, height: number) =>
    Math.min(
      clamp(300, width * 0.08333 + 220, 380),
      clamp(300, height * 0.41667 - 20, 380),
    );
  const verticalWidth = (width: number, height: number) =>
    Math.min(
      clamp(270, width * 0.07292 + 200, 340),
      clamp(270, height * 0.36458 - 10, 340),
    );
  const wallTextWidth = (width: number, height: number) =>
    Math.min(
      clamp(280, width * 0.07292 + 210, 350),
      clamp(280, height * 0.36458, 350),
    );
  const viewports = [
    [1366, 768],
    [1440, 900],
    [1536, 864],
    [1920, 1080],
  ] as const;

  for (const getWidth of [carouselWidth, verticalWidth, wallTextWidth]) {
    const sizes = viewports.map(([width, height]) => getWidth(width, height));

    assert.ok(sizes[1] >= sizes[0]);
    assert.ok(sizes[2] >= sizes[0]);
    assert.ok(sizes[3] >= sizes[1]);
    assert.ok(sizes[3] >= sizes[2]);
  }

  assert.deepEqual(
    viewports.map(([width, height]) => Math.round(carouselWidth(width, height))),
    [300, 340, 340, 380],
  );
  assert.deepEqual(
    viewports.map(([width, height]) => Math.round(verticalWidth(width, height))),
    [270, 305, 305, 340],
  );
  assert.deepEqual(
    viewports.map(([width, height]) => Math.round(wallTextWidth(width, height))),
    [280, 315, 315, 350],
  );
});

test("shows the complete rendered slide without cropping its headline", () => {
  assert.match(
    workspace,
    /function CarouselDeckCard[\s\S]*className="size-full pointer-events-none object-contain"/,
  );
  assert.doesNotMatch(
    workspace,
    /function CarouselDeckCard[\s\S]*className="size-full pointer-events-none object-cover"/,
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

test("uses the shared post scheduler after accepting a Wall-of-Text Reel", () => {
  assert.match(
    workspace,
    /candidate\.format === "wall_text"[\s\S]*setPendingWallTextScheduleCandidate\(candidate\)/,
  );
  assert.match(
    workspace,
    /\{wallTextCandidate \? \([\s\S]*?<CarouselActionDialog[\s\S]*?actionState=\{wallTextActionState\}[\s\S]*?onSaveToLibrary=\{handleSaveWallText\}[\s\S]*?onSchedulePost=\{handleScheduleWallText\}/,
  );
  assert.match(
    workspace,
    /setPendingWallTextScheduleCandidate\(wallTextCandidate\);[\s\S]*setWallTextCandidate\(null\)/,
  );
  assert.match(
    workspace,
    /contentType: "wall_text"[\s\S]*returnTo: "accounts"/,
  );
  assert.match(
    workspace,
    /scheduleContext\.contentType === "wall_text"[\s\S]*createPendingWallTextSchedule/,
  );
  assert.match(
    workspace,
    /Scheduled\. Your Text Reel is being prepared\./,
  );
  assert.doesNotMatch(workspace, /HookVideoScheduleDrawer/);
});

test("keeps the Carousel format pill attached to its scrolling post", () => {
  assert.match(workspace, /if \(presentation === "feed"\) return \{ opacity: 1/);
  assert.match(workspace, /isActive \? <TrendingFormatPill candidate=\{candidate\} format="carousel"/);
});

test("preserves format labels and the ordered mix of upcoming posts", () => {
  assert.match(workspace, /presentation="feed"/);
  assert.match(workspace, /positionClassName="bottom-\[calc\(100%\+24px\)\]"/);
  const slots = workspace.slice(workspace.indexOf("function getTrendingDeckSlots("), workspace.indexOf("function CarouselFeedState("));
  assert.doesNotMatch(slots, /nextCandidate.format/);
  assert.match(slots, /\[0, 1, 2\]/);
});

test("preserves separate responsive 9:16 frames for Wall-of-Text and video cards", () => {
  assert.match(
    workspace,
    /WALL_TEXT_REVIEW_CARD_FRAME_CLASS\s*=\s*\n\s*`\$\{WALL_TEXT_REVIEW_CARD_WIDTH_CLASS\} aspect-\[9\/16\]`/,
  );
  assert.match(
    workspace,
    /function TrendingWallTextDeckCard\([\s\S]*WALL_TEXT_REVIEW_CARD_FRAME_CLASS,[\s\S]*reviewLayout\.responsiveWallTextFrame/,
  );
  assert.equal(
    (workspace.match(/data-trending-vertical-frame/g) ?? []).length,
    3,
  );
  assert.equal(
    (workspace.match(/VERTICAL_REVIEW_CARD_FRAME_CLASS,/g) ?? []).length,
    2,
  );
  assert.equal(
    (workspace.match(/WALL_TEXT_REVIEW_CARD_FRAME_CLASS,/g) ?? []).length,
    1,
  );
  assert.match(
    workspace,
    /relative size-full overflow-hidden rounded-\[20px\] bg-\[#171717\]/,
  );
});

test("opens the shared scheduler directly after accepting a rendered Reaction Reel", () => {
  assert.match(
    workspace,
    /candidate\.format === "reaction"[\s\S]*setPendingReactionScheduleCandidate\(candidate\)[\s\S]*contentType: "reaction"[\s\S]*returnTo: "trending"/,
  );
  assert.match(
    workspace,
    /scheduleContext\.contentType === "reaction"[\s\S]*createPendingReactionSchedule/,
  );
  assert.match(workspace, /function TrendingReactionDeckCard/);
  assert.match(workspace, /data-trending-vertical-frame/);
});

test("keeps liked posts visible for heart feedback before advancing once", () => {
  assert.match(workspace, /direction === "left" \? 0 : POST_LIKE_FEEDBACK_MS/);
  assert.match(workspace, /liked=\{exitDirection === "right"\}/);
  assert.match(workspace, /completion\(\);[\s\S]*setExitDirection\(null\)/);
  assert.doesNotMatch(workspace, /setPointerCapture/);
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
  assert.match(workspace, /disabled=\{Boolean\(exitDirection \|\| postHistory.browsing\)\}/);
});

test("distinguishes ready cards from the complete remaining daily pack", () => {
  assert.match(
    workspace,
    /getTrendingDeckProgressLabel\(\{[\s\S]*readyCount: visibleCandidates\.length,[\s\S]*remainingCount/,
  );
  assert.match(
    workspace,
    /safeRemainingCount > safeReadyCount[\s\S]*ready now · \$\{safeRemainingCount\} total remaining/,
  );
  assert.match(workspace, /data-trending-deck-progress/);
  assert.match(
    workspace,
    /Trending posts\. \$\{deckProgressLabel\}/,
  );
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

test("keeps the Trending Hook composer available before an accepted Hook opens it", () => {
  assert.match(
    workspace,
    /import \{ HookVideoComposer \} from "@\/components\/trending\/hook-video-composer"/,
  );
  assert.doesNotMatch(
    workspace,
    /const HookVideoComposer = dynamic\(/,
  );
  assert.match(
    workspace,
    /if \(hookComposition\) \{[\s\S]*<TrendingHookComposer[\s\S]*item=\{hookComposition\.item\}/,
  );
  assert.match(
    workspace,
    /function TrendingHookComposer[\s\S]*useState<HookVideoFlowState>[\s\S]*<HookVideoComposer/,
  );
  assert.doesNotMatch(workspace, /function HookVideoComposerLoading\(\)/);
});

test("Carousel editing keeps content headings and shared Slide 1 typography", () => {
  assert.match(editor, /data-carousel-editor-preview=\{/);
  assert.match(editor, /showExactRender \? "exact-render" : "live-render"/);
  assert.match(editor, /function getExactCarouselPreviewUrl/);
  assert.match(editor, /getCarouselBodyBlocks\(supportingText \|\| \(!hasHeading \? slide\.headline : ""\)\)/);
  assert.match(editor, /kind === "headline" \? CAROUSEL_HEADING_FONT_SIZE : CAROUSEL_BODY_FONT_SIZE/);
  assert.match(editor, /WebkitTextStroke: "0\.370cqw rgba\(0, 0, 0, 0\.72\)"/);
  assert.match(editor, /function CarouselEditorBackground/);
  assert.match(editor, /story_product_reveal/);
  assert.match(editor, /function CarouselOutlinedText/);
  assert.match(editor, /function CarouselCoverText/);
  assert.match(editor, /fontSize: `\$\{CAROUSEL_HOOK_FONT_SIZE \/ 10\.8\}cqw`/);
  assert.match(editor, /className="font-bold leading-\[\.98\] text-white"/);
  assert.match(editor, /primaryText=\{slide\.headline\.trim\(\) \|\| supportingText\}/);
  assert.match(editor, /const isCover = slide\.slideNumber === 1/);
  assert.match(editor, /fontSize: isCover \? CAROUSEL_HOOK_FONT_SIZE : CAROUSEL_FIXED_EDITOR_FONT_SIZE/);
  assert.match(editor, /slide\.slideNumber === 1 \? "Hook" : slide\.hasHeading === false && !slide\.subtext \? "Text" : "Headline \(optional\)"/);
  assert.match(
    editor,
    /kind === "headline" \? \(\s*<span className="box-decoration-clone rounded-\[1\.8cqw\] bg-white/,
  );
  assert.match(
    editor,
    /kind === "body"\s*\? \{\s*paintOrder: "stroke fill",\s*WebkitTextStroke: "0\.370cqw rgba\(0, 0, 0, 0\.72\)"/,
  );
  assert.doesNotMatch(editor, /function CarouselBubbleText/);
  assert.doesNotMatch(editor, /fill="#ffffff"/);
  assert.doesNotMatch(editor, /<feDropShadow/);
  assert.doesNotMatch(editor, /Rendered as the bottom action label\./);
});

test("moves the real edited Carousel slide from the latest state instead of a stale closure", () => {
  assert.match(workspace, /function moveActiveSlide\([\s\S]*setActiveSlideByCarouselId\(\(current\) =>/);
  assert.match(workspace, /\[carouselId\]: \(currentIndex \+ direction \+ slideCount\) % slideCount/);
  assert.match(workspace, /onActiveSlideMove=\{moveActiveSlide\}/);
  assert.match(workspace, /onClick=\{\(\) => moveSlide\(1\)\}/);
  assert.match(workspace, /function stopDeckControlPointer/);
  assert.match(workspace, /onPointerMove=\{stopDeckControlPointer\}/);
  assert.match(workspace, /edit\?\.format === "carousel" && edit\.renderState === "ready"/);
  assert.match(workspace, /src=\{editedRenderedUrl \?\? activeSlide\.renderedUrl\}/);
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
    /!retainingReviewShell[\s\S]*items\.length === 0[\s\S]*\(preparing \|\| pendingSlotCount > 0\)[\s\S]*TrendingPreparingEmptyState/,
  );
  assert.match(
    workspace,
    /if \(!retainingReviewShell && !loading && error && items\.length === 0\)/,
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

test("offers to restart Hook generation when the legacy selector never started it", () => {
  assert.match(workspace, /failure=\{trendingFeedFailure\}/);
  assert.match(workspace, /failure\?\.code === "hook_generation_restart_required"/);
  assert.match(
    workspace,
    /actionLabel=\{\s*restartRequired \? "Generate Hook videos" : "Try again"\s*\}/,
  );
  assert.match(workspace, /title=\{restartRequired \? "Hook videos are ready to generate"/);
  assert.match(
    workspace,
    /function openBusinessProfile\(\) \{[\s\S]*router\.push\(`\/onboarding\$\{query \? `\?\$\{query\}` : ""\}`\)/,
  );
  assert.match(workspace, /\) : failure \? \([\s\S]*TrendingFeedFailureState/);
});

function readProjectFile(relativePath: string) {
  return readFileSync(
    new URL(`../../${relativePath}`, import.meta.url),
    "utf8",
  );
}
