# UGCPilot UI & Workflow Mistake Ledger (`clear.md`)

UGC-UI-046 browser follow-up: actual fourteen-profile local fixture now PASS after fetch receiver correction: edited text/width/color, save/reopen, blank removal, full12s/mobile bounds. Hosted acceptance OPEN; no deployment/generation. Layout inventory remains52added/47remaining in99record local scope.

29 October UGC-UI-046 browser recovery continuation: CODE/RUNTIME CONFIRMED fixture status reported Failed to execute fetch on Window: Illegal invocation. useClipDraftSave supplied native fetch as an object property, invoked by transport with the wrong receiver. Wrapped it in a lexical call;24focused editor/layout checks and scoped lint pass. Actual browser rerun pending. No deployment/generation; related browser acceptance remains OPEN until rerun.

UGC-UI-046 29 October continuation: local profiles f5bc/c2fb/5286 added; initializer/source/hash/duration/saved-style tests pass. Editor fixture lacked useId; stable hook mock added and10/10pass. Browser fixture timed out waiting Ready; cause UNKNOWN, batch browser acceptance OPEN. Typecheck blocked by unrelated PageProps undefined in avatars page. No deployment/generation. Receipt docs/prompt-reviews/wall-next-three-admission-2026-10-29.md.

UGC-UI-046 continuation: locally admitted three further source-bound layouts 652f/e95c/2fe0. Actual initializer and manual saved-style tests retain words/duration; hash mismatch and overflow rejected; longer-copy fits or asks review. 41 focused tests/types/lint and actual-catalogue browser save/reopen/blank/mobile/full12s checks pass. Hosted acceptance remains OPEN; no deploy/generation. Receipt docs/prompt-reviews/wall-three-nonnumbered-admission-2026-10-28.md.

UGC-UI-046 follow-up 28 October 2026: eight actual local profiles added (49/52/56/58/62/63 then45/57). Source-specific outlines/position refined without changing prior profiles. 38 focused tests, types/lint and actual-profile browser save/reopen/mobile/full12s pass. Historical saved-style protections pass through 63.565s. No deployment/generation. Hosted and actual-footage acceptance remain OPEN; other layouts unfinished. Receipt docs/prompt-reviews/wall-eight-local-admission-2026-10-28.md.

### UGC-UI-032 — Rotating hero fallback font clips on mobile when font fails
- Date:2026-10-27. Status:OPEN; AUDIT/BROWSER CONFIRMED. Linked hero audit UGC-UI-031.
- Observed: deliberately abort InstrumentSerif-Italic.ttf in actual-component390pxChrome fixture; Georgia fallback makes firstphrase two lines within1.2em stage, causing clipping. Root cause CODECONFIRMED fallbackglyphwidth plusfixedstage/overflowclip. Normalfontloaded anddelayedfontlayoutchecks pass.
- Expected: readable fallback with same reservedgeometry; no pageoverflow or movement. Regression: blocked_rotating_font_keeps_firstphrase_inside_stage_at_mobile_widths. Record fix only after actualnegativebrowsercheckpasses.

UGC-UI-032 localfix27October2026: adjustedGeorgiafallback82%; exactfontabort390testnowPASS(readablewithinreservedstage/nooverflow),delayedfontswapstablePASS. Sixviewportheadline/loop/reducedmotionchecksPASS;lint/types/gallery5PASS. ProductionNOTVERIFIED. Sidebysideaudit docs/hero-side-by-side-audit-2026-10-27.md.

### UGC-UI-031 — Hero headline pairing feels disconnected from reference
- Date:2026-10-27. Status:OPEN; USER REPORTED/SCREENSHOT OBSERVED d1161ae7. First/second lines feel misaligned and the motion does not match the supplied Reception clip. Root cause UNKNOWN before measurement; source currently uses semibold Geist firstline and extra margin/1.4em animated stage.
- Expected: reference-like regular sans/italic serif pairing, compact visually connected two-line heading, restrained transition, stable rest-of-hero geometry. User explicitly hides MCP hero badge until further instruction; show Instagram/TikTok/YouTube only.
- Regression: reference_hero_pairing_and_social_only_badge — computed typography/gap and visual desktop/mobile comparison; firstline/CTA/gallery stationary across transitions, no overflow, reduced-motion; MCP names/tag absent on load and after multiple former badge intervals. Preserve unrelated sections and existing merge work.

UGC-UI-031 local correction27October2026 (renumbered from colliding029 without changing the separate closing-CTA029): measured reference regularSuisse72/400,lineheight1.12,zeroextra margin,InstrumentSerif72/400; publichero source confirms2.4s,±20px/±90rotateX/4pxblur,spring900/80/10. ExistingGeist400/72cap +92%InstrumentSerif,compact1.2emstage removes disconnectedweight/gap; source-like3Dtilt/spring sampledCSS addedwithoutdependency. Socialbadge defaultsfalseMCP/no-timer; no names/statusinitial/after6.4s; opt-inpreserved. Actualhero6width +badge6theme/widthcasesPASS,regularfont/stablegeometry/3phrases/reducedmotion/emojioption/links/nooverflow/0errors;types/lint/gallery5/diffPASS. Screenshots before/after and refreshedvideo inspected; localacceptanceVERIFIED/userfinalvisualacceptancepending,productionNOTDEPLOYED/NOTVERIFIED. Receipt docs/landing-rotating-text-2026-10-27.md. No unrelatedworktreeorbackend mutation.

UGC-UI-031 side-by-side audit27October2026: source video and local preview cropped at identical spatial scale, synchronized approximately to firsttransition, hstacked and sampled. AUDIT/CODE CONFIRMED outstandingdifferences: rotating font deliberately92% while sourceuses1em, and noIntersectionObserver gating althoughreference rotatesonly50%visible. StatusOPENforcorrection; testsmust verifyequalfont-size, offscreenpause/resume and slow/failedfontno-layoutshift. IntentionalGeist-versus-licensedSuisse/darktheme/copy differences remainexplicit; do not claimexactpixelmatch.

UGC-UI-031 auditcorrections27October2026: equal1emfont,50%IntersectionObserverpause/resume,andnoheadlinefullstop; newchecksPASSsixwidthsplusoffscreen2.7s/slowfont/failedfont/reducedmotion. ComparisonMP4sourceLEFT/localRIGHTand5fpssheetsinspected. Latestmobileuserrequest hidesPostrightawayonlybelow640andcompactsocialpill; desktoplabelretained,MCPstilloff. Userfinalvisualacceptancepending; nohostedacceptance/deployment. Receipt docs/hero-side-by-side-audit-2026-10-27.md.

**Purpose:** This is the append-only record of reported mistakes and their safeguards. It is NOT an AI-generated list of proven code-level root causes. Read it at the beginning of every Codex task together with the real `explore context.md`. NEVER erase previous incidents to make the list appear clean.

## Maintenance rules

- When a user reports something wrong, add an OPEN incident immediately, even before debugging.
- Quote user intent accurately. Record what is directly visible, versus what is reported, versus what still needs verification.
- Add an executable test or explicit manual test for every incident.
- If resolved, retain the incident and append resolution evidence: git commit/ref, test command, screenshot/video, observed backend result and date.
- If the same mistake recurs, add a NEW incident with `Recurrence of: UGC-...`; do not silently reopen without history.
- Never create root cause explanations without inspecting code and logs.
- If an incoming user instruction changes an approved contract, explicitly update the contract and the linked incident instead of pretending the former rule never existed.

## Reported incidents — October 25, 2026

### UGC-UI-001 — Duplicate Choose Photos tile under starting-frame preview
- Status: OPEN; severity: P1; area: Hook Video > Create > Generate.
- Evidence: user-provided screenshot with starting-frame preview, Change overlay, and unwanted Choose Photos tile below; user report.
- Observed: two distinct photo selection affordances when a starting frame already exists.
- Expected: one starting-frame preview with a Change button; clicking Change opens photo selection for replacement and supported additional references; no always-visible standalone Choose Photos tile in the loaded state.
- Root cause: UNKNOWN; investigate component rendering conditions and reference-image state.
- Must-test: existing image displays exactly one card; Change opens correct selector; add/replace/cancel work; reload preserves preview; no duplicate tile at desktop or mobile sizes.
- Historical context links: `EXPLORE_CONTEXT.md` sections `2026-10-24 Compact starting-frame photo library`, `2026-10-22 One face-image chooser`, and `Stable generation reference controls — 18 October 2026` document earlier duplicate/expanding chooser problems and the intended single-entry behavior.

### UGC-UI-002 — Starting-frame restoration causes layout jump / unclear loading
- Status: OPEN; severity: P1; area: Hook Video > Create.
- Evidence: screenshot showing `Restoring your starting frame...` and much shorter panel vs loaded state.
- Observed: loaded image region is missing during restoration, changing the layout substantially.
- Expected: reserve preview height with a skeleton, restore image reliably, show actionable failure when restoration fails. Never present an endless spinner/message.
- Root cause: UNKNOWN; verify whether a genuine indefinite stall occurs or only a normal async transition.
- Must-test: cold launch, refresh, slow network, missing object, expired signed URL, stale state, recovery; ensure stable layout.
- Historical context links: `EXPLORE_CONTEXT.md` sections `2026-10-24 Recreate source-frame latency recurrence`, `2026-10-24 Creator starting-frame failure and loading recurrence`, and `2026-10-22 Starting-image transient status recovery` describe repeated loading, restoration and recovery failures.

### UGC-UI-003 — Changes damage established UI quality/layout
- Status: OPEN; severity: P1; area: Hook Video shell and adjacent tabs.
- Evidence: repeated user reports; screenshots vary by state/viewport; no approved baseline supplied yet.
- Observed/reported: a fix in one part changes working UI elsewhere.
- Expected: localized patches without unsolicited changes to components, spacing, tabs, scroll, loading states, or responsive behavior.
- Root cause: UNKNOWN; inspect git history, shared components and CSS specificity.
- Must-test: desktop/mobile screenshots of Create, Demo, Schedule, References, Your videos; before/after visual diff; keyboard and scroll behavior.
- Historical context links: `EXPLORE_CONTEXT.md` section `Read first: recurring failures the user has had to correct` records lost/repurposed controls, renamed sections, unreachable actions and desktop-only layout reviews as repeated mistakes. Related historical family: UGC-UI-004.

### UGC-VID-001 — Occluded face unsuitable as influencer generation anchor
- Status: OPEN; severity: P0; area: Recreate the account > Reference video > starting frame.
- Evidence: screenshot of source creator with hand over mouth; user reports face-transfer/generation difficulty.
- Observed: an input source frame may obscure important facial features.
- Expected: review source video over time; use the first frame if sufficiently visible, otherwise select a suitable timestamp (often mid-video) that preserves scene and identity feasibility; record timestamp and motion implications.
- Root cause: UNKNOWN; audit extraction/selection algorithm and face visibility decisions.
- Must-test: clear front face, face obscured by hand, profile angle, heavy blur, face absent, multiple persons, mid-video anchor. Verify image quality and timestamp metadata.
- Historical context links: `EXPLORE_CONTEXT.md` sections `Repeated facial-adherence failure: glasses/hand Hook`, `Clearer-frame direction clarified`, and the 23–24 October curated-frame reviews document occlusion and candidate-frame tradeoffs.

### UGC-VID-004 — Generated influencer starting image may be poor despite adequate source frame
- Status: OPEN; severity: P0; area: Image-generation quality/identity transfer.
- Evidence: user reports influencer face sometimes lacks usable clarity even when original starting frame is acceptable; generated samples not supplied in this session.
- Observed: USER REPORTED output quality problem; do not infer that source-frame selection is always the cause.
- Expected: two independent quality checks, one for source-frame usability and one for rendered influencer-face identity clarity, pose, lighting and anatomy. Retry/debug image generation when source is good, use different source timestamp only where evidence supports it.
- Root cause: UNKNOWN; inspect identity references, image-generation prompt, model parameters, source frame and generated samples.
- Must-test: good source / good output, good source / bad output, bad source / good later candidate, multiple reference images and prompt variants; verify temporal alignment after any anchor change.
- Historical context links: `EXPLORE_CONTEXT.md` sections `Starting-frame layout and scene-preservation recurrence`, `Repeated facial-adherence failure: glasses/hand Hook`, and `Clearer-frame pilot completed on Hook 50; mixed image fidelity` distinguish valid inputs from failed visual fidelity. Related historical family: UGC-VID-006.

### UGC-VID-002 — Source-video analysis and generation prompts misdescribe actions
- Status: OPEN; severity: P0; area: Recreate video prompt pipeline.
- Evidence: user report that prompt became incorrect after frame-quality changes; prompt text not provided.
- Observed: REPORTED prompt mismatch; cannot establish exact failure without prompt templates and model traces.
- Expected: time-stamped motion plan, camera/expression/gesture continuity, correct relation between source video timestamp and generated start image; faithful source scene plus influencer identity.
- Root cause: UNKNOWN; inspect all stages and transformations including prompt assembly, token caps, model response and output mapping.
- Must-test: first-frame anchor, middle-frame anchor, hand-covering-face action, fast transition, looping action, changed selected reference, negative controls for incompatible instructions.
- Historical context links: `EXPLORE_CONTEXT.md` section `Starting frame + optional face photos, three-second output and Hook 100` records that a later anchor must begin after the completed glasses-removal gesture and must not replay it. The clearer-frame entries likewise require post-anchor chronology.

### UGC-VID-003 — Preview may show `Loading preview...` for reference video
- Status: NEEDS INVESTIGATION; severity: P2; area: Reference gallery.
- Evidence: screenshot with `Loading preview...` badge on one card.
- Observed: loading badge in a still image; no proof of persistent failure.
- Expected: timely preview resolution or a clear retry/fallback; never indefinitely freeze. Maintain size while loading.
- Root cause: UNKNOWN.
- Must-test: fast/slow media load, media errors, caching, switching references.
- Historical context links: `EXPLORE_CONTEXT.md` sections `Creator starting-frame failure and loading recurrence` and `Upload, library and idle-tab performance recurrence` require bounded, owner-scoped media loading, cancellation and retry without stale results.

### UGC-SCH-001 — 24-hour time picker replaced with plain `HH:mm` input
- Status: OPEN; severity: P1; area: Schedule tab.
- Evidence: user-provided screenshot and report that former time selector was removed.
- Observed: a basic manually entered field appears with `00:00–23:59` helper text.
- Expected: preserve/restore the established interactive 24-hour time selector (not merely a string field); accept valid local times and retain values after tab change/reload.
- Root cause: UNKNOWN; inspect original picker component, commits and form binding.
- Must-test: 00:00, 09:30, 21:30, 23:59, invalid 24:00, cross-midnight, keyboard/mobile, reload.
- Historical context links: `EXPLORE_CONTEXT.md` section `2026-10-25 Explicit 24-hour scheduling time (local)` establishes 00–23 hour and 00–59 minute behavior, while older AM/PM guidance is superseded.

### UGC-SCH-002 — Scheduling end-to-end is reportedly unreliable
- Status: OPEN; severity: P0; area: Schedule > publishing pipeline.
- Evidence: user report; screenshot alone does NOT demonstrate backend failure. The disabled button may correctly require missing account/date/time.
- Observed: user reports scheduling not working properly; no confirmed database/job evidence available.
- Expected: selected platform account(s) + caption + valid local date/time -> durable backend schedule/targets -> server-side execution -> platform result/clear failure; no reliance on browser staying open; safe retries and idempotency.
- Root cause: UNKNOWN; inspect API, persistence, job execution, target creation, credentials, scheduled worker, error handling, timezone and duplicates.
- Must-test: valid schedule, missing fields, job row and targets created, close browser, 21:30 IST conversion, failed post/retry, multi-account partial success, dedupe.
- Historical context links: `CAROUSEL_CONTEXT.md` sections `Explore scheduling integrity and Talking Head session recovery`, `Scheduled publication time and account region audit`, and `Explore schedule time rejection recovery` document atomic target creation, durable execution, due-time enforcement and uncertain-request recovery.

## One-time historical import — October 25, 2026

This import groups repeated occurrences into distinct regression families rather
than duplicating every historical release note. The full source files remain the
authority for dated implementation and deployment evidence. During installation,
18 distinct families were appended and the eight starter incidents above were
cross-linked to matching history. All imported entries remain historical and need
fresh verification before being treated as current failures or current fixes.

### UGC-UI-004 — Visual cleanup hides, renames or repurposes core workflow actions
- Date/source: HISTORICAL; `EXPLORE_CONTEXT.md` sections `Read first: recurring failures the user has had to correct`, `Demo overview: Hook and Talking Head`, and `Focused clip editors`.
- Status: HISTORICAL / NEEDS CONFIRMATION; severity: P1; area: Explore shared workflow shell.
- Evidence/observed: the context records repeated loss or repurposing of upload, replacement, Demo sound, editing, saving and return navigation during visual changes; controls could exist in code but be hidden, covered or unreachable.
- Expected behavior: preserve each workflow's section names, action destinations, accepted media, drafts and recovery. Create, Demo/Edit and Schedule responsibilities remain distinct; laptop and mobile users can reach every retained action.
- Root cause: UNKNOWN for any current recurrence; historic occurrences involved shared layout/visibility decisions.
- Regression test: before/after section-and-action map plus real desktop/mobile navigation through Create, Demo/Edit, Schedule, replacement, save and return paths.
- Recurrence of: UGC-UI-003.

### UGC-UI-005 — Failed or stale media operations overwrite accepted selections
- Date/source: HISTORICAL; `EXPLORE_CONTEXT.md` sections `Recreate step-by-step audit`, `Upload, library and idle-tab performance recurrence`, and `Slideshow attachment/history correction`.
- Status: HISTORICAL / NEEDS CONFIRMATION; severity: P1; area: media selection, restoration and uploads.
- Evidence/observed: historical flows cleared an approved frame during replacement, failed to restore the composer selection, or risked late async results replacing newer choices.
- Expected behavior: failed replacement retains accepted media and edits; owner/source changes cancel stale work; late responses cannot overwrite a newer selection; reload restores the same validated asset.
- Root cause: UNKNOWN for current code.
- Regression test: select A, begin slow replace/restore, switch to B, force A failure/success late, reload, and assert B plus its draft/provenance remain authoritative.

### UGC-UI-006 — Saved slideshow or Carousel edits appear reset after navigation
- Date/source: HISTORICAL; `CAROUSEL_CONTEXT.md` sections `Trending edit recovery and rendering latency`, `Trending review recovery after navigation or refresh`, and `Slideshow latency, screenshot persistence and history repairs`.
- Status: HISTORICAL / NEEDS CONFIRMATION; severity: P1; area: Carousel/Slideshow edit recovery.
- Evidence/observed: users reported saved edits resetting after route/tab return; in-flight saves and history/current-draft state could be lost or confused.
- Expected behavior: accepted saves survive remount and lost responses without a second mutation; recovery never overwrites newer typing; current draft, generated history and saved Library output remain distinct.
- Root cause: UNKNOWN for current code; cited sections describe earlier visit-local state and recovery gaps.
- Regression test: save during navigation, lose the response, return/reload, type a newer edit during recovery and verify one mutation, correct revision and no draft overwrite.

### UGC-UI-007 — Library background changes erase Carousel body text
- Date/source: HISTORICAL; `CAROUSEL_CONTEXT.md` sections `Library backgrounds lost body text` and `Repeated library-background text loss: missed dedicated worker repaired`.
- Status: HISTORICAL / NEEDS CONFIRMATION; severity: P0; area: Carousel edit renderer and deployment.
- Evidence/observed: owned six-slide edits retained copy in storage but rendered blank body slides after background replacement; the dedicated edit worker remained on an older mapping.
- Expected behavior: changing backgrounds preserves all submitted body copy and renders it on every slide; release verification checks the actual queue-routed edit worker and resulting pixels.
- Root cause: HISTORICALLY CODE-CONFIRMED in the cited context as legacy `headline` versus `subtext` mapping plus an omitted worker rollout; not revalidated during installation.
- Regression test: six-slide body-only edit with new backgrounds, inspect stored copy and pixels on all outputs, verify renderer version and active worker digest.

### UGC-UI-008 — Fractional text geometry corrupts rendered glyph segments
- Date/source: HISTORICAL; `CAROUSEL_CONTEXT.md` section `Missing glyph segments in edited slides — confirmed worker serialization defect` and matching Explore shared-renderer note.
- Status: HISTORICAL / NEEDS CONFIRMATION; severity: P1; area: manual text rendering.
- Evidence/observed: intact saved text rendered with damaged letter segments when fractional coordinates produced non-finite SVG path tokens.
- Expected behavior: preview and worker output preserve complete glyphs across supported fonts, positions and styles; invalid geometry fails explicitly.
- Root cause: HISTORICALLY CODE-CONFIRMED in the cited context as unsafe OpenType path serialization; not revalidated during installation.
- Regression test: rasterize representative glyphs at fractional positions across all supported font faces and assert finite path data and visible glyph ink.

### UGC-UI-009 — Trending review cannot reliably return to prior posts
- Date/source: HISTORICAL; `CAROUSEL_CONTEXT.md` sections `Same-visit finger swipe-back correction` and `Trending review recovery after navigation or refresh`.
- Status: HISTORICAL / NEEDS CONFIRMATION; severity: P1; area: Trending gestures and history.
- Evidence/observed: ordinary shorter downward touch gestures failed to return to the prior Reel, and leaving/reloading lost visit-local reviewed-post snapshots.
- Expected behavior: bounded native touch reversal selects exactly one adjacent prior item; authenticated review history restores after navigation/reload without replaying decisions or leaking across accounts.
- Root cause: HISTORICALLY CODE-CONFIRMED in the cited context as missing touch release policy and visit-local React state; not revalidated during installation.
- Regression test: phone/tablet touch up/down sequences, reload, empty server feed, account switch, corrupt/blocked storage and exact decision-count assertions.

### UGC-UI-010 — Shared reference controls duplicate or reflow as selections grow
- Date/source: HISTORICAL; `EXPLORE_CONTEXT.md` sections `Stable generation reference controls`, `Generation image picker multi-selection`, and `Hook generation references — redundant library entry removed`.
- Status: HISTORICAL / NEEDS CONFIRMATION; severity: P1; area: Hook/Talking Head/Wall reference controls.
- Evidence/observed: a forced two-column layout pushed Audio onto another row, selected images could add/displace controls, and a redundant library entry duplicated existing chooser capability.
- Expected behavior: Image, Video and Audio occupy stable visible slots; multiple images stay inside one Image tile; existing chooser sources remain inside that control without extra permanent buttons.
- Root cause: UNKNOWN for current code.
- Regression test: zero/one/many images with video/audio at laptop and mobile widths; assert stable slot order, no duplicate entry and retained selections after model changes.

### UGC-VID-005 — Starting-frame scene and identity roles are conflated or dropped
- Date/source: HISTORICAL; `EXPLORE_CONTEXT.md` sections `Starting frame plus optional animation face references remains missing` and `Starting frame + optional face photos, three-second output and Hook 100`.
- Status: HISTORICAL / NEEDS CONFIRMATION; severity: P0; area: starting-image/video request plumbing.
- Evidence/observed: historical code cleared optional photos when choosing a scene, derived empty reference images, rejected mixed scene/person inputs, or risked silently dropping references on unsupported models.
- Expected behavior: approved scene and optional identity photos remain separate, frozen roles through client/API/worker/provider, and unsupported combinations block clearly while allowing removal or model choice.
- Root cause: UNKNOWN for current code.
- Regression test: select scene plus several owned face references, change each independently, switch supported/unsupported models, submit/recover and assert exact provider roles and immutable IDs.

### UGC-VID-006 — Technical completion is mistaken for scene or identity fidelity
- Date/source: HISTORICAL; `EXPLORE_CONTEXT.md` sections `Repeated facial-adherence failure: glasses/hand Hook`, `Starting-frame layout and scene-preservation recurrence`, and clearer-frame pilots.
- Status: HISTORICAL / NEEDS CONFIRMATION; severity: P0; area: generated starting-image quality.
- Evidence/observed: completed jobs could preserve the wrong identity, allow identity photos to override the scene, retain the source person, or alter wardrobe/background despite correct inputs.
- Expected behavior: evaluate identity, scene, pose, hands, clothing, camera and continuity independently after generation; require explicit approval and never infer fidelity from job status or input validation.
- Root cause: historical evidence shows unstable model role precedence in reviewed outputs; no single current code root cause is established.
- Regression test: controlled same-scene/multiple-identity matrix with independent source-frame and generated-frame QA, recorded provider/model/prompt/asset IDs and rejection of critical mismatches.
- Related to: UGC-VID-004.

### UGC-VID-007 — Hook Remix over-rewrites source voice, roles or named products
- Date/source: HISTORICAL; `EXPLORE_CONTEXT.md` sections `Hook Remix clarification: small word edits, not a new hook`, `Hook v7 scope: fix only the human-role substitutions`, and `Recent Remix audit: Claude failure confirmed on deployed v7`.
- Status: HISTORICAL / NEEDS CONFIRMATION; severity: P1; area: Hook Remix text generation.
- Evidence/observed: outputs invented new scenarios, substituted a product for a person role, or replaced an explicitly named tool with a generic category despite valid business context.
- Expected behavior: retain source emotion, delivery, line structure, human roles and named tools; make only the minimum product-relevance wording change and permit already-applicable text to remain unchanged.
- Root cause: UNKNOWN for current active prompt/model.
- Regression test: frozen corpus covering person roles, named tools, already-applicable copy, block/line preservation and semantic review beyond length/schema validation.

### UGC-VID-008 — Video references are silently omitted, downgraded or mapped as images
- Date/source: HISTORICAL; `CAROUSEL_CONTEXT.md` section `Explore image and video reference correction` and `EXPLORE_CONTEXT.md` Hook Recreate/source entries.
- Status: HISTORICAL / NEEDS CONFIRMATION; severity: P0; area: Explore reference admission and provider payloads.
- Evidence/observed: historical paths could show a video poster as an image, omit an unsupported video, or route preview mode through a legacy full-video intent instead of the intended starting-frame flow.
- Expected behavior: video selection binds the actual owned clip and correct task mode; unsupported models disclose incompatibility and retain attachments; poster pixels never substitute for video semantics.
- Root cause: UNKNOWN for current code.
- Regression test: select image and video references across supported/unsupported models, inspect frozen request payload and provider input, reload/recover, and assert no omission or poster substitution.

### UGC-VID-009 — Slideshow reference delivery is mistaken for visual fidelity
- Date/source: HISTORICAL; `EXPLORE_CONTEXT.md` sections `Slideshow recreation recurrence`, `Fresh v3 fidelity and master-slide assembly audit`, and `Latest slideshow quality investigation`; `CAROUSEL_CONTEXT.md` section `Manual Explore slideshow fidelity recurrence`.
- Status: HISTORICAL / NEEDS CONFIRMATION; severity: P1; area: slideshow generation.
- Evidence/observed: some jobs omitted the requested attachment; others received it but invented a different light UI or redesigned unrelated scene/text details. Stubbed checks proved delivery, not fidelity.
- Expected behavior: requested assets are present before billing, unchanged regions remain faithful, and visual acceptance inspects real outputs; exact screenshot insertion uses compositing when generation cannot guarantee it.
- Root cause: multiple historical failure modes; no single current root cause established.
- Regression test: positive/negative attachment admission plus real-output review for exact reference presence, unchanged geometry/text, provider/model/prompt provenance and credit behavior.

### UGC-SCH-003 — Ambiguous schedule responses are retried as new mutations
- Date/source: HISTORICAL; `EXPLORE_CONTEXT.md` section `Saved-caption drawer and scheduling timeout recovery` and `CAROUSEL_CONTEXT.md` section `Explore schedule time rejection recovery`.
- Status: HISTORICAL / NEEDS CONFIRMATION; severity: P0; area: schedule submission recovery.
- Evidence/observed: network timeout or lost response can leave acceptance uncertain; an automatic POST retry or new idempotency key could duplicate schedules/posts.
- Expected behavior: persist immutable request identity, recover the accepted request by read, distinguish explicit time rejection from uncertainty, and never replace/post automatically on missing GET evidence alone.
- Root cause: UNKNOWN for any current recurrence.
- Regression test: server accepts then drops response; client reloads/retries; assert one schedule, exact targets/options/time and no second mutation.

### UGC-SCH-004 — Generic job recovery publishes future posts early
- Date/source: HISTORICAL; `CAROUSEL_CONTEXT.md` section `Scheduled publication time and account region audit`.
- Status: HISTORICAL / NEEDS CONFIRMATION; severity: P0; area: publishing recovery.
- Evidence/observed: production traces historically tied 48 early publications to generic stale-job recovery redispatching future publish jobs without a final due-time guard.
- Expected behavior: recovery selection, atomic claim and worker execution all enforce the target's not-before instant and `next_attempt_at`; waiting cannot call the provider or consume retries.
- Root cause: HISTORICALLY CODE-CONFIRMED in the cited context as a missing final not-before check; not revalidated during installation.
- Regression test: mark a future job stale, run every recovery/claim path, and assert no provider call before due time; verify execution once due and idempotent cleanup afterward.

### UGC-SCH-005 — Valid media fails scheduling preparation because timeline or duration metadata is mishandled
- Date/source: HISTORICAL; `EXPLORE_CONTEXT.md` section `Scheduling preparation timing failure` and `CAROUSEL_CONTEXT.md` section `Captioned Explore schedule receipt verification`.
- Status: HISTORICAL / NEEDS CONFIRMATION; severity: P0; area: final-media verification before scheduling.
- Evidence/observed: small valid track start offsets produced `COMPOSITION_TIMELINE_UNSUPPORTED`; a validated speech duration was lost during parsing and became `VIDEO_DURATION_INVALID`.
- Expected behavior: bounded valid timeline offsets are normalized without changing relative timing; validated duration survives receipt parsing; deterministic invalid media gets an actionable error and is not blindly retried.
- Root cause: HISTORICALLY CODE-CONFIRMED in cited sections; not revalidated during installation.
- Regression test: exact affected media receipts plus synthetic 0–100 ms offsets, malformed duration and unchanged retry; assert correct preparation or typed terminal error with no duplicate schedule.

### UGC-OPS-001 — Partial deployment leaves the active worker on incompatible code
- Date/source: HISTORICAL; `CAROUSEL_CONTEXT.md` section `Repeated library-background text loss: missed dedicated worker repaired` and `EXPLORE_CONTEXT.md` section `Hook Remix emoji recurrence: production renderer release gap`.
- Status: HISTORICAL / NEEDS CONFIRMATION; severity: P0; area: deployment verification.
- Evidence/observed: website or one render target was updated while the queue-routed Carousel edit worker or active video-render worker/job still served older code, so reported fixes recurred in outputs.
- Expected behavior: enumerate every queue/service/job consumer, deploy compatible versions in safe order, read active traffic/digest/config back, then exercise a fresh real job and inspect its output/version.
- Root cause: HISTORICALLY CODE-CONFIRMED as omitted or stale deployment targets; not revalidated during installation.
- Regression test: release manifest maps queues to active targets and asserts source/digest parity plus one end-to-end renderer receipt per affected route.

### UGC-OPS-002 — Completed provider video is treated as failed because output collection rejects a valid host
- Date/source: HISTORICAL; `EXPLORE_CONTEXT.md` section `WAN/ReAPI completed-output collection — 18 October 2026`.
- Status: HISTORICAL / NEEDS CONFIRMATION; severity: P1; area: provider output recovery.
- Evidence/observed: a WAN task completed, but the adapter rejected the returned CDN host and exhausted recovery with a generic failure even though the paid output existed.
- Expected behavior: safely allow only verified provider output hosts, persist completion before collection, poll the same task/refresh URL and never submit another paid generation as recovery.
- Root cause: HISTORICALLY CODE-CONFIRMED as a narrow output-host allowlist; not revalidated during installation.
- Regression test: saved completed task returning each approved host, expired refreshed URL, lookalike/redirect rejection and proof of zero replacement POSTs.

