# UGCPilot UI & Workflow Mistake Ledger (`clear.md`)

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
