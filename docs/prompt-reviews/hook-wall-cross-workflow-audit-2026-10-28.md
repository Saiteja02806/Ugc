# Hook and Wall cross-workflow audit — 28 October 2026

Read-only application audit. No source fix, deployment, paid generation or hosted write. Consulted current Hook/Wall helpers, API, recovery, source-frame service, draft store, text-fitting paths, WALL_TEXT_CONTEXT and prior Wall production/completion receipts; reused current-session context/prompt/frame/regression procedures. This is code/test evidence, not fresh generated media review.

## Confirmed gaps

1. Wall recovery drops reviewed motion: lib/explore/hook-starting-frame-history.ts special-cases Wall/Talking Head to startingFrameWorkflowDirections, instead of resolving getWallMoneyMotion for canonical source. Fresh preparation in hook-keyframe-prompt-preview selects the six reviewed Wall records. Thus saving/reusing a Wall starting image can replace source-specific timed motion with generic background motion. Correct source image ownership alone does not protect its motion assignment.
2. Wall source-speed/trim is not implemented: video-generation-api only creates hookSourceTimeline for workflow hook; starting-frame-workflow retimes Wall across the full chosen duration and does not use actionDurationSeconds; clip-draft-store initial trim only handles hook. Do not claim Wall automatically retains source-speed actions plus source-end trim. This is scope difference, not proof that Wall's existing proportional mapping is intrinsically wrong.
3. Wall reviewed prompt coverage is six Investing/Money records, not every Wall reference. Others deliberately fall back to generic clean moving-background directions. No evidence of a full Wall catalogue frame-by-frame rewrite exists in the inspected code.
4. Stored frame performance has deployment prerequisites: hook-source-frame.ts only uses public Hook persistent frame storage when EXPLORE_STORED_SOURCE_FRAMES_ENABLED=true or explicitly configured. Missing stored frame gives503; disabled flag permits decoding after memory-cache misses. Wall sources do not enter the public Hook-only stored branch. Therefore original-frame correctness does not establish instant stored loading everywhere; live inventory/flag not checked.
5. Broader known regression failures remain: Slideshow completed neighboring version handoff; two older middle-frame receipt/draft fixture assertions. They were not repaired by this audit.

## Checks which are behaving as implemented locally

New image preparations useframe0, source and identity roles are separate, latest cleanup requests captions/logos/readabletext removal while preservingmaterials. Omni-ownedphoto reuse/removal/replacement tested; unsupportedfirstframeroutesremain singleimage. Hook-only source-speed/reversibletrim and newHook-only initialtextfit are tested. Wall typography is intentionally separate, so the new Hookfit is not a Wall layout change.

Latest local assignments104public+12private have timed directions; sevenpublicreviewgatesremain. Existingusereditedmotion andhistoricalrequestsretainpriority. Hooks45/80/86assignedsixsecondplans;Hook22handroles/warningreconciled. Source fidelity of new images/videos remains untested.

## Current audit tests

24tests:23PASS1FAIL using repository Node server-only loader/module mocks/transform-types and wall-money-references, starting-frame-reference-source, revised-recreate-prompts, starting-frame-history, clip-initial-timing and starting-frame-photo-carryover suites. Failure is Wall test's old expectation preservingphysicaltext versus new actual removePhysicalText cleanup. It does not itself prove an applicationbehaviorbug. Logs outputs/hooks-45-80-86-rewrite-20261028/cross-workflow-audit.log. Tests do not expose the Wall recovery gap because current history expectations acceptgenericWallmotion. No browser/paid/productionacceptanceclaimed.

## Deployment evidence

Prior27OctoberWallreport identifies deployed bundles withsixreviewedWallrecords and approvedframehandoff. Its initialanimation-promptdisclosure correction was onlylocal. This is historicalshippedcodeevidence,notfreshliveauthenticatedacceptance. LatestHook/localpolicychangesremainundeployed under userhold. Privatecorrectedciphertextrelease/activationnotverified. Do not assume allproductionpromptsold orallnew.

Recommended next patch: preservecanonical reviewedWallmotion through recovery first, then decide whether source-speed/trim and storedopeningframecoverage should extend toWall; update stalecleanup-testexpectation; verifyfreshpreparation,reuse,refresh,useredits andactualproviderprompt. Keep genericWallfallback for sources without reviewedplans unless explicitly undertakingtheirsourceaudit.