### UGC-OPS-003 — Local builds or mocked checks are reported as production acceptance
- Date/source: HISTORICAL; repeated warnings throughout `EXPLORE_CONTEXT.md` and `CAROUSEL_CONTEXT.md`, including `Read first: recurring failures`, `Manual Explore slideshow fidelity recurrence`, and deployment receipts.
- Status: HISTORICAL / OPEN SAFEGUARD; severity: P1; area: verification and reporting.
- Evidence/observed: context repeatedly distinguishes compiled support, mocked provider tests, isolated fixtures and local screenshots from authenticated production behavior, provider fidelity and deployed worker acceptance.
- Expected behavior: report each verification layer separately; user-facing flows using authentication, production data or hosted integrations receive final acceptance on the real production domain and correct backend target.
- Root cause: process/reporting gap rather than a single code defect.
- Regression test: completion receipt must enumerate environment, real/mock boundaries, active deployment identities, production checks and explicit NOT VERIFIED items; CI/build alone cannot set production status.

### UGC-VID-010 — Clear identity anchor is mistaken for the animation opening frame
- Date/user request: 2026-10-25; user clarified that a face-clear frame may be selected from any suitable point in the source video only to establish the influencer identity, while the recreated video must still begin with the source video's original opening action and continue through its ending.
- Status: OPEN / DESIGN CLARIFIED; severity: P0; area: Hook Recreate starting-image and motion-prompt pipeline.
- Evidence: USER REPORTED clarification in the Explore audit conversation; illustrative opening has a hand covering the mouth while a later frame exposes the face clearly. No source video or generated output was supplied for frame-level verification in this clarification.
- Observed: the current terminology and single-frame path can treat the selected clear middle frame as the literal first animation frame, which either omits the original opening or creates a contradiction when the motion prompt asks for earlier actions.
- Expected behavior: keep two explicit roles. `identity_clarity_anchor` may come from any reviewed suitable source timestamp; `animation_opening_frame` must recreate the original source t=0 pose/scene with the selected influencer. The video prompt begins from that actual opening image and covers the complete reviewed source action through the ending. If a provider cannot support this route, block or disclose the limitation; never rely on text alone to make a later literal first frame represent an earlier pose.
- Impact/dependent components: frame analysis/selection, stored frame metadata, image prompting, generated-image review, composer persistence, API/worker receipts, provider payload roles, motion-prompt compilation, recovery/history and Hook Create UI labels.
- Root cause: UNKNOWN until the current runtime path and provider capabilities are traced against this clarified contract. Existing static audit indicates one generated frame currently serves both clarity and animation-start roles.
- Fix scope and explicit non-goals: separate the two roles and bind the full-source motion plan to the recreated opening. Do not add a fixed timestamp rule, discard original opening actions, claim exact stochastic reproduction, change Schedule, or introduce a second permanent Choose Photos control.
- Regression test that would have caught it: `hook_full_recreation_uses_clear_identity_anchor_and_original_opening` — fixture source t=0 has hand over mouth and a later clear face; assert distinct timestamped receipts, recreated opening matches source t=0 pose, provider first-frame input is the recreated opening, identity references remain bound, and the motion timeline includes the original hand movement through the source ending without treating the later anchor as generated t=0.
- Related incidents: UGC-VID-001, UGC-VID-002, UGC-VID-004, UGC-VID-005 and UGC-VID-006.
- Audit update, 2026-10-25: CODE/DATA/FRAME CONFIRMED for every current nonzero case. The public gallery has 21 nonzero clarity frames and Recreate-the-account has 10; all 31 default prompt paths begin from or continue after the later clarity anchor instead of rebuilding original t=0. All 31 source videos were decoded; 118 of 118 native contact sheets covering all 3,110 frames were visually inspected, and configured indices were in range. This does not claim all 3,110 frames received written semantic annotations or that paid generated outputs passed. Hook 64 and creator-account-2-04 retain most recognizable post-anchor motion because their anchors are near the opening pose, but still fail literal t=0 chronology/provenance.
- Root cause update, 2026-10-25: CODE CONFIRMED. `hook-curated-motion.ts` explicitly begins after the selected-frame gesture; `hook-keyframe-image-prompt.ts` recreates the selected pose and only includes verified opening text for frame zero; `hook-keyframe-motion.ts` calls that image the complete opening; `gemini-omni-video.ts` sends it as literal `FIRST_FRAME`; client/composer selection types have no separate identity-anchor/opening receipts. The private path selects `selectedFrameDirections` as `generationPrompt` for matching nonzero frames. Detailed evidence: `docs/middle-frame-prompt-and-recreate-account-audit-2026-10-25.md`.
- Pilot implementation update, 2026-10-26: LOCALLY IMPLEMENTED / VISUAL ACCEPTANCE OPEN for stable Hook reference `explore-paired-hook-fc44f6214b6e17413600ec13` only. Receipt v4 now freezes the original stored frame-zero evidence as `animationOpeningFrame`, the reviewed frame-70/2.333-second source evidence as `sourceFrame`, the exact browser preparation key and ordered influencer assets. The still prompt assigns t=0 composition to the first image, later-frame continuity evidence to the second, and identity authority only to the user's ordered photos. The Hook 100 motion plan covers source t=0 through the reviewed ending, and worker/provider admission rejects changed hashes, timestamps, byte payloads or reference order before submission. The generated still output—not either source evidence image—is the only approved animation first-frame URL. Hook 100 storage preparation, paid still/video generation, generated-pixel review, deployment and authenticated production acceptance were not performed.
- Pilot regression evidence, 2026-10-26: targeted API/receipt/prompt/provider/video-worker tests prove v4 role order, exact frame bytes, full chronology and generated-output-only `FIRST_FRAME`; client recovery stays bound to the v3 browser preparation; the existing UI retains one preview/Change entry and responsive browser checks passed at 1440×900, 1280×720, 390×844 and 320×568 with no horizontal overflow. This is technical contract evidence, not proof of identity, pose, occlusion or motion fidelity from a real generated output. Keep the incident OPEN until one explicitly approved paid Hook 100 still/video trial passes frame-by-frame visual review.

## Incident template (copy and append; NEVER overwrite prior entries)

### 2026-10-26 three-second follow-up — UGC-VID-010 / UGC-VID-011
- User authorized one new source-reviewed prompt test after dedicated skills were created. One real three-second Omni output, operation `v1_Chd4dXZlYXBmYk11TEY2OTRQdE9HOGtBZxIXeHV2ZWFwZmJNdUxGNjk0UHRPRzhrQWc`; same approved opening and portrait, prompt shortened from 2417 to 1326 characters with distinct observed phases and full duration mapping.
- All 72 frames reviewed. Ending scene cut did not recur, creator caption stayed absent, original opening/removal and action order present, no smile. Remaining removal delay ~0.2 s, excessive worried inner-brow contraction, insufficient source wide-eyed surprise and closer framing mean PARTIAL PASS, not a qualified full recreation.
- Exact retained image/prompt roles confirmed; raw/silent 72 decoded pictures identical; final output exactly 3 s and silent. Duration and prompt changed together, so causal attribution for scene-cut improvement remains UNKNOWN. UGC-VID-011 stays OPEN; one trial does not prove general reference reliability.
- Regression evidence and future acceptance: same image/duration, inspect every frame for source event boundaries, expression and subject scale, plus final-tail scene continuity. Full artifact/report: `docs/hook100-three-second-test-results-2026-10-26.md`. No other reference changes, runtime rollout, automatic retry or deployment.

### UGC-VID-011 — Omni appearance reference becomes an unrequested ending scene
- Date/evidence: 2026-10-26, authorized Hook 100 caption-v2 real trial; completed Google Omni interaction `v1_ChdyZURlYXJQa09ZSG42OTRQdGRQQjRRWRIXcmVEZWFyUGtPWUhuNjk0UHRkUEI0UVk`.
- Status: OPEN / PROVIDER OUTPUT CONFIRMED; severity P0; area: image-to-video scene continuity with an optional identity photo.
- Observed: 4-second, 96-frame output begins from the approved caption-free t=0 glasses-on image and removes the glasses once. At zero-based frame 90 / 3.75 seconds it abruptly cuts from the window setting/black sweater/earbud to the identity photo's bedroom/gray shirt/necklace for all six final frames. The middle expression also becomes a smile and frontal gaze arrives early.
- Expected: one uninterrupted source scene, camera and wardrobe through the complete requested duration; identity photos affect facial appearance only; original surprise and action timing preserved.
- Root cause: UNKNOWN inside provider generation. Retained Google interaction confirms exact approved opening bytes, exact identity-photo bytes, literal `<FIRST_FRAME>@Image1`, separate `<IMAGE_REF_0>@Image2`, and complete motion/scene-lock prompt. The source action plan ends at 3.733 seconds while requested output is 4 seconds; possible contribution must be tested, not asserted as the cause.
- Independent proof: raw provider video and final silent video have identical MD5 hashes for all 96 decoded pictures, so local audio removal did not introduce the cut. Raw output contained audio; final existing helper removed it successfully without changing pictures.
- Regression/acceptance: `hook100_omni_identity_reference_never_becomes_ending_scene` must inspect all output frames including the final requested-duration tail; reject scene/wardrobe/camera changes even if input roles and completed-job receipts pass.
- Scope: no new paid retry, no other reference changes or rollout. Exact artifacts, all-frame interval review and retained-input summary are under `outputs/hook100-full-recreation-trial-2026-10-26/caption-v2/`. Related: UGC-VID-005, UGC-VID-006, UGC-VID-010.

### 2026-10-26 recurrence evidence — UGC-VID-006 / related UGC-VID-010
- Status: RECURRENT / OPEN; severity P0; area: generated starting-image caption fidelity.
- Evidence: one explicitly authorized real Hook 100 Gemini 3 Pro 2K image, completed interaction `v1_Chc1dHJlYXVEbEVyVFlqTkFQNC1HaC1ROBIXNXRyZWF1RGxFclRZak5BUDQtR2gtUTg`; output `outputs/hook100-full-recreation-trial-2026-10-26/generated-opening.png`.
- OBSERVED: original t=0 glasses-on, temple-hand, side-gaze and source setting broadly survive, but original three-line creator caption remains. The generated opening fails caption-cleanup acceptance. Its identity is plausible under oblique reflective glasses, not fully qualified.
- PROVIDER-RETAINED INPUT CONFIRMED: original frame-zero SHA `9eb3c117dbf181a870d89fb3c4b3f4495e10cfe435aa035140e079d4e1218f26`, clarity-frame SHA `df452e82eadb2e7ed8338f34e2424e623b59ef4015d646a2a3c89d63a34d5a9c`, owned portrait SHA `640669439c0ec80020bcaaf03dc76ccbc51c39d0fc1be42d6c0133f1899b920a`, ordered role labels and untruncated prompt including caption removal. Model-internal cause is UNKNOWN; no input omission or prompt truncation was observed in this request.
- Expected: source pose and identity plus caption-free image before on-video editable Remix text is applied. No source creator caption may be accepted as cleaned output merely because the provider completed.
- Regression/acceptance fixture: `hook100_real_opening_removes_source_caption_before_animation`; compare original t=0 and actual generated pixels for three-line text, pose, scene, glasses/hand continuity and selected influencer. Retained input is transport proof, not a visual pass.
- Consequence: image rejected; zero video requests; generated-video frame-by-frame review NOT TESTED. One paid image create only, no automatic retry or rollout. Follow-up detail: `docs/hook100-real-trial-2026-10-26.md`.

### UGC-XXX-### — concise specific title
- Date/user request:
- Status: OPEN / INVESTIGATING / VERIFIED FIXED / RECURRENT / BLOCKED.
- Severity/area:
- Evidence (screenshot, issue, log; quote exact path/URL if available):
- Observed (FACT vs USER-REPORTED):
- Expected behavior:
- Impact/dependent components:
- Root cause: UNKNOWN until proven (then cite file and function/commit):
- Fix scope and explicit non-goals:
- Regression test that would have caught it:
- Verification evidence/date (only when fixed):
- Recurrence of (if applicable):

### UGC-UI-011 — Two unwanted Talking Head fact-check references
- Date/user request: 2026-10-26; remove the two red-marked cards in the supplied Talking Head + Demo screenshot and audit shared Hook/Talking Head behavior.
- Status: OPEN; area: Talking Head reference discovery.
- Evidence: SCREENSHOT OBSERVED; local poster inspection confirms `talking-outdoor-discovery` and `talking-outdoor-reaction`, both displaying the fact-check caption.
- Observed: both cards are discoverable/selectable in the reference gallery; user requests their removal.
- Expected: exactly those two stable IDs disappear from gallery discovery, including cached responses. Remaining seven keep order and behavior. Historical media/source identities and saved work remain recoverable.
- Root cause: UNKNOWN as a defect; the archival catalogue includes both items and the gallery currently maps every item. This is an explicit catalogue-selection change, not evidence of a generation failure.
- Regression test: `retired_talking_head_cards_are_hidden_but_saved_references_restore` — render all nine archival items in both preparation modes; assert seven visible IDs, zero retired actions, unchanged order, and successful restoration of a retired saved reference.
- Related safeguards: UGC-UI-003/004/005, UGC-VID-005/008/010, UGC-SCH-001/002 and UGC-OPS-003. Audit claims of lag/generation failure remain unverified until reproduced.

### UGC-SCH-006 — Reconnected publishing account cannot retry a stale action-required slideshow target
- Date/user request: 2026-10-26; user asked to fix the partial-failure recovery issue found while auditing Explore slideshow scheduling and generation.
- Status: OPEN / CODE AND PRODUCTION DATA CONFIRMED; severity: P1; area: target-scoped social publishing retry.
- Evidence: the 2026-10-23 TikTok slideshow target ended `action_required` after provider `invalid_grant`; the same social connection later published three carousels and one video successfully. The production `public.retry_social_publish_target(uuid,uuid,text)` function returns `action_required` before revalidating current connection health.
- Observed: reconnecting or otherwise restoring the account does not make the old target retryable. A retry request remains blocked by the target's historical status even when the connection is now connected and refresh-capable.
- Expected behavior: target-only retry revalidates the current connection. When healthy, it creates or reuses exactly one durable publish job for that target; when still unhealthy, it continues to require reconnection. Published sibling targets and provider receipts remain untouched.
- Impact/dependent components: retry RPC, retry API/service outcome mapping, background-job reconciliation, provider-operation idempotency, parent partial-failure projection and slideshow publishing recovery.
- Root cause: CODE CONFIRMED in `public.retry_social_publish_target`: an unconditional early return for `action_required` precedes the existing current-connection validation, and later eligibility permits only `failed` targets.
- Fix scope and explicit non-goals: change only the target-retry database function and focused regression coverage. Do not alter the schedule picker, initial schedule creation, slideshow generation/rendering, media validation, provider publish adapter, target selection, published siblings or UI layout.
- Regression test that would have caught it: `reconnected_action_required_target_retries_once_without_republishing_siblings` — start with one published sibling and one `action_required` target, restore that target's connection, retry twice, and assert one queued job, the same job returned on the second request, preserved sibling receipt and no retry while the connection remains unhealthy.
- Related incidents: UGC-SCH-002, UGC-SCH-003 and UGC-OPS-003.
- Verification update, 2026-10-26: LOCALLY VERIFIED / PRODUCTION OPEN. Migration `20261026105718_retry_reconnected_action_required_target.sql` passes four focused PGlite cases covering recovered and unrecovered connections, legacy failed-target semantics, duplicate prevention, published-sibling preservation, owner isolation and browser-role denial. Existing retry delivery tests pass 4/4; terminal projection tests pass 6/6; the social publishing worker builds and passes 33/33 tests. No production migration, target retry or provider call was performed, so the incident remains open for deployed acceptance.

### 2026-10-26 audit recurrence — UGC-SCH-001 / shared Explore time field
- Status: RECURRENT / OPEN / CODE CONFIRMED.
- Evidence: `components/explore/workflow-scheduling-panel.tsx:64` renders `postTime` as `type="text"` with HH:mm placeholder and pattern, accompanied by a 24-hour label. This is no interactive hour/minute picker. Talking Head mounts this panel in its Schedule section.
- Expected: interactive 24-hour selector with unchanged wall-clock/timezone persistence and backend conversion. Current valid HH:mm serialization is not evidence that this interaction contract passes.
- Root cause: the shared form implements text entry rather than the protected picker. No picker/runtime change made in this audit.
- Regression: actual browser opens the selector, selects 21:30 with pointer/keyboard, reloads and confirms unchanged zone/time; separately verify exact UTC schedule/targets.

### UGC-OPS-004 — Broad Explore regression gate has drifted from current imports and controls
- Date: 2026-10-26. Status: OPEN / TEST FAILURE CONFIRMED.
- Evidence: `.tmp/talking-head-hook-audit-explore.log`; npm run test:explore reports 1,203 pass / 57 fail / 1,260 total. Many failures occur before behavior runs: missing react-dom, lazy workspace, result-prompt or private-source mocks; outdated duration/cover source assertions; one sandbox temporary-file EPERM.
- Expected: current behavioral fixtures run through the intended real client/API boundaries and detect actual regressions. Do not equate 57 failing tests with 57 customer defects or report the release gate green.
- Root cause: multiple concrete stale fixture/import/expectation errors; full product consequences remain unverified. No broad test cleanup in this scoped removal.
- Regression: run the unmodified broad gate after updating fixture dependencies and behavioral expectations, then separately perform signed-in production acceptance.

### 2026-10-26 local verification update — UGC-UI-011
- Status: LOCALLY VERIFIED / PRODUCTION OPEN. Actual-component regression checks hide exactly two IDs in both Recreate/legacy modes and retain restoration for both saved references. Full-workflow browser journeys pass at 1366×768, 1536×864 and 390×844; fresh desktop/mobile gallery images inspected. TypeScript/scoped lint pass. No deployment or authenticated production acceptance; do not mark live fixed. Full receipt: `docs/talking-head-hook-shared-audit-2026-10-26.md`.

### UGC-UI-012 — Talking Head shared-feature parity follow-up
- Date: 2026-10-26. Status: OPEN / IMPLEMENTATION REQUESTED.
- Evidence: user requests fixes from docs/talking-head-hook-shared-audit-2026-10-26.md, including shared interactive picker, optional animation face photos, history, prepared source frames and source-text lookup.
- Expected: reuse shared capabilities while keeping Talking Head script, Demo, three audio scopes, owner/draft isolation and explicit generation/scheduling actions intact. Fix stale verification fixtures without weakening behavioral assertions.
- Root cause: CODE CONFIRMED separate workflow integrations omitted newer shared features; per-feature evidence is in the audit. Actual generated fidelity and production lag remain unverified.
- Regression: talking_head_shared_features_preserve_script_demo_and_approved_frame; shared_24_hour_picker_retains_local_time; prepared_talking_head_frame_never_decodes_on_request; history_selection_is_explicit_owner_scoped_and_recovers; remix_uses_asset_provenance_not_current_gallery.
- Related: UGC-SCH-001, UGC-OPS-004, UGC-UI-011; no authorization for automatic paid retries or live publication.


### 2026-10-26 local fix verification - UGC-UI-012 / UGC-SCH-001 / UGC-OPS-004
- Status: LOCALLY VERIFIED / PRODUCTION OPEN. Interactive24-hour picker, ordered face inputs, explicit history, canonical source-text lookup and exact prepared t=0 PNGs implemented. Broad Explore gate passes1,283/1,283 after concrete fixture repairs; focused suites82/82 and22/22 (overlap). Production build, scoped lint/types and desktop/mobile browser checks pass including320px and keyboard time selection.
- Evidence: docs/talking-head-shared-fixes-2026-10-26.md and .tmp/talking-head-parity-*.log. Cold-frame tests trap decode/download for all nine sources; generator verifies source/PNG hashes. Real client/API tests retain script, Sound, approved frame and ordered person photos, blocking incompatible inputs before jobs.
- Signed-in acceptance unavailable: production redirect to sign-in confirmed. No production output, target/queue/provider verification or deployment. Existing UGC-VID-010/011 unchanged; no live-resolution claim. UGC-UI-011 removal remains locally verified only.


### 2026-10-26 recurrence - UGC-SCH-001 remaining workflow pickers
- Status: OPEN / USER REPORTED and CODE CONFIRMED. User reports remaining workflows still lack consistent interactive 24-hour selection. Native type=time remains in Trending Hook drawer and the shared platform-selection modal; browser locale determines their presentation. Main Scheduling editor already has a custom 24-hour rail picker.
- Expected: every visible scheduling time selector uses an explicit 00:00-23:59 interaction, retains wall-clock/timezone and manual drafts, and supports keyboard/mobile use.
- Root cause: CODE CONFIRMED two independent native controls did not reuse the shared explicit24-hour picker.
- Regression: remaining_workflows_use_explicit_24_hour_picker; midnight_late_evening_keyboard_roundtrip.

### UGC-SCH-007 - Explicit Post now choice across workflows
- Status: OPEN / USER REQUESTED enhancement, not an established publishing defect. Explore's shared form requires manual timing although existing server-owned useDefaultScheduleTime supports earliest available posting. Trending modal already exposes ASAP; Hook drawer defaults to automatic timing implicitly.
- Expected: explicit Post now requires no date/time entry, retains manual timing when toggled back, uses existing server-owned earliest slot (configured lead time, currently default5 minutes), owner/accounts/media/publishing validation and durable/idempotent recovery. Never call a queued request Published without provider evidence.
- Root cause: missing UI integration, not absent queue infrastructure. No proposal to bypass configured lead time or publish on render.
- Regression: post_now_uses_server_default_without_wall_time; manual_mode_restores_exact_zone_time; saved_post_now_retries_same_request_without_duplicates; no_automatic_submission.


### UGC-VID-012 — Hook 12 drink-trickle detail omitted by thumbnail-level draft
- Date: 2026-10-26. Status: OPEN / SOURCE REVIEW CONFIRMED; related UGC-VID-010 full-source fidelity.
- Observed: the initial source-review candidate covered sip, mug lowering and surprise but omitted a thin trickle from lower lip toward the mug. Root inspection of full-resolution source frames 45 and 72 confirmed that action before any trial.
- Expected: the full t=0-to-ending prompt includes the visible drink movement and final reaction without inventing a cup placement.
- Cause: the detail was missed in contact-sheet thumbnails; this is confirmed for the authored candidate, not a provider-output diagnosis.
- Draft correction: public-A Hook12 beats/ending and the isolated three-second pilot prompt include the trickle. No provider output exists to mark visual fidelity fixed.
- Regression: middle_frame_hook12_prompt_retains_sip_lower_trickle_and_ending; approve generated t=0 mug contact, then inspect complete generated sequence against retimed source before activation.
- User subsequently chose prompt drafts without paid generation. No new paid image/video request was submitted; rollout remains gated.


### 2026-10-26 local verification - UGC-SCH-001 remaining surfaces / UGC-SCH-007
- Status: LOCALLY VERIFIED / PRODUCTION OPEN. Both remaining native time controls replaced with explicit24-hour picker; main Scheduling custom24-hour picker retained. Post now exposed using existing server-owned automatic timing with no mandatory manual date/time. Manual values/zone retained, selected accounts/defaults required and existing same-key recovery preserved.
- Evidence: docs/workflow-post-now-and-time-pickers-2026-10-26.md; broad Explore1,285/1,285; focused119/119; pending46/46; build/types/scoped lint; three real-component desktop/mobile browser suites pass. Test counts overlap. Source search finds no remaining native type=time component controls.
- Named regressions cover no-time posting, mode changes with zero submissions, manual21:30 restoration,24-hour edge values/keyboard, lost acknowledgements, repeat/double-click handling, default slot replay and targetless immediate requests blocked.
- Production recheck redirects to sign-in. No real post, provider receipt, hosted target/job/queue evidence or deployment. Keep production resolution open.


### UGC-UI-013 - Post now duplicated as a mode section and final action
- Date: 2026-10-26. Status: OPEN / USER REPORTED and SCREENSHOT OBSERVED. User rejects the newly added Post now/Schedule for later sections and asks for a simple final Post now button that schedules from the click instant.
- Root cause: CODE CONFIRMED unnecessary mode-selection groups added alongside the final posting action.
- Expected: remove the extra mode groups and automatic-time explanatory section. Default final Post now action uses server-owned click-time scheduling; preserve existing manual date/time controls and explicit manual scheduling without another mode section.
- Regression: single_post_now_action_no_mode_selector; click_resolves_automatic_time; manual_picker_retains_explicit_schedule; no_submission_on_render.
- User clarification supersedes the prior mode-selector UI decision in UGC-SCH-007. Keep server lead/idempotency/ownership policy unchanged.


### 2026-10-26 local correction verification - UGC-UI-013
- Status: LOCALLY VERIFIED / PRODUCTION OPEN. Removed unnecessary timing-mode groups/cards and extra automatic-time explanation; default review has one final Post now action, resolving a fresh server-owned time at confirmation. Manual24-hour controls remain, existing edits stay exact-time.
- Focused126/126, types/scoped lint/build and three desktop/mobile browser suites pass. Tests assert one Post now button/no Publishing time group, no submit on render, clock advances before click, targetless posting blocked and retry/reload uses the original request. Receipt: docs/post-now-simple-ui-2026-10-26.md. Broad rerun pending at this entry.
- No production post/deployment/provider receipt; authenticated acceptance remains unavailable. Do not re-add mode sections to solve an action already handled by the final button.

- Final UGC-UI-013 local gate update: broad Explore passes1,285/1,285; focused126/126; production build/native bundles, TypeScript/scoped lint and all three desktop/mobile suites pass. Corrected review-region screenshot inspected with no timing-mode group or Now/Earliest explanation. Docs/post-now-simple-ui-2026-10-26.md is the final receipt. Production acceptance still open; no deployment.


### UGC-UI-014 - Duplicate Talking head video heading in Create
- Date: 2026-10-26. Status: OPEN / SCREENSHOT OBSERVED and CODE CONFIRMED. User asks to remove redundant heading below Create tab and run local changes.
- Cause: WorkflowVideoSourceSection renders a visible h2 in Talking Head's already-labelled Create panel.
- Expected: no duplicate visible heading; source chooser retains accessible label and all Generate/Upload/Creative Assets interactions. Other workflows retain existing headings.
- Regression: talking_head_create_hides_duplicate_heading_preserving_source_controls.

- UGC-UI-014 local verification: duplicate h2 is visually hidden only for Talking Head Create; accessible label retained. Source controls6/6, full desktop/mobile browser journey (including320px), TypeScript/scoped lint and diff whitespace checks pass. Logs .tmp/talking-head-heading-*.log; screenshots .tmp/talking-head-full-workspace/references-1366.png and references-390.png. No generation/provider/backend changes.


### 2026-10-26 assignment evidence — UGC-VID-010 / UGC-VID-012
- Status: LOCAL WIRING VERIFIED; generated fidelity/production OPEN. User explicitly requests activating per-video assignment code for all31 drafts while retaining no-paid-generation decision.
- New source-bound defaults cover full t=0-to-ending and require reconstructed-opening v4 receipts; stale legacy-image/full-timeline pairs fail before billing. Private opening+anchor URLs remain protected and both are signed before provider submission. User edits and old job recovery are retained.
- Evidence: hook-middle-frame-motion.test.ts verifies all31 mappings and compilation at3/4/8/10seconds; video-generation-api.test.mjs verifies actual duration-mapped job prose and pre-v4 rejection; generate-image.hook-keyframe.test.mjs verifies both private source roles across Flash/Pro branches. Existing API/private audit exercises all12 private sources and three image models without provider calls.
- Source prompt correction for Hook12 sip/lower/trickle/ending is included. No real generated output establishes visual acceptance. Private ciphertext and public original-opening storage are deployment prerequisites still unverified. Full receipt: docs/middle-frame-runtime-assignment-2026-10-26.md.


### UGC-SCH-008 - Device-default time presentation
- Date: 2026-10-26. Status: OPEN / USER REQUESTED. Explicit user instruction supersedes forced24-hour display: follow device/browser locale preference, preserve interactive selection and canonical HH:mm storage. No format toggle/new posting sections.
- Expected:12-hour locales show AM/PM,24-hour locales retain00-23, correct noon/midnight conversion, unchanged wall-clock/timezone persistence and Post now5-minute rendering delay.
- Regression: device_time_format_noon_midnight_roundtrip; both_picker_surfaces_follow_locale_without_mutating_draft; automatic_delay_and_retry_unchanged.


### 2026-10-26 UGC-SCH-008 local verification
- Status: LOCALLY VERIFIED / PRODUCTION OPEN. Shared and main time selectors, quick slots/manual summaries follow browser/device locale default12/24-hour cycle; internal HH:mm/timezone unchanged. Post now retains the existing5-minute rendering lead and same-request recovery. No format toggle or mode sections.
- Evidence: focused119/119, broad Explore1,285/1,285, final build/native bundles/types/scoped lint/diff checks pass. Real browser en-US/en-GB desktop/mobile checks pass including12AM/12PM,21:30, canonical hidden values, source/default validation and zero unsolicited posts.
- Receipt/files/limits: docs/device-time-format-2026-10-26.md. Web locale preference is observable; OS-only clock overrides hidden by the browser are not. Local app3000 and sample posting preview3107 running. No production post/provider/deployment claim.


### UGC-SCH-009 - Missing quick-time actions on other scheduling surfaces
- Date:2026-10-26. Status:OPEN / USER REPORTED and CODE CONFIRMED. In1hour/In3hours exist only in shared platform modal; main review preview, Explore and Trending Hook drawer omit them. Open picker also overlays the existing modal's row in supplied screenshot.
- Expected: compact quick actions consistently available by date/time inputs, no separate mode-selection section; calculate from click instant in selected timezone, preserve media/account/caption, do not submit. Post now5-minute default unchanged.
- Root cause: separate form integrations lacked quick-action wiring. Regression: quick_schedule_actions_compute_click_time_zone_rollover_without_submission.

- UGC-SCH-009 user clarification2026-10-26: exact quick presets are5mins,1hour,3hours,Tomorrow9AM (supersedes interrupted30mins request). Compact pills must occupy one row at laptop/mobile widths; scroll inside row instead of wrapping or overflowing page. Selected timezone/device clock format and no-submit behavior retained.


### 2026-10-26 UGC-SCH-009 final local verification
- Four exact pills5mins/1hour/3hours/Tomorrow9AM are shared across scheduling forms. One row with internal horizontal scrolling at narrow widths, no page overflow. Tomorrow follows selected-zone next calendar day/device clock format; click only fills manual draft.
- PASS106/106 focused,1,285/1,285 broad Explore, types/lint/diff, production build/native bundles and two browser suites. Geometry tested1536/1366/1280/390/320px. Live local DOM confirms all four labels,nowrap/equal top coordinates/no page overflow. Receipt:docs/quick-publish-actions-2026-10-26.md. Production remains unverified; no deployment/publication.


### UGC-UI-015 - Quick preset row needs a visible purpose label
- Date:2026-10-26. Status:OPEN / USER REQUESTED. User approves a small Quick schedule label above the four pills. Expected: shared label only, preserve single-row pills, timing behavior and final action. Root cause: visible caption absent while only accessible group label existed. Regression: quick_schedule_label_visible_above_unchanged_four_pills.

- UGC-UI-015 locally verified: added only small Quick schedule caption in shared component. Local DOM confirms caption above exact four pills,nowrap. Scoped ESLint/TypeScript/diff checks pass (.tmp/quick-label-*.log). No scheduling/backend behavior change or deployment.


### UGC-VID-013 — Normal frame-zero prompt pacing and expression gaps
- Date: 2026-10-26. Status: OPEN / CODE AND SOURCE REVIEW CONFIRMED. Audit requested by user, not a claim of failed new provider outputs.
- Structural evidence:83 public normal references plus2 private; all exact source hashes match, all85 compile at3/4/8/10seconds, but none has numeric action timings. Public78 historical static-reviewed and5 needs-decision labels are not visual-output acceptance.
- Fresh source evidence:11 cases across46native contact sheets/1,148frames at sheet resolution, plus3full-resolution opening checks. Hook01/02/99 contain important holds not measured in current prose. Hook03 final gaze returns toward lens after the late side glance, more nuanced than its current ending. Private1-04/1-05 show specific open/pursed/reopened lip and brow transitions missing from generic questioning/blink directions.
- Expected: ordinary image authority stays originalt0; source-measured action/hold boundaries and full ending are mapped to selected output duration, without inventing gestures or replacing user edits.
- Root cause: CODE CONFIRMED current motion plans carry semantic phases without numeric timing; source-specific expression/ending omissions are documented in the visual findings. Provider consequences remain NOT TESTED.
- Regression: normal_opening_audit_preserves_source_binding_and_custom_edits; normal_source_hold_and_final_expression_match_measured_frames; no paid quality fix claimed from compiler pass.
- No normal runtime prompt changed during this audit; source-reviewed draft examples are separate. Full receipt: docs/prompt-reviews/normal-opening-prompt-quality-audit-2026-10-26.md.

UGC-VID-013 evidence correction (26 October 2026): full-resolution Hook 03 final frame_000109.jpg confirms sideways gaze. The earlier sheet-resolution claim of a final return toward the lens is superseded. No ending-direction defect is established; the missing numeric hold timing finding remains OPEN. Audit JSON and report corrected; application prompts unchanged.

### UGC-VID-014 — Starting-frame photographic texture and naturalness drift
- Date: 2026-10-26. Status: OPEN / USER REPORTED; existing saved output visually reviewed. Recurrence of UGC-VID-004 and UGC-VID-006.
- Report: some generated influencer starting frames appear less natural despite a suitable selected source frame; user requests an audit and discussion of pose, texture and realistic appearance.
- Observation: saved Hook 100 caption-v2 source/portrait/raw generated/normalized stills retain broad scene and gesture but have approximate framing/face-glasses geometry and visibly different fine skin rendering. Qualitative review only; no new generation or measured skin/identity score.
- Root cause: UNKNOWN for the reported examples. CODE CONFIRMED inspected Gemini path uses whole-image reference conditioning without an explicit mask/local-edit boundary; normal v4 and separate full-recreation v5 routes exist; result admission verifies provenance, not visual realism. These facts do not establish provider-internal causality.
- Expected: influencer identity and intrinsic natural skin characteristics adapted to source lighting, with source camera/pose/scene and photographic rendering preserved; separate visual acceptance for identity, pose/contact, scene/camera and naturalness.
- Regression: starting_frame_realism_same_source_identity_controlled_matrix — frozen source/photos/model/settings, repeated baseline versus one prompt revision, raw and matched-resolution reviews, clear-opening and glasses/hand cases; no critical fidelity miss accepted for animation.
- Evidence and limitations: docs/starting-frame-realism-audit-2026-10-26.md. No application code/defaults changed; fresh inference, deployed parity and production acceptance NOT TESTED.

UGC-VID-013 pilot preparation (26 October 2026): isolated normal Hook 02 prompts now preserve neutral hold, surprise hold, hand rise, glasses removal and ending in six contiguous3s intervals. Verified source hash, stored t0 PNG hash, prior influencer identity hash and actual original frame PTS;91 source frames reviewed at sheet resolution. Plan: docs/prompt-reviews/hook02-normal-pilot-plan-2026-10-26.md. Generated still/video remain NOT TESTED; no normal runtime prompts changed, no paid requests, no rollout. Status remains OPEN pending staged real-output review.

### UGC-VID-015 — Hook 02 normal pilot image rejected by provider
- Date:2026-10-26. Status:OPEN / PROVIDER RESPONSE OBSERVED.
- User approved exactly one Gemini3Pro2K image and one conditional3s video, no paid retries. The image request returned HTTP400 safety violations with no image or operation ID. Video was not submitted.
- Root cause:UNKNOWN; Google did not disclose which input triggered its filter. Do not infer a prompt, source or identity cause from this response.
- Expected: surface the actual rejection, retain frozen inputs/receipt, stop before video and never retry generation without a new user decision.
- Regression: hook02_rejected_image_blocks_video_and_second_paid_submission; confirm write-ahead attempt receipt, zero video attempts, no second image attempt and preserved input hashes.
- Evidence:docs/prompt-reviews/hook02-normal-pilot-result-2026-10-26.md and sibling sanitizedJSON. Actual provider charge unverified. No runtime prompt, UI, database or application-credit changes. UGC-VID-013 remains OPEN; generated fidelity NOT TESTED.

UGC-VID-015 diagnostic preparation (26 October 2026): official exact-model/Interactions/safety docs reviewed; existing trial logger saved message only, discarding structured response body/diagnostic headers. Original block cause remains UNKNOWN. Read-only modelGET returns gemini-3-pro-image version3.0; tokenlimit differs from modelpage, recorded separately. Offline SDK2.10.0 synthetic400 capture verifies response error.code and requestID; no real generation. Avoid serializing SDK httpMeta Request wrapper. Six conditional diagnostic cases prepared, no automatic execution; C5 hash-reconstructs the exact rejected request. No paid retries/settings changes. docs/prompt-reviews/hook02-diagnostics-and-controlled-test-2026-10-26.md.


UGC-VID-015 controlled diagnostic execution (26 October 2026): user approved three neutral-prompt Gemini 3 Pro 2K checks (Hook 02 source alone, influencer portrait alone, source+portrait pair). Source-only and pair returned HTTP 400 safety violations for unspecified reasons; portrait-only completed (`v1_ChdaUTFmYXYzU0hZcXA5OThQNEp5X3lRTRIXYVE1ZmF2M1NIWXFwOTk4UDRKeV95UU0`). Exact visual trigger/safety category remains UNKNOWN. Evidence: docs/prompt-reviews/hook02-controlled-diagnostic-results-2026-10-26.json.

### UGC-VID-016 — Hook 01 normal pilot starting-image identity adherence failure
- Date: 2026-10-26. Status: OPEN / VISUAL GATE FAILED. Links to UGC-VID-004, UGC-VID-006 and UGC-VID-014.
- Observed: Hook 01 (`explore-paired-hook-4585ee949081c4e5cd835cd3`) starting-image request completed (`v1_ChdZaFBmYXJhVUpOUzU2OTRQeEltb29BMBIXWWhQZmFyYVVKTlM1Njk0UHhJbW9vQTA`, SHA-256 `824f83d08c74978889f0641f9b3a6a76063cd12c43cc8acbcac28f65a479fb60`), preserving the source scene, camera, seated posture, upward-right wide-eyed open-mouth reaction, low hands at the pink keyboard, and cleanly removing the two-line lower-middle caption. However, the generated face stayed too close to the source performer (retaining jet-black hair/parting, high thin arched dark brows, heavy winged eyeliner, dark brown eyes, heavy blush, dark lip liner, and heart necklace) instead of matching the selected influencer (`495d8905-7a1b-4cbf-a38f-7a526a4dbff5`).
- Verified inputs: retained provider interaction confirmed exact source t=0 hash (`5d28f502...`), influencer portrait hash (`64066943...`), model (`gemini-3-pro-image`) and prompt (`6d006635...`). Zero video requests were submitted.
- Root cause: PROVIDER INTERNAL CAUSE UNKNOWN; CODE/PROMPT CONTRIBUTION IDENTIFIED — the custom pilot script (`.tmp/run-hook01-approved-pilot.mjs`) bypassed the production normal `v4` influencer-first builder (`buildHookKeyframeImagePrompt` + `hookKeyframeProviderImageLabels`) and used a custom scene-first prompt ("Create one natural 9:16 photograph matching Image 1's original opening shot...") with terse role labels, encouraging the model to treat Image 1 as an inpainting canvas rather than photographing `MY_INFLUENCER` (Image 2).
- Controlled revision prepared (unpaid): `outputs/hook01-normal-pilot-2026-10-26/identity-v2/preparation-receipt.json` and `docs/prompt-reviews/hook01-normal-pilot-image-prompt-v2-2026-10-26.txt` keep source t=0 bytes, influencer portrait bytes, image order, model, 2K, 9:16 and safety defaults unchanged while switching to the `v4` influencer-first builder/labels with influencer-agnostic source-face/makeup exclusion and exact two-line caption removal.
- Regression: `hook01_starting_image_visual_review_blocks_video_until_identity_passes`; `hook01_identity_v2_preserves_frozen_inputs_and_uses_v4_subject_first_contract`. Formal review: `outputs/hook01-normal-pilot-2026-10-26/image-visual-review.json`.

### UGC-OPS-005 - MCP release catalogue and staging evidence drift
- Date: 2026-10-26. Status: OPEN / CODE AND HISTORICAL RECEIPTS CONFIRMED.
- User requests resolving PR71 release/staging issues and checking regressions. PR head 8be325d5 registers 106 unique tool names; scripts/mcp-tool-catalog.mjs lacks five groups and hardcodes 79. Its --check fails before validation. Current main remains a separate 79-tool application.
- Historical evidence: .tmp/mcp-analytics-read-20261018/docs/agent-staging-setup-2026-10-23.md records provisioning UGC test (zmmayoyslgtvrmwiabqq), 153 migrations and protected website/MCP snapshot builds. This contradicts the later handoff's claim that no hosted migrations ran. Management credential returns HTTP401; historical receipts are not current hosted verification.
- Expected: derive catalogue totals from registry, detect drift/duplicates/missing metadata in CI, use explicit staging-only target checks, reconcile hosted schema before migrations and preserve current app/uncommitted work.
- Root cause: CODE CONFIRMED stale catalogue metadata/count. Credential invalidity, current staging schema and failed sibling preview cause remain UNKNOWN/unverified.
- Regression: mcp_catalog_tracks_registered_groups_without_fixed_count; mcp_catalog_rejects_missing_metadata_duplicates_and_stale_output; staging_isolation_rejects_production_and_mixed_project_credentials.
- Related: UGC-OPS-001 and UGC-OPS-003. No production migration, access-protection removal, paid provisioning or publishing performed.

### UGC-OPS-005 local verification - 26 October 2026
- Isolated PR repair commit495ca826 contains only catalogue/preflight tooling, generated catalogue, CI and receipt. Source catalogue106 matches independent package validator; same builder still reads primary79-tool baseline correctly. Production/application settings and both unfinished worktrees preserved.
- PASS24/24 focused; full npm run test:mcp409 tests across30 runners, zero skipped, plus standalone contract runners; scoped ESLint, next typegen, TypeScript, workflow YAML and diff checks pass. Initial sparse-checkout dependency/type-input failures resolved by restoring tracked inputs/linking existing dependencies; no runtime workaround.
- Hosted staging remains OPEN: configured PAT has correct personal-token format but API401; no saved CLI login; browser redirects to Supabase sign-in. Historical153-version staging receipt differs from current PR158-file source by seven absent and two additional versions; this is not a live database comparison. No reset/replay/migration performed.
- Receipt and exact8-file PR list: .tmp/pr71-release-repair-20261026/docs/pr71-staging-release-repair-2026-10-26.md. Remaining: live ledger/config verification, protected native-host ingress, exact-candidate Codex/Claude acceptance, media infrastructure/receipt, review recording and current sibling Vercel diagnosis.

UGC-OPS-005 follow-up: repair495ca826 pushed and remote head read back exactly; PR71 remains draft. New catalogue/staging safeguard step passed in GitHub Linux run40303664657; remaining jobs still running when checked. Plugin archive suite passed9/9 with0.2.9/47files/18skills/106tools and missing review recording still reported. Supabase PAT recheck remains401. No hosted acceptance or production promotion claimed.

### 26 October 2026 PR71 completed-check revalidation - UGC-OPS-005 / UGC-OPS-004
- PR head and remote both495ca826; draft/open/mergeable. Both MCP Linux CI runs PASS, including new guard, full MCP/onboarding tests, package archives and dependency audits. Migration reconciliation and completed-video-delivery PASS. Main ugc Vercel preview PASS.
- preserved-application FAIL: Explore1280/1281; exactly one failure at scripts/workflow-sections.test.mjs163, searching type=time although WorkflowSchedulingPanel uses name=postTime,type=text. Exact failure reproduced on baseline8be325d5 and repair495ca826; test/component Git blob hashes identical between commits. This is a confirmed pre-existing test/component contract mismatch, not evidence that the catalogue repair changed scheduling runtime. No assertion/product code changed during this verification-only request.
- Current focused recheck24/24 and catalogue106 PASS. Repair diff contains no app/components/contexts/worker/lib-mcp/schema/environment/dependency changes. Existing primary work remains intact.
- Separate trending-release-web preview still FAIL; newest failure cause not inspected. Supabase PAT recheck HTTP401. Hosted staging/clean client and provider acceptance NOT VERIFIED. Full release remains uncleared; no production mutation, deployment or merge performed.
- Evidence: isolated checkout .tmp/verification/preserved-application-failure.log, recheck-workflow-sections.log, baseline-workflow-sections.log and recheck-focused.log. GitHub application failure run40303664641; complete MCP success run40303664657.

UGC-VID-016 identity-v2 real test (26 October2026): user requested next-step testing. One frozen candidate Gemini3Pro2K image completed, retained input source/identity/prompt verified. Raw+normalized image qualitatively passes identity,caption,scene,opening-pose and visible-anatomy pilot checks; framing approximate and source necklace deliberately excluded by candidate. This is one successful instruction-package sample, not proof of universal repair or isolated causal attribution. No app/default changes or image retry. Receipt:docs/prompt-reviews/hook01-identity-v2-test-results-2026-10-26.md.
UGC-VID-013 normal motion pilot (26 October2026): one conditional3s GeminiOmni video used only approved first frame, zero extra portraits.72frames reviewed on3native and6all-frame paired sheets; exact duration,no captions,no scene cut,broadhold/hand-cover order pass. Hand begins slightly early and source early blink absent. Ending fidelity FAILS: source has tilted off-edge close crop; generated remains wider/centered and reaching hand withdraws. Overall PARTIAL_PASS_NOT_FOR_ROLLOUT; incident remains OPEN. Raw/final decoded hashes match after audio removal; final has no audio. Next isolated candidate should change only reach/camera/ending direction, not approved image/model/duration. No further paid request or rollout.

### UGC-OPS-006 - Pre-existing scheduling fixture and unused duplicate preview failure
- Date:2026-10-26. Status:OPEN / CODE AND HOSTED LOG CONFIRMED. User requests fixes and post-fix regression verification.
- Observed: preserved-application1280/1281; workflow-sections.test.mjs searches type=time though the unchanged PR panel uses named postTime text input. Exact failure reproduced on8be325d5 and495ca826, identical source hashes. Duplicate project trending-release-web-3f35202 build dpl_Bd66NnFN6Kvjm3iHwtzL6Djf9VMP fails Firebase auth/invalid-api-key; no READY deployments or custom domain in current connector inventory.
- Expected: assert actual stable time-field identity and unchanged draft forwarding; stop automatic builds only for the unused duplicate, preserve all history/main website/MCP/staging deployments.
- Root cause: CODE CONFIRMED stale selector. HOSTED CONFIRMED duplicate invalid Firebase build configuration; no production application outage established.
- Regression: workflow_time_field_forwards_canonical_time_without_mutating_other_draft_fields; duplicate_project_git_builds_skipped_main_targets_unchanged.
- Access update: new Supabase connector works for production organization mxorsznmwilngqwwvsyt but cannot access UGC test organization pztieohuzapgdlgmjjyh (permission denied). Request staging-account connector authorization; do not share tokens or mutate production as a substitute.

UGC-VID-013 source-to-prompt completeness recurrence (26 October2026): user correctly identifies repeatable omission risk after Hook01 ending comparison. Retained prompt mentioned reach/closer/smalltilt/edgecrop but omitted explicit desk-to-handheld transition,irregularshake and maintained camera grip. Phone handling is inferred from visible reach/viewpointmotion,not directly seen. New camera-v2 draft prepared only,untested.116reference audit register prepared; not116freshreviews. Regression: source_interval_has_prompt_coverage_for_action_hold_hand_camera_and_finaltail; distinguish observed evidence from inference and prompt gap from generation adherence. No paid generation/runtime rewrite. docs/prompt-reviews/source-to-prompt-completeness-review-2026-10-26.md.

### UGC-OPS-006 final repair and hosted verification - 26 October 2026
- Test repair572e351d pushed to draft PR71: only workflow-sections.test.mjs plus receipt. Time field located by stable postTime name; no runtime/UI/backend edits. PASS13/13 section tests;105/105 scheduling;24/24 catalogue/plugin; TypeScript/lint; full Explore1282/1282 zero skipped. Initial local sparse-fixture and sandbox rename issues were isolated and corrected without altering product code/assertion strength.
- Vercel connector now authorized: newest duplicate logs prove Firebase auth/invalid-api-key. Fresh inventory confirms no READY deployment/custom domain. Set only prj_sEUePx1qDIZgisRySeJTeMlMGmsI Ignored Build Step=exit0; next Git deployment dpl_8tkPfMjTkwWWnGSeviRmndYXmTzw CANCELED with ignored-build link and GitHub SUCCESS. Preserve history; main/staging projects/protection/domains unchanged. Main exact-source preview READY. Public production website/MCP health HTTP200.
- Supabase staging credential supplied by user works; use through hidden input, no disk/env/argv storage. Explicit project/org assertions limit every request to zmmayoyslgtvrmwiabqq/pztieohuzapgdlgmjjyh. Live preflight153migrations/149RLS tables, no profiles/media/jobs/schedules/connections/tokens. Exact seven canonical missing PR migrations applied transactionally; two staging-only migrations retained. Transport interruption after fourth handled by ledger/hash readback, then resume only missing versions; no blind mutation retry.
- Hosted final160migrations/155RLS tables; all seven normalized source hashes match ledger. All149pre-existing table row counts unchanged; six new tables empty. Rollback-only probes PASS confirmation replay rejection, plan owner isolation/conflict/replay, foreign logo lease denial, anon/auth table and RPC denial and pure reads/no jobs. Advisor0warnings/errors,155informational RLS-without-policy notices matching existing server-only model. No production operation, write-gate enablement, paid provision, media request or publication.
- Evidence: .tmp/pr71-release-repair-20261026/docs/pr71-remaining-issues-2026-10-26.md and .tmp/verification/staging-{before,after,migration-repair,migration-verified}.json plus probeSQL/logs. Raw credential not saved; revoke chat-exposed credential after session and use correct-organization plugin OAuth for future access.
- Full new Linux MCP CI40314773605, migration and video-delivery PASS. Broad preserved-application40314773667 remains media-stack provisioning; not claimed green. Clean exact-candidate Codex/Claude/native ingress and real staged media finishing remain NOT VERIFIED; production release still gated. UGC-OPS-005 catalogue/staging-schema portions VERIFIED; client acceptance remains OPEN.

UGC-OPS-006 final readback: remote PR71 head729cc229 (documentation-only after tested572e351d); latest main preview dpl_B4ES5dBLJX6uAvffRiGTsdmWJDNm READY; second duplicate deployment dpl_FZhrKqmAyLx3cvVRzzo6QfN4tTEN correctly ignored/CANCELED with SUCCESS status. Latest migration/video guards PASS, MCP/application CI still running; old application job remains media provisioning. Full local1282/1282 and hosted canonical migration/rollback proofs remain PASS. No runtime source or production changes. Receipt supersedes historical access401/unapplied-staging claims without erasing them.

UGC-VID-013 Hook01 camera-v2 real test (26 October2026): explicitly authorized1video,same approved image/model3s720p/singleFIRST_FRAME,no new still. Exact revised prompt retained verified. All72frames reviewed across3native sheets plus paired ending sheets and fullresolution63/67/71. New late handheldshake/motionsoftness and finalface partlyoutside rightedge observed; earlier hold/cover/identity/scene broadlyretained. Improvement over previousvideo,remaining source timing/scale/trajectory differences. Actual phonegrip outsideview notverified. Oneoutputpercondition does not prove individualwording causality/reliability. No model switch or rollout. Receipt docs/prompt-reviews/hook01-camera-v2-test-results-2026-10-26.md; statusIMPROVED_PARTIAL_PASS,incidentOPEN.

### UGC-OPS-007 — Production Cal.com onboarding fails URL business-context quality gate
- Date: 2026-10-26. Status: OPEN. Evidence: USER REPORTED screenshot plus PRODUCTION DATABASE/WORKER/VERCEL LOG CONFIRMED.
- Observed: supplied test account verified its email and created draft b1014463-60f6-4972-b363-cae097d3d263 for https://cal.com/. Job 2a48f820-fe86-45f7-af7d-73c2ce50bfbd failed twice with application HTTP422 at 12:03:48/12:04:50 UTC; no analysis/profile/finalization persisted. Screenshot shows first analysis step waiting, but duration and current recovery UI are unverified.
- Expected: evidence-supported URL brands complete analysis, including a legitimate brand spelled like its domain; true unsupported context failures expose recoverable manual entry.
- Root cause: CONFIRMED quality-gate rejection boundary. CODE CONFIRMED validator rejects Cal.com solely because the name equals hostname, even with complete summary/audience; exact production rejected model fields UNKNOWN because not retained. GCP delivery and signed callback succeeded; account-change causation not supported.
- Regression: evidenced_domain_brand_passes_url_quality_without_accepting_hostname_placeholders; failed_url_analysis_exposes_manual_fallback_and_preserves_draft.
- Existing quality suite3/3 PASS but lacks domain-brand acceptance; direct actual-function reproduction confirms422. No code fix, paid retry or deployment. Full evidence/limits: docs/production-onboarding-account-change-audit-2026-10-26.md.

### UGC-VID-017 — Historical version3 Gemini3Pro Hook receipt rejected with misleading frame-mismatch error
- Date: 2026-10-26 investigation; failures occurred2026-10-24. Status: OPEN / DATABASE AND DEPLOYED-SOURCE CONFIRMED.
- Observed: jobs6de5153c-d7b7-4f09-9bfa-59555ff75981 and f7b320e7-1403-4706-bd6d-f6b83330156e use version3/gemini_3_pro/creator-account-1-01/frame1.7s; worker5f7b7747 rejected both before provider submission, saying downloaded scene mismatched.
- Expected: valid receipt/model pairs pass; invalid byte/role evidence still blocks before provider submission and diagnostics identify the actual failure.
- Root cause: deployed verifiedHookImageLabels permits non-version2 receipts only for nano_banana_2, so version3+gemini_3_pro necessarily fails independently of PNG bytes. Exact historical bytes need not be assumed wrong. Both jobs predate prior owner removal on25October; no account-transfer cause found.
- Regression: valid_v3_gemini3pro_receipt_passes_provider_labels_while_invalid_frame_hash_still_blocks.
- No fix/deployment/paid retry. Receipt: docs/production-onboarding-account-change-audit-2026-10-26.md. Related source/role safeguards: UGC-VID-005 and UGC-VID-008.

UGC-VID-013 completeness batch01 (26October2026): fresh387sourceframes/15native sheets plus4fullres checks across Hook72(191),Hook99(123),middleHook12(73). Actual normal compiler/assignedplans inspected; sourcehashes verified. Hook99 missing numeric covered-mouthhold,briefeyeclosurebeforerelease and finalphases corrected as draft. Hook72 upwardtilt already present; repetitions/finalheadlowleftcrop underdescribed,source-timed draft prepared,existing needsdecisiongate retained. Hook12 currentfulltimeline already includes sip,muglowering,thintrickle/finalreaction:retain,no newgap. Draftcompilation validates fullphaseclock at selecteddurations; initial authoringlint rejected source/sound words in motionbody,corrected draftonly and rerunPASS. No applicationcataloguechanged,no paidcall. Register4/116specificreviews,112remain. Receipt docs/prompt-reviews/completeness-batch-01-2026-10-26.md.

### 2026-10-26 UGC-OPS-007 / UGC-VID-017 scoped hotfix rollout
- Website source c630c66f deployed/promoted as dpl_HF6A6phBxSDN9aMSpMXcuZ9jHQ5f; apex/www readback verified. Domain brands now require exact visible scraped-text evidence; URL/link/email/lookalikes and missing facts remain rejected. Evidence is server-local; no UI/schema/API changes.
- Onboarding/business-context/database77/77PASS; focused9/9PASS; historical worker compatibility5/5PASS; current Hook adapter/context79/79PASS. Lint/types/worker buildPASS; hosted production build/native bundlesPASS. Local build hit ENOSPC; only task-created build/baseline artifacts removed. Seven broad AI Studio failures independently reproduce on untouched production source; global suite is not green.
- Hook compatibility was already corrected by0f9f2eba in active worker45bf657b. Verified pinned image/100percent traffic/build/runtime identity and added exact historical v3GeminiPro1.7s regression with wrong-model/bytes rejection. No worker rollout or paid image request.
- User will manually check signed-in production. Initial post-promotion source job remains the original failed job without retry. UGC-OPS-007 remains OPEN for live acceptance; GoogleOAuth/final-page/reload/mobile NOT VERIFIED. No fabricated database completion. MCP unchanged; unrelated user work preserved. Receipt:docs/onboarding-domain-brand-hotfix-2026-10-26.md.


### UGC-VID-018 — Hook22 draft falsely describes empty returning hand — 26 October2026
- Status: OPEN; linked UGC-VID-013 source-to-prompt completeness audit.
- FULL-RESOLUTION OBSERVED: zero-based frames78,90,92 show the removed glasses still held by the hand returning to cover the mouth. Existing assigned candidate says the hand returns empty and glasses remain outside view.
- Expected: preserve glasses grip during the returning mouth-cover gesture; never invent hidden placement or object disappearance.
- Verified cause of draft mismatch: earlier thumbnail review missed the visible glasses arm. Generated-video effect NOT TESTED.
- Regression: compare Hook22 final-hand prop continuity against full-resolution source90/92 when reviewing revised prompt and any later output.


### UGC-VID-019 — Additional source-to-prompt completeness defects — 26 October2026
- Status: OPEN; linked UGC-VID-013. SOURCE REVIEW OBSERVED: Hook11 hands grip headphone earcups but baseline omits headphones; Hook20 both palms cover mouth but baseline describes one; Hook15 hard cut and tighter ending omitted; Hook04/05/10/72/83/99 have camera/expression/hold details needing correction. Hook22 is separately tracked as UGC-VID-018.
- Root cause: source-visible omissions in saved draft directions confirmed; exact historical prompt-authoring cause UNKNOWN. Generated effects beyond Hook01 NOT TESTED.
- Expected: compare complete decoded source sequence and full-resolution prop/gesture/cut/ending boundaries before candidate acceptance. Preserve source-specific actions rather than copy Hook01 shake into other videos.
- Regression: source-hash-bound audit fixtures must retain headphone grip11, two palms20, cut15, glasses-held22, full-tail camera/expression phases and complete t0-to-end chronology.
- Candidate corrections and individual evidence: docs/prompt-reviews/source-to-prompt-audit-progress-2026-10-26.md and reviewed-prompt-candidates-2026-10-26.json. Draft compiler checks pass; incident remains OPEN for eventual generated visual acceptance.

UGC-VID-013 completeness progress26October2026:27/116specific source comparisons completed,19corrected/timing drafts,8no-new-substantive-gap,89pending. New batches2342decodedframes/91sheets plus76fullreschecks. Actual prompt compilation/sourceSHA checks PASS; no paid calls/runtime assignment. Three next-batch agents hit usage limits before completion; their unfinished rows remain pending. Parent continued middle30/35/39/46 directly. Consolidated per-ID package and progress report preserve evidence/status; no claim of full116acceptance.


UGC-VID-013/019 completeness follow-up26October2026:20additional publicnormal sources reviewed end-to-end at native sheet resolution,1626decodedframes/63sheets plus29full-resolution checks. Hook102finalgaze returns nearer lens after upwardsideglance; baselineending omittedreturn,correcteddraft. Hook103approachalreadycovered,nowexplicittransientwobble/blur/tighttail. Other18mainactions substantivelymatch; measuredtimingrefinements saved. New shortsource3scandidates preserve sourceelapsedtimings thenextendfinalpose ratherthan slowwholeperformance. Actualcompiler/sourceSHA/framecounts/clockchecksPASS; no providercall/runtimeactivation/appedit. Register47/116reviewed,69pending; new visualgenerationNOTTESTED. Receipts docs/prompt-reviews/completeness-{next10,tail10}-2026-10-26.md; source-to-prompt-audit-progress-2026-10-26.md. IncidentsremainOPEN.


UGC-VID-013/019 continuation26October2026:13additional middle source comparisons,1325decoded thumbnails49sheets27fullreschecks. Twelve public cases retain already-covered action sequences. One private reference ending has source-visible tight/blurry framing omitted by fixed-camera baseline; private candidate corrected and compiler-checked, actual physical camera mechanism UNKNOWN. Private prose stays ignored. Regression: compare complete final-tail framing/foreground occlusion against source for private creator-account-1-01; do not classify correction as generated pass. Current60/116reviewed56pending. Hash/PTS-count/compiler/register consistency PASS; generation/runtime/UI/scheduling NOTTESTED, no paid calls or app edits. Incidents remainOPEN. Receipt docs/prompt-reviews/source-to-prompt-audit-progress-2026-10-26.md.


UGC-VID-013/019 final completeness follow-up26October2026: remaining56source comparisons completed (45public normal,2private normal,9private middle),5292native thumbnails/206sheets63targeted fullreschecks. New public source-confirmed draft gaps: Hook40 pink stylus incorrectly called finger;42late sideways gaze;45thin liquid trickle contradicted no-spill constraint;75pursed downturned ending;78opening gaze direction;90parted-lip edge-cropped ending. Three private corrections stay ignored. Historical authoring cause UNKNOWN; generated effects NOT TESTED. Regression: verify these props/gazes/liquid/final states against source and candidate before generation acceptance; retain full t0 chronology and clarity-only anchor role. Register116reviewed0pending,31correction statuses85no-new-gap. Compiler/hash/count/timeline/package checks recorded in completion receipt. No app edits/runtime assignment/paid calls/deployment. Incidents remainOPEN for generated acceptance. Disk ENOSPC resolved sufficiently to save; removed only task-created reproducible frame/sheet copies after review, original source retained.

### UGC-SCH-010 - Five-minute shortcut expires while composing before final submission
- Date: 2026-10-26. Status: OPEN / CODE REPRODUCTION CONFIRMED; related UGC-SCH-009.
- Observed: quickSchedulePreset(5) fills an absolute time at shortcut click. With the default five-minute lead, a click at 12:00:30Z produces 12:06Z, valid initially but rejected at 12:01:01Z. Production submission not reproduced.
- Expected/user instruction: resolve the five-minute shortcut at final submission; manual date/time overrides it; other presets and UI remain unchanged. Preserve configured server lead policy and retry the first accepted request without moving its time.
- Root cause: CODE CONFIRMED preset discards relative intent and every form treats its filled values as exact manual scheduling.
- Regression: five_minute_shortcut_resolves_at_final_submit_after_caption_delay; manual_date_or_time_clears_relative_intent; relative_draft_roundtrip_and_saved_request_retry_preserve_intent.

### UGC-UI-016 - Demo library empty text promises an unavailable upload control
- Date: 2026-10-26. Status: OPEN / CODE CONFIRMED.
- Observed: Demo picker says Upload one here but provides selection/refresh only. The surrounding Demo screen already supplies upload actions; no workflow dead end is asserted.
- Expected/user instruction: point to the Demo screen in empty-state wording only, retaining all controls and layout.
- Root cause: CODE CONFIRMED inaccurate empty-state string in WorkflowVideoAssetPicker.
- Regression: empty_demo_picker_directs_upload_to_demo_screen_without_new_controls.


UGC-VID-013 controlled pilot follow-up26October2026: user redirectedHook01repeat toHook04. Source original t0 and92decoded thumbnails inspected; frozen corrected prompt prepared. Provider rejected sole starting-image POST HTTP402(PaymentRequired),without usable error detail. Exact billing cause UNKNOWN;no image output/operation returned,zero video submissions,no automatic paid retry. Generation adherence remainsNOTTESTED; runtime unchanged. Regression expectation: no video submission until actual generated opening passes visual identity/scene/pose/caption review. Receipt docs/prompt-reviews/hook04-corrected-pilot-results-2026-10-26.md;prior trial history preserved.


### UGC-UI-016 — Talking Head references should show requested full videos
- Date: 2026-10-27. Status: OPEN / USER REQUESTED and SOURCE OBSERVED. Three marked cards use short excerpts; user explicitly requests full originals in folders24,25/4,37, including files under fullvideo_ignore. This overrides the historical import exclusion for these named files only.
- Expected: full-length gallery media, matching original links, no cropping/trimming, same card layout; old source identities remain recoverable.
- Root cause: historical catalogue deliberately selected trimmed sources; no runtime failure established.
- Regression: full_talking_head_sources_preserve_duration_hash_and_archival_recovery.

UGC-UI-016 local update2026-10-27:three full-original IDs prepared, originals/old IDs retained, discovery swaps verified by full_talking_head_sources tests.49/49 focused tests; all14 added/replacement files decode through end; types/lint PASS. Production OPEN:no upload/deployment; expanded browser launch not approved because review usage limit prevented review. Receipt:docs/talking-head-reference-import-2026-10-27.md.

### 2026-10-27 scoped implementation - UGC-SCH-010 / UGC-UI-016
- Five-minute choice now carries relative intent through all four scheduling surfaces; Explore unsent draft serialization preserves it. Manual date/time or another preset clears it; caption/accounts do not. Existing server default-time path resolves accepted slot; saved request retry remains immutable. Demo empty text directs upload to the existing Demo screen.
- Local evidence so far:104/104 focused tests;40/40 draft/pending recovery checks;63/63 service/local atomic DB/pending/section checks; targeted submission source contract1/1; TypeScript/scoped lint PASS. Main Scheduling and both popup browser suites PASS, including20-minute delay/manual override at desktop/mobile; screenshot comparison preserves layout. Full Explore/build verification recorded in final receipt.
- Separate broader scheduling source-contract suite initially126tests:122pass/4fail. One stale extraction boundary repaired for the directly affected submission test and targeted1/1PASS. Three unrelated expectations still refer to removed now/later cards, native step=time input and forced24-hour helper text. Do not change product UI to satisfy obsolete assertions. No claim that entire scheduling suite is green.
- Production acceptance remains OPEN/NOT VERIFIED: no hosted schedule/target/job/provider evidence or deployment. Receipt:docs/five-minute-submit-fix-2026-10-27.md. No generation changes.
- Receipt count correction: the initial broader scheduling/source-contract command ran112tests (108PASS/4FAIL), not126/122. The directly affected final-submission extraction was subsequently repaired and passes1/1. The other three source assertions remain stale; source/UI must not be regressed to satisfy them.


### UGC-SCH-011 — Slideshow automation settings do not reach published slides; cancellation can falsely succeed
- Date: 2026-10-27. Status: OPEN / CODE CONFIRMED; user requests scoped fixes and verification before deployment.
- Observed: collection asset IDs and saved visual styles were stored in slot snapshots but not passed into Library slide rendering. Format matching fell back to any ready generation. Pause/cancel swallowed cancelUserSchedule errors then marked slots cancelled. No live automation publication established.
- Expected: render selected owned collection images and exact saved cover/body styles into isolated automation Library copies; strict requested format; require durable cancellation confirmation before reporting success, and stop preparing new slots when paused. Original Trending cards/manual edits stay intact.
- Root cause: CODE CONFIRMED missing rendering handoff, permissive format fallback, and catch-to-null cancellation branches in slideshow-automation-service.ts.
- Regression: automation_collection_pixels_and_saved_cover_body_style_are_in_scheduled_snapshot; automation_wrong_format_waits; automation_cancel_failure_never_reports_cancelled; paused_automation_does_not_schedule_after_render.
- Production migration/client/provider acceptance remains NOT VERIFIED; no deployment authorized in this task.


UGC-VID-013/018/019 prevention follow-up27October2026: notbeen2new10source sets reviewed separately from prior116. All1260decoded thumbnails47sheets21targeted fullreschecks. Preserve set9glasses puttingON, set5pointingindex, set1continuouscheek-to-mouthcontact, set10pinkpen/reach/camera ending. User approved only sourceframes0–118for set10Hook; retained originalwithdemo, losslessderivative and previewpixelsverified. No new generated adherence evidence or incidentclosure. Source-bound package/validation docs/prompt-reviews/notbeen2-2026-10-27/. Actualbuilder first caught internal source-commentary in actionprose; kept evidence outsideproviderprompt and reranPASSwithout weakening validation. No appedit/provider call/liveassignment.

- Final 27October2026 local receipt for UGC-SCH-010/UGC-UI-016:124/124 final focused handlers/time/draft/Demo/pending checks;63/63 service/client/local atomic DB/pending/section checks;40/40 explicit draft/pending recovery checks (overlapping); full Explore1,287/1,287 zero skips; targeted submit source contract1/1; types/scoped lint/diffPASS. Three local desktop/mobile browser suites PASS. Before/after mobile and desktop screenshots inspected, same controls/geometry/labels.
- Sandboxed default Turbopack build stalled and was stopped; outside-sandbox npm run build -- --webpack PASS(exit0),230static pages and native traced-route checksPASS. The three unrelated stale UI source assertions remain excluded from green claims. No deployment/hosted schedule/provider write. Status LOCALLY VERIFIED / PRODUCTION OPEN; final files, commands, artifacts and rollback boundary in docs/five-minute-submit-fix-2026-10-27.md.

UGC-UI-016 production source update2026-10-27:full replacements and11additions deployed in dpl_B6HT7nNDKy5HXq6ETmk7gY48Fnno. All14live files hash-identical to validated originals/copy; posters200/range206 PASS. Old sources retained; gallery layout unchanged by source diff. Browser playback acceptance OPEN because browser control unavailable/unresponsive. No generation/publication claim. Receipt:docs/talking-head-live-release-2026-10-27.md.


### UGC-VID-020 — New Wall paired preview URL dropped during catalogue mapping
- Date:2026-10-27. Status:LOCALLY VERIFIED FIX; production NOT VERIFIED. Related UGC-VID-008/UGC-OPS-003.
- Observed: new six-reference integration test found `previewVideoUrl` undefined although the paired resolver supplied verified audio-muxed preview keys. Existing Wall pairs had no preview keys, so no prior production symptom is claimed.
- Expected: preserve each new Wall reference's exact paired preview URL, original video/audio identities, source link and category through the canonical catalogue.
- Cause:CODE CONFIRMED `getRecreateReferences` mapped original video/source/audio fields but omitted `item.previewVideoUrl` for Wall entries.
- Fix: add optional preview URL propagation in Wall mapping only. No old entry gained a preview field; all262 prior serialized catalogue records compare unchanged.
- Regression:`published batch appears in both galleries' existing category filter and canonical source/audio paths` checks all six preview hashes, audio/source roles and wrong-workflow rejection. PASS4/4 new tests; all1100 preview/source decoded hashes match. Browser fixture passes desktop/mobile selection and preview open/close. No production deployment, real generation or signed-in acceptance.

UGC-SCH-011 local repair evidence — 2026-10-27: collection/background/style output now rendered and pixel-tested before schedule creation; strict structure selection, empty-subset rejection and actual slide count; derived Library source identity prevents overwriting original content; cancellation requires durable cancelled status and pause blocks further preparations.91focused/database tests PASS,41worker tests PASS; actual Library and cancellation SQL executed in local PGlite; existing Trending Adjust/editor desktop/mobile browser fixtures PASS; scoped lint/types/Webpack build PASS; five route traces include18fonts. During verification Node/ESM parser mismatch was caught and corrected before final41/41 rerun. Three unrelated scheduling UI source assertions remain failing outside patch. No hosted migration/provider publication/production activation. Status remains OPEN for hosted acceptance; receipt docs/trending-automation-gap-fixes-2026-10-27.md.


UGC-VID-013/019 notbeen2backendfollow-up27October2026: uploaded49mediaobjectsplus source-boundpromptpackage/index afteruserexplicitrequest. InitialADC403resolvedbyexistingauthorizedCLIidentity;noIAMchange.51/51remoteSHA/contenttype/size/publicURLchecksPASSand10source/t0/promptjoinsverified. Do not equatebackendobjectswithactivecatalogueorvalidatedgeneratedvideo: noappcode/deployment/provider-generationperformed. Durable receipt docs/prompt-reviews/notbeen2-2026-10-27/backend-upload-receipt.md; historicalincidentsremainOPEN.


### UGC-UI-017 — Visual clip edits erase corrected subtitle words
- Date:2026-10-27. Status:OPEN / CODE CONFIRMED and LOCAL REPRODUCED. Found during requested read-only Talking Head code audit, not a reported live occurrence.
- Observed: workflow-finishing-boundary includes the complete clip composition, including overlay color/text/layout, in audioSelection. Any such change resets options.corrections to an empty array even when source IDs, trim and sound remain the same.
- Expected: preserve corrected subtitle words for purely visual changes; invalidate only when speech/timing actually changes.
- Verified cause: deployed workflow-finishing-boundary.tsx lines57-70; hook-workflow-preview passes complete sourceEditing/demoEditing at298-299. Native provider cause not involved.
- Regression: visual_overlay_change_preserves_subtitle_corrections. Reproduction of current defect PASS in ignored exact-production scripts/audit-caption-reset.test.mjs; no fix made. Output log .tmp/talking-head-additions-20261026/code-audit-reproduction.log.

### UGC-OPS-008 — Unbounded video-start request prevents in-page recovery while stalled
- Date:2026-10-27. Status:OPEN / CODE CONFIRMED and CONTROLLED LOCAL REPRODUCED. No live stall asserted.
- Observed: workflow-generation-client awaits POST and JSON body without AbortSignal/deadline. Until it settles, client submitting and boundary submittingRef remain true; boundary recover returns immediately. A stalled response/body leaves Preparing state and Refresh cannot recover within the mounted page.
- Expected: bounded auth/submission/body waits preserve original request identity and allow read-only same-request recovery without automatic paid resubmission.
- Verified cause: deployed workflow-generation-client.ts222-227 and workflow-generation-boundary.ts250-251. Browser may eventually reject transport; there is no application deadline.
- Regression: generation_start_timeout_releases_busy_and_recovers_same_request_without_duplicate_post. Controlled unresolved fetch reproduction confirms absent signal and submitting guard, then releases exact response for cleanup. Repro scripts/audit-generation-stall.test.mjs; log code-audit-generation-stall.log. No runtime change or live paid request.


UGC-UI-017 / UGC-OPS-008 repair follow-up - 2026-10-27: scoped two-file runtime fix implemented. Generation auth and POST/body waits now have30s deadlines, retain original body/key/durable receipt, release busy state and reject late acknowledgements without automatic paid retry. Caption-preview/audio selection uses speech-only composition while final export retains full visual edits.118/118focused tests PASS on primary and isolated release source, including durable GET recovery and visual-versus-audio invalidation. Primary types/lint PASS; isolated types after next typegen and lint PASS; staged hosted build and14mediahashes PASS. Broad primary Explore1289PASS/2FAIL on unrelated six-Wall-reference catalogue expectations; both pass2/2on isolated release. Status:LOCAL FIX VERIFIED; fresh signed-in production/provider acceptance NOT VERIFIED. Historical reproduction entries retained. Receipt:docs/talking-head-audit-fixes-2026-10-27.md.

UGC-UI-017 / UGC-OPS-008 live release follow-up2026-10-27: promoted isolated patch dpl_8BRwiJK2Kanr75D6CGPLEgqqADX2; live domain exactID/READY confirmed. All14referenceMP4 live hashes/bytes PASS; initial49MB read timeout resolved by independent exact-hash download, range206PASS. Fresh signed-in acceptance remainsNOTVERIFIED; local headless browser attempt did not complete and was cleaned up. No paid generation/publishing. Receipt docs/talking-head-audit-fixes-2026-10-27.md.

### UGC-UI-018 — Moving landing gallery slideshow lacks positioned image parent
- Date: 2026-10-27. Status: OPEN / LOCAL NEXT.JS WARNING CONFIRMED during implementation verification.
- Observed: Next.js warns that the two slideshow images use fill with a static direct parent. No production symptom or visible corruption established.
- Expected: each fill image has a positioned, fixed-size direct parent throughout the moving gallery.
- Cause: CODE CONFIRMED new SlideshowContent wrapper used size-full without relative positioning.
- Regression: landing_gallery_fill_images_have_positioned_parents_and_no_next_image_warnings; inspect real Next.js desktop/mobile gallery.

### UGC-OPS-009 — Local MCP proxy returns HTTP 500 in marketing regression sweep
- Date: 2026-10-27. Status: OPEN / LOCAL RESPONSE AND LOG CONFIRMED; production NOT TESTED.
- Observed: after the moving landing page loaded, the broader public-page sweep received HTTP500 at /mcp. Local Next.js log reports Failed to proxy http://localhost:8192/mcp-server with socket hang up. Gallery-only page checks proceed separately.
- Cause: UNKNOWN. No MCP, proxy, middleware or server implementation was changed by the gallery task; no production outage inferred.
- Expected: local public-page sweep can load /mcp and its setup routes successfully without proxy transport failure.
- Regression: marketing-layout.browser.mjs four-route sweep must receive HTTP200 on every route. Keep this failure distinct from gallery-specific acceptance; do not omit it from release reports.

UGC-UI-018 local verification — 2026-10-27: positioned the slideshow wrapper; production-build browser sweep passes40/40 layouts plus gallery interaction/recovery checks, with explicit positioned-parent assertions and zero Next.js image-parent warnings. Build/types/lint pass. Status: LOCALLY VERIFIED; no deployment/live claim. Receipt docs/landing-gallery-motion-2026-10-27.md.

UGC-OPS-009 follow-up — 2026-10-27: /mcp and both setup pages pass HTTP200, responsive layout, clipboard and setup navigation on the completed local production build, as part of40/40 public layouts. Cold-development proxy failure remains unexplained; no proxy/MCP runtime change made and no hosted outage inferred.

### UGC-OPS-010 — Root font-preload budget differs from older performance expectation
- Date: 2026-10-27. Status: OPEN / LOCAL TEST RESPONSE CONFIRMED, product impact UNKNOWN.
- Observed: unscoped landing-performance.browser.cjs stops at expected2 font preloads versus actual0 in the production homepage HTML/Link header. Font configuration was not edited by the moving-gallery task. No baseline comparison proves the cause or age of this mismatch.
- Expected: determine whether current Next.js output or the test's preload policy needs correction independently of the gallery; preserve exact editor font metrics.
- Regression: retain the unscoped font-preload assertion. The explicit --gallery-only run excludes only that budget assertion and reports it in excludedChecks;15 other static/media/lifecycle/auth-fixture checks pass, including on-demand loading of all six editor faces. Do not call the full performance suite green.


### UGC-UI-019 - Resume previous work prompt is uncentered and visually overwhelming
- Date:2026-10-27. Status:OPEN / USER REPORTED and SCREENSHOT OBSERVED. Related UGC-UI-003. Screenshot codex-clipboard-0f18948f-9d85-4d4c-bf21-be7cdbf97eb4.png shows prompt/actions at top-left of a large empty Talking Head content area.
- Expected: compact centered card, clear primary/secondary actions, responsive layout and keyboard focus while preserving all three navigation actions and draft recovery semantics.
- Root cause:UNKNOWN at report; exact renderer located in components/explore/workflow-draft-entry.tsx.
- Regression: resume_prompt_centered_desktop_mobile_and_all_existing_draft_actions_preserved.

UGC-UI-019 local repair2026-10-27: CODE CONFIRMED ask-state had only top-left padding without centering/container. Scoped440px card with hierarchy,44px actions and keyboard focus; prior choices/state/IDs/URLs retained.13session/lifecycle tests, real-boundary browser recovery journey/fiveviewports, TypeScript/lint and hosted staged build PASS. Desktop/mobile/baseline screenshots inspected. Short-landscape scroll preserved; no clipping. Production acceptance pending; receipt docs/resume-work-prompt-ui-2026-10-27.md.

### UGC-UI-020 — Landing badge appears unstyled and still shows old words
- Date:2026-10-27. Status:OPEN / SCREENSHOT OBSERVED, missing-icon behavior NOT REPRODUCED on public site.
- Evidence: supplied codex-clipboard-d1d04fd9-b226-459e-9208-0ea2ed916403.png shows Made for social, platform words without icons, no pill border, no brand icon and plain header links. Exact screenshot URL/runtime UNKNOWN.
- Expected: approved Post right away text within existing styled pill with Instagram/TikTok/YouTube icons; retain original headline and #workflow link.
- Verified: current local landing-platforms.tsx differs from Git baseline by only requested label. Fresh apex/www HTTP still returns old words with three SVGs and pill classes. Real production Chrome1440/390 shows1pxsolid border, rounded background and three visible16pxSVGs; no CSS/font/brand HTTP failures observed. Screenshot symptom cannot be attributed to source deletion or browser cache from this evidence.
- Root cause:UNKNOWN for unstyled screenshot. Copy mismatch is confirmed local-versus-production release state; no deployment in the original copy task.
- Regression: landing_badge_real_browser_has_approved_text_pill_and_three_visible_platform_svgs — verify computed styles/geometry and screenshots at1440/390/320 on exact preview/released URL, plus unchanged workflow destination. Earlier HTML render fixture stubbed Instagram/YouTube icons and was insufficient visual acceptance.
- Scope: investigation and isolated real-component preview; no production mutation or application CSS rewrite.

UGC-UI-020 approved contract update27October2026: user now requests initial Coming soon / Claude / Codex / Grok with icons and /mcp arrow, alternating every3seconds with the existing Post right away / Instagram / TikTok / YouTube / #workflow state. This explicitly supersedes the social-only expectation above. Pause on hover/focus; retain gallery/header/heading/shared social exports. Actual badge/CSS Chrome fixture PASS at320/390/1440 dark/light, stable state dimensions, icons, initial/repeat timing, hover/focus and link navigation; types/scopedlint/5gallerytests PASS. Screenshot original cause remainsUNKNOWN/OPEN. No deployment/full-app acceptance; unrelated unmerged worktree retained. Receipt docs/landing-rotating-badge-2026-10-27.md.

UGC-UI-020 subsequent user clarification27October2026: Coming soon is a separate status tag; the leading row should describe controlling the product from the clients. Implemented Control from beside Claude/Codex/Grok, with the status at the upper-right edge. Social state and rotation preserved. This is a requested wording/placement refinement; original unstyled screenshot incident remainsOPEN.

UGC-UI-020 visual design refinement27October2026: user requests premium rim/glow matching supplied reference and straight right arrow. Added local badge-only neutral gradient, inset highlight and soft exterior glow; ArrowRight replaces diagonal arrow. Actual-component Chrome checks PASS320/390/1440dark/light including unchanged sizes, icons, text, timing, pause and destinations; scopedlint/diffcheckPASS. Desktop/mobile screenshots inspected; pre-glow baselines preserved. No new reported runtime defect; original screenshot cause remainsUNKNOWN/OPEN, production notverified. Receipt docs/landing-rotating-badge-2026-10-27.md.

UGC-UI-020 supplied-asset/edge refinement27October2026: user requests supplied Grok bot image instead of prior Grok mark and status at far-right edge. Copied exact PNG, labelGrok bot, right0status/desktopquarterwidthoverhang/mobilealigned; existing dimensions/glow/timer/links retained. Initial standalone fixture render timedout after Next Image import; process.env build shim expanded, actual Next Image rerunPASS with0pageerrors. Browser asserts natural240px asset/right-edge status,320/390/1440dark/light stablebounds/nooverflow,rotation,pause,navigation PASS. Types/scopedlint/diffcheckPASS. Original screenshot incident remainsOPEN; local preview is not deployed acceptance. Full receipt docs/landing-rotating-badge-2026-10-27.md.

UGC-UI-020 exact placement clarification27October2026: user confirms status starts at right edge extending outward, only slightly smaller. Desktopleftfull; text10->9px/padding8->6px; mobile rightalignment preventsoverflow. Actual fixture allsixsize/theme cases and statusboundary/timing/navigation PASS; scopedlint/diffcheckPASS. Live header inspection1440/390HTTP200 confirms Free tools absent; local header source contains desktop/mobile nav item. Header untouched/no deployment. Receipt docs/landing-rotating-badge-2026-10-27.md. Original incident remainsOPEN; no new defect/root-cause claim from header availability question.

### UGC-UI-023 — Coming soon status visually detached from main pill
- Date:2026-10-27. Linked design iteration:UGC-UI-020. Status:OPEN pending final visual verification. USER REPORTED/SCREENSHOT OBSERVED in30816fd0: status pill is separated; expected slight touch/overlap at upper-right corner.
- Original cause UNKNOWN before code inspection. CODE CONFIRMED prior classes top:-12px plus left:100% produced no horizontal overlap at desktop; current patch top:-8px and12px inward desktop overlap preserves small status sizing. This is latest user-approved geometry replacing the previous outward-only instruction.
- Regression: actual Chrome status rectangle must cross main pill top by>3px and desktop right edge inward by12px; inspect curved corner visually at1440and320; retain rotation/link/overflow tests. User separately explicitly removes all footer social links, superseding original preservation requirement. No unrelated header/gallery/backend change authorized.

UGC-UI-023 local verification27October2026: actual Chrome320/390/1440dark/light passes attachment geometry, status size, iconloading,rotation,pause,links/nooverflow; desktop/mobile images reviewed show slight corner contact. Footer sixviewport tests pass with no social/external anchors, alllegal links accessible and wordmark retained. Scopedlint/types/diffcheckPASS. Status:LOCALFIXVERIFIED; production notdeployed/notverified. Receipts docs/landing-rotating-badge-2026-10-27.md and docs/landing-footer-2026-10-27.md. No broader release or original020 resolution claim.

UGC-UI-019 production acceptance2026-10-27: FIX VERIFIED for requested presentation. Live dpl_7RCmDsbfGBjZsX8E3M78p15keGgE shows centered prompt on exact old-work URL. Inspected desktop1280x720 and phone390x844 screenshots; center640,360desktop and correct content-center454below mobile64pxheader. Actual Tab order Resume->Start verified; no production draft mutation. Local13tests/five-size recovery browser acceptance remainPASS. Evidence .tmp/resume-work-ui/live-{desktop,mobile}.jpg; receipt docs/resume-work-prompt-ui-2026-10-27.md.

### UGC-UI-021 — Landing gallery opening arrangement, slow travel and hidden slideshow chevrons
- Date:2026-10-27. Status:OPEN / USER REPORTED; screenshot codex-clipboard-f6509f40-a37b-419d-bdc2-1156e9f0a93b.png supplies desired initial arrangement.
- Expected: product demo centered on first render, with the same seven surrounding pieces shown in the screenshot; continuous movement after entry at a noticeably faster pace; small visible slideshow chevrons.
- Root cause:UNKNOWN at report. Source inspection confirms initial phase3 selects the earlier Hook,6.5seconds per position, and slideshow chevrons render only for the focal card and stay hidden until hover/focus.
- Regression: landing_gallery_opens_demo_centered_and_travels_one_position_in_three_seconds; visible_slideshow_chevrons_change_slides_without_advancing_track. Preserve card size profile, media speed, pause/preferences and unrelated landing/Explore behavior.

UGC-UI-021 content clarification2026-10-27: user additionally requests that the centered Talking Head + Demo preview begin with the creator speaking. The earlier demo-only derivative intentionally started at source11seconds. Current instruction supersedes that selection: use source0–19seconds, retaining original creator opening followed by demonstration. Preserve original full Explore media, other card positions, three-second travel and slideshow chevrons. Regression: centered_talking_head_demo_begins_at_original_zero_with_creator_poster.

UGC-UI-021 final local verification2026-10-27: opening position9 matches requested card order; combined clip now source0–19seconds with original creator poster, no video retiming. Three-second travel measured in actual browser; opaque chevrons available on visible slideshows and click/key handling does not advance track.5/5motion/provenance tests, scoped lint, final Webpack/TypeScript/native build,40production-build layouts plus motion/recovery/preferences,15scoped performance checks PASS. Final actual-page/initial-fixture desktop images reviewed. Existing UGC-OPS-010 root-font budget remains separate excluded failure; no hosted acceptance/deployment. Status LOCALLY VERIFIED; receipt docs/landing-gallery-opening-speed-2026-10-27.md.

### UGC-UI-022 — Landing gallery should travel only on mouse hover
- Date:2026-10-27. Status:OPEN / USER REQUESTED change superseding continuous-on-arrival behavior in UGC-UI-021.
- Evidence: codex-clipboard-21a2a895-f2d4-49a3-863f-2391830e059a.png shows the original Hook-centered arrangement. User explicitly requests no gallery travel until hover.
- Expected: first render centers original primary Hook; gallery stays at its current position while unhovered, travels at the approved3second pace while mouse hovers, stops on leave. Preserve visible slideshow arrows, manual touch/keyboard browsing, creator-first combined-format media and card geometry.
- Cause:CODE CONFIRMED prior requested continuous mode runs when unhovered and pauses on hover. This is an explicit interaction-contract change, not a newly established production bug.
- Regression: gallery_idle_hover_leave_reenter_motion_contract; gallery_touch_and_focus_never_trigger_unattended_travel; initial_hook_center_matches_latest_reference.

UGC-UI-022 final local evidence2026-10-27: restored initial phase3/source primaryHook; travel admission now requires mouse hover, and pointer leave stops at current position. Focus/touch do not autonomously move the track. Actual-component fixture and real production-build40layout/motion suite PASS idle/hover/leave/re-entry/manual controls/preferences/recovery;5motion/provenance tests, scoped lint/diff, Webpack/TypeScript/native build and15scoped performance checks PASS. Final actual-page desktop screenshot inspected against supplied arrangement. Creator-first combined media and visible slideshow arrows retained. Status LOCALLY VERIFIED; no deployment/live-domain acceptance. Existing font-preload exclusion remains disclosed. Receipt docs/landing-gallery-hover-only-2026-10-27.md.

### UGC-OPS-005 release-readiness follow-up — 27 October 2026
- Read-only audit of PR71 head729cc229 confirms0.2.9/106tools/18skills/47packagefiles and all current exact-head GitHub checks PASS, including preserved-application. Fresh local catalogue/isolation/plugin24/24, archive9/9 and confirmation4/4 PASS. Package ZIP hash409411370c124c6337570501068fde1f5d6a7f0fe737fd710ec621a6376b733c matches committed source.
- Release drift remains OPEN: live apex connect page still links0.2.0; production OAuth advertises nine scopes without analytics/publishing. Candidate public preflight reaches production but fails missing analytics:read; this does not prove a candidate endpoint defect. Production health ready and401OAuth challenge observed. Dedicated staging builds remain older snapshots; exact729cc229 inventory has website preview only, no matching MCP build. Anonymous protected staging health302 is not native-client acceptance.
- PR does not contain the older unfinished social-connection/schedule-action modules, their two migrations, or CIMD transient-retry follow-up. Source count106 does not imply those features are consolidated. Cross-isolate confirmation replay rejection requires verified durable-storage flag/table configuration; deployment flag was not inspected or changed.
- Documentation-only audit and source-bound JSON package/tool/migration inventory prepared in .tmp/pr71-release-repair-20261026/docs/pr71-production-readiness-2026-10-27.md and pr71-release-manifest-2026-10-27.json; plugin context now points to current decision. Historical26Oct staging-schema verification is retained as historical evidence, not a fresh query. Clean exact-candidate Codex/Claude install/consent/callback/safe-read and candidate finished-download acceptance remain NOT VERIFIED. No runtime code, production/staging configuration, schema, deployment, publishing or customer content changed; no push/merge. Status remains OPEN for hosted acceptance.

### UGC-OPS-011 — PR71 portable MCP authentication extension rejected by installed Codex
- Date:2026-10-27. Status:OPEN / ACTUAL HOST REPRODUCED. User requests matching isolated staging builds and clean Codex/Claude plugin sign-in; no production writes/publishing.
- Observed: exact PR71 source729cc229 plugin0.2.9 installed successfully in disposable Codex0.164.0-alpha.11.1 profile with ON_INSTALL policy; plugin/read loads18skills but returns mcpServers=[] and thread-bound server discovery empty. Codex loader warns failed to parse plugins/ugc-pilot/mcp.json: unknown field extensions, expected url or headers. Both installed cache and local source exhibit rejection.
- Expected: clean installation discovers the bundled staging MCP and can start normal OAuth before an authenticated safe read. Package/schema fixture success must not replace host-loader acceptance.
- Verified cause: CODE/HOST CONFIRMED portable mcp.json embeds server.extensions.com.openai.auth; installed client parser rejects it. Wider client-version compatibility and best canonical packaging fix remain unverified; no production sign-in outage inferred from this isolated install.
- Regression: portable_plugin_loads_bundled_server_in_supported_codex_then_normal_oauth; assert nonempty plugin/read mcpServers plus actual thread-bound discovery; preserve resource/account scope and normal CIMD/DCR without embedded credentials. Current24/9package tests do not catch this host parser boundary.
- Scope: staging-only builds READY at source729cc229, production unchanged. Disposable compatibility variant may be tested separately and must never be reported as original package acceptance. Prior UGC-OPS-005 release-drift acceptance remains OPEN.

### UGC-TEST-001 — Proxima browser fixture omitted Semibold asset route and retained a wrong saved-font assertion
- Date:2026-10-27. Status:OPEN; CODE CONFIRMED; scope: local font test fixture only.
- Observed during requested edit-screen verification: scripts/explore-text-fonts.browser.cjs allows only400/500/700 WOFF2 requests, so Proxima600 falls through to HTML. Its deliberate saved Poppins700 check was accidentally changed to expect Proxima600. No production font-loading failure is established.
- Cause: fixture was incompletely updated for the new single-weight face. Application assets/render tests pass separately; browser execution remains blocked by Work settings.
- Expected: serve actual600 WOFF2 bytes; retain explicit Poppins saved style assertions; explicitly verify real Proxima browser loading and save/reopen before claiming UI acceptance.
- Regression: actual fixture HTTP asset responses must match packaged font bytes/content type; browser checks must retain authored Poppins and load Proxima600, including desktop/mobile screenshots. Do not equate asset checks with browser acceptance.

UGC-OPS-011 / UGC-OPS-005 staging host acceptance follow-up27October2026: exact729cc229 website dpl_2psCcgVGuUkoKpt6CnyDV8zTwaG5 and MCP dpl_Bs35uwhNVLuv5kSDJo8o71hJL62p READY on dedicated staging aliases. Protected health/OAuth13scopes/challenge/root-isolation PASS; staged0.2.9ZIP142182bytes SHA409411370c124c6337570501068fde1f5d6a7f0fe737fd710ec621a6376b733c matches source. Actual original Codex package loading FAILS as above; disposable no-extension variant loads server but does not establish full OAuth. Direct staging Codex diagnostic produces normal CIMD/PKCE URL; user reports requested action invalid, causeUNKNOWN/callbacknotverified. Claude official2.1.311 isolated installPASS; OAuth notaccepted dueprotectedgateway/noninteractiveharnessboundary. User reports staging onboarding missing workerconfiguration; no productioncredentials copied or workerprovisioned.
User requests switching narrowauthenticationtest torealapplication. Stoppedstaginglogin; callbacklistenerabsent. Both temporary user-approved staging TrustedSources restored to priornull and read back with SSOall intact. Three newer businessgates explicitlyfalse onlyin staging. Canonicalsource/package hash unchanged; production/settings/publishing/migrations untouched. Durable receipt .tmp/pr71-release-repair-20261026/docs/pr71-staging-host-acceptance-2026-10-27.md. IncidentsremainOPEN; source/staticchecks are not cleanhostacceptance.

UGC-TEST-001 follow-up2026-10-27: corrected600fixture route, restored deliberate Poppins700saved-style expectation, and prepared explicit Proxima600font-load/save/reopen assertions at desktop/mobile sizes. Actual fixture compiles and19font HTTP responses match packaged bytes/content type; syntax/lint PASS. No app runtime changes. Browser interaction acceptance remains OPEN/NOT VERIFIED: CUA still returns browser disabled after user reports enabled. Do not mark full browser test passed.

### UGC-OPS-011 Codex-only compatibility and live account verification — 27 October 2026
- Status: LOCAL PACKAGE/TESTED CODEX BOUNDARY VERIFIED; public distribution/other hosts remain OPEN. After reading the entire Explore context and ledger, changed only isolated PR71 plugin packaging, version0.2.10, validation/tests and acceptance tooling/docs; original0.2.9 ZIP hash remains409411370c124c6337570501068fde1f5d6a7f0fe737fd710ec621a6376b733c. No primary runtime/user edits overwritten.
- Actual Codex0.164.0-alpha.11.1 negative control0.2.9 loads18skills/no MCP server; corrected exact0.2.10 loads18skills/ugc-pilot/no parser warning. Removed portable server.extensions; endpoint/compatibility transport unchanged, normal protected-resource discovery retained. NewZIP142178bytes SHAae5cb61e758d97004098c811f89a1a623606477307001293ab957bd85c125074.
- First live OAuth browser callback showed Authentication complete but native login failed; independent same-profile process reports notLoggedIn and denies reads. Original failure diagnostic unavailable; token-exchange/persistence causeUNKNOWN. Preserved, not silently called passed. Second normal user-consented CIMD/PKCE/account:read login PASS through the installed plugin; same app-server get_profile/get_entitlements/get_capabilities return structured data. Account hash matches previously verified user account. Live79tools, distinct from source106.
- Restarted app-server with same isolated profile: native oAuth/79tools/same account/three safe reads PASS without another sign-in. All test processes exited; ignored profiles/credentials not committed or extracted. Claude deferred because user said use Codex. No media/render/upload/schedule/publish call or production source/settings/schema/worker mutation.
- PASS14catalogue/plugin,11isolation,10archive tests, validator/scopedlint/Pythoncompile/diff checks. Incorrect initial nonexistent isolation test path was corrected and actual11test suite passed. Desktop Install-button UX, other clients/versions, fresh paid media and full106-tool candidate release NOT VERIFIED. Package remains local/unpushed; existing public links/normal plugin installation unchanged.
- Receipt/files/preflight/rollback: .tmp/pr71-release-repair-20261026/docs/codex-plugin-signin-2026-10-27.md; sanitized positive/negative/restart receipts in ignored .tmp/live-plugin-signin-20261027/. UGC-OPS-005 release drift remains OPEN; no production-ready claim from this focused acceptance.

### UGC-UI-023 — Logo and favicon contrast
- Date: 2026-10-27. Status: OPEN. Evidence: USER REPORTED black logo is difficult to see on dark backgrounds and favicon has low contrast.
- Expected: existing logo adapts to the saved application theme without changing layout; a consistent high-contrast favicon is crawlable and legible at small sizes.
- Root cause: UNKNOWN pending inspection. Regression: verify theme switches, forced-white brand marks, icon declarations, and 16/32 pixel favicon rendering.

UGC-UI-023 local investigation 2026-10-27: shared ProductLogoMark used only the dark raster without a dark-theme filter; landing header already selects theme-specific artwork. Applied a theme-class filter to the shared mark and replaced the three framework icon files with matching white-on-orange artwork derived from the existing 1024px raster (original vector not found). ICO contains 16, 32, 48, 64, 128 and 256px images; inspected enlarged 16/32px output. Theme unit tests 7/7 and scoped ESLint passed. Production DNS unavailable and browser, responsive and deployed Google acceptance not verified; incident remains OPEN.

### UGC-UI-024 — Landing closing call-to-action feels outdated
- Status: OPEN; area: public landing page closing CTA; date: 2026-10-27.
- USER REPORTED: The existing closing section looks old and unattractive; see the user-provided screenshot in this conversation.
- Expected: A more attractive, clear closing section that fits the landing page and retains the existing account-aware action.
- Root cause: UNKNOWN; this is a design preference, not an established functional defect.
- Regression check: inspect desktop and mobile closing CTA for readable content and overflow; verify the existing signed-out, signed-in and verification destinations remain wired through LandingAuthCta.

### UGC-UI-025 — Scheduling section left column feels sparse
- Status: OPEN; area: public landing page scheduling section; date: 2026-10-27.
- USER REPORTED: The left-side content and gap in the scheduling section feel visually unbalanced; screenshot supplied in conversation.
- Expected: A tighter, more balanced left column while preserving the scheduling preview.
- Root cause: UNKNOWN; this is a visual design assessment, not a confirmed functional defect.
- Regression check: inspect desktop and mobile layout, headline wrapping, section link and preview for overflow and clarity.

### UGC-UI-026 — Unwanted scheduling-step dividers
- Status: OPEN; recurrence of UGC-UI-025; area: landing page scheduling section; date: 2026-10-27.
- USER REPORTED: The two horizontal lines around the scheduling steps should be removed, as marked in the supplied screenshot.
- Expected: Keep the steps and spacing without those divider lines.
- Root cause: CODE CONFIRMED: the steps list has border-y and border-border classes.
- Regression check: inspect the desktop and mobile section to confirm no list dividers and that all three steps remain visible.

### UGC-UI-027 — Agent logos scattered instead of grouped like reference
- Status: OPEN; recurrence of UGC-UI-024; date: 2026-10-27; area: landing closing CTA.
- USER REPORTED / SCREENSHOT OBSERVED: three isolated logo tiles float around the center. User requests overlapping, deliberately grouped side stacks like the supplied Finance+ reference, with content correctly centered.
- Expected: two compact overlapping agent stacks framing centered content; responsive layout avoids collision and overflow. Repeated marks are decorative and do not imply additional integrations.
- Root cause: UNKNOWN until source inspection. Existing source uses separate absolute positions for three tiles.
- Regression: closing_cta_grouped_agent_stacks — inspect side-stack overlap and centered content at 1024/1440, mobile at 320/390; preserve existing LandingAuthCta, MCP link and coming-soon qualification.

UGC-UI-027 local follow-up — 2026-10-27: replaced isolated absolute placements with two grid-owned overlapping three-mark stacks framing the centered copy. Repeated marks are aria-hidden decoration. Same LandingAuthCta prop, MCP href and coming-soon text retained. Scoped ESLint and TypeScript exit0; isolated actual-section Chrome renders at320/390/1024/1440 report no horizontal overflow. Desktop1440/1024 inspected. Screenshot fixture uses substituted auth button/Next Image and Arial, so full Next.js/auth/production acceptance remains NOT VERIFIED. Artifacts .tmp/cta-preview/cta-{width}.png. Incident remains OPEN pending user visual acceptance. Only closing CTA source and this append-only ledger changed in this turn; existing unrelated worktree retained.


### UGC-UI-028 - Unsupported model audio remains selectable before generation validation
- Date:2026-10-27. Status:OPEN / CODE CONFIRMED and PRODUCTION OBSERVED during requested core audit. UX gap, not evidence that audio reaches an incompatible provider.
- Observed: select Omni Flash1.1, open Select audio, attach harmless3s silent WAV; UI accepts local attachment. With valid instructions, Generate remains disabled and says choose Seedance/WAN or remove unsupported reference. No generation clicked. Test inputs cleared afterwards.
- Expected: make model support clear at selection time; preserve removal of an existing incompatible attachment and explicit model-switch recovery. Never silently discard references or switch providers.
- Cause: WorkflowAudioReference always renders picker; it reads policy.maxAudioDuration without consulting policy.allowedKinds. Generation client/API independently reject incompatible audio before submission/billing.
- Regression: model_incompatible_audio_picker_explains_support_before_selection_and_keeps_remove_available. Existing client/API rejection checks pass; new picker UX regression remains to implement.
- Evidence: .tmp/core-workflow-audit-20261027/omni-audio-rejected-live.jpg plus actual disabled-button DOM read; docs/core-workflow-audit-2026-10-27.md. No application fix requested or made in this read-only audit.

Core audit2026-10-27: UGC-SCH-006 still PRODUCTION CONFIRMED: old TikTok target action_required, connected/nonrevoked refresh-capable account with4later publications, live retryRPC unconditionally returns before revalidation. Local candidate4/4PGlitePASS; no migration/retry run. UGC-OPS-002 historical Seedance job remains undelivered in app despite provider completion and documented prior read-only retrieval; active exact-host adapter verified present. Last7days production39provider-ID targets,7Explorepublished/1blocked, no recent audio-reference jobs/Kling proof. Core adapter/source identities verified; local schedule56/56, compiled ReAPI/publish52/52PASS. Wider fixture failures retained. No paid/model/provider mutations. Full evidence docs/core-workflow-audit-2026-10-27.md.

### UGC-UI-029 — Logo stacks lack full-height cascade and edge fade
- Status: OPEN; recurrence of UGC-UI-027; date: 2026-10-27; area: closing CTA.
- USER REPORTED: apply full-height cascades, container gradient masks, consistent small cards, overlapping/jittered deterministic rotations and asymmetric left/right rhythms.
- Expected: decorative repeats of the existing three marks cascade through both side lanes and fade at the section edges; central content remains clear and existing CTA/MCP destinations remain.
- Root cause: CODE CONFIRMED: prior AgentStack uses a centered three-card flex column and no mask.
- Regression: closing_cta_full_height_masked_cascades — inspect full-height masked lanes, distinct rotations/orders and no center collision at1024/1440; mobile320/390 stays readable without overflow.

UGC-UI-029 local follow-up2026-10-27: grid side lanes stretch through full closing-card height. Both prefixed/unprefixed container gradient masks applied;88px tiles repeat existing marks with deterministic unique local rotations/offsets, distinct side orders and staggered right rhythm. Center CTA props/MCP href/qualification retained by source comparison. ESLint,TypeScript,diffcheckPASS; isolated Chrome320/390/1024/1440no horizontal overflow;1440/1024images inspected. Actual auth/Next Image substituted and Arial used in fixture: full-app/hosted acceptance NOTVERIFIED. No deployment. Local artifacts .tmp/cta-preview/cta-{width}.png. User visual acceptance pending; incident remainsOPEN.

### UGC-UI-030 — Repeated logo cascade and inaccurate agent artwork
- Status: OPEN; recurrence of UGC-UI-027/029; date: 2026-10-27; area: closing CTA.
- USER REPORTED: too many repeating cards feel cluttered. User supplies exact OpenAI, Claude and Grok bot images and supersedes earlier cascade/fade direction with exactly3 separated84px cards per desktop side, gentle inward arc, no mask or overlap.
- Reported jagged icon/background rendering symptom is UNVERIFIED; do not treat the user's suggested breakpoint cause as established.
- Root cause: CODE CONFIRMED for repeated count:9 entries per prior side. Existing shared mark supplies different Codex artwork; supplied image bytes must be used locally here.
- Expected: supplied images inside rounded solid cards at10/42/74% height; middle card35px inward; distinct gentle rotations;3unique marks per side. Existing account-aware CTA/MCP destinations retained.
- Regression: closing_cta_exact_assets_three_card_arcs — verify file hashes,3unique images per desktop side, visible separation, masks absent, solid rounded cards, no center collision at1024/1440 and responsive320/390; report fixture limits separately.

UGC-UI-030 local verification2026-10-27: exactly3 supplied-image cards per desktop arc; unique Claude/OpenAI/Grok images,84px squares, solid backgrounds,20px corner radius and separate positions10/42/74%; middle offsets55 vs20px. No masks/repeated cascades. Exact source/destination byte and SHA checksPASS. ScopedESLint/TypeScript/diffcheckPASS. Actual-section Chrome fixture at1440/1024 asserts3unique images/side,complete image loads,masknone,84px sizes and positive gaps(about74/76px at1440,93/95px at1024).320/390compact image rows and allfour widths no horizontaloverflow.1440/320images inspected. Fixture now embeds exact supplied images andGeist font, substitutes NextImage/auth action; full Next.js/auth/hosted acceptance NOTVERIFIED. API/provider unchanged; no deployment. Source file,three newlocalPNG assets andthisledger changed; unrelated shared marks/assets retained. Incident remainsOPEN for user visual/hosted acceptance. Evidence .tmp/cta-preview/cta-{width}.png.

### UGC-UI-032 — Closing copy does not explain agent control
- Status: OPEN; date:2026-10-27; area: landing closing CTA.
- USER REPORTED: central copy still talks generically about creating/sharing and should explain the agent-controlled application workflow.
- Expected: agent-focused headline/body with supported generation,editing,export actions; retained approved exact-logo arcs and account-aware CTA.
- Root cause: CODE CONFIRMED: closing title/body remained generic after logo redesign.
- Claim boundary: current MCP marketing/workflow source supports images/videos/edits/exports; docs/pr71-production-readiness-2026-10-27.md does not establish complete product parity. No full-app-control or scheduling parity promise added.
- Regression: closing_cta_agent_copy — inspect readable wrapping at320/390/1024/1440, preserve three-card arcs and exact asset loading, source-check unchanged auth action and MCP destination.

UGC-UI-032 local verification2026-10-27: eyebrow/headline/body now describe agent-controlled content generation, editing and export. Only closing CTA source copy plus this ledger changed in this turn; exact supplied-logo files/arcs, auth component props and MCP link retained. Evidence read: lib/marketing/mcp-public.ts supported workflows and docs/pr71-production-readiness-2026-10-27.md capability boundaries. Scope not complete-app parity. ScopedESLint/TypeScript/diffcheckPASS. Actual-component fixture320/390/1024/1440: no horizontaloverflow,desktop3unique84pxcards/side,imagesloaded/masknone/positivegaps; desktop1440/mobile390screenshots inspected. Fixture substitutes auth/NextImage and uses exactlogos/Geist: production/auth acceptanceNOTVERIFIED. Artifacts .tmp/cta-preview/cta-{width}.png. No deployment.

### UGC-UI-033 — Closing content should sit directly on the page
- Status: OPEN; date:2026-10-27; area: closing CTA.
- USER REPORTED / SCREENSHOT OBSERVED: entire closing section looks bundled in an unwanted rounded container; user requests text and logos directly on the screen/page.
- Expected: remove outer card background,border,rounded outline and clipping; keep invisible layout alignment, supplied logo tiles, centered agent copy and actions.
- Root cause: CODE CONFIRMED: closing wrapper has bg-card,border,border-border,rounded-[28px],overflow-hidden.
- Regression: closing_cta_no_outer_panel — computed outer wrapper transparent/zero border/zero radius;desktop3cards per side and mobile layout remain readable without overflow at320/390/1024/1440.

UGC-UI-033 local verification2026-10-27: removed only outer overflow-hidden,rounded-[28px],border,border-border,bg-card. Invisible max-width/grid wrapper keeps alignment;84px rounded individual logo cards retained. Actual-component fixture320/390/1024/1440no horizontaloverflow;desktop3unique loaded images/side,positive gaps,masknone.1440screenshot visually inspected: content directly on page background,no outer panel. ScopedESLint/diffcheckPASS. TypeScript not rerun for class-only removal; prior turn passed. Auth and production NOTTESTED; fixture substitutes auth/NextImage,exactlogos/Geist. Source andledger changed; no deployment. Evidence .tmp/cta-preview/cta-{width}.png.

### UGC-UI-034 — Unwanted white outlines around agent cards
- Status: OPEN; date:2026-10-27; area: closing CTA.
- USER REPORTED / SCREENSHOT OBSERVED: visible white outline around each logo; user requests removal.
- Expected: no added border on desktop or mobile logo tiles; retain supplied images and latest borderless section layout.
- Root cause: CODE CONFIRMED: desktop/mobile tile wrappers have border border-white/10 over bg-white.
- Regression: closing_cta_logo_cards_no_border — inspect border-free image edges at desktop/mobile and maintain84px desktop card geometry/image loads.

UGC-UI-034 local verification2026-10-27: removed added border andwhitebacking from desktop/mobilelogo wrappers. Exact suppliedimagebytes,shadow,radius,size,arcs andborderless outersection retained. Actualcomponent fixture320/390/1024/1440PASSloadedimages/3uniquecardsperdesktopside/positivegaps/nooverflow;computeddesktopbackground transparent;1440imageinspected withwhite outlinesabsent. ScopedESLintPASS. Firstwhitebackingremovalattempt blockedbyautomaticapprovalreviewusagequota,notexecuted;usercontinuedandnormaltoolretry succeeded. Noauth/provider/deploymentchange;fullapp/productionNOTVERIFIED. Evidence .tmp/cta-preview/cta-{width}.png. Incident locallycorrected,useracceptancepending.

### UGC-UI-035 — Default sign-in destination should be Explore
- Date: 2026-10-27. Status: OPEN / USER REQUESTED.
- Observed: ordinary sign-in reaches the Trending dashboard. Expected: ordinary email/Google sign-in and email verification reach Explore; paid checkout and OAuth consent retain their explicit destinations.
- Cause: CODE CONFIRMED: purchase-intent helper and auth component defaults use /dashboard.
- Regression: default_signin_opens_explore_and_preserves_checkout_and_oauth.

### UGC-UI-036 — Recreate opening latency and missing remembered Talking Head photos
- Date: 2026-10-27. Status: OPEN / USER REPORTED; relates to prior source-frame/restoration latency incidents.
- Observed: Recreate opens slowly; previously used person photos are not always selected in Talking Head + Demo.
- Verified: shared preparation already remembers account-scoped photo IDs but only restores them when no draft exists. An automatically saved empty draft suppresses defaults. Exact hosted latency cause remains UNKNOWN; lazy bundle loads on first open.
- Expected: warm the preparation bundle on pointer/keyboard intent; restore recent owned photos into untouched empty preparations while preserving explicit clears, existing images, accepted requests and approvals.
- Regression: recreate_intent_warms_bundle_without_generation; empty_preparation_restores_recent_owned_photos_and_preserves_explicit_choices.

### UGC-VID-021 — Starting-frame screen remains pending although the saved job completes
- Date: 2026-10-27. Status: OPEN / USER REPORTED and SCREENSHOT OBSERVED.
- Evidence: codex-clipboard-86691e7a-379c-4d1f-a3ba-883572adffc1.png shows Seated travel explainer, one person photo, Seedream 5.0 Pro and pending result.
- Backend: read-only production lookup confirms job 5ca95d8b-4a36-4339-8658-ffe9a912c8a3 completed, with ready owned media ae8800a1-0611-49a1-8322-310ecfcdf766 and matching input/output receipt. No replacement generation or credit spend.
- Root cause: UNKNOWN for the screenshot. CODE CONFIRMED recovery gap: an initially missing request (HTTP404) stops automatic status polling even though an uncertain accepted submission may appear later.
- Expected: bounded-rate read-only recovery of the same saved request after404/transient failures; authentication/ownership failures still stop; preserve receipts and block duplicate spending.
- Regression: missing_starting_image_receipt_recovers_completed_same_job_without_post.

### UGC-UI-037 — Free tools cards and download buttons feel inconsistent
- Status: OPEN; date:2026-10-27; area:/free-tools.
- USER REPORTED / SCREENSHOT OBSERVED: card/button corners feel dated and download actions sit at unequal heights.
- Root cause: UNKNOWN initially; source shows video status row above button and PDF action without equivalent row.
- Expected:28px cards,20px media panels,52px pill downloads and common desktop content/status row heights. Preserve downloads,counter,request IDs,errors,notification consent and standalone bundle layout.
- Regression: free_tools_aligned_download_actions — compare both button top/height/radius at1024/1440 in loading/available/exhausted/error states and mobile320/390 overflow; no production slot consumed.

UGC-UI-037 local verification2026-10-27: page+compact bundle now28px cards,20px previewpanels and52px pillbuttons. Common desktop heading/description/status height slots align button tops exactly1143.59375px at1024/1440 available fixture;1440completed/errorfixtures also equal.320/390no horizontaloverflow. Loading slot same minheight; no download POSTs or notificationwrites exercised/production slots consumed. Logic above render unchanged; compact-only ternaries preserve standalone classes. ScopedESLint/TypeScript/diffcheckPASS. Actualpage/bundle/Button rendered in isolatedChrome fixture withGeist/originalcover,stubheader/NextLink/Image andmockstatus;1440screenshot inspected. HostedGETfailedviawebtool; production/downloadendtoend/standalonebrowser NOTVERIFIED. Files:app/free-tools/page.tsx,components/marketing/hook-video-bundle.tsx,thisledger. Evidence .tmp/free-tools-preview/free-tools-{width}.png andcomplete/error variants. Uservisualacceptancepending;notdeployed.
### UGC-UI-037 — Slideshow generation disappears after navigation and duplicate finished-slide controls
- Date: 2026-10-27. Status: OPEN; recurrence of UGC-UI-006/010.
- USER REPORTED: Generate did not produce slides; leaving the workflow and returning showed nothing. SCREENSHOT OBSERVED: user marks both permanent Use my finished slides buttons for removal.
- Expected: remove those two controls; retain Add slides upload. Accepted server jobs continue independently and their latest batch remains visible after return/reload. Planning clarifications remain readable after navigation; recovered history must not replace an edited sequence.
- Root cause at report: UNKNOWN. Investigate request admission separately from job execution and view restoration.
- Regression: slideshow_completed_while_away_restores_latest_batch; slideshow_clarifications_survive_remount; slideshow_removes_duplicate_finished_upload_actions.

### UGC-OPS-012 — Slideshow planner asks for a screenshot destination already linked to slide 5
- Date: 2026-10-27. Status: OPEN; related to historical UGC-VID-009 and 25 October planner clarification recurrence.
- USER REPORTED: slideshow generation did not start. Root cause at report: UNKNOWN.
- Production evidence: plan e4c021d8-3700-4318-8eb8-e0de3253b800 at 12:21:29 UTC contains six source targets, one person upload, one website screenshot and instructions to replace slide 5's phone with a laptop displaying the supplied image. Planner output is a clarification about Upload B's destination, with zero slides. No image jobs are associated with that request.
- Expected: contextual device-screen references resolve to the explicitly named source slide when unambiguous; genuine competing destinations still clarify. Keep per-slide scoping, identity roles, grounded copy, credit admission and idempotency intact.
- Regression: slideshow_device_replacement_uses_supplied_screenshot_on_named_slide_only; slideshow_ambiguous_destinations_still_require_clarification.




### UGC-UI-038 - Failed starting-frame image appears to block retry and model switching
- Date:2026-10-27. Status:OPEN / USER REPORTED, SCREENSHOT OBSERVED and failed server job confirmed. Source screenshot codex-clipboard-80f871fb-75e7-409d-9d14-bba6c6bb354c.png.
- Observed: user reports Generate another continues blocking after failure and selecting a different image model. Production job4d540d5d-7f3d-47b4-a647-629243c6bed1 is failed/JOB_FAILED with provider402diagnostic for talking-emmgr4c3. Selected screenshot model differs from failed receipt model; changing model alone must not submit.
- Expected: verified terminal failure releases retry/model controls, preserves photos/source/draft/history, and a deliberate click creates a fresh request. Uncertain/running requests remain protected from duplicate spending.
- Root cause:UNKNOWN pending actual-state reproduction; provider402underlying reason not established beyond returned error.
- Regression: failed_starting_frame_allows_same_frame_retry_and_model_switch; uncertain_starting_frame_remains_blocked; terminal_failure_restores_after_remount.

UGC-UI-038 code evidence2026-10-27: new creator-reference/remount regression fails before fix (Generate another disabled) while ordinary noncreator failure test passes. retainedFrame treated any version2 creator preparation with an image request as an obsolete source binding even when getCuratedHookFrame returns undefined. generationDisabledReason then permanently blocks retries on the original source; changing model remains version2. Restrict retained binding to references with an actual curated replacement. This confirms a code path matching the report, not a reconstruction of the user's browser storage. Underlying provider402cause remains UNKNOWN.

UGC-UI-038 local follow-up2026-10-27: PARTIALLY VERIFIED, production acceptance remains OPEN. Corrected retainedFrame guard; added actionable provider402message.64focusedUI/variation/polling/modeltests and25API/clienttests PASS. Real component/browserfixture before/after1440/390 reproduces disabled original and enabled fixed retry, including close/reopen and deliberate new request. Types/scopedlint/diffcheckPASS. No paid generation or deployment. Source/photos, uncertain-job duplicate protection and curated legacy-source gate verified by tests. User browser's exact saved failing state and provider402underlying cause NOT VERIFIED. Evidence docs/starting-frame-retry-fix-2026-10-27.md and .tmp/starting-frame-retry-20261027/.

### UGC-UI-039 — Scheduling illustration image fails to load
- Status: OPEN; date:2026-10-27; area: public landing scheduling section.
- USER REPORTED / SCREENSHOT OBSERVED: broken image indicator and black thumbnail in scheduling illustration.
- Expected: source thumbnail loads through actual Next Image on desktop/mobile, preserving preview geometry and surrounding scheduling layout.
- Root cause: UNKNOWN. Local tracked WebP exists,29544bytes,Sharp metadata decodes540x960. Current component requests optimizer. Production DNS lookup fails in this environment; no assertion of deployed optimizer/root cause.
- Regression: scheduling_preview_actual_next_image_loads — real Next Image element,actual asset request/image decode,currentSrc,naturalWidth and stable geometry at desktop/mobile; production endpoint remains required acceptance.

UGC-UI-039 local image evidence2026-10-27: one-line scoped unoptimized prop serves existing29544byteWebP directly instead of /_next/image. Source remains tracked/samebytes. Real NextImage (not substitute) actual-component Chrome harness requests originalsource and decodes540x960 at1440/390;complete/currentSrc/naturalWidth assertionsPASS. Render188x235desktop,80x100mobile;no horizontaloverflow;1440screenshotinspected. Harness intercepts staticrequests withactualfilebytes andsubstitutes host shell: doesnotestablishdeployedasset/optimizerresponse. curl productionDNSfailed;rootcauseUNKNOWN/liveacceptanceOPEN. No globalconfig,otherimages,schedulinglogic or deployment changed. Evidence .tmp/schedule-image-verification/schedule-{width}.png. Incident locallymitigated pendinghostedverification.

### UGC-UI-039 — Starting-frame pending state lacks visible loading feedback; changed-photo and latency audit
- Date:2026-10-27. Status:OPEN. USER REPORTED/Screenshot8518277a shows static image icon and blank pending variation while second image is generating. User asks whether a one-photo first request and three-photo second request keep distinct inputs, and whether delay is backend or display.
- Expected: visible accessible spinner during pending generation across shared workflows; no spinner after failure/completion; current selected photo list frozen independently per explicit request. Preserve uncertain-request guards and source roles.
- Cause at report:UNKNOWN for excess latency. Production saved jobs502e1728 and9c814c29 show1and3photo IDs respectively,2and4totalreferences,0.67/0.63squeue,59.31/70.28sprocessing. Provider-wait stage spans58.43/69.43s; persistence after provider output0.60/0.65s. Exact browser display latency not yet established.
- Regression: starting_frame_pending_spinner_states; generate_another_freezes_updated_three_photo_selection; generation_api_preserves_per_attempt_photo_lists.

UGC-UI-037 / UGC-OPS-012 local verification — 2026-10-27: CODE CONFIRMED recovery gaps were completed browser-hinted jobs excluded from foreground visibility, initial presentation relying on a URL job parameter, and visit-local planning questions. Latest production attempt at17:51IST is separately blocked by an unnecessary UploadB destination clarification, with zero planned slides/no image jobs. Removed both marked permanent buttons; retained Add slides upload. Added owner-scoped validated clarification persistence, terminal-result restoration, one-time recovery presentation, current-visit-only auto-assembly and scoped New session clearing. Planner revision3 adds contextual replacement-device screenshot guidance without removing genuine ambiguity checks.204combinedtestsPASS; actual-client local recovery browserPASS completion-while-away/cleanroute/reload/accountisolation/clarification/lostresponseGET/noduplicatePOST/Newsession; responsive320–1900picker and full editor/upload/save/reload/touchfixturesPASS. Signed-in production redirectstosignin; no approvedfullappgoldenbaseline, deployment or imagequalityacceptance. Automaticapprovalreview rejected the exact-private-input OpenAI planner replay beforeexecution for missingpayload/destinationpermission; no bypass, no real model result. StatusLOCALLYVERIFIED/PRODUCTIONOPEN. Receipt docs/slideshow-generation-recovery-2026-10-27.md. Retain all unrelated concurrentworktreechanges and prior incidenthistory.

### UGC-UI-040-SLIDESHOW — Gallery names and sharp Recreate buttons
- Date:2026-10-27. Status:OPEN / USER REPORTED and SCREENSHOT OBSERVED. Source: codex-clipboard-42ef8e31-79fc-4194-81c2-04213ed96220.png.
- Observed: slideshow gallery displays Slideshow1/2 and category names such as Fitness under images; user requests no displayed slideshow names and a subtle increase in Recreate border radius.
- Expected rule: slideshow gallery cards have no visible reference name, including generic names and category labels; keep source links, slide counts, preview and accessible action identities. Only slideshow Recreate corners become more rounded.
- Cause at report:UNKNOWN. Source confirms compact ReferenceCard renders reference.title unconditionally and labelled action inherits default rounded-lg.
- Regression: slideshow_cards_hide_names_preserve_source_actions_and_use_rounded_recreate; hook_wall_card_presentation_unchanged; desktop_mobile_preview_source_and_recreate_clicks.

UGC-UI-039 local follow-up2026-10-27: loadingfeedbackimplemented in existing preview and pending recreation thumbnail, including reduced-motion class and aria-busy; terminal/readerror stops spinner.66UI/variation/recovery +26API/client +36worker/provider testsPASS. One-to-three changed-photo tests assert both immutable request lists and ordered queued references; production jobs independently match1and3identityphotos. Desktop/mobile1440/390before/afterfixturePASS andscreenshotsinspected. Provider-waitstage accounts58.43/69.43sof59.31/70.28processing; no clientcompletion telemetry, exact provider-only split or all-workflow latency claim. SingleGET3.37s/1,280,719bytes; no paid inference. Types/scopedlint/workerbuild/diffPASS. StatusPARTIALLYVERIFIED; hostedUI/productionacceptanceOPEN. Receipt docs/starting-frame-loading-audit-2026-10-27.md.

UGC-UI-040-SLIDESHOW local verification2026-10-27: ReferenceCard now suppresses visible names by slideshow format, retains source links/selection/accessibility/reference IDs and skips truly empty caption rows. Labelled/icon slideshow Recreate corners are rounded-full; Hook/Wall captions and radius unchanged.80focusedtests,TypeScript,scopedESLint,diffcheckPASS. Realcomponent browserfixturePASS38source destinations,preview/next/previous,recreate,keyboard,freegate,legacycards at1366/1280/390;actual before/afterdesktop/mobile screenshots compared. Fixture auth/billing/socialdestinations substituted; no hostedacceptance/deployment/paidcall. Rule recorded in nonnegotiables.md and EXPLORE_CONTEXT.md. StatusLOCALLYVERIFIED/PRODUCTIONOPEN. Evidence docs/slideshow-card-ui-2026-10-27.md and .tmp/slideshow-card-ui/.

### UGC-UI-040 — Unrequested starting-frame panel hid the three reference cards and added explanatory clutter
- Date:2026-10-27. Status:OPEN. USER REPORTED/SCREENSHOT OBSERVED: separate starting-frame prose panel, permanent face chooser/model hint, and From your frame ratio text displaced familiar Choose image / Video reference / Select audio. User requests restoration, starting frame inside image card, no unsolicited explanation.
- CODE CONFIRMED: WorkflowCreationForm hides Optional references in startingFrameMode; HookWorkflowPreview supplies prose-heavy frameControl. Root cause: unrequested replacement of established card layout.
- Expected: retain three cards; single starting-frame image tile with existing Change/Remove behaviors and photo controls inside picker. Keep model validation, Sound state, draft/source bindings and scheduling unchanged. Ratio uses normal selector without From your frame.
- Regression: starting_frame_keeps_three_reference_cards; no_unsolicited_frame_helper_copy; starting_frame_ratio_uses_normal_selector. Related UGC-UI-001/013.

### UGC-UI-023 — Duplicate animation photo chooser and unnecessary guidance recurrence
- Date:2026-10-27. Recurrence of UGC-UI-001/003. Status:OPEN. USER SCREENSHOT OBSERVED: loaded frame Change plus separate Choose photos tile and explanatory animation guidance. Expected: one visible preview/Change; all existing photo capabilities accessible inside Change; no persistent explanatory copy. Root cause CODE CONFIRMED: shared video composer omits compact prop on StartingFrameAnimationReferences; noncompact branch displays both controls. Preserve recoverable errors and selected images/model restrictions.
- User additionally requests starting-frame animation defaults3seconds for WAN/Omni and4seconds for Seedance. Existing app model IDs wan_3_0/google_omni/seedance_2_5; no provider-version change authorized.
- Regression: loaded_frame_change_contains_photo_controls_without_duplicate_tile; no_redundant_animation_guidance; model_specific_starting_frame_duration_defaults; saved_selections_and_custom_duration_unchanged_on_rerender.

UGC-UI-040 local follow-up2026-10-27: restored three reference cards in frame mode; approved frame sits in image card and existing Change (+ overlay with accessible label) opens scene/photo controls. Removed unsolicited speech/audio panel and permanent model hint; Sound retained in Video settings. Ratio normal selector/currentframeoption; removed From your frame.153focusedregressionsPASS including failedretry/loading/currentphotos/draftscope/Demo/script/inputgates; types/scopedlint/diffPASS.1440/390fixture verifies3cards,Change/dismiss/removal/emptyimage,normalratiooption,noduplicatepermanentphotos,nooverflow. Screenshot review caught clipped Change word in circular action; corrected to existing-style+icon. Fixture selector initially used prehydrationexactratio name; fixed to hydrated name and reranPASS. No paidcalls/schema/prompt/deployment. StatusLOCALLYVERIFIED; production and uservisualacceptanceOPEN. Do not repeat unsolicited layoutreplacement/helperprose. Evidence docs/restore-starting-frame-reference-cards-2026-10-27.md.

### UGC-VID-021 — Reviewed prompt corrections not wired into production runtime
- Date:2026-10-27. Status:OPEN. CODE/DEPLOYMENT CONFIRMED: source-completeness review package explicitly declares source_review_complete_drafts_not_activated and runtimeChanges0. Production uses existing motion-plan JSON and private encrypted assignments instead. Hook01 lacks the revised phone-pickup/shake sequence in that animation path.
- Cause: review-only task boundary excluded activation/encrypted packaging; subsequent release included audit documents without runtime assignment changes. This is an integration/rollout gap, not evidence that every existing prompt is wrong.
- Expected: promote source-ID/SHA-bound reviewed candidates to runtime tables, preserve pacing decisions, old-image continuation paths and authored instructions; verify real caller output and private encrypted roundtrip before requesting deployment approval. User explicitly requires notification before any live deployment. Do not label static source review as perfect generated output.
- Regression: reviewed_prompts_resolve_from_each_runtime_reference; hook01_phone_pickup_and_final_shake_present; middle_clarity_anchor_unchanged_t0_motion_complete; private_encrypted_prompt_pack_matches_candidate; changed_hash_and_manual_edits_do_not_select_wrong_prompt.

UGC-VID-021 local candidate2026-10-27:116source-bound assignments prepared,111changed/5already matched. Runtime public normal/middle tables and two encrypted private files updated locally; source-video route reads matching reviewed plans.43prompt tests/38related API tests,12actual production-mode private reads and60private duration compilations/types/lint PASS. Hook01pickup/shake regression passes. User-authored text and five existing review gates retained. No paid or hosted generation/production deployment performed. Status LOCAL CANDIDATE VERIFIED; production activation/visual acceptance OPEN. Receipt docs/reviewed-prompt-activation-2026-10-27.md.


### UGC-VID-022 — Reviewed Investing & Money motion prompt hidden during Recreate preparation
- Date:2026-10-27. Status:OPEN. User requests verification and showing the six reviewed Wall prompts immediately after Recreate. Related UGC-VID-020/021.
- USER REPORTED expectation; CODE CONFIRMED initial finding: getHookKeyframePromptPreview resolves the six source-hash-bound motion directions and compiles animationPrompt; HookStartingFrameWorkspace passes directions onward when approving a frame but renders only image instructions in its initial preparation popup. No animationPrompt display there.
- Production status: public page currently identifies dpl_C1UzT3KFgb91yCiTtcrhimJA5acV; signed-out browser reaches Opening sign in. Lazy bundle inspection pending; real saved-generation usage not yet verified.
- Expected: the matching compiled video prompt is visible on opening each of these six Wall recreations, remains synchronized with saved user motion edits, and is the same builder content passed to animation after explicit image approval. Source/identity/time bindings, other references, payment gates and layouts remain.
- Root cause of display gap:CODE CONFIRMED missing render of animationPrompt. Whether current users submitted paid jobs with these directions UNKNOWN.
- Regression: six_wall_recreate_dialogs_show_exact_compiled_prompt_before_any_submission; saved_motion_edit_is_the_displayed_and_submitted_directions; other_workflow_preparation_unchanged. No paid generation or deployment authorized by an inspection claim.

UGC-VID-022 local verification — 2026-10-27: deployed bundles for dpl_C1UzT3KFgb91yCiTtcrhimJA5acV confirm all six Wall reviews and runtime composer wiring, but preparation did not display animationPrompt. Added source-bound expanded Video prompt disclosure using the existing preview compiler/styles. 57 focused tests, scoped ESLint, TypeScript and diff check PASS. Actual preparation-component Chrome fixture PASS for all six refs at1440/390: exact text, collapse/reopen, no overflow/pageerrors/POSTs. Two screenshots manually inspected. Source SHA/index, identity roles, custom/empty instructions and paid gates preserved by tests. Signed-out production redirects to login; historical provider usage, generated fidelity and authenticated hosted UI remain NOT VERIFIED. Status LOCALLY CORRECTED / PRODUCTION OPEN; no deployment. Receipt docs/prompt-reviews/wall-money-production-prompt-check-2026-10-27.md. Preserve concurrent worktree changes; UGC-VID-021 notification/approval release instruction retained.


### UGC-UI-041-INFLUENCER — Image workspace grows vertically and needs compact previews/enlargement
- Date:2026-10-27. Status: LOCALLY VERIFIED / PRODUCTION OPEN. USER REQUESTED workflow/UI revision; related layout safeguards UGC-UI-002/003.
- Report/request: delete batch-count and reference-helper lines, clamp submitted prompts to two lines with Copy retained, use fixed-width horizontal results including creating candidates, and add full-resolution enlargement. Initial cause: UNKNOWN until inspection.
- CODE CONFIRMED: character-workspace renders progress.message and selectionHint, maps batches as vertical blocks, uses an auto-fit image grid and unrestricted prompt text; no result enlarge action. This establishes existing presentation, not a provider defect.
- Regression: results_remove_summary_copy_and_enlarge_only_completed_images; character-reference.browser.cjs verifies desktop/mobile horizontal geometry, complete clipboard payload despite two-line clipping, pending append without page-height growth, completion geometry, touch expand placement/hit targets, lightbox navigation and Close/Escape/outside dismissal.
- Evidence: 32 focused UI/session tests +57 generation/identity/history tests PASS; types/lint PASS; actual-component fixture PASS. Before screenshots preserved in .tmp/influencer-rail-baseline; after screenshots in .tmp/character-reference-browser. API/auth/media fixture substitutions disclosed; no paid inference/deployment. Production browser unavailable (profile in use); live acceptance NOT VERIFIED. Receipt docs/influencer-image-rail-2026-10-27.md.

### UGC-UI-041 — Saved influencer selection replaces photos; starting-image verification error duplicated
- Date:2026-10-27. Status:OPEN. USER REPORTED / SCREENSHOT OBSERVED: My AI influencers behaves as single-select despite 1-of-5 indicator; starting-image verification failure displayed in settings and result. Document7 contains hypotheses, not established root causes.
- CODE CONFIRMED: selectInfluencer replaces images with one asset; influencer tab checks only selectedImages[0]. Expected independently toggle same-person photos to model cap and preserve existing removal, uploads and draft scope. Multiple selected photos must reach request in order.
- BACKEND READ CONFIRMED: Seedream creator-account-1-02 job03125acf-9f8c-45d5-9016-2c8344580319 failed PRE_DISPATCH_PERSISTENCE_FAILED, no worker/start/output. Receipt version4 with one person/three total references. Exact screenshot browser request ID is absent; this is matching reference/model evidence.
- Root cause investigation: receipt verifier serializes nested animationOpeningFrame and preparation sourceFrame with property insertion order; JSONB reorders objects. Reproduce before correction. Preserve strict owner/source/frame/hash/prompt/model bindings.
- Recovery contract: one job-error display in result area, Refresh status checks same saved job/request by GET only. Unknown outcome stays guarded; no automatic replacement generation, billing reservation, refund or terminal-state database modification.
- Regressions: saved_influencer_photos_toggle_to_model_cap; selected_photos_reach_frozen_request; jsonb_receipt_roundtrip_retains_exact_bindings; single_result_error_refresh_reads_same_job_no_post.


UGC-UI-041-INFLUENCER follow-up2026-10-27 — separate user-requested Skills feature, not a new reported defect. Preserve compact horizontal results and two-line authored previews while Copy now includes explicitly selected preset instructions.93UI/session/API tests,2worker/provider checks and responsive browser fixture pass locally, including frozen history, independent multi-select, prompt limits and original rail/recovery contracts. Initial browser fixture retained its deliberate clipboard-denial stub; restored the native method before Skills copy assertions and waited for the new result metadata. No application defect inferred from that harness timing. No deployment/paid generation; live acceptance OPEN. See docs/influencer-prompt-skills-2026-10-27.md.

UGC-UI-041 local verification2026-10-27: source selection bug reproduced in real-component browser fixture; corrected add/toggle/cap/checkmark behavior without redesign. Exact production receipt rejected before, accepted after canonical nested frame ordering; exact full stored input also passes. Job03125acf was failed before dispatch, no output; original1credit reservation already released (SELECT evidence only). Result error displayed once; Refresh status checks unresolved original request/job and cannot submit, reserve or dispatch.150focusedtests/types/workerbuild/scopedlint/diffPASS;1440/390actual-component browser before/after passes cap/removal/reopen/four-photo submission/same-job recovery/one alert/nooverflow. Screenshots inspected. Providers/auth/transport/optimizer fixture substituted; no paid call, production write, deployment or hosted fix acceptance. Status LOCALLY VERIFIED / PRODUCTION OPEN. Receipt docs/starting-image-selection-recovery-2026-10-27.md. Preserve prior prompt activation and other concurrent changes.


### UGC-UI-042-INFLUENCER — Detached saved-image actions and unclear Copy prompt
- Date:2026-10-27. Status:OPEN. USER REPORTED / SCREENSHOT OBSERVED: action icons float between grid rows, My AI influencer names consume useful footer space, and Copy does not seem to copy the prompt. Screenshots dc8e9f05,6810c0a6,a7341d67 show the current local fixture design.
- Expected: hide visible names here; put clearly labelled Copy Prompt and Download inside each image card footer. Preserve independent image/reference selection and use that image's full saved prompt, including Skills.
- Root cause:UNKNOWN for reported clipboard failure; previous local browser tests copied exact merged prompt successfully. CODE CONFIRMED presentation issue: actions are outside the bordered image/name button, leaving detached rows and repeated names. Do not infer deployed clipboard behavior from fixtures.
- Regression: saved_card_footer_has_labelled_copy_download_no_visible_name; saved_card_copy_exact_image_prompt_and_visible_success_or_error; desktop_mobile_actions_stay_inside_card; image_selection_unchanged.

UGC-UI-042-INFLUENCER local iteration2026-10-27: browser selection test FAILED before completion. Integrating the footer and setting card overflow:hidden removed the grid item's automatic minimum; default auto rows compressed under max-height and portraits overlapped adjacent rows. Actual multi-select-library-mobile.png confirms overlap; image3 intercepted clicks on image1. Correct grid auto-row sizing before continuing; add explicit non-overlap assertions. This is an agent-introduced local regression, not the user's clipboard root cause.

UGC-UI-042-INFLUENCER follow-up2026-10-27: LOCALLY VERIFIED / PRODUCTION OPEN. Names removed from visible card content, accessible identities retained, Download/Copy Prompt in attached bordered footer, selection mark on image, visible Copied confirmation. Existing copy handler uses each source job's full stored prompt; ownership/privacy and absent-prompt omission preserved.45focused tests, types/scopedlint/diff and full actual-component browser PASS. Browser asserts no card overlap and attached footer geometry on desktop/mobile, exact merged clipboard content, success expiry, denied clipboard error and retry, preserved selection/downloads. max-content grid rows correct the local overflow/minimum-size regression described above. Screenshots manually reviewed, including standalone corrected card. Root cause of any actual hosted clipboard failure remains UNKNOWN; local writes succeed. No deployment/paid generation. Receipt docs/influencer-library-copy-prompt-2026-10-27.md.

### UGC-UI-043-PICKER — My Influencers missing from the general person-photo picker
- Date:2026-10-27. Status:OPEN. USER REQUEST/Screenshotbee91c74: replace visible Other images section with My Influencers in both photo pickers; keep Person photos and separate UGC Pilot images. No four-tab redesign or catalogue merge.
- CODE CONFIRMED: Other images is an image-purpose toggle; general picker receives no influencerLibrary. Starting-frame picker has the owned character-history source. Merely relabelling general-purpose mode would misrepresent content and input roles.
- Expected: My Influencers opens the signed-in owner's Build AI Influencer history, retains independently selected photos/model caps, and Refresh reloads that source. No inferred same-person filtering, paid generation, migrations, model or prompt change. Existing general-purpose saved draft values remain until explicit user choice.
- Regressions: both_pickers_have_my_influencers_section; influencer_section_loads_owned_history_and_refreshes_it; influencer_selection_preserves_order_limits_and_roles; catalogue_and_upload_sources_remain_separate; desktop_mobile_picker_sections_no_overflow.

UGC-UI-043-PICKER local verification2026-10-27: actual My Influencers source replaces visible Other images; compact naming aligned, owner-keyed character history/owned asset resolution added. UGC Pilot catalogue stays separate.115focusedtests/TypeScript/scopedlint/diffPASS;1440/390bothpickerrealcomponentfixturesPASSmulti-select/cap/checkmarks/refresh/catalogue/reopen/personrole/nooverflow. Intermediate compact label regression and lint ref closure caught/corrected. Existing source reset on reopen retained; checked items remain. Screenshots inspected after color transition. Status LOCALLY VERIFIED / PRODUCTION OPEN; fixture auth/API/optimizer substitutions; no paid call/write/deployment. Completion documentation initially blocked by automatic-review usage limit, completed after user continuation. Receipt docs/my-influencers-picker-2026-10-27.md.

### UGC-TREND-001 — Automation/backend, rounded controls and CTA screenshot follow-up
- Date: 2026-10-28. Status: OPEN / USER REPORTED enhancement and backend investigation. Related: UGC-SCH-011, UGC-VID-009.
- Requested: audit real automation and slideshow failures, round Automation buttons, and use uploaded app screenshots on Structure 2 CTA slides with selected/default backgrounds when absent.
- Verified read-only production evidence: dedicated automation tables absent; one fallback configuration is draft; zero auto-slot schedules. No active execution exists to qualify. Seven-day Carousel generations:1030completed/235failed;36invalid-slide-number failures. Exact inspected response repeats slide5 across ordered slots. All8product screenshots are archived; no current usable screenshot.
- Code findings: automation collection rendering replaces every background, including a product CTA. Structure1 provider schema permits any role/number at every array index; parser rejects repeated numbering. Causes for remaining timeout/quality failures are not established by this finding.
- Regression: automation_cta_uses_owned_ready_screenshot_with_collection_fallback; numbered_slide_schema_binds_each_role_once; automation_controls_have_pill_radius_without_layout_changes; draft_automation_never_schedules; repeat_sweep_and_pause_preserve_existing_jobs.
- Scope: existing Automation workspace, derived renderer/service and numbered-slide schema/parser plus focused tests. Preserve original slides/copy, ownership/readiness, negative validation, daily slot identity, local time, manual controls and unrelated work. No live activation, paid retry or publication authorized by this audit itself.

UGC-TREND-001 visual follow-up: actual before/after390px Automation Appearance screenshots expose pre-existing min-content grid width clipping, despite document-level overflow check passing. This is not introduced by the pill-radius change. Add a base single-column minmax grid and bounds assertions for primary actions; preserve desktop two-column layout. Do not report mobile geometry verified until those assertions and screenshots pass.

UGC-TREND-001 local verification update2026-10-28:63app/database checks and78worker checks PASS; actual Automation component1440/390browser checks PASS including computed pill corners, no implicit activation, failed load/empty collection and corrected recovery-button bounds. Source and current HTML viewport screenshots reviewed. TypeScript and scoped lint PASS; planner-inclusive lint has one existing unused-function warning. Production SELECTs confirm draft-only automation/no auto-slot schedules, no active screenshots, and6ordinary published targets with provider IDs. No paid generation, activation, production mutation or deployment. Numbered-schema repair addresses repeated-position output; other timeout/copy-quality failures and hosted automation concurrency/execution remain OPEN. Receipt docs/trending-automation-followup-2026-10-28.md; build outcome recorded there separately.

UGC-TREND-001 final build update: outside-sandbox Webpack production build PASS/exit0,248static pages, TypeScript complete. Initial sandbox EPERM is separately preserved in build.log. No hosted-resolution claim; production acceptance remains OPEN.

### UGC-VID-023-REMIX — Forced minimal edits and source-length drift
- Date:2026-10-28. Status:OPEN. User requests tested second Remix revision shared by manual and automatic Hook text; no production change before validation. Prior pilots showed generic hooks unnecessarily rewritten, related copy expanded, and unsupported claims becoming flat feature labels. Emotional quality is manually assessed, not established by character counts.
- Expected: KEEP suitable copy exactly, SMALL EDIT only necessary named tool, ADAPT mismatched situations/claims preserving reaction. Source-relative length, not universal two lines; longer hooks can stay long. Preserve saved receipts, authored edits, no automatic paid retries, non-Hook prompts, source data and model settings.
- Regression: manual_and_automatic_share_v9; source_relative_budget_brand_allowance; old_receipts_stay_immutable; rewritten_named_tool_review_can_omit_brand_with_evidence; overbudget_fails_without_retry; automatic_text_never_overwrites_saved_edits.

### UGC-TREND-002 — Remaining durable automation and slideshow recovery
- Date:2026-10-28. Status:OPEN. Follow-up to UGC-TREND-001/UGC-SCH-011; user explicitly requests remaining backend fixes.
- CODE CONFIRMED: no preparation lease; slot checkpoint written after scheduling; pause lists slots before fencing active state; publish-preference failures use defaults; all handoff errors classified as reconnect; first30old slots hide newer history. Missing hosted tables leave whole-envelope fallback storage.
- Production READ CONFIRMED: sole fallback remains draft/revision9/no slots; no active automation. Model validation failures remain distinct from transient interruption; do not bypass quality checks or blindly replay completed siblings.
- Scope contract: dedicated storage/backfill, preparation lease, atomic automation-to-schedule fence and slot checkpoint, recovery/classification, feed structure sourcing, and evidenced planner repair/timeout failures. Existing UI, source copy/ownership, screenshot exception, local times and provider-target contracts remain protected. Rollback is only this task's incremental diff/migrations; preserve existing worktree.
- Regressions: simultaneous_sweeps_claim_once; pause_fences_commit; crash_after_commit_recovers_same_schedule; failed_preferences_never_default; fallback_draft_migrates_without_activation; automation_counts_guide_future_feed_only; invalid_headings_repair_without_rewriting_body; transient_timeout_keeps_retryable_state.

UGC-TREND-002 verification2026-10-28: LOCALLY VERIFIED / HOSTED EXECUTION OPEN.70app/real-SQL tests,103compiled worker tests and3durable recovery tests PASS; types,workerbuild,scopedlint pass (two existing warnings). SQL tests prove same-transaction schedule/targets/jobs/slot receipt, pause/cancel/expiry fences, stable replay, owner restrictions and fallback draft preservation. Production migrations applied individually as20261027194354/20261027194405; readback all3tablesRLStrue, unchanged sole draftrev9/no lease/zero slots; draft claimfalse and browser privilegesdenied. Active mixed inventory uses balanced whole batches to prevent minority structure roundingtozero; actual posting keeps savedcounts and manualpreferences/reservedpacks remain unchanged. Live automatic publication, new model output, website/worker deployment and production UI acceptance NOT TESTED. No historical failedjob replay or activation. Receipt docs/trending-automation-backend-reliability-2026-10-28.md; retain OPEN until hosted acceptance.

UGC-TREND-002 final local gate2026-10-28: final Webpack production build including latest generation-mix refinement PASS/exit0; scoped diff whitespace check PASS. Production execution acceptance remains open; no website/worker deployment performed.

### UGC-TREND-003 — Review exposes active settings-update gaps
- Date:2026-10-28. Status:OPEN. Related:UGC-TREND-002/UGC-SCH-011. CODE CONFIRMED and locally REPRODUCED during requested review, not an observed hosted publication.
- P1: saveAutomationDraftOrSettings snapshots active status, awaits collection lookup, then updates byuser_id only; a concurrent Pause is overwritten backtoactive. Reproduction confirms paused duringlookup and active aftersave. Expected:newer Pause intent survives an older settingssave.
- P2: active settingssave bypasses activateSlideshowAutomation dailyLimit<10 mixedstructure guard. Saving1Educational/2Product on active singlebatch plan returnsactive; one whole generationbatch cannot supplyboth. Expected:reject unsupported activechanges consistently, retain drafteditability.
- Regressions: settings_save_preserves_concurrent_pause; active_settings_enforce_structure_batch_entitlement. Both targeted safety assertionsFAIL in .tmp/trending-backend/review-edge.log. Existing72app/SQL and104worker checksPASS; actualdesktop/mobileUI fixturePASS. Read-only hostedstate remainsdraftrev9/nolease/zeroslots. No appcodefix/deploy/activation inreview. Receipt docs/trending-changes-review-2026-10-28.md.

UGC-TREND-003 fix verification2026-10-28: LOCALLY FIXED / HOSTED ACCEPTANCE OPEN. Status+revision conditional UPDATE protects settings and final activation from newer Pause/settings intent; zero-row writes return409, failed guarded writes return503 without unfenced fallback. Shared mixedstructure check covers activation and active/needsattention edits; mixed drafts/paused setups, supported mixtures and single formats remain editable.83app/SQL testsPASS including11new regressions. Real installed Supabase client+localPGlite verifies the emitted filters preserve a committed Pause; test transport substitutes hostedHTTP, not production acceptance. TypeScript/scopedlintPASS. No UI/worker/schema/deployment/productionwrite/activation/publication change. Receipt docs/trending-settings-race-fixes-2026-10-28.md; build result appended separately.

UGC-TREND-003 final gate2026-10-28: Webpack production build PASS/exit0 including TypeScript,296static pages and tracing. Scoped diff whitespace checkPASS. Both reported code defects locally fixed; production execution remains NOT VERIFIED until matching deployment and hosted acceptance.

### UGC-SCH-012 — Trending scheduled slideshows missing from Schedule
- Date:2026-10-28. Status:OPEN. USER REPORTED: slideshows scheduled from Trending do not appear in Schedule. CODE AND HOSTED DATA CONFIRMED: the listing orders oldest first and limits to200; two scheduled Trending carousel posts rank202 and203 for their owner. Both have scheduled TikTok targets and queued publish jobs; publication is not yet evidenced.
- Expected: saved scheduled posts remain visible despite older history; preserve ownership, target/job records, filters, timezone and status handling. Regression: schedule_list_includes_upcoming_after_200_older_posts; owner_isolation_and_target_attachment_across_pages.

UGC-SCH-012 local repair2026-10-28: Schedule listing retrieves ordered200-row pages with a stable ID tiebreaker and attaches targets page by page; page failure is surfaced. Local focused20tests, TypeScript and scoped lint PASS; new tests cover203 records, ownership, target attachment, status filtering and later-page failure. Broader scheduling source contracts report66PASS/3FAIL in previously modified UI expectations, matching historical known failures; no UI change in this repair. Read-only hosted data initially showed two scheduled Trending slideshows at ranks202/203, each with TikTok target and queued publish job. Later read shows one published target/completed job with provider receipt and one still scheduled/queued; production times can advance. No writes or deployment. Production Schedule screen acceptance NOT VERIFIED; incident remains OPEN. Receipt docs/trending-schedule-visibility-2026-10-28.md.

UGC-SCH-012 verification follow-up2026-10-28: three prior source-contract failures were stale expectations for rejected separate posting-mode cards, native time inputs and forced24-hour wording. Updated assertions enforce the approved single Post now flow, interactive locale-aware picker, all60minutes and canonical-hour conversion; UI unchanged.69/69 scheduling/atomic SQL/service checks and32/32 time/status/media checks PASS; actual Schedule carousel fixture passes desktop/mobile, refresh failure/retry and owner switching. Pagination regression now explicitly checks Trending carousel source, library item, scheduled target and date/status filters after200 older posts. Hosted read-only shows both recent Trending TikTok targets published with completed jobs and provider IDs. Website deployment and authenticated live Schedule display of the patch remain NOT VERIFIED; no production mutations. Receipt docs/trending-schedule-crosscheck-2026-10-28.md.

UGC-VID-023-REMIX local implementation2026-10-28: shared v9 base equals tested second pilot; manual and automatic callers freeze it with business context. Source-character budgets/named-brand allowance enforced only for new outputs; historic plan/receipt and user-edit protection retained. Optional reviewer v3 aligned with KEEP/adapt and explicit removed-tool evidence; remains opt-in, no added calls.77focusedtests/types/scopedlint/workerbuild/diffPASS;fivepaidoutputsofflinereplayPASSexactbase/budgets/editabletext/layout. Two broad checks fail outside changed modules: Poppins expectation vs Proxima default; inventory283vs302. Isolation forbidding changed-runtime imports reproduces both. Do not count them as pass or silently deploy. Earlier paid pilot's unnecessary finally removal/mild earnings question remain known semantic limitations; no fresh model/reviewer/hosted acceptance. Status LOCALLY VERIFIED / RELEASE HELD. Receipt docs/remix-v9-implementation-2026-10-28.md.
`nUGC-VID-023-REMIX verification follow-up2026-10-28: CODE CONFIRMED stale emoji export test expects Poppins700 rather than approved Proxima Nova A600; inventory helper omits9published October Hook references,6Wall references and4October slideshows. Before verification corrections, status OPEN; regressions: exact current inventory identities/storage paths, actual emoji MP4 pixels, and saved legacy font preservation. User explicitly prohibits deployment; no hosted changes authorized in this follow-up.

UGC-VID-023-REMIX local verification correction2026-10-28:3script checks now PASS: actual emoji clip/composition exports use approved Proxima600, legacy saved Poppins700 stays intact, inventory matches exact302runtime IDs/storage paths. Revealed historical Wall08/09 transcripts intentionally retained per22Octoberdecision; exact hash-bound tests preserve them while asserting reference lookup rejects them.77focusedtests/types/workerbuild/scopedlint/diffPASS. Crop visually inspected .tmp/hook-remix-emoji-k29c1a/corrected-caption.png. No new model calls, production writes or deployment; latest user explicitly says DO NOT DEPLOY. Hosted acceptance still NOT VERIFIED. Receipt docs/remix-v9-implementation-2026-10-28.md.

UGC-VID-002 original-opening research follow-up2026-10-28: user requests identification/model-capability audit and one prepared t=0/automatic-trim trial; DO NOT DEPLOY. Current31nonzero curated bindings(21public/10private) reconciled;31local source hashes match. Hook12all73thumbnailframes and full-resolution opening/frame45 reviewed. Current normalized motion helper maps source to output duration; trimming source length without changing that mapping could remove ending(CODECONFIRMED risk, not observed new provider failure). Prepared isolated source-speed0–2.433s +hold-to3s draft, no later image attached. Actual worker marked-frame trim fixture retains73frames/ending, removes excess tail, rejects overrun and preservesraw PASS.15Omni+19ReAPImockedchecksPASS. Google documents first-frame plus appearance roles; connected ReAPIWAN/Seedance keep roles separate. No app runtime/prompt/selection edits, production writes, paid generation or deployment. Generated fidelity/editor integration NOT TESTED. Receipt docs/original-opening-pilot-2026-10-28.md.

### UGC-UI-044-REMIX — Automatic Hook text remains narrow or becomes too small
- Date:2026-10-28. Status:OPEN. USER REPORTED; sketch codex-clipboard-f2389033-e18c-4d6b-979f-67149f7ff9b8.png depicts broad desired text versus narrower current text. No exact affected generated asset supplied; actual hosted instance root cause remains UNKNOWN.
- Expected: new automatic Hook captions use an appropriate broad safe width and readable size, avoiding unnecessary wrapping/shrinking. Preserve source-relative copy, original user line/position/style edits, saved fonts, non-Hook workflows and exact preview/export parity. Short copy need not be stretched unnaturally to fill the entire image.
- Audit scope: inspect width, explicit newlines, font-size fitting and render paths separately; prepare local comparisons before changing runtime defaults. No deployment or paid generation.
- Regressions: automatic_hook_short_caption_keeps_readable_scale; source_newlines_do_not_force_unnecessary_shrink; generated_caption_preview_export_width_match; saved_authored_layout_never_reflowed.

### UGC-VID-024-OPENING — Opening scene fidelity and original-frame policy clarification
- Date:2026-10-28. Status:OPEN for runtime migration/visual acceptance. User explicitly requires original source frame0 only for all future recreation; no new later clarity-frame input. Existing immutable histories/receipts remain historical and must not be relabeled or overwritten.
- REPORT OBSERVED: Hook7 Starting Frame Generation Report.pdf (23pages, six still tests) shows outputFusingidentitygreen shirt instead of sourcewhite; defaultv4 mentions source clothing/light but does not explicitly exclude supporting-photo wardrobe/light. Cause of individual stochastic output UNKNOWN; no claim all v4 results fail. Report includes no video test, so it does not prove extra portraits improve video consistency.
- Expected: source t0 controls lighting direction/color/contrast, scene, outfit, pose, hands/props and crop; selected photos control identity. Caption-free image reviewed separately before animation. Reuse selected influencer photos automatically only on a route supporting literal-first-frame plus appearance roles, respecting explicit removals and ownership; consistency benefit is a hypothesis until output review, not guaranteed.
- Regressions: new_recreation_preparation_uses_frame0_only; source_lighting_and_outfit_not_taken_from_identity; caption_cleanup_preserves_physical_text; supported_identity_carryover_preserves_roles_and_user_edits; motion_prompt_includes_timed_actions_and_ending.

UGC-UI-044-REMIX audit evidence2026-10-28: code/localnativefontreproduction confirms defaultfont48at1080onlyshrinks;84%box is wrappingceiling; explicitnewlinesstayfixed. Example3lineactualink52%;94%boxalone52%; exploratoryboundedfont84ink90%. Short1linestays1lineat54;long4linestays4line. VisualcomparisonPNGinspected. No runtimestylechanged; historicalreceiptversion/frozenlayoutneeded before newfitter to avoidoldresultrestyle. StatusOPEN for implementation/hostedacceptance. UGC-VID-024-OPENING currentpolicyrecordedinprotectedcontracts/repeatableguide; all104public+12private localdraftscompilewithnumericintervals, historicalexport21/107+10/12; no livecoverageclaim. Receipt docs/starting-frame-and-remix-audit-2026-10-28.md.

UGC-VID-024-OPENING implementation authorization2026-10-28: user explicitly requests local implementation across newpublic/privatepreparation, physical logos/text removed in addition to captions, lighting/clothing/scene preserved; supportedphotocarryover, correctedtimedprompts, coordinatedtrim andversionednewtextfit. This supersedes previous physicaltext/logo preservation; historical frozenjobs remainunchanged. Scope split imagev5/prompt7 contracts+source UI, versionednewHooklayout, frozennewsource-timeline/initialtrim, owner-boundphotocarryover. No dependency/schema/providerconfig/deploy changes or paid test. InitialstatusOPEN; verifyactual API/worker/editor/recovery contracts before claimingimplemented.

### UGC-UI-045-EXPLORE — Redundant Workflows heading wastes vertical space
- Date:2026-10-28. Status:OPEN. USER REPORTED/SCREENSHOT OBSERVED: remove Workflows subheading and bring cards upward on Explore. Cause CODE CONFIRMED: visible h2 line plus mb-3 above card grid.
- Expected: remove visible label and its occupied height; retain accessible section name, Explore header, card order/geometry, destinations, quick starts and responsive behavior. Scope only ExploreWorkspace markup.
- Regression: existing Explore navigation checks plus before/after desktop/mobile geometry.

UGC-UI-045-EXPLORE local verification2026-10-28: removed visible h2 and mb-3; retained accessible Workflows region via aria-label. Actualcomponent/style fixture1440/390 proves32px reclaimed, identicalcard/quickstartdestinations andnooverflow.13existingnavigationtestsPASS;scopedESLint/diffPASS. Desktopafter screenshotinspected. No layoutCSS/card/navigation/backendchange. ProductionNOTVERIFIED;notdeployed. Evidence .tmp/explore-heading-20261028/{before,after}-{1440,390}.png, browser.log/tests.log.

### UGC-OPS-MERGE-20261028 — Six resolved working files still marked unmerged in Git
- Date:2026-10-28. USER REPORTED mergeconflicts; CODE/GITCONFIRMED: .gitignore andfive testfiles retained indexstages1/2/3 withzero working-filemarkers, merge HEAD626f4b63/incoming538b5bbf.
- Resolution: reviewedbase/bothsides/current; preservedcombinedignore andmedia/access/preview/schedulecoverage. Tightenedpluginignoreallowlist andexactpreviewtimingassertion; stagedonlysixpaths. Backedupworking/stagesbeforemutation.
- VERIFIED:47testsPASS,scopedlint/types/cacheddiffcheckPASS,unmergedindexempty,trackedmarkersnone. Noapplicationcodeedit,mergecommit,push/deploy. Combinedrelease/productionNOTTESTED. Receipt docs/merge-conflict-resolution-2026-10-28.md.


UGC-VID-024-OPENING / UGC-UI-044-REMIX local implementation evidence 2026-10-28: new API tests cover all21 curated public cases and all12 private sources through frame0-only receipt5/prompt7 requests, with historical request replay retained. API/worker tests verify source-speed hold, reversible initial trim, owned-only output lookup and rejection of changed timeline before submission. Photo hook tests verify ordered owned reuse, explicit empty removal, replacements, model switch, stale cancellation and unavailable-photo blocking. Existing local/saved/empty Hook text remains authoritative. New layout plan v1 measured/rasterized sample preserves1/3/4 lines while using broader safe width. Generated-output identity/lighting/cleanup/ending and hosted integration remain NOT VERIFIED; incidents remain OPEN for those acceptance gates. No paid generation or deployment.

Verification correction 2026-10-28 linked UGC-VID-024-OPENING: detected non-UTF8 em-dash bytes in newly inserted image-prompt/role strings during final byte inspection; converted only invalid bytes to UTF8 and added replacement-character regression. Browser font test had stale Regular/Bold assumptions for Proxima Semibold-only face; assertions now check actual supported600, with full local laptop/mobile save/reopen browser pass. Neither correction changes saved font choices or frozen historical prompt prose.


UGC-VID-024-OPENING final local checks2026-10-28: variation parser lacked new version4; corrected allowed version while preserving legacy1/2/3. New/legacy request and recovery91testsPASS, API/editor129PASS,worker/layout101PASS,types/workerbuild/scopedlintPASS. Full composer suite87PASS1FAIL: completed neighboring Slideshow version auto-handoff expected1 observed0 (scripts/explore-format-generation-ui.test.mjs); causeUNKNOWN, outsideHookpatch, no claim pre-existing. Keep combinedrelease unverified. Full receipt docs/opening-policy-implementation-2026-10-28.md. No deploy/paidcalls.

UGC-VID-025-OPENING-PROMPT 2026-10-28 OPEN: USER REPORTED and CODE CONFIRMED: new frame-zero public former-middle references fall back to untimed rewrite; private workspace selects legacy directions when frame hash changes. Expected source-bound full-video timed directions for new opening, preserve user edits and historic recovery. Regression: all 21 public and 10 private assignments plus wrong hashes and user overrides. Generated output/production unverified.

UGC-VID-025-OPENING-PROMPT local verification 2026-10-28: public v4/frame0 selects full source directions by validated curated reference ID/hash; private new frame0 selects reference full-source generationPrompt, while existing edited directions and legacy paths retain priority. All21 public defaults tested; all10 private local package entries returned timed opening directions with verified source/poster hashes; UI private handoff fixture passed. 112 focused checks, scoped ESLint and tsc passed. Older middle-frame test suite still fails two legacy fixture assertions (v4 receipt and draft version), cause not fully assessed; not a generated output or production pass. No deploy or paid calls.

UGC-VID-025 local assignment2026-10-28: user explicitly requests Hook45/80/86rewrites in Recreate rather than draftonly. Source-bound runtime plans now use re-reviewed actions and six-second preview, ending86lowered eyelids. Approval/history/composer validators carry6seconds; new frame/model defaults honor6onlywhenreviewedselection6. Existing editedmotion andordinary3/4defaults retained.82assignment/recoverytestsPASS,1sixsecond actualcomposer submissionPASS,types/lintPASS. Broadercomposer suite retains knownSlideshowneighborfailure. No deploy/paidcalls. Hook22right-hand clarification acknowledged; warning not changed in this patch.

UGC-VID-025/Hook22localfollowup2026-10-28: user requests all revised prompts selected on Recreate and confirms creator right hand retains glasses,otherhandhandlesphone. Updated22staticreviewwarning/status andexplicitcontinuoushandroleconstraint; generatedadherence remainsuntested. Privategallerynewpreparation nowcallsoriginalOpening resolver; missing/mismatchednewtimedprivateassignment returnsundefined ratherthanuntimedfallback. Verified104activepublic and12localprivate framezeroassignments,custommotionpreservation;115focusedtestsPASS,tsc/eslint/diffPASS. No deploy,ciphertextrepackageorpaidcalls. Sevenotherpublicdecisiongatesremain;removalof22warningdoesnotapprovegeneratedpixels.

UGC-VID-026-WALL-RECOVERY 2026-10-28 OPEN CODECONFIRMED audit: freshWallpreparation uses six reviewed source motion records, but resolveRecentHookStartingFrame replacesWallmotion withgenericworkflowdirections. Rootcause explicitWall/TalkingHeadspecialcase;testneededfresh/recoveredWallpromptparitywithusereditprotection. Additionalreportedgap:WalldoesnotshareHooksource-speedtrimorpersistentpublicHooksourceframeflag. Noapplicationfixordeployinthisaudit.23/24checksPASS;oneoutdatedphysicaltextcleanupassertionFAIL. Receipt docs/prompt-reviews/hook-wall-cross-workflow-audit-2026-10-28.md.

UGC-VID-026-WALL-RECOVERY localfix2026-10-28: all6source-boundWallmotionrecordssurviverecovery;unreviewedfallbackunchanged. Wallpersistentreadthroughadded,preparation--walloptionavailable;29tests/types/lintPASS. Hostedstorageinventory/preload/latencyandgeneratedoutputNOTTESTED. UserclarifiesWallkeepslongerdurationandindependent4–10linetypography;noHookautocut/textfitapplied. Sixretainedopeningcontactsheetsegmentsviewed,notfullsources.

UGC-UI-046-WALL-AUTO 2026-10-28 OPEN for hosted acceptance. CODE CONFIRMED Wall had manual Remix with generic placement, whereas automatic text admission/output was Hook-only. User requested measured source-specific automatic new-draft placement, preserving existing edits and full Wall duration. Local implementation and tests described in docs/prompt-reviews/wall-automatic-placement-2026-10-28.md: six hash-bound profiles, separate disabled flags, optional explicit line spacing, owned completed job initial content; saved/local/pending/empty draft priority. 73focused+25worker+87integration tests, browser fixture and7renderer exports PASS. No paid calls/deployment. New tests wall-initial-text-layout.test.ts, Wall initialContent/actual-editor recovery tests, wall-automatic-text.browser.cjs and export.mjs. Hosted backend and generated-copy/readability acceptance remain NOT VERIFIED. Linked UGC-VID-026 and UGC-UI-044. Historical thumbnail line estimates01/02 corrected from7 to6 by native frames.

UGC-UI-046 manual Remix continuation 2026-10-28 OPEN: CODE CONFIRMED manual Remix applied to an unstyled Wall clip still uses the generic width, position and font size even when a matching reviewed profile exists. Existing overlay styles must retain precedence; unreviewed and structured references require separate handling. Regression: source ID/hash-matched manual single-block layout, saved style preservation, full duration and source mismatch.
UGC-UI-046 manual Remix local update: a new unstyled single-block Wall Remix with a matching non-structured profile uses that profile; prior styles take precedence and source start timing is retained. Focused 35-test suite, TypeScript and scoped lint pass. Existing automatic-layout browser fixture passes; the new manual path has not been browser-verified. Unprofiled and structured sources still need review; no deployment or video generation.

### UGC-VID-025 — Talking Head starting-frame identity photo handoff gap
- Date:2026-10-28. Status:OPEN / CODE CONFIRMED local. User asks whether original influencer photos follow the approved starting frame into video and how images are labelled.
- Evidence: Hook video uses useStartingFramePhotos with receipt identityAssetIds; Talking Head hook-workflow-preview uses independently initialized facePhotos and approveStartingFrame neither restores IDs nor clears prior frame photos. Original photos can be absent or stale when changing frames. Production acceptance/version NOT VERIFIED.
- Expected: owner-verified ordered identity photos carried over for supported route; per-frame explicit edits/removals preserved; stale asynchronous work cannot overwrite newer frame; unsupported providers remain protected.
- Regression: talking_head_frame_photo_carryover_and_cross_frame_isolation. No runtime fix in this audit. Report docs/image-role-labeling-audit-2026-10-28.md.

UGC-VID-025 local follow-up2026-10-28: Talking Head now restores owned receipt identityAssetIds via shared useStartingFramePhotos; per-frame scoped state prevents priorframephoto leakage. Explicit edits/empty choice persist; missing/unowned/pending reads block; unsupportedWAN/Seedance send no optionalphotos. Parent integration/asynchook/API tests andprovideradapter testsPASS. Production/paidoutput NOTVERIFIED. Details docs/image-role-labeling-audit-2026-10-28.md.

### UGC-VID-027 — Character image references have no automatically assigned semantic roles
- Date:2026-10-28. Status:OPEN / CODE OBSERVED. Related user request to audit image labeling. Character-generation service preserves ordered saved-character references followed by uploaded images and freezes IDs, but does not itself declare main/support/identity roles per image. Provider receives ordered references and user/skill prompt; no proven output failure or universal same-person intent.
- Expected: product should decide whether and when explicit roles are appropriate without inventing user intent or modifying frozen prompts. Regression proposal character_reference_roles_match_explicit_user_intent_and_order. No behavior change in this audit.
UGC-UI-046-WALL-AUTO local batch 02/05: source-bound profiles and optional profile color added; previous six snapshots retain white default. 32 focused tests, types, build, lint and two local 12-second neutral exports pass. New-profile browser, hosted and generated-scene acceptance remain NOT VERIFIED. No deploy. Receipt docs/prompt-reviews/wall-layout-batch-02-05-2026-10-28.md.
UGC-UI-046-WALL-AUTO follow-up: local browser fixture verified 02/05 edit, server-fixture reopen, full duration and mobile bounds. 03 single-layer and 04 two-layer exact-source prototypes render and save/reopen; 04 heading and body edited independently. Automatic 03/04 assignment remains unavailable pending reliable structured Remix output and overflow review. No deploy or paid calls. Receipt docs/prompt-reviews/wall-layout-browser-complex-trial-2026-10-28.md.
UGC-UI-046-WALL-AUTO local continuation: added structured source-context Remix handoff for Wall 04 and source-bound condensed profile for 03; 35 focused, 26 worker and 10 editor fixture checks pass. The edit test first failed due to cross-realm array prototype comparison; corrected the assertion and reran 10/10. Real model response, actual generated-scene readability and hosted acceptance NOT VERIFIED. No deployment. Receipt docs/prompt-reviews/wall-structured-remix-2026-10-28.md.
UGC-UI-047-WALL-HEADING 2026-10-28 OPEN CODE CONFIRMED: Wall 04 real text-only trial returned 5 marketing laws worth knowing; fixed 65px heading wraps and was rejected. Source structure passed but one result contained unsupported improvement claims. Expected bounded readable fit and grounded copy; regression: saved-real-output heading fit, overflow rejection, frozen legacy behavior and prompt version/recovery. No video generation or deployment. Linked UGC-UI-046.
UGC-UI-047-WALL-HEADING local fix: new structured plans freeze heading-fit v1; exact saved provider heading fits at 61px and original stays 65px, legacy plans retain 65px and excessive text rejects. Prompt v3 adds explicit grounding for adapted law/outcome claims. 38 focused +26 worker checks, types/build/lint PASS; saved output rerendered without another provider call. Actual new-prompt quality, browser/hosted acceptance remain NOT VERIFIED; no video/deploy. Receipt docs/prompt-reviews/wall04-heading-and-grounding-fix-2026-10-28.md.

## UGC-VID-028 — Wall references contain Hook-plus-demo footage (2026-10-28)
- Status: OPEN. USER REPORTED: Wall 06, 28 and 59 belong to Hook, while Wall 21 should be retired from the visible catalogue. CODE/FRAME CONFIRMED: 06, 28 and 59 each have a short person opening followed by a product demo; visible Wall catalogue includes all four. Root cause UNKNOWN (historical classification decision not established).
- Expected: retire Wall 21 from selectable gallery while retaining historical asset provenance. Make 06, 28 and 59 available as Hook-only references with correctly bound text and prompts; retain old jobs and source assets.
- 2026-10-28 local continuation: published-media manifest is active locally for 06/28/59; their source-bound timed motion plans and opening captions resolve through Recreate and Remix. Retired Wall assets remain available for history. The 12 focused catalogue/prompt/remix tests and six release tests pass. Hosted application activation, live browser interaction, generated output and legacy curated-frame draft regression acceptance remain NOT VERIFIED. No deployment or generation performed. UGC-VID-028 remains OPEN.
- Regression: `scripts/explore-wall-text-removal.test.mjs` checks gallery retirement and historical source registry; future migration test must verify each cut, new storage object and matching Hook prompt and Remix source before activation. See `docs/prompt-reviews/wall-to-hook-reclassification-2026-10-28.md`.

## UGC-OPS-013 — Release build rejected typed reviewed-reference metadata (2026-10-28)
- Status: OPEN / CODE CONFIRMED. The production Next.js build fails before deployment because JSON-imported `reviewMethod` is inferred as `string` in `lib/explore/reference-video-prompts.ts`, while `ReferenceVideoPrompt` deliberately accepts only `sampled_frames` or `all_decoded_frames`. This affects the three reclassified Hook motion records; no request, source hash, prompt copy, or persisted historical receipt has been changed.
- Expected: validate/narrow imported review metadata at the catalogue boundary, reject an unsupported value rather than weakening the prompt type, and keep all reviewed prompt/source bindings intact.
- Regression: `lib/explore/reviewed-prompt-activation.test.ts` plus the production Next.js build must accept the three valid reclassified records and reject invalid review methods.

## UGC-OPS-014 — Production Business Context update does not take effect (2026-10-28)
- Status: OPEN / USER REPORTED. The user reports that updates made in Settings did not update Business Context in production. Exact interaction and error are not yet known.
- Root cause: UNKNOWN. Production has the atomic apply function and its onboarding guard; their presence alone does not prove the user's request succeeded.
- Expected: a confirmed apply persists the edited owner-scoped context and version, survives reload, and is used for future content without changing existing pinned content.
- Regression: exercise Settings through the authenticated API and persistence boundary, including direct apply, stale revisions, reload, and future-context selection.

UGC-OPS-014 local follow-up 2026-10-28: the user supplied the production 400 message, "Send a valid Business Context action." The existing form permitted text exceeding the API schema and silently clipped extra list lines. The rejected payload is unavailable, so its exact invalid field remains UNKNOWN. Settings now preserves all lines, reports the specific invalid field and existing limit, normalizes blank optional fields, and leaves valid changes on the existing atomic apply path. Focused form tests and an actual Settings route + PGlite persistence/reload/stale-revision integration pass. Authenticated production acceptance remains OPEN.

## UGC-OPS-015 — Worker release build omits cross-project test fixtures (2026-10-28)
- Status: OPEN / CODE CONFIRMED. Cloud Build 7377495d-f989-48d8-b578-2dc08ca9b0c9 failed because four Wall layout tests import application sources outside the worker-only Docker context. The worker-only compiler now excludes those four test files; `npm run test:worker-cross-project-wall` executes them separately against the full checkout (23/23 pass). The worker image must still build and be verified before release.

## UGC-OPS-016 — MCP manual Hook test fixture exceeds source-relative limit (2026-10-28)
- Status: OPEN / TEST CONFIRMED. The release MCP suite's manual Hook fixture returned longer generated text than its supplied source, so the existing source-relative validation correctly rejected the simulated provider output. This is a fixture mismatch, not evidence of a production provider failure.
- Regression: `scripts/mcp-reference-tools.test.mjs` must pass with a source-compliant output while `lib/explore/remix-text-api.test.mjs` continues to reject overlong outputs.

## UGC-UI-049 — Automation library dialog hidden behind workspace (2026-10-29)
- Status: OPEN / USER REPORTED; CODE AND LOCAL FIXTURE CONFIRMED. The full-screen automation workspace has stacking level 100, while its portalled library dialog has level 50. The dialog opens behind the workspace on desktop and mobile; collection and pause dialogs share the same layering.
- Expected: library, nested collection management, collection picker, and pause confirmation appear above the workspace and remain usable without changing automation or publishing behavior.
- Regression: actual automation browser fixture must check dialog hit-testing and nested collection management on desktop and mobile.

UGC-UI-049 local follow-up 2026-10-29: automation workspace stacking lowered below the existing shared dialog layer, leaving shared dialog styles and scheduling logic unchanged. Actual workspace browser fixture passes desktop/mobile library opening, nested collection dialog cancellation, return to setup, load error and no implicit activation; library contents and backend are mocked. Authenticated production acceptance remains OPEN; no deployment performed.

## UGC-OPS-017 — Business Context rejects owner-entered category tags and long values (2026-10-29)
- Status: OPEN / USER REPORTED; CODE CONFIRMED. Recurrence of UGC-OPS-014: production reports “Category tags allows at most 3 entries” when applying the user's context. Shared schema imposes list counts and text lengths; slideshow snapshot validation independently imposes limits.
- Expected: preserve all owner-entered Business Context entries and text on save and reload, while keeping authentication, required field types, atomic version checks and existing content snapshots intact.
- Regression: Settings route plus database reload with more than three categories and long fields, invalid type and stale revision; slideshow context snapshot accepts saved long values without changing ownership guards.

UGC-OPS-017 local follow-up 2026-10-29: owner-edited context no longer uses the AI analysis output length/count caps; AI response limits stay separate. Completed profiles retain onboarding status for a long saved business name, and slideshow snapshot validation accepts longer owner facts. Settings route/PGlite integration saved and reloaded five tags, twelve long audience entries and long business fields; invalid types and stale revisions rejected. Existing slideshow generation provider/request limits remain and production acceptance is NOT VERIFIED. No deployment.

## UGC-UI-048-CONTROLS — Final preview blocked and demo save controls appear stale or missing (2026-10-29)
- Status: OPEN. USER REPORTED intermittent final-video Play failure and demo edit Save/Save & return controls appearing stale or missing. Screenshot 1 shows Needs attention and the text-fit warning; screenshot 2 shows the save toolbar but cannot establish its live disabled state or any intercepted click. Related historical families: UGC-UI-004, UGC-UI-005 and UGC-VID-003.
- Root cause at report: UNKNOWN. Investigation found multiple distinct mechanisms; do not assign all user symptoms to one cause.
- CODE CONFIRMED / isolated component test: format-video-editor.tsx emits text-fit validation as preview.disabledReason; format-demo-section.tsx passes openingPreview.disabledReason or demo validation into WorkflowSequencePreview. Its Play button is disabled and playCurrent returns immediately for that reason. The screenshot's exact warning reproduces the block with ready mock media. This supports the reported first screenshot; no authenticated production session replay occurred.
- CODE CONFIRMED: demoSaveDisabled combines upload/preparation/audio/draft-load/validation conditions; the action toolbar explains uploading and draft errors but does not explain every prerequisite, including initial saved-draft loading. Shared useClipDraftSave requires browser storage reads/writes before marking the server read loaded. Simulated blocked storage after a successful GET leaves loaded=false. Token acquisition happens before the draft HTTP timeout starts; simulated pending auth leaves loaded=false, busy=false, error=null, no HTTP request. Actual Firebase/network cause in the user's session UNKNOWN.
- BROWSER CONFIRMED, isolated actual-component fixture: 1280x720 and 1536x864 upload/edit flows keep toolbar visible and enable save after owned-upload confirmation while retaining edits. The existing browser suite then FAILS mobile overflow. Diagnostic rerun at 390x844 measures scrollWidth=419 and Save & return right=418.92, despite enabled=true. Its intrinsic-width action row exceeds the viewport. Fixture uses substituted auth/upload/draft boundaries; full deployed-shell acceptance NOT VERIFIED.
- Shared exposure: Hook final preview, Wall post preview, Talking Head opening/demo and combined previews use the same disabled-reason player. Shared draft persistence also serves the opening/Wall editor. This is code-path reachability, not proof of failures in every workflow.
- Expected: clear visible reason and recovery for blocked controls; preview/export validity kept distinct where appropriate; save controls reachable at narrow widths; preserve owner isolation, request replay, conflict checks and existing drafts. No application fix or deployment in this diagnosis.
- Regression: text_fit_reason_blocks_play_explicitly; draft_load_pending_has_visible_save_reason; blocked_storage_does_not_silently_strand_save; draft_auth_wait_has_bounded_recovery; demo_actions_fit_390px_and_remain_visible; save_after_upload_preserves_pending_edits.
- Evidence: docs/control-responsiveness-audit-2026-10-29.md; .tmp/control-audit/hook-probes.json; .tmp/control-audit/browser/mobile-diagnostics.json and mobile-diagnostics.png. Existing focused tests22/22PASS; temporary playback probe6/6PASS. No production acceptance or fixed-status claim.

## UGC-UI-050 — Explore controls fail after about five minutes idle (2026-10-29)
- Status: OPEN / USER REPORTED. The user reports that leaving the site unused for roughly five minutes makes Explore cards/sidebar buttons fail to respond correctly. Supplied screenshot shows the Explore landing page, not a captured failed click.
- Recurrence: earlier idle-navigation investigations dated 2026-10-19 and 2026-10-23; related UGC-UI-048-CONTROLS covers editor controls separately.
- Root cause: UNKNOWN. Existing auth/read deadline fixes do not establish the cause of this report. The available production browser redirects to sign-in; no authenticated idle reproduction yet.
- Expected: the first navigation after idle reaches the selected destination or presents bounded actionable recovery; no lost edits, weakened authorization, duplicate mutation, or layout change.
- Regression: explore_first_navigation_after_real_five_minute_idle; stalled_route_has_visible_pending_and_recovery; background_gate_failure_retains_verified_workspace; cancellation_and_account_change_prevent_late_reads. Compare input delay, route/RSC transport, token wait and API timing before/after idle.
- Evidence: user attachment codex-clipboard-2d839657-0185-424d-9dd1-e32de36ed037.png; production browser attempt redirects from /explore to /sign-in.

UGC-UI-050 code-only continuation 2026-10-29: user clarifies sidebar/Explore links fail after 5–30 minutes idle and refresh restores them; requests investigation without computer control. Isolated execution confirms (1) installed Next route transport remains pending across 30 simulated minutes when headers stall, with no request deadline, and sidebar links have no pending/recovery UI; (2) actual AuthGuard replaces a verified cached workspace after transient background profile-query error; (3) cancelled profile token wait later attempts fetch with an aborted signal and no expected-owner token binding. Native fetch should reject that aborted request; no production HTTP arrival or account disclosure proven. Installed static route-cache freshness defaults to 300 seconds, a timing correlation rather than root-cause proof. Existing bounded read/auth tests pass. Actual production idle failure remains UNKNOWN/OPEN. No application fix/deploy/browser control. Evidence: docs/idle-sidebar-diagnosis-2026-10-29.md and scripts/idle-sidebar-diagnostics.mjs. These diagnostic assertions reproduce current defects; they do not represent desired fixed behavior.

UGC-UI-048-CONTROLS local implementation verification — 2026-10-29: LOCALLY VERIFIED / PRODUCTION OPEN. Preview warning separated from playback blockers across Hook/Wall/Talking Head; exact demo drafts save despite text-fit warnings while composition/export validation remains. Both save buttons expose their blocking reason through visible status and aria-describedby. Draft transport bounds auth/fetch/body parsing; source/audio reads are cancellable and bounded. Storage denial stays safe/actionable; retry of initial load preserves typing, explicit loaded-draft reload retains CAS recovery, and stale save errors do not leak across sources. Scoped mobile wrapping keeps all actions inside320/360/390px; desktop ready toolbar remains44px. Final193/193behavior/API/PGlite/offline-renderer testsPASS; actual-component browserPASSconfirmed HTTP save/return/reopen, real video playback with overflow warning, mobile scroll/button bounds, Hook timing/reload and shared Wall/TalkingHead. Types/scopedlint/diffcheck and webpack productionbuild/postbuild native tracesPASS. Sandbox build EPERM was retried outside sandbox. No deployed/authenticated production acceptance, paid generation or publication; do not mark production FIXED. Receipt:docs/control-responsiveness-fix-2026-10-29.md. All earlier evidence and unrelated concurrent changes retained.

## UGC-UI-051 — Schedule screen future-date postNow default, List view action/date gaps, platform reconnect anchors, account-timezone Today, and time-format consistency (2026-10-29)
- Status: OPEN / CODE CONFIRMED. Audit of `components/scheduling/scheduling-workspace.tsx`, `components/scheduling/schedule-editor.tsx`, and `components/settings/settings-workspace.tsx` identified five Schedule screen issues:
  1. Opening `ScheduleEditor` for a future calendar date omits `initialUseDefaultScheduleTime`, so `ScheduleEditor` defaults `postNow = true` ("Post now") and submits `useDefaultScheduleTime: true` (5 minutes from now today) unless the user manually edits the date/time input.
  2. List view (`ScheduleDayList` / `ScheduleDayListItem`) omits post action controls (`ScheduleDraftActions` and `ScheduleTargetStatusList`) and shows an empty state with no date recovery when switching tabs (`Upcoming`, `Failed`, `Published`) if those posts fall on dates other than `selectedCalendarDate`.
  3. "Connect" and "Reconnect" links for TikTok and YouTube targets in `ScheduleEditor` and `ScheduleTargetStatusList` hardcode `/settings#instagram-publishing`, and `SettingsWorkspace` only maps `#instagram-publishing` to Connected Accounts.
  4. Calendar "Today" highlighting and today navigation (`toDateKey(new Date())` / `toMonthKey(new Date())`) use browser local Date getters rather than `accountTimezone`.
  5. `CalendarDraftPill`, `ScheduleDayListItem`, and `SelectedDayDraftCard` render raw 24-hour `draft.scheduledTime` strings instead of formatting with `displayScheduleTime(draft.scheduledTime, hour12)`.
- Expected:
  1. Selecting a future calendar date opens `ScheduleEditor` with `initialUseDefaultScheduleTime={false}` so the chosen future date and slot time are preserved by default, while scheduling for Today continues to default to `initialUseDefaultScheduleTime={true}` ("Post now").
  2. `ScheduleDayListItem` renders `ScheduleTargetStatusList` and `ScheduleDraftActions` (Edit, Cancel, Retry publishing, Retry scheduling, Prepare video, View post), switching tabs in List view jumps to a date with matching posts when the current date has none, and `ScheduleDayList` provides quick date jump buttons when other dates have matching posts.
  3. Platform-specific Settings links (`/settings#instagram-publishing`, `/settings#tiktok-publishing`, `/settings#youtube-publishing`) all open Connected Accounts in `SettingsWorkspace` and scroll to the corresponding platform manager card.
  4. Calendar "Today" badge, initial selected date/month, and Today jump actions resolve using `accountTimezone`.
  5. `CalendarDraftPill`, `ScheduleDayListItem`, and `SelectedDayDraftCard` format `draft.scheduledTime` with `displayScheduleTime(draft.scheduledTime, hour12)`.
- Regression: `lib/scheduling/scheduling-database-contract.test.ts`, `scripts/schedule-editor-inline.test.mjs`, and `lib/scheduling/schedule-workspace-status.test.mjs`.

UGC-UI-051 local implementation verification — 2026-10-29: LOCALLY VERIFIED / PRODUCTION OPEN. `SchedulingWorkspace` now passes `initialUseDefaultScheduleTime={editingSchedule === null && newScheduleInitialDate === accountTodayDateKey}` to `ScheduleEditor` so future calendar dates keep their selected date/time by default while Today retains "Post now". `ScheduleDayList` / `ScheduleDayListItem` now render `ScheduleTargetStatusList` and `ScheduleDraftActions`, auto-select the nearest date with posts when switching tabs in List view if the selected date has none, and render quick date-jump buttons when other dates contain posts for that tab. Platform reconnect/connect links in `ScheduleEditor` and `ScheduleTargetStatusList` now route to `/settings#instagram-publishing`, `/settings#tiktok-publishing`, and `/settings#youtube-publishing`, and `SettingsWorkspace` maps all three hashes to Connected Accounts and scrolls the matching platform card into view. Calendar Today highlighting and Today navigation use `getAccountTodayDateKey(accountTimezone)`. `CalendarDraftPill`, `ScheduleDayListItem`, and `SelectedDayDraftCard` format `draft.scheduledTime` via `displayScheduleTime(draft.scheduledTime, hour12)`. Verified with `npx tsc --noEmit` (0 errors), `npx eslint` (0 warnings/errors), and 91/91 scheduling unit/contract tests passing (`lib/scheduling/scheduling-database-contract.test.ts`, `scripts/schedule-editor-inline.test.mjs`, `lib/scheduling/schedule-workspace-status.test.mjs`, `lib/scheduling/time-display.test.ts`, `scripts/scheduling-performance.test.mjs`). Authenticated production acceptance remains NOT VERIFIED.

## UGC-SCH-013-ACCOUNT-SELECTION — Schedule accounts cannot be deselected and posting feels blocked (2026-10-29)
- Status: OPEN. USER REPORTED: selecting multiple connected Instagram/TikTok accounts, then trying to deselect/reselect does not work; intermittent blockers prevent posting as intended. Screenshot codex-clipboard-3ca54de8-2238-4e80-a15d-58f5b68d2156.png shows multiple available accounts with one selected per platform. It does not prove a backend publishing failure.
- Root cause at report: UNKNOWN. CODE CONFIRMED in this investigation: selectWorkflowAccount always assigns a platform's single ID, so clicking the same selected card cannot clear it; the draft model permits only one account per platform even though backend normalizeTargets supports up to5 accounts. Cards are disabled during every background query refetch, and connected-account lookup does not bound auth/fetch/parsing. An explicit empty choice is removed by draft serialization, allowing a later auto-suggestion to replace that choice. A blocked selected account is displayed unchecked and disabled, preventing direct removal. Exact user production request/version UNKNOWN.
- Expected: independent explicit account toggles, preserved deselection across navigation/reload, responsive cached valid cards during bounded refresh, clear per-account restrictions and posting blocker reasons. Preserve owner validation, provider permissions/capabilities, five-account backend limit, exact wall-clock/timezone, durable targets/jobs and idempotent uncertain-request recovery.
- Regression: connected_account_toggle_clear_reselect_multi_same_platform; explicit_empty_account_choice_survives_remount_reload; background_refetch_does_not_freeze_valid_cards; account_lookup_auth_timeout_and_cancel; stale_selected_blocked_account_can_be_removed; selected_target_ids_reach_atomic_schedule_receipt; targetless_and_over_limit_have_visible_reasons.
- Scope/assumption: user optional clarification pending; treating multi-account posting as allowing several accounts of the same platform within the existing backend limit. No real posts or provider writes authorized for bug testing. Related: UGC-SCH-002, UGC-SCH-003 and UGC-UI-048-CONTROLS. Existing preview/save work and all concurrent changes remain preserved.


## UGC-UI-052-ANALYTICS — Recent analytics require manual refresh (2026-10-29)
- Status: OPEN / USER REPORTED. The Analytics screen often shows older data until the user manually refreshes. Exact production timing and platform are not yet established.
- Root cause at report: UNKNOWN. Investigation will distinguish provider lag, server snapshot freshness, browser revalidation and sync completion handoff. Recurrence of the return-refresh investigations in docs/analytics-return-refresh-2026-10-24.md and docs/analytics-performance-audit-2026-10-22.md.
- Expected: selected-platform metrics and activity update automatically during an open visit and on return, retaining saved content through bounded failures; no cross-owner/range/authorization data, duplicate sync starts, or hidden/offline polling. Preserve existing UI, provider admission cooldowns and manual Refresh.
- Regression: analytics_visible_stale_snapshot_and_activity_refresh_without_user_event; analytics_hidden_offline_inactive_no_periodic_reads; analytics_refresh_without_job_reconciles_authoritative_snapshot; analytics_completed_job_retries_failed_snapshot_read; analytics_manual_event_consumed_after_no_job_response.
- Production evidence: available browser redirects https://www.getugcpilot.com/analytics to /sign-in; authenticated production acceptance NOT VERIFIED. No provider writes, publishing, deployment or paid generation for this investigation.

UGC-UI-050 local implementation 2026-10-29: added shared shell-scoped navigation feedback for sidebar and Explore links; after15seconds offers explicit native new-tab recovery that leaves current drafts in the original tab. No forced reload, request replay, cache-duration/framework patch, or changes to destinations/prefetch. Profile GET now binds owner and blocks late-token fetch after cancellation. Cached successful gate survives typed transient failures only; initial/unknown/400/401/403/incomplete/unverified cases still block. Focused59/59PASS; actual-component headless1440/390 and collapsed fixturePASS including mobile drawer closure, newer-route replacement, query commit cleanup, native recovery destination and unsaved draft retention; types/scopedlintPASS. Production true-idle cause and hosted acceptance remain UNKNOWN/OPEN; no deploy. Supplementary socialvisibility fixture3PASS/7FAIL for missing existing marketing/scheduling stubs; default local build stopped at compile without outcome. Full receipt:docs/idle-sidebar-fix-2026-10-29.md. No personal browser control.

UGC-UI-050 final local receipt 2026-10-29: final headless fixture also passes current-page cancellation and collapsed-sidebar recovery; final scoped lint clean. Default Turbopack build and supported --webpack retry both remained at compile without a result and were stopped; production build NOT VERIFIED, no compiler error claimed. Production idle acceptance remainsOPEN. Details/logs/skipped checks:docs/idle-sidebar-fix-2026-10-29.md. This is local recovery and profile-error correction, not proof that the actual production connection/suspension root cause has been eliminated.

UGC-UI-052-ANALYTICS verification — 2026-10-29: LOCALLY VERIFIED / PRODUCTION OPEN. Code confirms visible idle screens had no saved-data checks, and successful no-job refresh responses never invalidated the preferred GET. Scoped fix adds one-minute stale checks for selected metrics, connection rows and activity with visibility/online/cooldown guards; successful no-job refreshes reconcile authoritative GET and consume manual mode. Provider cooldowns, owner/range/consent scope, queue semantics, markup and CSS retained. Actual-workspace Edge fixture PASS for all selected platforms, no hidden/offline reads, no-job reconciliation, failed completion-read automatic recovery, terminal-job stop, saved-content retention, manual retry and isolation. Desktop fixture before/after PNG hashes identical; fixture uses minimal styles, not production visual acceptance. All analytics105/105PASS; combined loader-assisted analytics-loading188/188PASS (overlapping runs); app/worker types and scopedlintPASS. Standard package command has existing Node extension-resolution failure; existing test loader used without package/config edits. Production build blocked by sandbox EPERM then concurrent Next build lock; no other process/lock disturbed. Available production browser redirects to sign-in; no deployment or provider writes. Status stays OPEN for authenticated hosted acceptance. Receipt: docs/analytics-freshness-fix-2026-10-29.md.

UGC-SCH-013-ACCOUNT-SELECTION local verification — 2026-10-29: user explicitly confirmed several accounts per platform. Independent accountIds groups now toggle cards and preserve explicit empty choices through format/session recovery while retaining legacy first-choice fields. Valid cached cards remain interactive during bounded/cancellable account refresh; selected blocked accounts can be removed and show their actual reconnect/permission reason. Target construction/receipt validation support the existing server limit of5 distinct connection IDs, including repeated platforms. Every target is revalidated against current owned connections/capabilities; missing/over-limit selections explain the blocker, and uncertain requests keep their original accounts/idempotency identity with clear retry copy.156scheduling tests plus27recovery testsPASS; prior193preview/editor testsPASSagain (376total). Real-card browserPASS1280/390/320: multi-select, deselect/reselect, held background refresh, return/reload, over-limit recovery, exact preflight IDs/21:30 and zero postingwrites. Real local Postgres atomic test confirms5targets+5jobs and no replay duplicates. Types/scopedlint/diffcheckPASS. Full build still running after earlier safe lock refusals; no lock/process/config changes. Production UI, hosted schedule/provider publication NOT VERIFIED; no deploy or realposts. Receipt docs/schedule-account-selection-fix-2026-10-29.md. Remains production OPEN.

UGC-SCH-013-ACCOUNT-SELECTION final local build update — 2026-10-29: webpack productionbuild exit0, TypeScript/page generation and all native Hook traced-package/postbuild checksPASS. Compiled Schedule chunks contain multi-account groups and original-request retry explanation.376total regression checks and actual desktop/mobile card browser remain PASS. Prior preview/save repair retained. No production deployment, hosted posting or provider writes; production acceptance remains OPEN. Complete receipt docs/schedule-account-selection-fix-2026-10-29.md.

## UGC-UI-051-FONT-MATCH — Workflow edit captions may differ from supplied references (2026-10-29)
- Status: OPEN / USER REPORTED and SCREENSHOT OBSERVED. User requests an audit of current workflow edit-screen typography against Screenshot 2026-10-27 115303.png, 115222.png and 115240.png. First supplied crop shows a heavier outlined caption and a red mark around a letter; exact saved font/style and render provenance are unavailable.
- Root cause: UNKNOWN. Do not infer exact reference font from a screenshot, or assume installed/default font equals the user's saved draft. Existing default is Proxima Nova A Semibold600 with outline8; prior EX-50/UGC-TEST-001 concern exact asset and preview/export parity.
- Expected: compare font shapes, weight, outline/joins, spacing and size separately; validate real browser font loading and current native renderer; retain existing saved styles and application layout. Audit before restyling defaults.
- Regression: reference_copy_font_and_outline_comparison; pointed_glyph_outline_has_no_spikes; browser_font_loading_and_export_parity; saved_legacy_font_retained. No application fix or exact font identification claimed.

UGC-UI-051-FONT-MATCH audit evidence2026-10-29: current new video-overlay default is Proxima Nova A Semibold600/white/outline8; older saved styles deliberately retain their font. Actual editor headlessfixturePASS19faces/Proxima600loading/save-reopen/laptop-mobile; rebuiltworker+11font/nativeMP4checksPASS. Current source rendered exact supplied wording acrossProxima/Poppins/Arial and outline variants; real current rendererMP4 frame inspected. Firstcrop appears heavier than refs, but its savedstyle/provenance unavailable; exact screenshot font and cause of circled letter remainUNKNOWN. Miter-vs-round experiment did not reproduce or prove circled defect; no broad restyle justified. Slideshow remains separate typography pipeline. No application code/font/defaults changed, generation or deploy. Receipt docs/workflow-font-match-audit-2026-10-29.md; comparison .tmp/font-match-audit/comparison.png. StatusOPENfor exact reference match/hosted acceptance; do not call locally passing font loading proof of a pixel-perfect reference match.

### UGC-UI-053 — Explore workflow cover playback starts slowly

- Date: 2026-10-29. Status: OPEN. USER REPORTED: Explore workflow videos take too long to start on hover; expected prompt playback without changing card layout or navigation.
- Root cause: UNKNOWN at report time. Investigate delayed source assignment, browser loading and media delivery independently.
- Regression: explore_workflow_cover_visible_metadata_immediate_hover_and_cleanup; preserve reference-gallery hover-only playback and reduced-motion/touch behavior.
UGC-UI-053 local evidence 2026-10-29: CODE CONFIRMED Explore covers assigned their video source only after a 250 ms interest timer, so network loading began after that delay. Landing cards now warm visible cover metadata and request playback immediately on mouse hover or keyboard focus. Shared reference-gallery previews retain the sustained-interest timer and source cleanup. Focused mocked interaction tests pass; actual browser timing, visual comparisons and production acceptance remain NOT VERIFIED. Status remains OPEN pending browser verification.

UGC-UI-046-WALL-AUTO continuation � 2026-10-29, LOCAL VERIFICATION: all 97 selectable Wall references now resolve through the actual recreation catalogue and source-text resolver to hash-bound layout profiles. Earlier 99/47 counts included already-retired 08/09; neither was restored. Four separate-region layouts, two left-aligned layouts and dense copy exposed real support gaps: manual Remix collapsed multiple saved regions through one output block, and the 600-character Hook ceiling rejected dense Wall copy. New Wall-only 6000-character bounds retain the source-relative budget; Hook/Slideshow limits stay unchanged. Manual reapply preserves saved layer styles; new source-defined heading/body and boxed regions persist through preview/save/reopen/export JSON. Region copies are defensively cloned. Wall prompts for new ordinary plans/receipts use version4; accepted frozen plans retain their original content. 227 focused checks,136 cross-feature checks,41 connected-flow/gallery checks, worker build, types and scoped lint PASS. Actual-component local browser covers every profile with edit/save/server-fixture reopen/mobile checks;97 source/outlined-render PNG comparisons produced and inspected. No paid API calls, video generation or deployment. Wall37/53 source sentences themselves end abruptly; retain verbatim transcription and list for manual copy review. Hosted AI quality, hosted persistence and final video render acceptance remain NOT VERIFIED. Receipt docs/prompt-reviews/wall-complete-placement-review-2026-10-29.md.

UGC-UI-051-FONT-MATCH implementation authorized2026-10-29: user explicitly requests closest possible match to references2/3/4, font+outline repair and equal exported appearance. This supersedes the previous new-overlay Proxima default where controlled reference comparison supports a better match. Preserve saved explicit styles, drafts, timing, unrelated layouts and publishing. Root cause/exact font identity remains UNKNOWN pending measured candidates; targeted white-glyph mask comparison planned across multiple reference lines, then preview/native export evidence. No claim of exact original-font identity from screenshots.


## UGC-UI-054-EXPLORE-SIX — Active Explore audit corrections (2026-10-29)
- Status: OPEN / USER REQUESTED, CODE CONFIRMED during read-only audit. Root cause at incident creation: UNKNOWN; preserve the audit observations separately from implementation verification.
- Observed: 28 selectable imported Wall IDs fail starting-frame resolution; seven active Hooks permit starting-image generation while frame use is decision-blocked; definite non-time schedule rejection retains stale intent; Remix errors occupy audio-upload error state; interrupted slideshow save plus a Library link exits before restoring Resume; Wall reviewed-draft recovery rejects 601+ characters despite the editor allowing 6000.
- Expected: all canonical published Wall sources resolve with immutable hashes; no new paid image submission for blocked Hook motion; corrected scheduling choices can follow proven rejection while ambiguous requests retain duplicate protection; text correction recovers without clearing audio errors; interrupted saves remain resumable; valid Wall drafts restore up to 6000 with other-format bounds unchanged.
- Named regressions: imported_wall_starting_frame_registry_coverage; blocked_hook_image_admission_and_accepted_recovery; definite_schedule_rejection_vs_ambiguous_retry; remix_correction_preserves_audio_error; interrupted_slideshow_save_before_library_open; wall_remix_6000_reload_and_cross_format_limits.
- Scope/receipt: docs/explore-six-confirmed-fixes-2026-10-29.md. Creator Phone excluded. No deployment or paid generation authorized. Relevant existing history: UGC-UI-046, UGC-UI-048, UGC-SCH-010, UGC-VID-028.

UGC-UI-046-WALL-AUTO recheck 2026-10-29 OPEN CODE/TEST CONFIRMED: Wall automatic-text needs_review metadata is ignored by the Hook-only editor warning. Wall correctly blocks empty text but reports only Add your wall of text, hiding the automatic failure reason. Regression wall-failure-before.log reproduces this. Scope: explain failure for Wall and clear it when user adds text; retain mandatory Wall copy, Hook explicit continuation, saved edits, full duration and no deployment/generation.

29 October 2026 Wall recheck: fixed unchanged referenceBlocks losing the original source hash/layout, plus missing Wall automatic-text failure explanation. Final161connected tests and97profile actual-component browser PASS locally. Full-worktree types currently fail in unrelated starting-frame-reference-source.ts/test optional videoFile usage; Hook worker test expects104but sees107. Hosted browser busy; live E2E NOT VERIFIED. No deploy/generation. Receipt docs/prompt-reviews/wall-end-to-end-recheck-2026-10-29.md. Saved edits/full duration preserved.

UGC-UI-051-FONT-MATCH local implementation2026-10-29: explicit Reference Social(TikTokSans700)/Classic(DMSans700) presets in existing selector, white/outline6/round joins/lineHeight1.2. New generic text usesSocial; existingfontchoices andoldautomaticplans retained; newHookplansfreeze textStyleVersion1. Native andpreviewASCIIlettering now share packaged font-hash-bound paths after real export comparison exposed browser-text/native-outline divergence. Final rawwhiteIoU95–96%,whitecoveragewithin1px100%,blackoutlinecoverage97–99% for3captions; exactpixelmatch stillnotclaimed(compression/AA) andsourcefont/platformemoji remainapproximate.63combinedfont/editor/draft/remix/nativeclip+compositiontests+26workerglyph/automaticchecksPASS; headlessdesktop/mobilebothpresets/save-reopen/controlchecksPASS; workerbuild/scopedlint/diffPASS. FullapptypesFAIL3unrelatedpossibly-undefinedvideoFileerrorsinconcurrentlymodifiedstarting-frame-reference-source(.test).ts; nofullbuild/productionacceptance. No deployment. Reference/candidateandpreview/exportPNGsinspected. Receiptdocs/reference-caption-fix-2026-10-29.md; remainsOPENforuservisual/hosted/exactsourcefontacceptance. Preservelegacyfonts; oldcaptionscanexplicitlyselectnewpresetwithoutcopy/timing/positionloss. Sharedwebsite/workerrelease needed.

UGC-UI-051-FONT-MATCH final verification follow-up2026-10-29: current sharedworktree already contains typeofvideoFile===string guards in starting-frame-reference-source.ts/test. Fresh fullapplicationtypesPASS; verified rather than duplicatinganotherchange. Source-registry4/4PASS, workerbuildPASS, combinedfont/editor/remix/nativeclip+composition63/63PASS, scopedlintPASS. Actualheadlesseditordesktop/mobilepreset/save-reopenPASS; freshnativeMP4vsactualpreviewPASSagain95–96%rawwhiteIoU,1pxwhite100%,blackoutline97–99%. Ref-vsupdatedcomparison+all3preview/exportpairs+actualeditorscreenshotsvisuallyreviewed. Thesearepreview/exportparitymetrics,notproofexactsourcefont. Originalfontidentity/platformemojivisualsremainunconfirmed/different; noexactmatch/hostedacceptance/deployclaim. Noapplicationcodeeditsneededthisfollowup. Receiptappendixdocs/reference-caption-fix-2026-10-29.md; logs.tmp/font-final-verification/. Historicaltypefailureentriesretained.

UGC-UI-051 final compiler evidence clarification: standard full-project tsc completed exit0. Additional optional --incremental false rerun remained silent/incomplete and was stopped; do not count it as a second successful compiler run. Four source-registry checks, workerbuild, scopedlint,63font/editor/nativechecks andbothbrowserfixtures completedPASS. Noapplicationedits in follow-up; existing string guards verified.

UGC-UI-051 correction to preceding compiler note: final tool result for the additional --incremental false session was exit0 with empty diagnostics, rather than an interrupted/error exit. The interruption attempt reached an already-completed successful result. Therefore clean nonincremental typecheck alsoPASS; receipt corrected. Preserve preceding note as an audit of the initially mistaken timeout inference.

UGC-UI-054-EXPLORE-SIX local verification follow-up — 2026-10-29: six corrections LOCALLY VERIFIED; production status remains OPEN. Verified code causes: published imported Wall sources omitted from frame registry; paid eligibility omitted the unresolved-decision gate; non-time rejection and uncertain outcomes shared immutable replay; Remix reused audio-upload error state; Library opening threw before interrupted-save hydration; reviewed-draft recovery retained Hook's600-character bound. New regressions failed before each fix;297focused+70neighboring/service/PGlite tests PASS; typesPASS; lint0errors with one existing test warning. All named regressions in the original entry now have executable coverage. CreatorPhone component/route hashes unchanged and shared-boundary regression proves unchanged phone recovery. Six Wall/TalkingHead desktop/mobile toolbar PNGs byte-identical. Broader browser fixture later fails the same Hook end-of-clip rendered-text assertion on baseline/current; label FIXTURE OBSERVED, root causeUNKNOWN, production impactNOTVERIFIED; do not silently turn it into a new implementation claim. No deployment, paid calls or production writes. Full evidence/limits/files: docs/explore-six-confirmed-fixes-2026-10-29.md.

UGC-UI-054-EXPLORE-SIX final local gate:298/298focused+70/70neighboring/backend testsPASS(total368). Allseven blockedHook IDs reject before billing; accepted historical image still recovers after motion is blocked with zero additional charge/source read. Actualaudio-upload error survives Remix correction. Full webpack productionbuild,296staticpages andpostbuild native-route tracesPASS after sandboxEPERM retry. TypesPASS;lint0errors/oneexistingtestwarning. CreatorPhone hashes unchanged. No deployment. Production/provideracceptance and baselineHookbrowserassertion remainunverified as recorded above.

## UGC-VID-029-HOOK-DECISIONS — Explicit source-faithful reference decisions (2026-10-29)
- Status: OPEN / USER REQUESTED. User confirms only airplane Hook19 should be removed from browsing; keep39/51/57/64/72/83 using original frame0, influencer identity replacement and source text/logo cleanup. Preserve props, original cut, camera movement and intentional partial-face crop. Reported excessive decision blocking is distinct from untested generation quality; root cause UNKNOWN until catalog verification.
- Regression: approved_six_hook_decisions_and_retired_airplane_history; original_opening_identity_cleanup_and_source_motion. No deployment or paid generation.

UGC-VID-029-HOOK-DECISIONS local verification — 2026-10-29: explicit user approval resolves six static catalog decisions; existing exclusion mechanism retires only19 with archive/media/history retained. Root cause CODE CONFIRMED: source-bound review records retained needs_decision despite the user's clarified original-opening policy.127local checksPASS, types/workerbuildPASS, lint0errors/oneexistingwarning. Data comparison proves allother plans/sourcehashes/beats/samples/media unchanged. Existing unrelated Hook22 wording test fails identically with pre-change JSON; no new motion fix claimed. Originalframe0/identity/cleanup/silentmotion/API duplicate recovery verified locally. CreatorPhone/scheduling/components untouched. Production/generatedquality NOT VERIFIED; no deploy/paidcalls. Receipt docs/hook-reference-decisions-2026-10-29.md. Status LOCALLY VERIFIED / PRODUCTION OPEN.


UGC-UI-054-EXPLORE-SIX recheck2026-10-29 — browser fixture cause CODE CONFIRMED: FormatVideoTextOverlay now renders reference-caption letters as SVG paths, while the existing late-Hook assertion reads SVG textContent. Empty textContent is not missing pixels. Scope: test-only renderer-aware geometry/copy validation and real browser rerun; do not change application renderer, timing, fonts or CreatorPhone. Regression: hook_end_of_clip_caption_paths_match_exact_saved_words. Status OPEN until verified.

UGC-UI-054-EXPLORE-SIX browser verification2026-10-29 — LOCALLY VERIFIED: SVGglyph-aware exactcaption geometry/copy check passes Hook1366/390 repeatedtrim/endvisibility/reload/multiblock and complete upload/edit/save HTTPfixture. SixsharedtoolbarPNGs byteidentical1280/390/320. Noappcomponent/renderer/Phone changes. Sixfix299,neighbors84,sourceidentity43,audio6PASS; strengthened106Hook3PASS. UGC-VID-029 allactive mapping/prompts valid and19retired; source/video output quality and hostedintegration remain separate. Existing Hook22 wording assertion fails identically on baseline, not silently skipped in evidence. Receipt docs/explore-six-fixes-recheck-2026-10-29.md; build/media finaloutcomes appended there. Nodeps/config/deploy/paidcalls.


UGC-UI-054 / UGC-VID-029 finalrecheck2026-10-29: all106sourceMP4hashes andactualframe0decodes/dimensionsPASS, no missingmedia; all106canonicalmapping/prompt/decisionchecksPASS.86cached+20read-onlypublicGCSdownloads verified; no generation. FreshfullwebpackbuildPASS/305pages/nativeHooktracesPASS after disk/cache/sandboxrecovery.432corechecks+5motionchecksPASS; one historicalHook22wordingassertion stillFAILandbaseline-reproduced, not an application regression claim. CorrectedSVG-awarebrowserfixturePASSdesktop/mobile; sixbaselinePNGsidentical. Phonecomponent/routehashes unchanged. ProductionAIoutput/authenticatedhosting/publishing NOT VERIFIED; no deploy. Receipt docs/explore-six-fixes-recheck-2026-10-29.md.


UGC-UI-054 / UGC-VID-029 stretch-test follow-up2026-10-29 — OPEN USER REQUESTED: verify test-only outdated wording/indexing. Root cause at request UNKNOWN; failing assertion and source evidence under .tmp/hook-motion-test-fix-20261029. Correct prior label: failing reference d1d14b08f6dd4711ad166ded is catalogHook08, notHook22. Expected preserve runtime plan/prompts/gallery/CreatorPhone and replace obsolete test assumptions with ordered visible-stretch assertions. Regression: original_opening_stretch_sequence_and_opposite_hand_order. No deployment/paidgeneration.

UGC-UI-054 / UGC-VID-029 stretch-test verified2026-10-29 — LOCALLY FIXED TEST ONLY. Rootcause CODE CONFIRMED: outdated literal already-joinedpalms and opposite-hand assertion at beat2 despite expanded7beatplan. Existingplan agrees with all79sourceframetiles; sourcehash9b8b330230ef1b0247d6a5727fbaec5694c47415e6316be7e03ab57f75b1eb66verified. Correct earlierlabel: catalogHook08, notHook22. Updated orderedactiontest passes111/111without skips; deliberate resetpose/earlyhandswitch fixtures each fail as intended.13runtime/data/Phone hashes unchanged. No applicationfix, newprompt, deployment or paidgeneration. Sourcequality review here is not generatedoutput acceptance. Receipt docs/hook-stretch-test-fix-2026-10-29.md; typesfinalresult appended there.


Stretch-test final static gate2026-10-29: fullnonincrementalTypeScript exit0/no diagnostics; scopedlint anddiffcheckPASS.111tests/no skips plus both negativefixture checks verified. Runtime andCreatorPhone remain unchanged; no deploy.


## UGC-UI-055-WALL-LAYOUT-02 — Manual structured Wall remix (2026-10-29)
- Status OPEN / USER REPORTED, CODE CONFIRMED. Root cause at report UNKNOWN; reproduction: known heading/body source accepts missing-separator generic blocks at API validation, then application fails; explicit fields rejected. Existing correct paragraph cases work. Preserve history rather than reinterpret saved outputs.
- Expected: new source-bound heading-body-v1 manual remixes use explicit heading/body through provider schema, API validation, review, save/reopen and application; old block receipts/drafts and other layouts still work. Regression structured_wall_manual_api_review_reload_apply_and_legacy_recovery. No CreatorPhone edits, deployment or paid generation.

UGC-UI-055-WALL-LAYOUT-02 local verification2026-10-29 — CODE CONFIRMED rootcause: manual output contract required genericblocks and rejected heading/body forWall; editor inferred boundary from blanklines. New source/hash-bound heading-body-v1 provider/schema/API/review/draft/apply path uses explicitfields; oldblockreceipts/drafts retained unchanged. Providernewcombinedblock rejected before completion; acceptedoldreceipt recovers withoutprovider calls.258tests/no skipsPASS, realbrowserdesktop/mobile emptyvalidation/unfinishedreload/700chars/bodyparagraphs/style/apply/reopen/legacyPASS.5baselinePNGs byteidentical; types/scopedlintPASS; Phonehashesunchanged. No deps/migrations/livewrites/paidcalls/deployment. Status LOCALLY VERIFIED / HOSTED AND PROVIDER ACCEPTANCE OPEN; fullreceipt/finalbuild docs/wall-layout-02-structured-remix-2026-10-29.md.


UGC-UI-055-WALL-LAYOUT-02 finalgate2026-10-29: fullwebpackbuild exit0/353staticpages/nativeHooktracedroutesPASS.258testsPASS, types/lint/diffPASS, fullRemixbrowserPASS,5baselinePNGsidentical. Phone hashes match currenttask andoriginalsixfixbaselines. Structuredfield contract locallyverified; legacyblockcompatibility remains deliberately for oldreceipts/drafts. Hostedmodel/persistenceacceptance NOT VERIFIED. No deploy/paidgeneration.


UGC-UI-055-WALL-LAYOUT-02 end-to-endrecheck2026-10-29 —275tests/no skipsPASS; direct97-source comparison topre-fixlegacyapply/draftreader PASS for initialregions/customstyles/completedandemptydrafts/save-reopen/export. Newtests coveroldpending/failedWallreceipts withzero providercalls, structuredsaved-edit/export/blankdraftretention andactualPGliteJSONBclaimrecoveryforoldv4/newv5fields. Freshdesktop/mobileRemixbrowserPASS;5oldPNGsidentical;types/lint/diffPASS.10runtime/layout/Phonehashes unchanged: test-onlyadditions, noappfixneeded. No deploy/paidgeneration/livewrites. Hosted/provideracceptance remainsOPEN. Receipt docs/wall-layout-02-structured-remix-2026-10-29.md rechecksection.


## UGC-REL-20261029 — Combined release regression gate

Status: OPEN. CODE CONFIRMED: the combined release test run found stale gallery counts, pre-frame-zero preparation fixtures, missing mock exports/imports, and an obsolete caption default. Local HTTP tests pass with loopback permission (53/53). PostgreSQL concurrency tests require the stopped Docker engine. Catalogue inventory mismatch is under investigation; no product root cause is assumed. Regression: combined changed-path root suite plus worker tests and deployment smoke checks. No production mutation has occurred at this point.

## UGC-VID-RELEASE-20261029 — Private identity URL incorrectly treated as scene
Status: OPEN. CODE CONFIRMED: worker/src/jobs/generate-image.ts maps the first extra image through resolveCreatorSceneDelivery for every Hook receipt, although only v4 has an extra clarity scene. For private v2/v3/v5 jobs that image is an influencer identity URL, so signing rejects it before submission. Scope: guard the extra scene signing with receipt.version === 4; keep canonical URLs, image ordering, frozen receipts, source t=0 policy and provider fingerprint unchanged. Regression: worker/src/jobs/generate-image.hook-keyframe.test.mjs private v2 both models and v4 two-scene cases; negative role binding tests retained. No paid provider calls.

## UGC-SEO-RELEASE-20261029 — Release SEO validation gaps
Status: OPEN. CODE CONFIRMED: full lint found three unescaped JSX punctuation errors in changed blog pages. Rendered SEO validation found the two standalone app-demo guides lack the common Article image/publisher/author fields and have schema headlines different from their visible H1. Scope: escape punctuation without changing visible copy; reuse existing articleJsonLd and faqJsonLd for those two guides, share visible FAQ data with the graph, add canonical breadcrumb metadata. No layout changes. Regression: full lint and scripts/test-public-seo-render.mjs plus public SEO checker after deployment.
UGC-SEO-RELEASE-20261029 continuation: all rendered guides inspected together. Shared founder-workflow-guide uses valid TechArticle (Article subtype) with no FAQ section; older checkers incorrectly require exact Article and FAQ for every guide. Preserve TechArticle/no fabricated FAQ, accept that type in checkers, and add the same missing image/publisher/author identity fields via the existing helper. All 97 actual Wall browser profiles now pass after disk cleanup. Final lint zero errors, 73 warnings; final build and rendered gates are rerun after this schema-only change.

UGC-VID-RELEASE-20261029 local verification: FIXED LOCALLY. One-line guard retains source-only signing for v2/v3/v5 and both scene roles for historical v4. 149 additional worker jobs/adapters, 88 compiled render/layout checks and 63 cross-project Wall checks PASS. Regression fixture covers both Gemini Pro/Nano Banana paths for v2/v3/v5 and v4, with canonical identity/order assertions and no paid calls. Hosted acceptance remains NOT VERIFIED.
UGC-REL-20261029 gate update: root run 2168 total,2160 pass,8 Docker infrastructure failures,0 skips; full lint 0 errors/73 warnings, types PASS, full build353 pages PASS before the final shared-schema addition. Browser PASS Analytics,account selection,Trending,structured Wall,97 Wall layouts,navigation,caption preview/export parity. Full SEO/schema rerun pending final rebuild. No production mutation or remote test upload.
UGC-SEO-RELEASE-20261029 factual-copy check: CODE/SOURCE CONFIRMED new comparison copy incorrectly says Synthesia requires annual billing and Billo costs $59–$120 plus standard ad-rights fees. Official sources checked: https://www.synthesia.io/pricing (monthly or annual billing); https://billo.app/blog/how-billo-pricing-works/ (starts $99, approved video use on owned marketing channels/ads, optional extras); https://help.billo.app/en/articles/12379731-organic-posting-and-partnership-ads (creator-handle partnership ads separately priced). Correct only those claims and inaccurate unlimited credit wording, retain page layout and existing price links. Other unsourced performance percentages and broad competitor comparisons require editorial verification before the SEO copy is called fully checked.
UGC-SEO-RELEASE-20261029 additional factual correction: changed SEO blog pages hardcoded 78 tools; checked actual catalogue106 and public105 (one gated tool omitted). Remove obsolete numeric claims from changed copy, retaining official tool-reference links and no application capability change. This avoids future count drift. No claim that unsourced conversion percentages were verified.
UGC-SEO-RELEASE-20261029 discoverability: rendered sitemap/homepage traversal found 10 new blog URLs without an incoming path from the public navigation graph. Keep the existing related-article card component and add appropriate topic/comparison/cost links in the core SaaS content guide and tools comparison page. No sidebar, auth or application workflow changes. Regression: scripts/test-public-seo-render.mjs homepage reachability must cover all119 public URLs.
UGC-REL-20261029 release gate: approved isolated Cloud Build4eaa8f7b-23cc-4aa6-ae7d-ae08366795e1 SUCCESS8/8, zero skips, resolves all eight Docker infrastructure failures. Full final exact-source build353 pages PASS; technical SEO119/119 pages and119 homepage-reachable URLs PASS, canonical/sitemap/schema match. UGC-SEO-RELEASE-20261029 technical defects FIXED LOCALLY; source-confirmed factual corrections and stale numeric tool-count wording fixed, other broad editorial claims remain unverified. Freeze receipt docs/combined-application-release-2026-10-29.md; production deployment/acceptance still pending.
