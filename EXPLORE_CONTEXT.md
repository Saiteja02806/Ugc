# Explore context and UI decision record

## 2026-10-23 New Hook Remix and Recreate readiness follow-up

- Verified all eight refresh references through the actual caption resolver,
  Remix input/output overlay mapping, draft-to-prompt preview and v4 image builder.
  Captions are ready with source hashes and reaction-only timing. Image prompts
  use the influencer as the person, source frame as visual guidance, verified
  frame-zero pose and caption removal; later motion/ending beats are separate.
- Fresh focused checks confirm every new reference resolves a nonempty motion
  preview with no animation error or unresolved decision. These are local pure
  contract checks, not a fresh paid generation or hosted acceptance. User approval
  of an actual generated image and server ownership/receipt validation remain.
- Important existing exception: duplicate folder (4) uses Hook 83, whose prior
  `needs_decision` review concerns retaining the intentional extreme partial-face
  crop. Its text is ready, but `requiresDecision` still prevents the Use-frame
  handoff. Importing the duplicate was not used to bypass this existing review.
  Details: `docs/hook-folder-refresh-and-ending-audit-2026-10-23.md`.

## 2026-10-23 Hook folder refresh and final-frame review (uploaded; release paused)

- Rechecked `D:/hookswithlinks/notbeen` after folders (2) through (10) appeared.
  Eight new posts are in `explore-hook-reference-oct23-refresh-release.json`
  (Hooks 100–107). Folder (4) duplicates existing Hook 83 by canonical TikTok URL;
  its original registered identity/trim remains. The unnumbered folder is Hook 99.
- User corrected folder (2)'s audio choice to default background music. It uses a
  verified immutable snapshot of the approved `hook_audio_006`. Supplied MP3s keep
  exact bytes. Other TikTok downloads supply only the reaction's audio interval,
  excluding later demo narration. Database lookup was read-only.
- Demo/outro panels in the user's screenshots came from full downloads. Imports
  use the short `muted_*.mp4` reaction files. All 656 new retained frames were
  reviewed; first/last-four inspection also covers every short candidate and
  existing Hook 83. Endings remain reaction footage, so no further cut was needed.
  Original files are unchanged. Preview decoded-pixel hashes match the sources.
- All 32 objects passed stored SHA-256/metadata and public URL checks before local
  activation. These eight form Hook batch sequence 2 and receive New; Hook 99 loses
  New while slideshow badges remain. Current platform mixing/order rules below
  remain authoritative. Website and worker deployment remain paused. Evidence:
  `docs/hook-folder-refresh-and-ending-audit-2026-10-23.md`.

## 2026-10-23 Mix reference video platforms (local)

- Default Hook and Wall video galleries now alternate Instagram/TikTok cards
  instead of exhausting one platform first. Ordering is deterministic across
  rerenders and scroll expansion, with newer batches first within each platform.
  When one platform runs out, remaining cards stay available. Unknown provenance
  stays unclassified and is included as its own interleaved bucket.
- This supersedes strict global newest-batch-first ordering for reference videos
  when that would group an entire platform first. New badges retain their batch
  meaning. Slideshow category/batch ordering remains unchanged. Both gallery
  entry points share the ordering; single-platform filters preserve platform scope.
- Wall catalogue mapping now retains available source-platform/link fields,
  allowing known provenance to participate without guessing unknown sources.
  Local validation is separate from deployed acceptance; release remains paused.

## 2026-10-23 Talking Head and Wall starting-frame Recreate (local)

- Both workflows now use the shared Recreate preparation behind the existing
  `ENABLE_HOOK_STARTING_FRAME_PREPARATION` gate: actual first frame, person photos,
  image model/variations/cost, generated variations, explicit Use selected frame,
  and separately submitted animation. Fixed approval footer and responsive result
  previews are shared with Hook. Opening/reopening never generates automatically.
- Talking Head keeps the user's script and Demo inputs. Its approved-frame form
  exposes supported animation models/durations, the frame's fixed ratio and Sound
  (off by default). Approval clears appearance/video generation references; a
  selected audio reference is retained with an explicit blocker and removal action.
  Script/Sound animation uses its own prompt builder; Hook's action-only grammar
  must not reject speech or wrap Talking Head scripts as Hook action directions.
- Wall uses clean moving background instructions; overlay words remain editable
  in Edit and are not requested as rendered text in generated footage. Hook's
  reviewed motion gates remain unchanged. These are generic workflow directions,
  not a claim to reproduce a reference's exact performance.
- Saved approved selections are isolated by account and workflow, and by draft
  for Talking Head. Closing a replacement retains the previous approved selection.
  Recovery re-verifies the exact owned job/asset with fresh media URLs. Other
  workflow frames do not appear in the Hook starting-frame shelf.
- The server resolves canonical Wall sources and nine packaged Talking Head clips,
  verifies SHA-256 before extracting frame zero, and independently derives workflow
  during image/video admission. Unsupported source shapes are blocked before image
  credits; video admission verifies image ownership, source, model and matching ratio.
  Native extraction routes trace packaged Talking Head MP4s. No schema change.
- Local evidence: 298 focused tests, all nine real packaged clips decoded and
  hash-verified, plus twelve browser layout cases (three workflows × four sizes).
  Browser fixtures isolate auth, person picker, inference and final video form;
  they establish layout/selection behavior, not hosted or paid-generation acceptance.
  Details: `docs/multi-workflow-starting-frame-2026-10-23.md`. Release remains paused.

## 2026-10-23 Recreate approval and preview layout (local)

- Active Hook Recreate overlay keeps its header and approval footer outside one
  scrolling content region. Use selected frame stays visible before/after image
  generation and is disabled until the selected receipt and current inputs pass
  existing approval checks. Choosing a card only selects; approval is explicit.
- Image model, variations and unit/total cost are grouped in Generation settings.
  Result badges, selection/enlarge labels and enlarged titles use Variation 1,
  Variation 2, etc.; the approved image remains a starting frame in the video form.
  After results, Generate more is secondary, with total cost beside it. Larger
  result cards include a Selected badge and separate enlarge controls; mobile
  uses two columns. Completion reveals the results within the content scroller.
- Local component/browser checks cover desktop, short desktop, 390px and 320px
  phones, four results, selection/approval, enlargement and footer visibility at
  either scroll end. Browser fixtures isolate auth/generation/person-picker and
  handoff boundaries; they do not establish hosted or paid-generation acceptance.
  Production release remains paused. `scripts/hook-recreate-layout.browser.cjs`
  reproduces this verification; screenshots/receipt: `.tmp/hook-recreate-layout/`.

## 2026-10-23 Idle navigation continuation — browser reads (local)

- Trending feed, shared billing and AI Studio access reads now include browser
  token acquisition in a 20-second total deadline, bind the expected owner and
  prevent late-token fetches after cancellation. Existing cache/retry policies
  remain intact. No production speedup or real-idle acceptance is established.
- Focused deadline/recovery tests pass; evidence and two unrelated broader test
  assertions are recorded in `docs/idle-navigation-investigation-2026-10-23.md`.


## 2026-10-23 New reference batches and supplied content (media uploaded; app release paused)

- New reference uploads appear before older cards in their own workflow. A small
  `New` badge marks every card in the latest complete published batch, with no
  time expiry or per-user seen state. The next successful batch in that same
  workflow retires the previous badge; uploading Hooks does not retire slideshow
  or Wall of Text badges. Pending/incomplete imports do not replace a live batch.
- Batch membership and monotonically increasing per-workflow sequences live in
  `lib/explore/reference-upload-batches.json`. Future importers must register
  their batch here and publish it only after all immutable media is verified.
  Apply newest-first ordering after filtering/category interleaving in both
  galleries so category mixing cannot move older slideshows above new content.
- Imported four uncategorized slideshows from `D:/slideshow/slideshow explore/NONE`
  with ordered counts 3/6/2/2 (13 original images). User explicitly excluded
  `New folder (2)/middle.mp4`. Do not invent slideshow source-post links.
- Imported one Hook from `D:/hookswithlinks/notbeen/New folder`: use the supplied
  4.1-second reaction-only clip, its native audio and verified supplied TikTok
  URL. The full download's later screen recording is excluded from the Hook.
  All 123 reaction frames and source copy were reviewed; this does not claim a
  generated animation has passed visual qualification or bypass motion gates.
- Sixteen immutable storage objects were read back and verified by byte count,
  content type and SHA-256 before activating local manifests. The source website
  and worker remain undeployed. Existing slideshow additions from 22 October
  remain staged, and automatic Trending catalogs are unchanged. Receipt, import
  IDs, tests and release limitations:
  `docs/explore-new-content-batches-2026-10-23.md`.

## 2026-10-23 Idle navigation recurrence — shared auth recovery (local)

- User clarified that sidebar navigation to Trending or other screens becomes
  slow after 22–30 minutes unused. A real authenticated idle trace is still
  absent; cache staleness alone is not an established root cause.
- Fault injection reproduced unbounded Firebase server lookup/body waits that
  hold same-token overlapping API checks. Local ten-second deadline releases
  those waits; upstream outages return 503 instead of invalid-session 401.
  Authorization remains fail-closed, without caching completed checks.
- Existing four-library browser idle fixtures pass with simulated elapsed time.
  Production browser requires sign-in; no deployment or real idle acceptance.
  Findings, remaining client deadline gaps and limits:
  `docs/idle-navigation-investigation-2026-10-23.md`.

## 2026-10-23 Combined release review — deployment paused

- Hook Recreate now stages replacement while retaining the previously approved
  composer frame. Closing restores that frame; the replacement preparation's
  draft ID remains recoverable. Only explicit Use this changes the selection.
- The composer persists owned job/asset/source identities and approved motion,
  duration and sound settings per account, without storing signed image URLs.
  Refresh re-verifies through authenticated GET and uses a fresh media URL.
  Failed reads retain the record and block generation until explicit retry or
  clearing; late reads cannot overwrite a newer selection/removal/account.
- References with unresolved motion now disclose the animation limitation next
  to image generation before image credits are submitted. Existing animation
  approval gates remain; the warning does not approve motion or generate video.
- These local corrections supersede the cancellation/refresh gaps recorded in
  the earlier step audit below. Production behavior is unchanged until release.
- Full release scope, current checks, database prerequisite and rollout order:
  `docs/final-release-review-2026-10-23.md`. No deployment or settings change.

## 2026-10-23 Native media packaging and default build verification (local)

- Default Turbopack production build now passes on the reviewed working copy.
  Native `ffprobe-static` is externalized alongside `ffmpeg-static` so its package
  resolver uses the deployed package directory instead of a bundled `/ROOT` path.
- Trace only the build platform/architecture's probe binary and preserve package
  entry/metadata. Four native consumers (Hook frame/keyframe, Audio transfer and
  MCP) receive isolated package resolution/executable postbuild checks.
- Broad `/mcp` include matching was removed because it added native binaries to
  lightweight health/resource metadata routes. Negative postbuild assertions keep
  those routes free of native media packages. No worker, generation or audio
  product behavior changed. Isolated Linux packaging checks now pass; hosted
  authentication/media acceptance remains distinct and requires release.
- Source-only MCP CPU optimizations and storage measurements are recorded in
  `docs/build-storage-mcp-audit-2026-10-23.md`. No deployment or retention change.

## 2026-10-23 Reference gallery filters, scrolling and playback (local)

- Hook filters expose Instagram and TikTok using source provenance, including
  legacy Instagram links. Clear filters is shown only for an active selection.
- Reference galleries reveal complete additional rows as the end approaches;
  the Show more references button is removed. Filtering restarts the window and
  existing access limits still apply.
- Visible reference cards start muted previews without hover, unload when outside
  the viewport or in a hidden tab, and respect reduced motion. Landing-page covers
  retain their interest-based behavior. Failed preview derivatives fall back to
  the original video in cards and the opened player.
- Component regression checks are local. Deployment remains paused; playback of
  every hosted media file and signed-in production acceptance remain unverified.

## 2026-10-23 Completed-media receipt freshness (local)

- Single/multi background-job detail hooks give successful completed receipts
  with a valid completion time, no error and a media asset UUID 30 seconds of
  freshness. This coalesces rapid remount/reconnect reads; it adds no timer.
- Failed/cancelled, incomplete/nonmedia outputs, malformed receipts and read
  failures retain immediate lifecycle revalidation. Explicit status refresh and
  invalidation still reach the server. Active-list discovery and retry behavior
  are unchanged. Do not extend this to all terminal jobs or infinite freshness.
- Local verification and the separate Settings bundle changes are recorded in
  `docs/terminal-settings-optimizations-2026-10-23.md`. Hosted acceptance remains
  pending an authorized deployment.

## 2026-10-23 Agent-reviewed polling coordination (local)

- Inactive AI Studio panels stop initiating job reads but retain IDs/cache and
  reconcile on reactivation. Standalone Studio remains enabled without an
  Explore format; owner changes stay isolated.
- Recoverable workflow detail polls may reuse fresh, observed, account-owned
  active-list receipts. Missing/failed/stale lists and ordering conflicts fall
  back to GET. Explicit Check status always reaches the server. Jobs leaving
  the list still receive final detail/output reads.
- A newer active receipt resumes a cached terminal same-ID job after a retry
  elsewhere. Equal-time conflicts require authoritative GET; older lists cannot
  revive newer terminal results. General terminal-cache tuning remains separate.
- Recurring Audio/Reaction reads have a 20-second deadline. Audio checks other
  pending jobs as well as exact saved receipts; successful general status updates
  survive a separate receipt read failure. No automatic paid mutation.
- Agents implemented and cross-reviewed policy/tests; parent reviewed/integrated
  fixes. Local evidence, final validation and next steps:
  `docs/polling-agent-review-2026-10-23.md`. Deployment remains paused.

## 2026-10-23 Recreate step-by-step audit — no deployment

- Complete 48-step trace, required/optional/unnecessary steps, production versus
  local status and evidence limits are in
  `docs/hook-recreate-step-audit-2026-10-23.md`. 82 local tests pass; an additional
  executed diagnostic runs the exact production and local navigation functions.
- Production still initializes legacy source-video intent behind preparation and
  leaves it after Close. The local separation fix is not a production fix.
- At this audit's revision, both versions cleared the approved frame during
  replacement and failed to restore the composer selection on refresh. The local
  corrections at the top of this file now address these gaps; production remains
  unchanged until the paused release is authorized.
- Ten of the 98 reviewed Hook entries need an explicit motion/crop/reveal/prop
  decision. Use this remains blocked for them. The final local review adds an
  explicit prepayment disclosure beside image generation; it does not silently
  approve motion, skip source frames or submit another generation.
- Local recent Starting frames history returns at most 24 verified frames from
  48 completed jobs and restores suggested motion with Sound off. Do not promise
  every historic frame or exact custom-motion/audio recovery with this service.
- Fresh computer-use access timed out on application approval. No fresh visual,
  keyboard, mobile or paid end-to-end acceptance is claimed. Prior signed-in
  production observations, deployed source and local harness checks are separate.
  No behavior change, production write, paid generation or deployment in this audit.

## 2026-10-22 Starting-image transient status recovery (local)

- Pending starting images check status every three seconds; transient network,
  timeout, 408/409/429 and 5xx read failures back off to 15 seconds. Foreground
  return checks the same receipt; terminal jobs stop. Auth/missing/invalid receipt
  failures retain explicit checking. No automatic generation or paid retry.
- Non-JSON HTTP failures retain their status classification. Successful malformed
  data still fails receipt verification. Prompt/provider/generation rules are
  unchanged; this polling patch remains under the deployment pause.
- The Hook/Wall recovery harness now loads the real pure starting-frame model
  helper: all 39 baseline checks pass. Separate runtime tests cover status
  recovery and independent variations. Local evidence and remaining bottlenecks:
  `docs/starting-image-recovery-fix-2026-10-22.md`.

## 2026-10-23 Prompt v4 production default — deployed

- User approved the generated v4 sample and requested its prompting approach as
  the production default for all Hook starting frames and selected influencers.
  Keep the exact approved prompt and adjacent image labels as the baseline.
  Added regression hashes pin both to the tested request; do not silently replace
  it with another untested wording change.
- A focused release was prepared in managed worktree
  `hook-prompt-v4-production`, PR #82, source commit
  `dffa8a95fe5076d98143967332ee1f16242d995a`. It includes prompt/version compatibility
  and worker forwarding only. Other pending UI, slideshow, scheduling, marketing,
  polling and migration changes in this checkout remain under the earlier pause.
  PR #82 is merged as `14be89fb36a796b28332f074f63a048006559266`.
  Production website deployment `dpl_8VmfmCjFcprdyNZt65nVNia182Uo` is Ready,
  serves getugcpilot.com/www.getugcpilot.com and reports that exact main commit.
  Active worker `ugc-ai-generation-worker-promptv4dffa8a95` serves 100% traffic;
  its pinned image and baked/runtime commit match the reviewed source commit.
- Remaining quality work is a diverse Pro evaluation across people/scenes and a
  separate Flash evaluation. One approved Pro image is not a consistency claim.
  Keep explicit image review before animation. No additional paid test was run.
  Signed-in production browser checks confirmed Recreate, source-frame decoding,
  photo selection, Pro default and the v4 text under View image instructions.
  No new paid production generation was submitted. Production still has the old
  split influencer/photo controls, missing Starting frames picker tab and legacy
  Use source video composer option; those fixes remain in the paused UI release.
  Full release evidence: `docs/hook-prompt-v4-release-2026-10-22.md`.

## 2026-10-22 Trending/Audio foreground polling (local)

- Active Reaction cards, the Reaction text editor and active Audio history use
  foreground status polling with bounded failure backoff. Returning reads the
  existing status/receipt; it never submits generation or editing automatically.
- Shared `pollInForeground` backoff is opt-in. Existing Explore finishing and
  pending-schedule timing remains unchanged; all 68 adjacent regressions pass.
- Local transport/effect tests cover hidden/offline return, late responses,
  cancellation and retained request keys. No deployment or hosted acceptance.
  Evidence: `docs/trending-audio-polling-2026-10-22.md`.
- Follow-up review corrected Audio overlap during initial recovery, rapid reads
  for absent receipts, and key-scoped reads that could starve other jobs while a
  saved receipt was uncertain. Initial recovery has a 20-second deadline;
  absent-receipt timer reads slow to 30 seconds. Shared numeric intervals retain
  their behavior. All 101 relevant local review regressions pass.

## 2026-10-22 Influencer photograph with visual reference — prompt v4 (local)

- User clarified that the requested task is a new photograph of their influencer,
  with the Hook frame as visual guidance. V3 still overemphasized exact scene and
  original hairstyle preservation and facial-region reconstruction. V4 leads with
  the influencer, uses the source for setting/composition/pose/expression/clothing,
  and prioritizes recognizable likeness over copying source facial geometry.
- Remove face-swap/replacement instructions and exact-position/source-hairstyle
  constraints from the new prompt and adjacent image labels. New generation can
  vary scene details; it is not a promise of pixel-identical scene preservation.
  Keep source ratio, visible gesture, hand/object occlusion and caption omission.
- Prompt v4 is supported through provider admission and saved-result recovery.
  Earlier accepted versions retain their labels and prompts. After the user's
  separate one-image test request, v4 completed on `gemini-3-pro-image`, 2K, 9:16,
  with the same four exact input files as the earlier v2/v3 comparison. The result
  visually follows more of the influencer's brow shape, facial proportions and
  brown hairstyle, while retaining the source setting/glasses gesture and omitting
  captions. This is one promising sample, not demonstrated production consistency.
  Evidence: `outputs/hook-prompt-ab-2026-10-22/case-v4.json`, `receipt-v4.json`,
  and `output-v4.jpg` (local ignored artifacts). Request ID:
  `e5bec406-dd24-4df7-8feb-fb156ee44808`. A restricted-network DNS failure was
  recorded before the successful unrestricted provider request. No additional
  generations were submitted. Deployment remains paused.

## 2026-10-22 Shared Demo and Creative Assets preview lifecycle (local)

- Library cards now retain a bounded display-only still and release idle video
  sources. Offscreen/hidden/offline playback pauses; explicit Resume retains its
  time. Source changes isolate state. Opening an expanded Demo stops its card.
- Visibility tracks the containing card including its playback controls. Tracking
  only the frame caused immediate pause when mobile controls remained visible
  below an offscreen frame; the explicit regression now passes.
- Existing posters and source URLs remain in use; no original-media rewrite or
  persistent/shared preview cache. This does not change Explore editor playback.
- All 82 local desktop/mobile browser assertions and 36 focused contracts pass;
  TypeScript and scoped lint pass. Long scrolling retains zero idle video sources
  versus 52 desktop/46 mobile in the previous fixture. No bill-saving claim and
  no deployment. Full build status and local/production limits are in the receipt.
  Evidence and remaining work: `docs/demo-creative-assets-video-previews-2026-10-22.md`.

## 2026-10-22 Primary-frame recreation prompt v3 (local; deployment paused)

- Subsequent user-authorized A/B test completed two fresh direct Google requests
  using `gemini-3-pro-image`, 2K, 9:16, the same hash-verified source from job
  `2d6398b7-39e0-4898-b3e5-28db054f4fc8` and the exact same main/two support
  images. Old prompt hash matches that historical job. Prompt plus adjacent role
  labels changed together; no seed was set and no paid retries ran. Both returned
  1536x2752 JPEGs. Private originals, prompts, input hashes and provider receipts
  are in ignored `outputs/hook-prompt-ab-2026-10-22/`.
- Visual review does not show v3 improving the requested identity in this pair.
  Both preserve the scene and remove captions; v3 remains strongly source-like,
  while v2 has more visible brow/skin changes. Neither is qualified as a convincing
  match. This single pair is not a reliability estimate. Do not deploy v3 as a
  proven fidelity fix. Deployment remains paused.

- Following the user's four-variation failure report, new starting-image requests
  explicitly recreate the primary shot with the selected influencer as the
  performer. Image 1 defines scene, framing, pose, expression, clothing, hands
  and occlusions; Image 2 defines facial identity. Scene preservation must not
  preserve the original performer's face. Supporting photos supply identity only.
- Prompt v3 and its adjacent provider image labels use the same recreation
  instruction. Receipt/draft schema stays v2; prompt version independently binds
  this change. Existing v1/v2 prompts, image labels, request recovery and saved
  output approval remain supported without resubmitting accepted work.
- This remains an unqualified prompt hypothesis, not a demonstrated fidelity
  fix. The subsequent test above did not establish improvement; no production
  deployment has run.
- Local validation passed: application typecheck, worker build, focused prompt,
  API, provider-input, approval/recovery and workspace interaction tests. These
  checks verify request handling; they do not measure generated facial fidelity.

## 2026-10-22 Completed slideshow recreation opens Your Slides (local)

- When a user recreates a complete single-version slideshow (two or more
  slides), resolve every owned result, preserve provider slide order, assemble
  them in the current editor, and return directly to Create → Your Slides. Do
  not require one Add to slideshow action for each finished slide.
- A just-completed slideshow supersedes the current visible sequence, even when
  that older draft is still restoring. Archive the older sequence for explicit
  recovery; do not show its slides beside or instead of the fresh result. Direct
  navigation to Your Slides continues to show the current draft. An interrupted
  save remains protected and requires an explicit ordered-version choice after
  it is resolved.
- Recreating one selected slide remains a replacement action. Incomplete,
  failed, recovered-history and multi-version batches stay in the generated
  results view so the user can choose a complete version deliberately.
- The shared prompt card beneath a generated slideshow version is bounded to a
  readable width instead of spanning the full results workspace. This is local;
  deployment remains paused.
- Local regressions cover replacement of four old slides with two fresh ones,
  direct-entry draft restoration, delayed restoration, retained draft history
  and interrupted-save protection. The combined three-suite run passed 209
  checks; the follow-up editor run passed 50, including one additional save
  protection case. These are component/service-boundary checks, not deployed
  browser acceptance or paid generation.

## 2026-10-22 Repeated facial-adherence failure: glasses/hand Hook (read-only audit)

- User reports that a previously successful face replacement does not generalize
  to another selected face. The newest two owned outputs were downloaded for
  inspection; both preserve the glasses/hand scene and remove captions, but do
  not convincingly demonstrate the requested facial change. Do not equate a
  completed image job with successful face replacement.
- Confirmed saved jobs `c3c7cad3-1bb3-4356-9ea9-a6fb8f03bf88` (Gemini 3 Pro) and
  `778ab6a8-6c93-49f7-a5f7-a2460462c94e` (Flash) use the same glasses Hook, main
  and supporting asset IDs, prompt v2/hash, three image inputs and empty custom
  instructions. Both provider operations are output_persisted. Switching to Pro
  alone has not resolved this reported case.
- Main/support metadata is 1122x1402, not the small UI thumbnail size. The main
  file is a clear face reference; there is no evidence here that the user supplied
  an unusable photo. Similar supporting poses add limited angle diversity; a
  role/conflicting-source weighting failure is a hypothesis, not proven internal
  model reasoning. Scene glasses, upward gaze and hand occlusion add difficulty.
- The earlier user-described successful request used different person assets AND
  a different Hook scene, so it does not isolate the effect of influencer choice.
  Saved prompt explicitly requests replacement, not just caption removal.
- Existing provider-interaction GETs returned 404 with the configured key. The
  current audit therefore verifies saved app requests and owned outputs, not
  retained provider input bytes or an actual provider model response field. Do
  not conflate this with the separately verified 21 October keyboard incident.
- Follow-up trace: the same main asset appears in eight completed outputs across
  four distinct source frames and several support-photo sets. The 21 October
  keyboard job is one of those runs and retains Gemini's original interaction:
  source scene bytes were first, the main face photo second, support third, and
  the explicit role/preservation prompt was present. Gemini returned a bedroom
  scene derived from the identity photos instead of the supplied keyboard scene.
  This is direct evidence that the general image-editing route does not provide
  stable role precedence between the base scene and identity references. It is
  not a missing prompt, picker-order, thumbnail or upload-delivery defect for
  that recorded request. Current interaction retention is unavailable, so do not
  overstate the old retained receipt as byte-level proof for every later run.
- Direct cross-frame visual comparison then confirmed the user-reported pattern:
  the purple-keyboard Flash run lets the identity reference override the source
  scene; a separate four-variation Pro run with the same main plus two support
  views preserves the Hook performer and scene but does not visibly adopt the
  intended identity; a further Pro Hook and both glasses-frame model attempts
  also fail identity review. All eight jobs have empty custom image instructions.
  This rules out a conflicting user prompt and shows that adding supporting views
  alone is not a reliable correction. Private comparison artifacts are ignored
  under `outputs/hook-reference-compare-2026-10-22/`.
- Recommendation is a bounded same-scene comparison before any more prompt-only
  claims: caption cleanup localized first, then evaluate a dedicated facial edit
  or face-swap stage, preserving occluding hands/glasses. A dedicated engine is
  a candidate, not demonstrated acceptance. Keep output review and explicit Use
  this; no automatic paid retries or hidden provider changes.
- No inference, upload, database mutation, application behavior change, push or
  deployment occurred in this investigation. Evidence and proposed qualification:
  `docs/hook-face-adherence-investigation-2026-10-22.md`. Private photos and local
  receipts stay under ignored `outputs/hook-face-adherence-2026-10-22/`.

## 2026-10-22 Starting-frame animation models, preview size and Schedule footer (local)

- User reported padded selected-frame tiles, a small generated-video preview,
  disabled Omni/WAN model options and Schedule actions overlapping scrolling
  timezone content. Deployment remains paused.
- The selected starting-frame tile follows the verified image's actual ratio,
  bounded to 200px, with no square letterboxing or image crop. Change still opens
  the Starting frames library. The redundant badge over the image is removed.
- The Seedance-only rule is superseded for new approved-frame animation requests.
  Preserve the current supported model on frame selection; allow Omni Flash 1.1,
  Seedance 2.5 and WAN 3.0 subject to their existing availability gates. The API
  and worker both retain owned asset/job provenance and forbid mixed person,
  source-video and audio inputs. App durations are 4–10s for Omni and 4–15s for
  Seedance/WAN. Unsupported qualities/durations adapt when changing models.
- New jobs freeze Gemini for Omni and ReAPI for Seedance/WAN. Omni receives one
  image with `<FIRST_FRAME>` and `image_to_video`; both ReAPI models receive one
  explicit `first_frame`. No fallback changes the paid model/provider route.
  Accepted older jobs retain their provider and request fingerprint. Native
  contract references: https://ai.google.dev/gemini-api/docs/omni and
  https://reapi.ai/docs/wan-3-0 . These docs and local tests do not constitute a
  fresh paid-provider acceptance test.
- Pending and finished video cards share enlarged viewport-based dimensions.
  Their container width determines whether the prompt sits alongside or below;
  prompt and preview no longer use space-between to create a large empty gap.
  Physical laptop diagonal is not detectable; available CSS viewport space is
  the sizing input. Existing play/seek/sound/download actions remain available.
- Schedule actions now scroll normally with the form. Removed the sticky footer
  that exposed underlying content through the form's bottom padding. The action
  keeps the short Schedule post label after confirmation; the Scheduling link
  uses explicit completion state rather than interpreting button text. Recovery,
  repeat intent, confirmation and duplicate-prevention behavior are unchanged.
- Verified the real deployed domain read-only: it still has the older two face
  controls and exposes legacy Use source video after closing Recreate. These are
  production observations, not acceptance of the pending local changes. No
  generation or scheduling submission was made. Local visual verification is
  still pending restored browser access; no fresh screenshot is claimed.
- Local validation: 208 frontend/scheduling checks, 97 source-frame/API/review
  checks, 51 video adapter/worker checks and 12 image-contract/output checks pass
  (368 distinct tests). Application TypeScript, worker build and scoped lint pass.
  No paid generation, production writes, migration, push or deployment.

## 2026-10-22 One face-image chooser (local; deployment paused)

- The starting-frame overlay now uses one square Choose image tile, matching the
  existing Create form. It replaces the separate Choose influencer and Choose
  photos controls. Saved influencer images, uploaded images and UGC Pilot images
  are sources inside that same chooser; library thumbnails stay inside it.
- Selecting a saved influencer verifies the owned image and replaces the main
  face photo. Changing identity clears old supporting views; a failed replacement
  preserves the current selection. Reselecting the same main photo keeps supports.
- The shared rounded model popover replaces the native model menu. Gemini 3 Pro
  remains the default with Gemini 3.1 Flash available. The count is labelled
  Variations, with 1–4 choices. Only the tile is width-bounded; its explanatory
  text uses the available column width. Touch controls keep 44px targets.
- The existing Create picker still exposes Starting frames for recent verified
  outputs (up to 24), preserving the scene-image role rather than face-photo role.
  Hook Recreate continues to open the overlay without attaching a source video;
  video editing controls are absent from this starting-frame path.
- 72 focused UI/history/navigation checks, application TypeScript and scoped lint
  pass. The local server runs at port 8190. Browser security rejected access to
  the local tab, so this revision has no fresh screenshot or visual acceptance.
  Earlier screenshots below are not evidence of this chooser revision. No paid
  generation, database change, push or deployment was performed.

## 2026-10-22 Remove Generated videos shortcuts from clip overviews (local)

- User removed the secondary Generated videos button from Hook's Your videos
  header and asked for the same removal in other workflows. Remove its matching
  Talking Head + Demo overview shortcut too. Keep the Schedule video action,
  References/Your videos navigation, clip editors and generation progress.
- Generation still reveals results when it starts; selecting Your videos
  returns to the clip overview. This request does not remove generated media,
  History, the Generate video submission button or slideshow controls.
- Local change; deployment remains paused.

## 2026-10-22 Hook Recreate flow audit (local; deployment paused)

- Root cause of the reported screenshots: `?preview=1` was explicitly excluded
  from keyframe preparation, so Recreate forwarded the full Hook as a legacy
  source-video edit. Local Hook preview now opens the same recreation overlay
  and suppresses that legacy binding while an approved starting image is absent.
- Removed the attempted preview adapter that substituted catalogue posters and
  an old generated portrait. Anonymous preview now calls a development-only,
  loopback-only source endpoint using the same canonical-source hash verification
  and FFmpeg frame-zero decoder as authenticated preparation. Client validates
  its receipt and downloaded bytes. It never fabricates jobs or generated outputs.
- Anonymous preview is explicitly read-only for generation. Existing influencers,
  new image jobs and animation still require authentication and the configured
  generation release gates. Local preview drafts use a separate identity and
  cannot become owned production requests. The separate e2e layout fixture remains
  labelled as a simulation; it is not evidence of model quality.
- Fresh browser checks on the real `/explore/hook-video?preview=1` page verified
  Recreate, actual 720x1280 source loading for two Hooks, enlargement, compact
  model/image-count controls, closing without a video attachment and retained
  Recreate action/focus. Source PNG was saved with a matching response SHA-256.
  Screenshot: `outputs/hook-recreate-real-source-desktop-2026-10-22.jpg`.
- 295 distinct focused frontend/API/worker checks pass. Application TypeScript,
  worker build, scoped lint and diff whitespace checks pass. These checks verify
  scene/main/support ordering, model routing, variation IDs, approval handoff,
  owned-result checks and no automatic paid retry; they do not prove visual face
  fidelity. No fresh paid image/video generation, push or deployment was performed.

## 2026-10-22 Shared browser font preload optimization (local)

- Root editor/monospace fonts retain their exact files, CSS variables and weights
  with `preload: false`; public pages no longer eagerly request editor faces.
  Rendered editor text still loads the matching fonts on demand. Bundled Explore
  font choices, text layouts, saved drafts and worker rendering are unchanged.
- All six legacy root families load in the production-mode local browser;
  seven font/export regressions and the existing desktop/mobile editor suite
  pass. No deployment, migration or paid generation. Evidence and limits:
  `docs/homepage-cost-optimizations-2026-10-22.md`.

## 2026-10-22 Deployment paused; user-drawn starting-frame flow supersedes tab layout

- User explicitly paused deployment before any source push or worker/website
  release. The separately approved additive migration `20261022092140` had already
  succeeded; leave it in place. Do not apply any other migration or resume release
  without the user's instruction.
- Recreate opens a focused overlay inside the existing Hook page. Remove the
  Starting frame tab from the right-side References/Your videos navigation.
- Overlay top row: original source frame left, compact influencer chooser plus
  model/variation count and Generate right. Generated variations occupy a separate
  row below; each finished image has its own Use this action. Keep regeneration
  available without discarding previous accepted outputs.
- Use this closes the overlay and sets the verified generated image in the
  existing Create / Choose image box as a first-frame input. Changing that box
  opens the image chooser with a Starting frames source showing recent owned
  generated frames. These are approved scene images, not person/support photos;
  retain their source/motion metadata and correct first-frame role.

### Local implementation and verification of the overlay flow

- Recreate now uses `presentation="recreation"` in a modal over the unchanged
  Hook page. References and Your videos are the only right-side navigation tabs.
  Scene/person inputs stay above the result grid; every completed variation has
  its own Use this and enlargement controls. Mobile rows explicitly reset the
  desktop source span. The modal owns scrolling without shrinking its input grid.
- The existing Create image picker displays the approved scene with a Starting
  frame badge and Change action. Its new Starting frames source reads up to 24
  recent verified owned outputs, newest first, then re-verifies the chosen
  asset/job before handoff. It never adds that scene to person/support photos.
- The development-only `?preview=1` Hook route follows the same starting-frame
  branch as the authenticated workflow. It no longer auto-attaches the full
  reference clip as `Use source video / Edit source video`; that legacy video
  edit control is reserved for explicit non-keyframe editing. The source-only
  local adapter decodes the selected canonical video; it never substitutes a
  poster or presents an existing output as a new generation. It never calls a
  provider, spends credits or changes production data.
- Reuse restores the matching Hook source and current reviewed motion directions
  (sound off); a missing/changed source, unavailable output or unresolved motion
  review cannot silently enter animation. Selecting ordinary photos explicitly
  exits starting-frame mode after successful admission; failed replacement leaves
  the approved image intact. No new database schema or paid call is needed.
- Local checks: 166 distinct focused tests pass, application TypeScript passes,
  scoped lint passes and diff whitespace checks pass. The 165-test combined run
  was followed by 32 targeted checks including the new navigation regression.
  These cover per-card handoff, owner scoping, failed/late reads, request binding,
  source reassignment and legacy upload/video behavior.
- The earlier overlay revision lacked fresh browser acceptance because browser
  access was restricted. The later flow audit above records fresh local browser
  checks; authenticated model-generation acceptance is still separate and pending.
- Deployment remains paused. No commit, push, website/worker release, migration
  or paid generation was performed during this overlay refinement. The earlier
  approved additive production migration remains in place.

## 2026-10-22 Approved Hook workspace / named slideshow release (in progress)

- User authorized push/deployment of the complete current intentional worktree
  and separately approved the additive slideshow-plan database migration.
- Production migration succeeded as ledger version `20261022092140`; canonical
  filename was aligned. Private grants/RLS were verified. Previously deferred
  recovery-billing and content-mix migrations remain unapplied. Historical ledger
  drift is recorded separately; do not claim complete migration-history parity.
- Release order is database, exact-commit image worker, website/MCP, then hosted
  checks. Latest layout visual acceptance remains pending browser access; do not
  reuse older screenshots as evidence. Detailed receipt:
  `docs/hook-workspace-slideshow-release-2026-10-22.md`.

## 2026-10-22 Starting-frame sizing and element placement review (local, visual review pending)

- User rejected the overall scale/placement even after the compact chooser: source
  and result ran below the laptop viewport, the selected face was too small and
  generation controls were buried. Do not treat the earlier overflow-only checks
  as visual acceptance of the composition. Screenshots 01–16 show prior revisions.
- Rebalance the complete focused view: bounded equal-height scene/result previews
  preserve their original aspect ratios and enlargement; selected face photos use
  96×120px previews instead of 56×68px thumbnails. One Choose influencer box opens
  the photo grid. Keep supporting photos and Change photos with the selected face.
- Put model, image count, price and Generate together in a bottom image-action bar.
  Keep generated variation choices before Use as starting frame. Back and heading
  share one desktop row. Instructions stay collapsed; audio/duration remain in the
  later video form. The main workspace auto-saves, so omit its redundant manual
  Save preparation button. Retain accepted-request recovery and inline errors.
- A completed result already visible must not automatically scroll the header out
  of view. Scroll only when review is outside the visible area, accounting for the
  action bar; reserve scroll padding so keyboard targets can clear that bar.
- Browser security rejected access to the local preview in this revision. Do not
  bypass that rejection or reuse the older screenshots as current evidence. The
  local server was restarted on port 8190 for the user's direct review; an app
  browser-panel open was queued. Fresh visual acceptance remains pending. No paid
  generation, database change, push or deployment in this refinement.
- Local code validation: 147 focused checks, application TypeScript and scoped
  lint pass. These checks do not certify the revised layout's visual quality.

## 2026-10-22 Hook saved-face picker and focused starting-frame view (local)

- User again found the preparation compressed on a laptop. Recreate now opens
  Starting frame inside the main Hook workspace, alongside References and Your
  videos, with the left composer hidden but mounted during preparation. The
  focused stage spans the available width and owns vertical scrolling. Keep the
  existing composer portal targets/drafts mounted; do not replace this with a
  new sidebar category or stack another narrow modal over the two-pane screen.
- Saved influencers load when preparation is restored, not only on History.
  User rejected the inline recent-photo row: show one compact Choose influencer
  box that opens the paginated image grid. Never display the whole influencer
  library on the preparation screen. Only selected main/supporting photos appear
  there. Keep the image picker separate from the builder's prompt-heavy history.
  Selecting a saved photo validates its owned ready asset and replaces the main
  person selection, clearing supports from the previous identity. A failed
  selection retains the current photos and shows an actionable error.
  Reselecting the current main photo is a no-op and retains its supporting views.
- Hook Recreate is a repeatable action: retain its rotate icon after selection
  and Back. The orange card border can indicate context; do not substitute a tick
  or toggle semantics for the action. Back retains local preparation/accepted
  request identities and restores focus to that card's Recreate control.
- Opening/cancelling gallery-based starting-frame preparation must not forward
  the legacy source-video edit binding or URL reference prompt. Until an image is
  approved, the composer offers Create starting frame/Clear reference and blocks
  new video submissions. Existing accepted-request recovery still uses its frozen
  request. Prompt-only/image-plus-prompt and intentional manual-video editing
  outside this gallery intent retain their normal behavior. Only approval hands
  the selected starting image and animation instructions to the video composer.
- Browser access was subsequently enabled. Fresh local checks use the actual
  components and shared production layout classes with a free mock adapter,
  including laptop/short-window/mobile selection, enlargement, Back/Recreate,
  retained variations and approved-image handoff. The shared shell exposed a
  mobile minimum-height/absolute-helper overflow recurrence: bound the focused
  grid row and main pane, and position the scrolling stage so hidden helper text
  cannot enlarge the document. Do not infer model fidelity from fixture portraits.
- 140 focused offline checks, application types and scoped lint pass (one existing
  VideoPanel image warning). These changes remain local, uncommitted and
  undeployed; no authenticated production acceptance, paid generation or database
  migration is part of these checks. See
  `docs/hook-starting-frame-workspace-2026-10-22.md` for the current UI receipt.
- Compact-chooser follow-up: 31 focused checks and scoped lint pass. Fresh local
  browser checks at 1366×768 and 390×844 confirm one 194×42px launcher, zero inline
  library thumbnails, working dialog selection and no horizontal/page overflow.
  Screenshot 15 replaces screenshot 12 as the current laptop review image.

## 2026-10-22 Named slideshow inputs and scoped execution plans (local)

- Keep the existing input bar. Selected images carry their original Source slide
  number and stable reference/slide IDs; owned uploads receive Upload A/B/etc.
  Names persist with the owner/source-scoped composer, including removed-name
  tombstones, so deleting Upload A does not rename Upload B. Current slide is the
  existing accepted result being edited. No per-image forms were introduced.
- New UI requests carry a named manifest. Server verifies catalogue identities,
  canonical URLs and upload ownership, then makes one image-aware structured
  planning call per explicit Generate. Private durable plan receipts fence lost
  responses, account isolation and conflicts; uncertain requests do not repeat
  planning automatically. This included planning has its own 200/day abuse bound,
  separate from the optional 20/day text-rewrite quota. Image credits are reserved
  only after the plan has valid destinations and no unresolved clarifications.
- Each v4 image job freezes its original request for history plus a scoped plan,
  base-first provider URLs, stable labels and semantic attachment roles. Only the
  target base and assigned uploads reach that output. Original slide 4 can be
  output 2 without becoming Source slide 2. Plans participate in provider fences.
  Already admitted v2/v3 jobs retain their prior prompts, ordering and recovery.
- This implements assignment/execution boundaries, not an exact screenshot
  compositor or a persistent conversational assistant. The optional sparkle
  rewrite remains text-only. Provider/stub checks establish transport and scope;
  actual model fidelity still needs a hosted visual acceptance run.
- Deployment requires migration `20261022092140`, the v4-aware generation worker
  first, then the website. This change has not applied the migration, deployed,
  or submitted paid model requests. See `docs/slideshow-named-plans-2026-10-22.md`.
- Local acceptance: 293 distinct automated checks, three real-component browser
  suites, types/lint, worker build and production build/postbuild passed. The
  browser recurrence where Recreate cleared uploads within the same source set
  is repaired; source order is canonicalized for that draft scope. Original
  Remix provenance is inherited from the accepted owned result's server job.

## 2026-10-22 Two relationship Wall of Text references removed (local)

- User identified two cards in a screenshot: `explore-wall-text-08` (“no man is
  perfect…”) and `explore-wall-text-09` (“I'll forever be a ‘you should've just
  told me’ type of person…”). Remove exactly these entries from the shared direct
  Wall library, covering Recreate, format galleries, legacy list/preview, valid
  source IDs and future import assets. Keep all remaining IDs and ordering.
- Version catalogue query keys so previously cached lists do not retain the two
  cards after the updated code loads. Keep source media and historical reviewed
  transcripts; this is removal from references, not deletion of user creations
  or cloud objects. Production acceptance requires release of this local change.
- Frontend additionally suppresses retired IDs from cached/preview/API catalogue
  data before gallery rendering, category metadata or URL-based selection. The
  legacy Wall observer also removes retired items and replaces a retired preview
  with the first available video. This covers an older response during rollout.

## 2026-10-22 Combined release authorization and acceptance

- The user has now explicitly authorized checking and deploying all intentional
  current changes. This supersedes the earlier local-only deployment pause.
  Production database changes and paid AI generation remain outside this release.
- Release the model-aware starting-image contract on the AI generation worker
  before promoting the website that submits it. Verify the active worker's baked
  and runtime commit identity; a local build is not worker deployment evidence.
- Include the concurrent connected-account photo fixes and performance/marketing
  work after their combined checks. Keep the 60 unpublished slideshow images
  staged only: their previously rejected public upload is still deferred.
- Vercel source packaging must exclude local worktrees, diagnostics, credentials
  and prototypes. A dry-run source manifest shrank from 2.33 GB to 266 MB after
  correcting `.vercelignore`; this is source transfer, not measured runtime
  savings. The current budget audit found approximately $0.23 infrastructure
  usage with $19.77 included credit remaining. Do not infer that the previous
  HTTP 402 was caused by exhausted credit.
- Fresh local UI verification and final deployed acceptance are recorded in the
  release receipt. Historical entries below describe checks and pauses at the
  time they were written; they do not establish current production acceptance.

## 2026-10-22 Approved slideshow mappings and source actions (local)

- User confirmed all mappings in the supplied D: slideshow folder are good to
  go. Retain repeated URLs, creator-profile destinations and existing categories
  as approved; no further mapping confirmation is needed. Preserve the three
  older catalogue sets absent from that folder.
- 38 mappings now supply source links to slideshow cards in both galleries and
  the full preview. Labels distinguish Original post and Creator profile; clicks
  open separately without selecting/previewing/recreating. Existing verified
  Starter/Growth entitlement applies, with the same free upgrade flow. Hook
  remains post-only; Wall has no source action.
- Separate staged additions contain 13 new sets / 60 original images. Existing
  59 sets / 332 positions stay unchanged. Development preview merges 72 sets /
  392 positions; staged IDs remain unavailable to authenticated generation lookup.
  Missing old references are retained and new category titles continue numbering.
- 86 local checks, application types, scoped lint and real-component browser
  coverage pass, including all 38 destination clicks, preview/Recreate separation,
  free/Pro, keyboard and 1366/1280/390px layouts. External navigation is intercepted
  in that fixture. New-source reviewed Remix transcripts remain a distinct gap.
- No deployment or successful cloud upload. Production is still HTTP 402
  Deployment Paused. Automatic approval review rejected the 60-image / 11,811,439
  byte transfer to public `ugcsaas-media/explore/recreate/v1/` pending explicit
  payload/destination approval. Do not bypass that rejection; local staging keeps
  unpublished media out of the live catalogue. See
  `docs/slideshow-source-links-2026-10-22.md` for receipt and next steps.

## 2026-10-22 Starting-image variations and image-only popup (local)

- The next approved UI refinement orders generated image → variation choices →
  approval, adds click/keyboard enlargement for both scene/result previews and
  tightens their comparison columns without changing image pixels or proportions.
  Rename Your person to Face reference. Its opt-in compact strip shows the main
  photo and all supporting views, with Change photos opening the existing editor.
  Other callers retain the standard reference tile. Enlargement is read-only and
  must not approve an image, submit generation or dismiss the preparation.
- Latest refinement: 60 focused checks and scoped lint pass. Fresh browser visual
  verification is pending because the browser-control runtime fails before any
  page action (cannot write kernel assets). Do not reuse older screenshots as
  evidence of these latest changes or claim them visually verified/deployed.

- The user explicitly removed video settings from Create your starting frame.
  This popup contains source/person photos, optional image instructions, a compact
  model choice and 1–4 image count. Video duration, motion editing and sound stay
  in the existing video composer after Use as starting frame. Preserve saved
  motion/audio preferences in the handoff; new preparations still default silent.
- Show total image credits before the explicit Generate action. Each variation
  uses the same frozen scene/person/model inputs and its own idempotency key.
  Submit requests sequentially, stopping on rejected or uncertain admission;
  closing stops only requests not yet submitted. Never resume planned requests
  or retry a paid POST automatically on reopen or status refresh.
- Keep each accepted result selectable in a compact thumbnail strip. Verify each
  completed job and its exact input receipt before handing off only the chosen
  image. Retain up to 12 recent choices locally without evicting pending requests
  or the selected result. Older completed assets remain in the owned library.
  Legacy single-image recovery records remain readable. Use one Web Lock and
  persisted revision checks to prevent competing tabs from submitting stale work.
- Reduce the approval button to its text width and the image model control to
  a small selector. Local preview uses labelled sample images and no inference.
  Deployment remains paused; no paid generation or production DB change is part
  of this work. Offline/browser checks do not establish face or scene fidelity.

## 2026-10-22 Expanded Content/Demo, Analytics and Scheduling loading audit (local)

- Continue the idle/upload recurrence audit through the current Demo inventory,
  Analytics and Scheduling. Current Demo is `/library?tab=posts`; historical
  Content/uploaded-post terminology shares its `UploadedPostsTab` inventory.
- Demo transfers use two shared slots and one settled-queue list read. Release
  transferred Files/decoders/handlers; retain a small completion receipt for
  explicit retry of the same object. Never delete an uncertain accepted upload.
  Failed-transfer cleanup must finish before Retry is exposed. Partial bulk
  deletion retains failed rows, selection and visible error.
- Bound/cancel owner-scoped Demo/source/job reads through auth, fetch and parsing.
  Stale pending jobs reconcile on return; terminal jobs stay stopped. Gallery
  hover videos release their sources on leave/click/hide/offscreen/unmount.
  Shared foreground refresh also suspends offline reads.
- Analytics revalidates stale saved snapshots on return and uses latest job
  status for polling eligibility. Scheduling pauses hidden/offline reads, keeps
  warm calendar/editor content and reconciles media/accounts on return. Fresh
  publishing access, selected IDs, draft state and submit validation remain.
- Production remains deliberately paused. Local fixture checks cannot establish
  hosted latency or a real 30-minute heap soak. Evidence and remaining acceptance:
  `docs/app-loading-audit-2026-10-22.md`.

## 2026-10-22 Upload, library and idle-tab performance recurrence (local)

- User again reports slow uploads, library selection, editing and returning
  after about 30 minutes. Production Explore currently shows the paused-hosting
  page, so local checks are not production acceptance or a measured memory cause.
- Manage library uses two concurrent transfers, ordered results, failed-file-only
  retry and one successful-batch membership write. Mutation completion releases
  its lock before background list reads; a failed refresh retains cached tiles.
- Shared library Apply uses bounded owner-scoped batch admission. Preserve
  generated-image/Remix provenance, original-source URLs, atomic draft changes,
  slide/text identities and saved-output invalidation.
- Stale image queries revalidate on return. Reads bound authentication/network/
  parsing and reject late cancelled requests. Existing one-hour account cache
  retention/isolation remains. Explore filmstrip thumbnails use the public
  optimizer; main preview and export keep original dimensions/pixels.
- Explore finishing/schedule preparation and Trending edit-status polls pause
  while hidden/offline, then resume without overlap or interval catch-up. Only
  reads resume; jobs continue server-side. Real 30-minute heap profiling remains
  pending. Website-only correction; deployment pause is preserved.
- Evidence and acceptance: `docs/ui-performance-2026-10-22.md`. 164 focused checks,
  the actual-component desktop/mobile library suite, types and lint pass. One of
  40 broader checks has a verified pre-existing source-assertion failure.

## 2026-10-22 Local starting-image models and edge normalization

- Deployment is paused at the user's explicit request. Continue local checks;
  do not promote the new website/worker contract or run a paid test implicitly.
- Add a compact image-model selector beside the image price. New preparations
  default to Gemini 3 Pro Image; Gemini 3.1 Flash Image is the alternative. Bind
  both choices to explicit provider model IDs. Do not let a general environment
  override silently replace the selected Hook model. Model changes invalidate
  approval of the previous result, retain photos and update the free price quote.
- New model-aware drafts/receipts use version 2. Pro accepts up to five identity
  photos and Flash four, plus the separate scene frame. Block a new request over
  that limit before credits; do not drop photos when switching. Accepted legacy
  Flash requests and their original fingerprints remain recoverable. Any new
  request from an old draft upgrades explicitly; missing-model requests may only
  replay an already saved legacy job.
- The reported white side strips were real output pixels introduced by our white
  contain-fit normalization: raw 768 × 1376 became 720 × 1280 with three white
  columns on each side. Only new model-aware Hook outputs opt into centered,
  uniform cover fitting when the required crop is at most 1% of either extent.
  This case trims five output pixels from top and bottom, preserving proportions.
  Larger mismatches retain the legacy fit. Never crop the source video or input
  portraits, or rewrite existing accepted media, as part of this correction.
- These changes fix input declarations and deterministic padding. Gemini's actual
  scene/face preservation remains visually unqualified until an approved test.

## 2026-10-21 Starting-frame layout and scene-preservation recurrence

- The user rejected the deployed preparation dialog: landscape-sized containers
  around portrait media created black gutters, source and result were separated
  vertically, and the fixed recovery footer consumed useful screen space. Keep
  portrait previews at their actual aspect ratio; compare source and result beside
  each other. Put actions next to the person controls, with optional instructions
  collapsed. Remove the large recovery-status container, while preserving the
  underlying saved request and duplicate-submission protections.
- Verify the actual UI at the user's short laptop viewport (1020 × 594) and a
  narrow mobile viewport before accepting a layout correction. A successful build
  or a larger desktop screenshot does not establish usable spacing or controls.
- Read-only audit of job 808b8505-90e7-4adb-9654-fa5918a22125 recovered the existing
  Google interaction. It contains the correct keyboard scene, main portrait and
  support photo in order, with the exact scene-preservation prompt. The raw
  gemini-3.1-flash-image output already contains the portrait's bedroom/clothing;
  the displayed result is its exact resized derivative. This is a model scene-
  preservation failure, not a missing reference, UI fallback or resizing error.
- Stronger per-image roles and source integrity validation are input-contract
  improvements. Offline tests cannot prove that the model will now preserve the
  scene or facial proportions. Do not call visual quality solved without a new
  explicitly approved visual test. No automatic paid retry or database migration
  is part of this investigation. Current corrections are local until released.

## 2026-10-21 Hosted first-frame decoder packaging

- PR #79 reached production and Recreate opens the new preparation dialog.
  Its authenticated free frame extraction failed with decoder-unavailable while
  paid generation remained disabled; no inference or credit charge was submitted.
  The hosted Linux prebuild had successfully run FFmpeg, so that alone did not
  establish executable resolution inside the deployed function.
- The Hook route trace contained the binary but not ffmpeg-static's native
  module. Replace createRequire-based loading with a static package import and
  explicitly externalize ffmpeg-static in Next configuration. Trace the native
  module, package metadata and platform binary for both source extraction and
  image admission; test the real hosted extraction again before claiming success.
- The generation/render worker image is unchanged by this website packaging
  correction. Keep its verified e9fc8fac source/image identity; no database or
  paid provider action is part of the repair.

## 2026-10-21 Complete bundled emoji rendering for Hook/shared video overlays

- User requested resolving the remaining emoji cases and questioned whether the
  Remix copy step was wrong. Verified AI output → Add to hook → JSON draft uses
  unchanged Unicode. Copying was already correct; drawing text into MP4 frames
  depended on different OS fonts. Do not change the Remix prompt, its contextual
  emoji policy, business personalization, credits or accepted request identities.
- Replace general video-overlay emoji font fallback with a pinned, local Twemoji
  17.0.3 vector pack, used by BOTH the React overlay preview and worker PNG/MP4.
  It resolves all 3,944 fully-qualified Emoji 17 RGI sequences and their official
  qualification variants. All 4,009 bundled graphics actually rasterize. Keep
  previously approved red cross/arrow and green check artwork/Unicode selectors.
- Native textareas remain ordinary editable Unicode; their OS emoji appearance
  is distinct from the authoritative composited preview/export. Do not introduce
  emoji token markup, another AI step, per-emoji controls or a changed user flow.
  Whole graphemes include skin tones, flags, keycaps and joined sequences.
- Public preview assets have bounded manifest IDs and version+content-hash URLs;
  serve only bundled SVG with immutable caching. Root trace includes the compressed
  pack; worker Docker already copies assets/. Export embeds exact artwork bytes,
  verifies the pack hash, needs no font/CDN/network call and fails on missing data.
  Preserve Twemoji/Unicode licenses; emoji exports carry attribution metadata.
- Unsupported emoji-like sequences/reserved future pictographs have a clear
  validation error before new render reservation and in the editor/export. Do
  not silently split, replace, remove or accept a broken font fallback. Existing
  saved text and accepted receipts remain readable/recoverable; no global hash
  bump, automatic regeneration or modification of old/scheduled MP4s.
- Actual local MP4 tests cover broad emoji, old/new fonts and presets, draft
  recovery, final Hook/demo composition, colors, attribution and source integrity.
  Laptop/mobile browser previews load all sample artwork and preserve save/reopen.
  This also applies to Wall/demo callers of the shared video overlay. Slideshow
  added-text, Trending and speech subtitles remain separate scope; do not claim
  this implementation fixed their general emoji paths.
- Release now needs the updated website/preview-asset endpoint AND both render
  targets. The other chat has explicit user authorization to include this task's
  work; avoid a competing deployment. Local checks and production acceptance
  remain distinct. Details: `docs/hook-emoji-rendering-2026-10-21.md`.

## 2026-10-21 Hook Remix emoji recurrence: production renderer release gap

- User asked whether ALL emojis are now correct. A fresh live service/job read
  still shows the old active revision/digest below; rollout remains pending.
  Expanded local actual-MP4 inspection of 16 samples finds the four explicit
  cross/check marks colored, while the 12 font-fallback samples (faces, fire,
  rocket, heart, skin tone, person ZWJ, flag, keycap, hundred, sparkle, party)
  are monochrome; flag/person sequences also look wrong. This is Windows
  fallback evidence, NOT proof of the Linux production font output. Docker's
  Linux daemon is unavailable, so same-container coverage remains unverified.
  Preserve the targeted symbol fix, but do not call it an all-emoji fix. Full
  coverage requires a separate bounded emoji-support contract and actual
  glyph/color/sequence verification, not merely checking Unicode in SVG.
  Evidence: `.tmp/hook-emoji-coverage-20261021/coverage.json` and
  `local-mp4-emoji-sample.png` in the same directory.
- The user again reports white cross/tick glyphs in remixed Hook text. Fresh
  production reads confirm the active `ugc-video-render-worker` revision is
  `ugc-video-render-worker-hookfix2-fac61da3` at 100% traffic, pinned digest
  `96afdde1f42c980281c3b68182ad91874c41c997d9d20219bd472f8d0f15a36d`.
  `ugc-video-render-job` uses the same old digest. The service template contains
  a newer image, but that is NOT evidence of the active traffic's code.
- `fac61da3` lacks `explore-inline-symbols.ts`; its outlined glyphs inherit white
  caption fill. The symbol fix was committed later in `c3bedc52`. Public production
  Hook JavaScript already contains the colored-symbol preview implementation.
  Shipping website code alone did not fix final exported MP4s.
- Locally reconstructed the three relevant renderer modules from the active
  source revision. The user's exact caption reproduces zero red/green pixels;
  corrected code produces red cross/green tick in decoded MP4 frames. This is
  a source reconstruction, not a new production render or paid generation.
- Added an actual-media regression through `applyVideoTextRemix`, serialized
  draft recovery, clip export and final Hook/demo composition. All four supported
  cross/check pairs retain Unicode/colors and disappear before the demo. Existing
  related 35 checks, worker build and scoped lint pass (36 checks with the new
  regression). No new runtime fix was needed beyond the already committed artwork.
- Release scope can be the four symbol/render modules on the active worker base,
  deployed to BOTH render service and batch job; no website or migration change
  is required for this symptom. Preserve existing accepted fingerprints/receipts:
  old immutable MP4s need an explicit fresh export from the editable source and
  existing remix, not another paid Remix/generation request. Do not globally bump
  finishing fingerprints and invalidate recovery to force a new render.
- Live browser redirects to sign-in; authenticated workflow acceptance remains
  pending. No deployment or production media mutation in this investigation.
  Details and reviewed release patch: `docs/hook-remix-emoji-production-gap-2026-10-21.md`.

## 2026-10-21 Starting-frame handoff and local browser verification

- Connected the dedicated owned image-generation job to result inspection and
  Use as starting frame. It returns to the existing Hook video composer with a
  Starting frame badge, source-bound motion directions and duration, and sound
  OFF by default. Only Generate video submits animation; using an image does
  not submit it. Original video/person/audio references are cleared from this
  animation path. ReAPI receives image_with_roles with role first_frame,
  adaptive size and a fixed duration; incompatible inputs/models fail before
  credit reservation. This does not prove generated facial fidelity.
- Image preparation uses canonical decoded frame zero followed by main person
  photo and supporting views. Actual owned photo object headers are checked
  before credits: 25 MiB per photo, 50 MiB combined including source PNG. Result
  admission validates the completed owner job, exact receipt and generated
  asset/dimensions. Uncertain requests recover by GET, not automatic resubmission.
- Local desktop and mobile browser walkthroughs used actual components with a
  development-only, nonspending result fixture. Fixed source-image URL cleanup,
  opening focus/scroll, mobile header/footer clipping and misleading completed
  primary action. Photo guide remains in the existing chooser popup. Screenshots
  and limitations: docs/hook-keyframe-ui-review-2026-10-21.md. These are local
  UI checks, not production or model-quality acceptance.
- Production enablement still requires matching website/worker releases. No
  database change or new paid generation is part of these checks.

## 2026-10-21 Clarified generated-frame handoff

- The user explicitly wants Generate starting image, a visible generated-image
  preview, and a button named Use as starting frame. That button returns the
  owned generated full-scene image to the existing video form's image box,
  labelled Starting frame. The existing Generate video button is the separate
  intentional video-generation action. A second standalone Animate screen is
  unnecessary for this handoff and is superseded by this clarification.
- Starting frame is a provider input role, not a promise made by the label or
  prompt alone. Admission must validate its completed image-job provenance and
  owner, reject incompatible models before billing, and freeze the first-frame
  role in the provider request. Do not silently send it as a general appearance
  reference. The original Hook video and person photos are used only to prepare
  the still; they must not accompany the animation request.
- Preserve the editable Hook motion directions, source-bound duration (Hook 15:
  eight seconds) and sound OFF default in the handoff. Image and video creation
  have separate visible credit estimates and deliberate actions. No inference
  is triggered by choosing or approving a generated frame.
- Local integration is in progress. Existing normal image/prompt-only Generate,
  Wall of Text and accepted provider operations keep their existing contracts.
  Do not enable the new production entry until this handoff is connected and
  verified. Deployment approval is recorded; no new paid test is authorized.

## 2026-10-21 Hook 15 duration and preparation UI code review

- The user requested an eight-second Hook 15 prompt after accepting the reviewed
  direction. Rechecked all 258 canonical frames: source is 8.634 seconds, with
  its deliberate take change at frame 170. The new preview preserves both
  chest-touch/open-palm cycles, one clean cut and the calm ending. The ID+SHA
  rewrite now declares eight seconds; preview, visible duration and review page
  use that value. Other variants still default to four seconds. Static review
  totals are now 88 reviewed / 10 decision records; this does not qualify output.
- A code-only UI pass found and fixed two state bugs: valid accepted photos can
  be saved after a partial upload warning, and dismissal remains responsive
  during uploads/influencer lookups. Closing invalidates late lookup responses
  and aborts the read. Child upload cleanup already invalidates its callbacks.
  Existing owned-photo validation and upload-pending save blocking remain.
- Header and step navigation no longer shrink into the scrollable content;
  prompt helper text uses the existing muted-foreground token. These are source
  corrections, not screenshot-based responsive or accessibility acceptance.
- Critical release gap: preparation still ends at Save preparation. Image
  generation, explicit image approval and animation handoff are unimplemented.
  Closing can return to the legacy video form; it must not be described as using
  the saved starting frame. Keep the new entry gate OFF for production until
  the handoff is implemented, or the user explicitly chooses a labelled preview.
- Deployment is authorized, but the desired release of the incomplete step is
  awaiting clarification. Browser use remains disabled after a fresh inventory;
  no current UI screenshot or authenticated production acceptance was obtained.
  No paid generation or production database mutation is authorized by this review.

## 2026-10-21 Slideshow recreation recurrence and conversation design

- Fresh owner-scoped production review finds the latest stored Explore slideshow
  batch `6506f728-4364-4533-a69b-c4e03b53e265` (16 October, 20:45 IST) uses v3
  Flare, but has no attachment despite requesting the provided screen image.
  Both actual outputs use the laptop scene, including the cover slot. Earlier
  v3 Sunburst batch `09e14462-478d-4a58-af80-d04a2cef4847` includes the screenshot
  but still invents a light website. Do not treat reference delivery, v3 wording
  or technical completion as visual acceptance.
- Current local missing-screen preflight rejects that latest historical prompt.
  A further reproduced bypass occurred when unrelated `do not`/`without` wording
  appeared in the same sentence as a positive screen-placement request. Local
  correction now scopes negation to the matching placement action. Client/API
  share it; regression checks confirm no billing/queueing without the attachment.
  This remains an English heuristic, not validated attachment-role understanding.
- The user revisits a chat-based creation experience. Recommended direction:
  one image-aware conversation maintaining a validated, revisioned plan, with
  per-slide source identities/changes/preservation constraints. This is proposed,
  not a replacement for the currently implemented one-box rewrite. Do not add
  separate per-image forms or claim the existing text-only star sees references.
- Precise screenshot/logo placement needs actual-asset compositing and screen
  geometry; exact text needs editable layers. Compile only each slide's relevant
  inputs/instructions for generative edits. Preserve v2/v3 retry fingerprints
  through a new versioned contract. No planner/compositor/chat feature was built
  by this investigation; those gaps remain open.
- 71 distinct local checks, worker build, application types and the updated
  real-component browser fixture pass. Scoped lint: zero errors, two pre-existing
  fixture warnings. Stored outputs were visually checked; no new paid generation
  or production writes/deployment. Production browser redirects to sign-in, so
  final authenticated acceptance and fresh quality A/B remain pending.
  See `docs/slideshow-workflow-recreation-audit-2026-10-21.md`.

## 2026-10-21 Hook motion rewrite and prompt auto-fill: second local increment

- User authorized agents to adapt all98 source-video prompts for the new
  starting-image flow. Reused prior all-decoded observations, then verified all
  98 canonical local video SHA-256/frame counts and visually rechecked sampled
  sequences including frame0 and ending. Complex hand/prop/cut cases received
  additional all-decoded contact-sheet inspection. Do not claim this pass
  independently viewed every frame of every clip, or tested generated output.
- All98 now have separately authored opening/action/camera/ending/continuity
  plans in `hook-keyframe-motion-plans-a/b/c.json`. An independent prose and
  visual spot review corrected already-started actions and flagged additional
  hidden glasses placement. Final static state:87 sequence-reviewed four-second
  adaptations,11 decision cases (Hooks15/19/22/28/39/51/57/64/72/83/84).
  Bind by ID+SHA; display titles remain nonunique and historic ordinals differ.
- The preparation screen auto-fills these action directions separately from
  image instructions. Users can edit and restore them; edits and sound choice
  persist in the owner/draft/source scope. Older drafts default to the suggestion.
  Sound starts OFF and controls the full animation-prompt preview. Four seconds
  is an adaptation; the original source's exact timing is not promised.
- Image-stage instructions still bind scene Image1, main face Image2 and other
  views afterward. Animation receives its approved image and explicit directions,
  without source-video roles, portraits or a second face-swap command. The legacy
  direct-video prompt helper remains untouched; these rewrites apply only to the
  new gated preparation flow, not existing jobs or Wall/ordinary Generate paths.
- Static source review and a displayed prompt preview are distinct from paid
  admission. All98 legacy motion catalog entries remain blocked from animation
  submission while image generation/approval and backend admission are pending.
  A custom direction edit cannot reuse the old motion-readiness receipt, and
  changing motion/sound does not invalidate a correctly approved still image.
- Review artifact: `outputs/hook-motion-rewrite-2026-10-21/index.html`, generated
  by `scripts/build-hook-motion-review.mjs`. It rehashes all98 canonical sources,
  shows source videos/frame evidence beside adapted prompts and defaults to the
  11 decision cases. It contains source footage, never a generated-result claim.
- No paid generation, uploads, production DB changes, commits, pushes or
  deployment. Feature gate remains off. Browser visual acceptance remains
  pending: tool inventory now works but local browser use is disabled in Work.
- Verification:216 targeted checks plus the loopback review-server check pass;
  targeted lint and final Next webpack build including TypeScript pass. Review
  receipts record4,276 inspected frame indices /9,751 decoded frames, including
  complete contact-sheet inspection of32 complex videos. The read-only helper
  at `http://127.0.0.1:8188/` allows only review page/videos/sheets, with working
  byte ranges and no arbitrary project file access or writes. Its HTTP response
  is verified; opening a Codex preview is not browser visual acceptance.

## 2026-10-21 Hook starting-frame preparation: first local increment

- User authorized incremental implementation and parallel prompt review, with
  clarity before advancing. Hook only; starting image first, ending frames
  deferred. No new paid test, production database mutation or deployment.
- Added default-off `ENABLE_HOOK_STARTING_FRAME_PREPARATION` gate on the Hook page
  and authenticated extraction endpoint. When opted in, Hook Recreate opens an
  internal free preparation preview and preserves owner/draft/reference scope.
  The current Generate path, Wall and Slideshows remain available as before.
- Extract actual frame zero from active canonical release video, verify SHA-256,
  preserve full display dimensions, bound download/decode/cache and verify the
  returned PNG receipt in browser. Never use the poster or stale preview. No
  object upload or media/database row is created for this extraction increment.
- Reuse existing owned influencer history (ready `image` OR `influencer` media),
  Explore-only reference uploads and main/supporting picker/photo guide. Builder
  opens in another tab so the preparation remains. Selecting a new influencer
  clears the previous person's support images. This preview cap is five person
  photos; existing model reference capacities are unchanged.
- Browser checkpoint persists IDs/hashes/instructions, never signed URLs or
  blobs. Resolve ownership on restore. Source/photo/instruction changes invalidate
  generated/approved image bindings. Output existence alone is not approval;
  a face portrait itself is not a generated full-scene keyframe. Sound OFF default.
- Added separate image-role compiler and 98-entry motion review inventory keyed
  by canonical ID+SHA, rather than converting legacy video prompts in place.
  All 98 still require motion review; six authored plans are review drafts only.
  No paid animation route uses these drafts. Current numbered exceptions are
  Hook19 window reveal, Hook15 two takes, Hook51 jump cut; display title Hook46
  is duplicated. Older conversation numbers must not determine asset mutations.
- This first increment ends at Save preparation. Image API/worker integration,
  generated preview/explicit approval and fixed-duration first-frame animation
  admission remain upcoming. Do not claim facial fidelity is solved or this flow
  is production-accepted. Browser visual acceptance and paid quality testing are
  distinct from offline checks. Implementation details and planned stages are in
  `docs/hook-keyframe-recreation-plan-2026-10-21.md`.
- Verification: 45 new and 170 existing targeted checks (215 unique) pass, along
  with lint, TypeScript and the final Next webpack build. A real local FFmpeg
  fixture confirms frame0/full dimensions; browser visual acceptance remains
  pending because the browser tool could not start. No production acceptance
  or generated-face quality claim follows from those offline checks.

## 2026-10-21 Clarified Hook/Wall performance recreation target

- User clarified that the body may be regenerated. The required output uses
  the photo person's facial appearance/features/proportions while following the
  source video's actions, emotions/expressions, position/pose and clothing.
  Retain prior scene/camera guidance; do not infer permission to redesign the
  scene. Exact preservation of every original body pixel is not an acceptance
  requirement. This supersedes earlier recommendations premised on that need.
- Treat identity fidelity and performance/clothing fidelity as separate checks.
  Passing uploaded main/supporting photos establishes input construction only;
  a task-mode label is not proof of either creative result.
- Reference-guided recreation is a legitimate candidate under this clarified
  target; do not declare reference mode inherently wrong or force every source
  clip into edit mode. The previous strict source-edit prompt and explicit
  reference declaration were misaligned. Match the clarified intent, explicit
  @Video/@Image ownership and provider task settings before evaluation.
- The two audited Seedance operations declared reference. The earlier separate
  Omni test did use editing and failed the fidelity review. Do not conflate
  prose asking to edit, the UI's Edit page, and a provider's edit parameter, or
  present edit as an identity-lock switch.
- Focus next on a reviewable request with explicit source-versus-identity roles
  and measured facial/performance acceptance. More photos/UI changes alone are
  not the next established remedy. Ask before paid inference; no automatic
  source padding, backend switch, deployment or paid test authorized by this
  advisory clarification. Source-duration investigation remains deferred.

## 2026-10-20 Meaning of edit mode and main-photo evidence

- Explain "confirmed" as verified from saved evidence, and API "contract" as
  request fields/rules developers implement. Neither is a user-facing document
  or a separate "conformal" feature. No new user upload format was requested.
- The actual Seedance request carried five image URLs and a video URL. Main
  first/supporting next is verified in stored metadata and prompt construction;
  `personReference` is app metadata, not a dedicated ReAPI face-identity object.
  Passing the photos correctly does not establish successful model conditioning.
- BytePlus's own Seedance2.5 guide lists replacing the character in a referenced
  video with the character from an image as an editing example. This supports
  the intended task category, but does not qualify exact face-only identity or
  unchanged source pixels. ReAPI's `omni_reference_task_type` is a declared
  subtask and validation hint within the same model/API. Provider docs explicitly
  say the model still classifies intent; it is not a dedicated face-swap switch.
- Current app API/worker restrict `referenceVideoMode:edit` to Omni; ReAPI always
  writes `reference`. An edit flag alone is therefore not a complete app fix.
  Source/identity binding should use provider `@Video 1`/`@Image N` syntax,
  and any supported task's prompt, media roles and parameters must agree.
  Explicit tokens are a documented correction, not a proven fidelity solution.
- Do not claim the prior model made no edits: latest samples removed captions.
  Known request fields do not expose its internal processing or prove why its
  facial appearance failed. BytePlus LAS `person_replace` is a separate service
  with distinct access/asset/evaluation rules, not this ReAPI model's edit flag.
- User requested research of the first three findings and deferred duration.
  No generation-code change, provider call, paid test or deployment in this
  research pass. Details: `docs/seedance-edit-mode-and-face-input-findings-2026-10-20.md`.

## 2026-10-20 Latest Seedance face replacement audit

- Completed provider task `task_01a1596a5eb3749d8606a7384e159cd2` independently
  returns model `doubao-seedance-2.5-face`. Saved job and matching request
  fingerprint reconstruct `content_filter:false`, `reference`, fixed duration4,
  size9:16 and `generate_audio:true` on worker `hookfix2-fac61da3`. The task GET
  does not expose the original filter/mode; distinguish provider confirmation
  from deterministic request reconstruction rather than claim a raw POST log.
- This latest task has uploaded `cdds.mp4` (3.1s) and five ready owned portraits,
  main first plus four supporting views. The roles are correct and no image is
  omitted. It differs from the earlier three-portrait `cdd.mp4` operation.
- Sampled output removes the source captions but retains source-looking facial
  appearance instead of matching the supplied face photos. It is a different
  4.064s/24fps file, not the source3.1s/30fps file. Successful collection and more
  images have not established facial-fidelity acceptance.
- ReAPI's documented source-edit contract requires `edit`, `duration:-1`,
  `size:adaptive` and a4–30s source. Current ReAPI adapter always declares
  `reference`; only Omni has an app video-edit route. Do not describe short
  reference generation as qualified source-preserving face replacement, or
  silently pad the source/switch providers. Less Restriction is a content-filter
  setting, not a face-replacement mode. Current roles omit provider @Image/@Video
  tokens; explicit binding is another unvalidated input improvement, not a
  demonstrated sole cause or solution. No paid test or deployment in this audit.
- Evidence: `docs/seedance-latest-face-replacement-audit-2026-10-20.md`.
- Causality clarification: four seconds is the documented minimum for this
  provider's edit input, not an established facial-fidelity threshold. Both
  poor outputs completed in reference mode, where their roughly three-second
  inputs are allowed. Two similar short-source failures do not isolate duration
  from task mode, conditioning, prompt or model behavior. No matched successful
  four-second edit or controlled duration comparison exists. Do not claim that
  extending/padding to four seconds fixes identity, or that short references
  universally cannot change a face. Qualify the corrected edit flow before
  using these cases to choose or reject a model.

## 2026-10-20 Generation worker rollout acceptance

- Production now routes 100% of AI-generation traffic to
  `ugc-ai-generation-worker-uploadfix-40f07bef`, image digest
  `sha256:e9d074c9bd15cede21768fec014c4c866a23307a11a6ae9c6a094a54c38edfca`.
  Its baked and runtime commit both equal `40f07befe6171ab543bbf6cfd91fff197b6b4b00`;
  its verified startup confirms the release guard passed. Later changes to the
  root release-check script/tests do not change this worker source tree.
- Cloud Run ingress is `internal`. An external `/version` 404 alone does not
  establish stale code. Keep ingress restricted: the release checker requires
  one ready revision at 100%, a pinned image digest, and that exact revision's
  verified startup identity after revision creation. Publicly reachable workers
  still use `/version`. Do not weaken acceptance to service readiness alone.
- Live production Hook picker showed Omni10, Seedance30 and WAN10. These UI
  checks and successful existing-task collection are separate from a fresh paid
  generation or a measured customer upload throughput test.

## 2026-10-20 Reference upload latency and Omni image capacity

- Upload audit found a sequential local metadata-read/authentication path and
  image/video event handlers installed after assigning `src`, which could miss
  an immediate load event. Read/authenticate in parallel, register handlers
  first, keep bounded metadata/network waits, and retain owned-asset recovery
  after an uncertain completion response. Never re-encode face originals or
  blindly resubmit an upload after a lost completion acknowledgement.
- Explore batch uploads retain two concurrent files, input order and the main
  photo. Display Preparing / Uploading with byte progress / Saving phases.
  These are confirmed code corrections; a user's minute-scale transfer delay
  cannot be attributed to one phase without a live timing trace.
- Raise Omni image capacity from six to ten independently of its source video.
  Google's Enterprise Omni 1.1 model card documents ten images; applying it to
  our direct Gemini stable route is an explicit model-family inference. It is
  not a paid ten-image generation acceptance result. Seedance/ReAPI remains30,
  WAN/ReAPI10 and Kling/Runway two keyframes; validate before charging.
- User renewed deployment authorization, while the decision to defer the
  Supabase recovery migration remains. Show recovered completed Seedance MP4s
  without another generation. Deploy web+generation worker and verify live
  identity; do not claim old exhausted app jobs were repaired by a source push.

## 2026-10-20 Deferred recovery migration and delivery release checks

- User explicitly chose to leave Supabase unchanged. The completed-output
  recovery migration was canceled; do not apply it or recover exhausted jobs
  until that decision changes. Gate the recovery action with server-side
  `ENABLE_COMPLETED_PROVIDER_OUTPUT_RECOVERY`, default false. While off, ReAPI
  collection failures must not fall through to a funded ordinary retry.
- Production still served `ugc-ai-generation-worker-hookfix2-fac61da3` after
  the new worker was staged and its traffic activation was interrupted. A ready
  website and a zero-traffic revision do not establish successful video delivery.
- Run `scripts/check-generation-worker-release.mjs <reviewed-worker-sha>` before
  declaring worker rollout complete. The video-delivery CI suite exercises the
  CDN collector, saved-operation/no-POST recovery, billing admission and image
  limits without provider credentials. See `docs/video-delivery-prevention-2026-10-20.md`.

## 2026-10-20 Seedance delivery recurrence and independent image limits

- Two completed ReAPI Seedance tasks remain failed in app result collection.
  The exact isolated-CDN allowlist fix is on merged main `dc73f0d1`, but read-only
  production inspection still routes AI generation to
  `ugc-ai-generation-worker-hookfix2-fac61da3`. Website readiness does not prove
  worker rollout. Exhausted jobs need bounded collection recovery of their saved
  task; never generate again or reserve more credits to recover completed output.
- Replace the shared six-total-files policy with separate image capacity:
  Seedance/ReAPI 30; WAN/ReAPI 10 in reference mode; Omni six application-supported
  images; Kling/Runway two first/last keyframes. The existing one-video/one-audio
  controls do not consume image capacity. Preserve all image ordering and block
  excess before charging when switching to a smaller-capacity model.
- More reference capacity is not facial-fidelity acceptance. The photo guide and
  main/supporting roles remain; do not advertise all models as ten-image capable.
  See `docs/seedance-delivery-and-reference-limits-2026-10-20.md` for evidence,
  provider documentation and the distinction between local fixes and live recovery.

## 2026-10-20 Complete removal of two rejected source images

- User explicitly superseded historical preservation for source assets
  `6e07f2d4-3d18-413a-be31-0e29604671e2` and
  `c8b4cefd-4905-433e-aa2f-e71e258fc3de`. Production tombstones now have
  rejected review status, permanent-removal reason and preservation disabled.
- Removed 25 historical slide previews across 24 generations, archived two
  saved Library entries, and removed the matching image from one saved edit.
  Quota/decision records remain unchanged. The two associated social posts
  were already published; this action does not delete social-platform posts.
- Deleted and verified absent 31 exact GCS objects (originals, base images,
  thumbnails and rendered slide variants). Retain only metadata tombstones
  and exact hash/path denylisting to prevent reimport.
- Cached Trending history rejects these exact asset IDs or deleted object
  keys, including saved-edit snapshots, without clearing unrelated history.
  Cache-code rollout is recorded separately from completed data removal.


## Photo guide popup — 20 October 2026

- In Hook/Wall generation, place “Photo guide & examples” in the person chooser
  header beside the input-purpose controls. Open a separate accessible dialog;
  do not put instructional example photos into the selectable image library.
- Reuse `public/explore/guidance/person-views.webp` with three labelled views:
  Main face photo, Supporting photo 1, Supporting photo 2. Explain clear front
  view, different side angles, natural detail, and choosing Use as main.
- The guide closes back to the existing selection. Supporting views are optional,
  no aspect-ratio quota or waist-up photo is required, and illustrations never
  enter provider inputs. Current provider routing is unchanged.
- User requested pushing all intentional worktree changes after the UI update;
  combined release validation and remote verification remain required.

## 2026-10-20 Second user-rejected Trending source retired

- The drained/keeping-up-with-trends screenshot is slide 2 of generation
  `4b7c163f-9505-4502-b08e-a696b7aa4a79`. Its exact original was visually verified:
  `productivity-human/Pinterest_2026-08-16 (74)/pinterest_002.jpg` (1440×1920).
- Asset `c8b4cefd-4905-433e-aa2f-e71e258fc3de` is inactive/archived in production
  with historical-render preservation. Existing posts are retained; future
  selection excludes this source. The earlier rejected cover remains retired.
- Exact-path/hash import policy updated locally; 12 retirement checks pass.
  No website/worker deployment was required for the live database retirement.
  Receipt: `outputs/trending-exhausted-source-retirement-2026-10-20.json`.

## 2026-10-20 Revisited slideshow first-edit fix — production release receipt

- The exact hook “if you’re stuck on creating fresh content, read this.” uses
  source asset `6e07f2d4-3d18-413a-be31-0e29604671e2`, a 736×919 JPEG enlarged
  to 1080×1350. It is archived/inactive and denied by hash/path during import
  and reconciliation. Existing historical bytes/renders remain available.
- A completed_skipped assignment with no saved edit was incorrectly blocked
  by the UI, API and database trigger. Owned revisited Carousel assignments
  now allow a first edit; ownership, immutable scope, revision checks and
  Hook/Wall restrictions remain. Edits do not replay decisions, consume quota,
  or rewrite previously saved/scheduled snapshots.
- Database migration `20261020102121` was applied before website deployment.
  PR #77 merged as `d70541952ee42538265f2e95e11d3942d94ddc76`; its tree matches
  validated source `ba8b2a8aaa6969d3907746a87adf5df8b046f819`.
- Production deployment `dpl_56RnJrvJ6MR63KAoWhpp3ewfnQb9` is READY and both
  getugcpilot.com and www.getugcpilot.com aliases resolve to it. Build settings
  were restored; MCP production and workers were unchanged by this patch.
- 25 focused checks, application TypeScript, scoped lint and production build
  passed. Database retirement/migration/function readback passed. Signed-in UI
  acceptance is still unverified because Work local browser access is disabled.
  Receipt: `outputs/trending-source-and-first-edit-release-2026-10-20.json`.


## Person-photo chooser revision and backend gate — local, 20 October 2026

- User rejected the narrow person-photo popover as crowded. Replace only the
  generation image chooser with a responsive Dialog: selected main/supporting
  photos beside the library on desktop, stacked on narrow screens, fixed Done
  footer. Keep video/audio popovers and all existing upload/ownership limits.
  First selection is main; Use as main promotes a supporting photo without
  discarding others. Other images retains general-reference semantics.
- Do not describe this as a facial-fidelity fix. AKOOL Face Swap Plus V4 is the
  first practical documented video-swap benchmark candidate; InsightFace Evi/Dax
  need commercial access. Neither is validated on the user's clip. AKOOL
  multi-face mappings do not establish joint multi-view identity conditioning.
  No provider route was added or changed; Seedance remains on ReAPI.
- Preserve original frames/timing through a qualified face-region compositor
  with foreground occlusion handling. Transferring facial contour must not
  leave the original actor's jaw around the new inner face. Caption removal is
  separate. Hosted whole-video output alone does not prove pixel preservation.
- No paid test, new external portrait upload, merge or deployment authorized by
  this work. Quote the exact bounded provider charge before asking approval;
  public provider credits are not app credits. No engine has passed acceptance.
- 107 focused tests, TypeScript and ESLint passed. Local preview behavior is
  recorded separately from production acceptance in
  `docs/hook-wall-face-backend-and-picker-2026-10-20.md`.

## Person-photo roles and Explore image provenance — local implementation, 20 October 2026

- Hook and Wall keep the existing Recreate/Create interaction. Choose image now
  defaults to Person photos, with one Main photo and ordered Supporting views.
  Make main explicitly changes the first image in the request and the main form
  preview. Other images preserves the general appearance/product-reference path;
  image+prompt and prompt-only generation remain supported.
- The API validates the image purpose and existing image constraints before
  billing, adds role instructions to the provider prompt, and freezes the main
  and supporting URL order in `personReference` metadata in both queue paths.
  Existing provider routing remains unchanged. This is input clarification, not
  a qualified face-replacement engine or a guarantee of facial proportions.
- Recommend one usable front photo and, where supported, two distinct slight
  left/right views of the same person. No arbitrary 9:16/4:5 quota or mandatory
  waist-up photo. A waist-up view can guide a new scene; a source video already
  supplies the body/clothing for face changes. Generated instructional examples
  are labelled and never included in the user's generation references.
- Your images now queries ready uploads with `project_id=explore-reference`
  within the authenticated owner scope. All shared Explore reference pickers
  use the narrowed query and a new cache version. Unrelated and unclassified
  legacy uploads remain in Creative Assets; this change does not delete,
  relabel or guess the origin of existing media. Slideshow backgrounds retain
  their separate purpose and do not become person-reference photos.
- Local contract tests and browser preview checks cover role selection/order,
  multi-upload, general images, both formats, and owner-scoped filtering. No
  production acceptance, push, deployment or paid video generation occurred.
  Saved person profiles and a qualified replacement backend remain follow-up
  work. Reconcile the separate unpublished source-edit/sound patch before any
  combined release; these UI changes do not establish that patch is deployed.
- Evidence and asset provenance: `docs/explore-person-photos-2026-10-20.md`.

## Trending body-text recurrence resolved in production — 20 October 2026

- The dedicated `ugc-carousel-edit-worker` was omitted from the earlier rollout;
  slideshow edit jobs route through `carousel-edit`, not `video-render`. A fresh
  six-background edit still used the old v3 renderer despite corrected video
  workers. The text was retained in all six saved slide records.
- Deployed the previously tested fix to the actual edit worker and verified
  ready revision `ugc-carousel-edit-worker-bodycopy-fac61da3` at 100% traffic.
  Re-saved the affected unchanged edit in the signed-in production editor;
  revision 2 completed with `normalized-edit-v4-body-copy`. Body slides are now
  visible in the production UI and all six stored images contain visible copy.
- Future acceptance must verify queue-specific deployment and a real saved
  output. Browser access was disabled after checking slides 2/3; the remaining
  body outputs were inspected as exact downloaded production image bytes.
  No scheduling, quota consumption or AI regeneration was performed.
- Full evidence: `outputs/carousel-edit-worker-repair-2026-10-20.json` and
  `docs/carousel-library-background-text-2026-10-19.md`.

## Integrate identity roles into existing Recreate — 20 October 2026

- User clarified that Recreate on the Hook/Wall reference card is the intended
  entry point: it attaches the video and commonly means changing the face.
  Keep this interaction and integrate identity controls into the current Create
  panel. "Replace face" denotes an operation, not a required new page/button.
- Read-only production inspection confirmed Recreate attaches a clip in both
  formats. Hook's current curated prompt already assigns video performance and
  image appearance, but the image chooser still mixes appearance/product images
  and has no explicit primary/supporting person roles. The sampled legacy Wall
  reference has no equivalent curated prompt; core behavior cannot depend on one.
- Keep image+prompt and prompt-only generation supported. Preserve Upload /
  Creative Assets as direct-to-editor paths; do not turn every import into an AI
  replacement. A proposed broader-reference mode remains a design option; the
  user's answer asked us to inspect Recreate, not to approve a new mandatory UI.
- Proposed profiles group existing owned media with a chosen primary and useful
  supporting views; saving does not train/generate or require copying files.
  Existing generated Characters remain valid one-photo starting points. Recommend
  frontal + left/right three-quarter views, count exact duplicates once, and
  enforce the eventual backend's actual photo limits without a 9:16/4:5 quota.
- Local/staged source-edit/sound work must be reconciled with the shared controls
  and historical jobs. No backend is yet face-qualified; no new application code,
  database change, paid call or deployment occurred in this integration audit.
  Details, affected files, scenarios and acceptance checks:
  `docs/hook-wall-person-reference-integration-2026-10-20.md`.

## Standard face-replacement experience proposed — 20 October 2026

- User wants a consistent Hook/Wall face-preservation workflow backed by a
  standard validated engine, rather than implying equivalent fidelity across
  arbitrary video models. They cited Higgsfield as the product comparison.
- Public Higgsfield documentation distinguishes reusable Soul ID/Elements,
  dedicated Video Face Swap and broader motion transfer/scene editing. It does
  not establish transferable identity weights across all video models or exact
  fidelity in every output. Reference-count guidance differs by interface;
  do not adopt a universal five- or twenty-photo requirement from it.
- Proposed direction: a shared source video + saved identity + sound workflow,
  with one approved replacement backend initially and no unvalidated fallback.
  Saved primary/supporting references are not a trained identity unless an
  actual provider enrollment/training process exists. Local Character currently
  resolves a selected image; staged source-edit compatibility covers model and
  duration, not visual acceptance. Neither is evidence of a shipped fidelity fix.
- No engine has passed the full acceptance benchmark. This discussion does
  not authorize a paid test, provider migration or deployment. Keep Seedance
  on ReAPI and distinguish image/prompt new generation from source replacement.
  Evidence and proposal: `outputs/hook-wall-visual-test-2026-10-19/engine-evaluation/higgsfield-standard-workflow-2026-10-20.md`.

## Conditional Kling addition and facial fidelity gate — 20 October 2026

- User would consider Kling 3.0 through OpenRouter only after both source-video
  support and facial fidelity on their assets are established. Live public
  catalogue/endpoint recheck still shows only text/image input for Kling 3.0
  Pro, Standard and O1. Do not add these routes to source-video replacement.
  Kling's separate Omni/Element documentation is not evidence that OpenRouter
  exposes those capabilities. Keep Seedance 2.5 on ReAPI.
- Five portraits are not a proven remedy. Raw image lists, multi-view character
  elements and shape-aware replacement are different mechanisms. Kling's
  documented multi-image Element takes 2–4 images; an arbitrary five-image list
  must not be described as that feature. Recommend useful unobstructed views
  only when the selected endpoint can consume them as the same identity.
- Correct asset delivery was verified for the later Omni edit, but output
  fidelity failed. Local LivePortrait controls tested portraits separately and
  failed hand occlusion/gaze; they did not test multi-image identity fusion.
  No engine has passed complete temporal/source-preservation acceptance yet.
- Next benchmark must distinguish input-contract correctness, facial geometry,
  foreground-hand handling and preservation of source timing/scene. Any paid
  A/B test requires fresh approval; no integration or deployment until the
  user's gates pass. Detailed decision and acceptance plan:
  `outputs/hook-wall-visual-test-2026-10-19/engine-evaluation/face-fidelity-decision-2026-10-20.md`.

## Seedance provider retained; Kling comparison only — 20 October 2026

- User explicitly wants Seedance 2.5 to remain on ReAPI. Kling 3/4 research is
  a cost/capability comparison, not authorization to migrate providers or run
  another paid test. No deployment was requested in this investigation.
- Kling 4 is released outside the earlier checked OpenRouter catalogue. Do not
  turn the absence of a model on one router into a global availability claim.
  Public live rates for a third-party provider and its API documentation differ;
  use labeled planning prices and require an exact quote before a paid call.
- Facial fidelity remains unresolved. Three complementary unobstructed views
  are recommended input coverage, not a guaranteed fix or a universal minimum.
  Correct role mapping/mode/audio and one-vs-three-image comparison are separate
  from a proven identity-preserving face replacement backend. Do not claim that
  staged delivery/contract corrections already solve facial proportions.
  Evidence: `outputs/hook-wall-visual-test-2026-10-19/engine-evaluation/kling-cost-and-fidelity-next-step-2026-10-20.md`.

## Seedance short-reference clarification and engine audit — 20 October 2026

- User accepts a four-second output from the 3.166667-second `cdd.mp4`, while
  still prioritizing facial features/proportions and source preservation.
  This is a requested option, not an implemented or deployed mode change.
  ReAPI reference generation accepts 2–30s input clips with output from 4s;
  strict edit still requires a 4–30s source and edit/-1/adaptive. Do not apply
  the edit-only four-second input minimum to all video references, or silently
  reinterpret source edits as reference recreation. No automatic padding.
- Rechecked the older completed Seedance task: its four-second reference-mode
  output retained source-looking facial appearance and captions. The collector
  failure and creative failure are separate. Its saved images are bed/sofa/car,
  so the prompt's second-image primary differs from attachment order in chat;
  this alone does not establish why identity replacement failed. The older
  request also hardcodes generated audio ON. Full prompt/assets were present.
- The later approved Omni edit is a separate test. GET/fingerprint and decoded
  pixel checks on 20 October confirm the exact source and bed/car/sofa portraits,
  with car correctly named second, reached the prepared submission. Correct
  delivery did not establish acceptable facial identity or source preservation.
- OpenRouter's current Kling catalogue lists 3.0 Pro/Standard and O1, with only
  text/image input modalities; no 3.2/3.4 listing or full-video input was found
  for those routes. OpenRouter Seedance 2.5 separately advertises video input.
  Provider and mode capabilities must be checked per route, not inferred from
  the model brand or first/last-frame controls. No new paid test or deployment.
  Evidence: `outputs/hook-wall-visual-test-2026-10-19/engine-evaluation/model-input-audit-2026-10-20.md`.

## Hook and Wall recreation intent and sound decision — 19 October 2026

- User clarified the primary product promise: edit the supplied source footage
  with selected portraits supplying the replacement face; preserve the scene,
  performance and timeline, and handle source captions before adding user text.
  Reference-guided synthesis is a different operation and must not be silently
  substituted when a source edit is requested.
- User explicitly confirmed **sound OFF by default** for Hook and Wall of Text.
  OFF means a completely silent generated result, including any reference music.
  Users can opt into sound. A preview-player mute button is not this setting.
  Persist the generation choice through queue/recovery/media metadata and final
  processing; automatically attached reference music must not override OFF.
- Audit of live commit `fac61da3` confirms only Omni currently has a source-edit
  path; Seedance/WAN use reference generation and hardcode sound on. The current
  MP4/timeline checks do not establish successful face change or text removal.
  Paired music is post-processed separately, and finishing can reload reference
  soundtrack metadata. A provider-level mute flag alone is insufficient.
- The verified release's 98-Hook catalogue snapshot has 80 clips below 4 seconds,
  leaving only 18 inside Seedance's documented edit-duration window. All 98 fit
  Omni's 10-second source maximum by duration only, not guaranteed eligibility
  or quality. Seven paired Wall clips span 6.067–14.067s; two exceed Omni's limit.
  The other 62 legacy Wall durations were not exhaustively re-probed in this audit.
- No product implementation or deployment in this alignment audit. The sound
  default is an accepted requirement, not an already-shipped control. Evidence:
  `outputs/explore-recreation-alignment-2026-10-19/alignment-evidence.json`.

## Seedance selective source edit is a workflow gap — 19 October 2026

- The user's exact face-change/text-removal prompt and all three full-resolution
  portraits were preserved in job `a9619070-8517-4d56-b213-d44bab46c141`.
  Pixel comparison matches the attachments; `cdd.mp4` hashes to the saved source.
  Offline execution of the exact deployed worker matches the saved request
  fingerprint. Do not describe this case as missing images or prompt truncation.
- Current Seedance request is `omni_reference_task_type: reference`, duration 4,
  fixed 9:16 and `generate_audio: true`. The UI/API/worker edit flag is Omni-only.
  This does not implement the user's request to selectively edit the source and
  return silence. Proper Seedance edit uses edit/-1/adaptive and a documented
  4–30s source; this exact source is only 3.166667s. Changing one request field
  is insufficient. No silent padding/looping, paid retry or model switch.
- Implement explicit operation/media roles and audio controls through typed
  browser/API/queue/fingerprint/provider/recovery boundaries before claiming
  selective source editing. Preserve reference recreation and historical jobs.
  Correct parameters still need output acceptance for the intended edit.
- Investigation only, no product changes/deployment here. The separate collector
  fix retrieves the existing result and cannot repair its creative content.
  Evidence: `docs/seedance-reference-edit-flow-audit-2026-10-19.md`.

## Seedance completed-output collection incident — 19 October 2026

- New production Seedance Hook job `a9619070-8517-4d56-b213-d44bab46c141`
  reached ReAPI and completed as `doubao-seedance-2.5-face`. Its MP4 came from
  `reapiflexible.b-cdn.net`, the Less Restriction isolated CDN. The live worker
  accepts only `cdn.reapi.ai`/`file.deepytb.com`, rejects that link and exhausts
  three collection attempts against one saved task. This is a later collector
  defect; deployed admission/menu/provider enablement did not prove a playable
  production output. Do not attribute this new failure to old moderation errors.
- Exact deployed adapter reproduction and same-task retrieval with the local
  correction succeeded. The recovered 720×1280 4.064s MP4 fully decodes, and
  26 adapter/worker/provider tests pass. Only the exact additional hostname is
  admitted; no CDN wildcard or credential forwarding. Local correction only:
  no merge, deployment or production job recovery in this investigation.
- The failed job's 16 app credits are released. Recovery needs the supported
  billing/job path and the original saved provider task, not a new paid request
  or a manual completed-row update. Deployment alone does not requeue exhausted
  jobs. Details: `docs/seedance-completed-result-incident-2026-10-19.md`.

## Combined Hook/Seedance/image-picker/Trending release is live — 19 October 2026

- PR #75 merged to main `93df700e`; its tree equals the tested source
  `fac61da3`. Website production `dpl_8vDMoogxxG5vxzoCFRH3heNKumpo` serves both
  apex/www, and MCP production `dpl_CPAsWrg7ouYPdwHRWs2sS9LZ2wy4` serves
  mcp.getugcpilot.com. Temporary build holds were restored to their prior values.
- All 18 approved trims now appear in the live 98-reference catalogue with
  verified new video hashes and durations. All 35 source/preview objects were
  public GET/SHA-256 checked and their retained decoded pictures verified.
  Hook 18 remains unchanged. Exactly Hooks 3, 13 and 59 have no paired audio;
  the other 95 paired tracks remain. Old immutable objects/history are retained.
- Seedance Explore model/gallery/audio admission correction is deployed. The
  screenshot's unsupported-workflow-model rejection is addressed. No paid
  Seedance generation was submitted; do not claim provider-output acceptance.
- Signed-in production Choose Image now displays 24 optimized 256px previews,
  no hidden catalogue image sources, Load more and a multi-file Add images
  input. All 24 were loaded at the 10.274s observation; a warm reopen's first
  observation at 430ms had all 24 loaded. These are intermittent DOM snapshots,
  not exact first-image latency. Two production thumbnail GETs returned 10.6/
  12.6KB WebPs and repeat cache HITs (previous originals 2.06/2.18MB).
- AI generation and video-render services are READY at 100% on
  `hookfix2-fac61da3`; the render job has the same verified image digest
  `96afdde1f42c980281c3b68182ad91874c41c997d9d20219bd472f8d0f15a36d`.
  Startup independently verified matching build/runtime SHA. The Trending
  body-copy renderer is live with `normalized-edit-v4-body-copy`; old blank
  saved images require a new edit/save/render. Scheduled snapshots were kept.
- Production web build, app types, worker build and 182 combined checks pass.
  Lint has zero errors and one existing unused-variable warning. Earlier
  same-quota Trending history remains in the baseline. Other shared-workspace
  edits were preserved and enumerated separately, not silently released.
- This supersedes earlier local-only deployment status below. Full receipt:
  `outputs/combined-hook-seedance-trending-release-2026-10-19.json`.

### Trending library backgrounds and missing body text — 19 October 2026

- The six-slide library replacement exposed a Structure 1 render-worker mapping
  bug: normalized body-only copy lives in `body`/`subtext`, while saved slides can
  carry it in legacy `headline` with empty `subtext`. The worker mistook that
  empty field for deletion. Text and image selections were preserved in storage;
  the hook followed a separate successful render path.
- Local worker fix resolves current body copy like the editor preview and fences
  old output through the Structure 1 edit renderer version. The actual picker
  browser now covers All slides + six selected images on fresh body-only slides;
  the real raster regression checks visible text on all six saved images.
- Build, worker/image checks and editor browser pass. No production writes or
  deployment in this correction. Worker rollout and signed-in acceptance remain
  pending; a website-only release does not fix an old worker. Details:
  `docs/carousel-library-background-text-2026-10-19.md`.

### Choose Image production status rechecked — 19 October 2026

- The current website deployment `dpl_Dfbks1DRK3L4AMnmWQRJFU9ohNSM` at `4c22c19e`
  still uses original image tile URLs and `staleTime: 0`; the local thumbnail
  helper/configuration is absent. The image-loading fix is not deployed.
- A fresh read-only benchmark of two saved 720×1280 PNGs measured 2.06/2.18 MB
  originals versus 10.6/12.6 KB 256px WebP previews (99.49/99.42% fewer bytes).
  This demonstrates payload reduction, not a measured production latency fix.
- A focused nine-file patch applies cleanly to that production commit; original
  generation assets and private delivery boundaries are preserved. Production
  rollout and cold/warm signed-in production acceptance remain outstanding.
  A separate locked validation runtime restored local checks: 132 tests and
  seven actual-component browser scenarios pass, including a 114-image fixture,
  24/48 pagination, no hidden catalogue downloads, cached reopening and three
  files from one chooser. The fixture does not measure production timing. See
  `docs/image-picker-performance-2026-10-19.md` and its latest recheck evidence.

### Hook trims missing from hosted catalogue — 19 October 2026, production recheck

- User still sees laptop/screen tails. Fresh production catalogue pagination
  returned all 98 references; every one of the 18 approved trims still points
  to its original video hash, and none points to the corrected hash. The current
  website deployment `dpl_Dfbks1DRK3L4AMnmWQRJFU9ohNSM`, commit `4c22c19e`, has
  the same original keys in its release manifests and uses those keys for the
  active Hook gallery. Local D: replacements all pass fresh SHA-256 readback.
  Do not describe original-folder replacement as a hosted upload/deployment.
- Hooks 3, 13 and 59 return `paired_audio: null` in the current published
  catalogue, have `audioPolicy: silent` in the website's deployed manifests,
  and have no background MP3 or active background mapping in the manual review
  folders. Other tracks remain available. The generation service is ready at
  100% on `ugc-ai-generation-worker-hookaudio-0df6a7d3`, using the verified
  soundtrack-policy image `sha256:54d28565616dc8391c1e02cc179f9d3c81f306b8aa981039a6370b4a162d51e5`.
- Direct browser playback was unavailable: the production workspace stayed at
  Opening your workspace after refresh. This recheck establishes catalogue and
  deployment identities, not fresh playback or a paid output test. No production
  writes were made. Hosted correction still requires publishing verified clean
  source/preview objects and activating matching duration/prompt/caption
  provenance across website and generation workers while preserving history.
- Evidence: `outputs/hook-reference-audit-2026-10-19/live-rollout-recheck.json`.

## 2026-10-19 Quota-history release verification

- PR #74 merged as `283afc17`; staged production build `4c22c19e` has the identical Git tree and is live on both `getugcpilot.com` and `www.getugcpilot.com`.
- Deployment `dpl_Dfbks1DRK3L4AMnmWQRJFU9ohNSM` is READY. No migrations or worker changes; MCP production unchanged. Deployment build settings restored.
- Final history (22), interaction (88), TypeScript, lint, full browser and quota browser checks passed. The service recovered all eight reviewed production-quota slideshows, denied a different owner and left quota unchanged. Both live history endpoints reject anonymous requests with 401 and private/no-store caching.
- Authenticated production-browser acceptance is still pending: the available browser is signed out. Deployment success does not establish that final user-session check. This entry supersedes earlier local-only/blocked-rerun status below.
- Receipt: `outputs/trending-quota-history-release-verification-2026-10-19.json`.


### Focus slideshow reference addition — 19 October 2026

- Added one six-slide reference from the user's renamed `slideshow explore/Focus/New folder`,
  preserving numeric order 1.jpg–6.jpg, original 1320×1760 JPEG bytes and baked
  captions. First slide is the cover; visible topic/category is **Focus**
  (`focus`). This supersedes the initial NOTA label per the user's correction.
  Preserve the original internal reference ID and uploaded image keys.
- Stable reference: `explore-slideshow-nota-f79553cb5f15c74e`. All six immutable
  GCS objects under `explore/recreate/v1/` are uploaded and public GET/hash-verified.
  The original 93 catalogue entries remain unchanged. New totals: 59 slideshow
  references, 332 slides. Added six visually reviewed, hash-bound text records
  so Remix works without an unreviewed extraction or paid model request.
- Media upload is complete; the catalogue/text additions are local pending the
  next web deployment. Upload alone does not update the deployed frontend.


### Choose Image loading and multi-file upload — 19 October 2026, local correction

- Production Hook picker investigation found full originals rendered in roughly
  68px tiles: 114 eligible images had no thumbnails; the newest 64 contained
  62 MiB. Lazy loading started 64 owned images and hidden catalogue downloads.
  The sampled indexed database query executed in about 81ms. Full API/auth and
  first-visible-image timings were not measured; do not claim an exact cause for
  every second of the reported minute.
- Local shared picker correction uses 256px optimized previews for the existing
  public GCS bucket and known catalogue paths, 24 entries then Load more, no
  hidden-tab image sources, and one-minute owner-scoped metadata freshness.
  Signed/private/blob URLs keep their authorized path; generation keeps the
  original selected asset, never the small preview. Refresh/mutations still
  reconcile the list.
- Add images in multi-reference generation workflows now accepts several files
  in one dialog, validates remaining capacity and model limits before upload,
  uploads at most two at a time, and preserves ordered successes after partial
  failure. Pending work and cancelled-owner guards apply to the whole batch.
  Single-image workflows retain one-file selection. Existing Talking Head and
  instruction-reference inputs already supported multiple files.
- This is local, not a production fix claim. Local tests include the installed
  Next optimizer and the actual generation component with controlled API
  boundaries: 132 checks, full TypeScript and scoped lint pass. Browser
  acceptance is blocked by sandboxed Edge permissions and
  unreachable loopback from the in-app browser. See
  `docs/image-picker-performance-2026-10-19.md` for evidence and remaining gates.

### Remix symbol colors and emoji clusters — 19 October 2026, local

- User reports final Hook Remix output turning a red cross and green tick into
  white font glyphs, despite face emojis appearing colored. The font-outline
  fallback and legacy drawtext path had no symbol-specific colors; ordinary
  right arrows also existed in the bundled face and inherited the caption fill.
- Shared preview/export artwork now draws ❌/✖/✘/✗ red, ✅/☑/✔/✓ green,
  and →/➡ red as requested. Keep authored Unicode, words, timing, styles and
  draft shape unchanged. An explicit Unicode text-presentation selector keeps
  plain font rendering. Do not recolor ordinary Latin X/x or math operators.
- Hook, Wall of Text and Talking Head/demo clip overlays share this fix.
  Legacy overlays containing colored symbols use the PNG overlay path too;
  ordinary legacy text retains drawtext. Explore slideshow added-text overlays
  use the same paths in their shared SVG preview/PNG export.
- Segment complete graphemes during wrapping/fallback so variation selectors,
  ZWJ sequences, skin tones, flags and keycaps stay together. Emoji fallback
  requests installed color emoji families, separate from outline glyphs.
  This does not claim universal emoji support on every operating system.
- Trending generated Hook has its own existing bundled cross/check icons.
  Trending Carousel manual text uses a separate fail-closed glyph renderer;
  AI-generated/baked slideshow text and speech subtitles are separate paths.
  Do not infer their production acceptance from these Explore checks.
- Local actual-video pixel checks confirm red cross, green tick, white copy,
  interval visibility and intact source bytes; desktop/mobile editor checks
  confirm preview colors and save/reopen. No production generation, scheduling
  or deployment was performed. Existing immutable outputs need a fresh export
  after worker/web rollout; old paid-operation receipts remain unchanged.


### Seedance Explore admission mismatch — 19 October 2026, local correction

- The screenshot message `Choose the workflow's supported video model.` is an
  application HTTP 400 from shared video admission, before credit reservation,
  atomic batch creation, queue dispatch or ReAPI submission. The deployed UI
  offered Seedance in Hook and Wall of Text, while the server's `exploreFormat`
  allowlist still admitted only Omni and WAN. Talking Head's separate
  `workflowKind` route without `exploreFormat` did not hit this specific guard.
- The old backend assertion explicitly expected an Explore Seedance request to
  fail. UI tests only captured a successful mocked submission; ordinary Seedance
  API tests omitted `exploreFormat`. Provider configuration checks alone missed
  this customer entry-point mismatch. Check the actual request shape through the
  real admission handler whenever a workflow gains a selectable model.
- Local correction admits Seedance for Hook/Wall, registered gallery references
  up to 30 seconds (minimum 2 seconds), and owned audio guidance. Keep selected
  Seedance output duration, image/video/audio inputs and `provider: reapi` through
  ordinary and atomic requests. Seedance stays reference generation, never Omni
  `referenceVideoMode: edit`. Retain existing auth, ownership, six-file limit,
  MIME/size checks, rollout switch, output duration/quality, idempotency and billing
  rules. Omni and WAN retain their separate limits; Kling remains outside these
  Explore format generators.
- Fresh production read at 16:03 IST: website `d2f698a7` still has the stale
  allowlist; AI worker `0df6a7d3` is ready at 100% traffic with enabled Secret
  Manager `reapi-api-key:1`. Read-only ReAPI balance returned HTTP 200, valid and
  funded. The exact deployed adapter passed an offline POST/poll/download test
  using `doubao-seedance-2.5-face`, `content_filter: false`, and reference mode.
  This verifies routing/configuration, not a successful paid generation.
- No Seedance jobs were recorded on 19 October at the check; latest recorded
  Seedance submission remains 17 October on the legacy provider. The failed
  screenshot request has no supplied request ID, and its older Vercel request log
  was outside retention. Do not invent a provider response for this UI rejection.
- This correction is local and not deployed. No real generation POST, paid retry,
  database write, credential rotation or production change was performed. See
  `docs/seedance-explore-admission-fix-2026-10-19.md` for evidence and tests.

### Idle-tab refresh correction — 19 October 2026, local

- Demos, Creative Assets edit status, saved Hook library and Edit library now
  coalesce manual focus/visibility/online resume reads through a mounted,
  account/resource-scoped queue. Automatic reads share an in-flight operation
  and a one-second successful-read window; persistent failures back off up to
  one minute. Explicit refresh and post-mutation reconciliation bypass that
  window and supersede an older read so uploads/deletes cannot reuse stale data.
- Their manual status polling waits for completion, stops starting reads while
  hidden, and checks again on resume. Token acquisition, GET and body parsing
  share a 20-second deadline. Navigation/account changes abort pending reads;
  cancelled reads cannot overwrite current state. Demos retains its finite
  polling budget, reset when its active-job signature changes.
- Unchanged JSON results retain existing state references. Background saved-Hook
  reads keep cards and loading controls steady, and errors retain current cards.
  Upload reuse in workflow finishing uses WeakMap keys so replacing a file no
  longer keeps the old File alive solely through the upload memo.
- Existing generation access/billing focus checks, server authorization,
  generation/finishing/scheduling request identities and media authorization
  lifetimes retain their contracts. Private-media URL renewal is a separate
  conditional issue, not an established explanation for whole-app lag.
- Local queue tests and four actual-component browser scenarios passed, using
  simulated 30-minute hidden time and controlled slow/failed responses. Same-card
  retention, retry and cancellation are covered. This is not a real elapsed
  production soak or proof the deployed app is fixed. See
  `docs/idle-tab-refresh-fix-2026-10-19.md` for scope, commands and acceptance limits.


### Trending same-quota older-post recovery — 19 October 2026, local correction

- Recovery scope is the same quota/delivered feed, including posts viewed hours
  earlier. Browsing them again must not consume quota or mix other quota feeds.
- User supplied a recording and clarified that recent swipe-back works but a
  slideshow reviewed about two hours earlier cannot be reached. Production
  records retain older skipped/ready slideshows; the connected browser stops at
  a later historical post. Deployed backward navigation read only local browser
  snapshots and cannot retrieve older account history from the server.
- No two-hour expiry was found. Seven-day/120-entry/serialized-size limits and
  browser-specific storage do not provide complete account history. Prior
  gesture and refresh tests did not cover earlier decisions missing from the
  browser. Keep this acceptance gap explicit; do not repeatedly adjust gestures
  to address missing historical data.
- Required correction is paginated, authenticated recovery of existing reviewed
  records, stable merging and an explicit older-history loading/error boundary.
  It is now implemented locally through `GET /api/trending/feed/history` using
  the saved feed ID and original slot order. The gallery preloads pages, merges
  pending local reviews without moving the current post, scopes storage to
  owner + quota, and exposes loading/retry/unavailable states. Revisiting is
  read-only; normal feed preparation and decision writes are unchanged.
- Local regression and browser checks passed for empty-cache +2h recovery,
  pagination, reload/navigation, quota isolation, empty feed, retry and blocked
  storage. The final quota browser rerun passed on the isolated release.
  Read-only production-service verification recovered all eight reviewed
  slideshows, denied a different owner, and left quota unchanged.
  Authenticated deployed-browser acceptance remains pending.

  Diagnostic evidence and limits, including the
  different Comet/in-app browser contexts, are in
  `docs/trending-older-history-investigation-2026-10-19.md`.

### Trending finger swipe-back recurrence — 19 October 2026, local

- Remaining user report concerns native touch during the same visit: swipe a
  Reel up, then swipe down to see it again. Do not conflate this with recovering
  history after leaving/refreshing or treat deployment metadata as gesture proof.
- Actual-component native touch reproduction found that normal 120px downward
  travel stayed on the current Reel while a much longer pull worked. The old
  test used keyboard advance and an 85%-height backward touch, leaving a gap.
- The shared feed now handles deliberate single-finger release distance/speed
  and chooses one adjacent post while retaining native panning. History browsing
  preserves decision counts; accidental/horizontal/multitouch/control gestures
  remain guarded. Mouse/wheel policies remain distinct. CAROUSEL_CONTEXT.md
  records the detailed mechanics and local acceptance.
- Local correction only; not deployed and not a signed-in production-device
  acceptance claim. Production browser access was disabled during this check.

### Original import MP4 replacements completed — 19 October 2026

- User explicitly requested replacing the 18 defective original videos with their
  verified trimmed versions. After fresh full-frame pixel/PTS/duration/native
  packet verification and three agents' independent visual end-frame checks,
  replaced exactly those 18 MP4s in the original import folders on D:.
- Roots: `D:\hook\videos (10)\New folder\HOOKS`, `D:\hookswithlinks`, and
  `D:\hookswithlinks\new batch`. Original filenames were retained. Every original
  is backed up under `outputs/hook-reference-audit-2026-10-19/original-import-backups/`.
  `BACKUP-MAP.json` maps targets and restore sources; the replacement receipt and
  independent readback confirm all 18 installed hashes and 18 backup hashes.
- Hook 18's actual original import MP4 remains unchanged. All sibling MP3/text
  files and all 106 manual audio-review files passed unchanged-hash checks.
  No audio analysis or paid model calls. Current installation record:
  `scripts/data/hook-reference-original-replacements-2026-10-19.json`.
- This is a physical replacement of the user-supplied import-folder videos.
  Immutable cached/catalogue source objects and historical audit evidence remain
  intact. The website/MCP/worker catalogue has NOT been switched or deployed;
  content-addressed media and matching prompt/text/duration rollout remain separate.
  Do not overwrite old hash-named cache objects with corrected bytes.
- Helpers: prepare a hash-bound plan with
  `scripts/prepare-hook-original-replacements.mjs`; backup-only preflight is
  `scripts/replace-hook-original-videos.mjs` and `--apply` performs the original
  folder replacement. The existing completed plan can resume idempotently.
  Preparing a fresh old-source plan after installation intentionally fails if
  the import bytes no longer match the original reviewed source.


### Hook audit approval and manual audio collection — 19 October 2026

- User reviewed the scene findings, explicitly chose to keep Hook 18 unchanged,
  and approved all 18 clear end trims. No uncertain scene decision remains.
  The derivatives are verified locally; catalogue activation/deployment is still
  separate. The full original Hook 18 stays bound to its existing prompt/text.
- User requested all background audio together for their own listening review,
  with names that map each track to its reference and original import folder.
  `outputs/Hook Reference Audio Review/` contains 98 descriptively named Hook
  folders, each with its complete byte-identical paired MP3, an original frame,
  source mapping and editable review notes. Eight embedded native audio tracks
  are also extracted by packet copy with payload-hash verification. No AI audio
  analysis, transcription, classification or paid model call was performed.
- Example: `Hook 003 - Pillow - wide-eyed reaction` retains the original source
  folder `New folder (3)`, `ReelAudio-77704.mp3`, permanent reference ID and source
  link in `mapping.json`. Every file includes the stable three-digit Hook number.
  The parent `index.html` has thumbnails and separate background/native players;
  `AUDIO-MAP.json` maps all files. Original soundtracks, including Hook 03's
  previously rejected pairing, remain available for explicit manual review.
- The exporter `scripts/export-hook-reference-audio-review.mjs` uses the scene
  labels in `scripts/data/hook-reference-audio-review-labels.json`. It verifies
  original hashes, refuses to replace differing existing media/mappings and
  preserves user-written `REVIEW-NOTES.txt` on rerun. It performs no upload or
  production write. Music remains acceptable; user is checking spoken commentary.

### Complete Hook frame audit and staged cleanup — 19 October 2026

- User explicitly rejected unrelated demo/screen tails in generation references.
  This supersedes earlier instructions to preserve even single-frame screen cuts,
  including the Hook 03 entry below and the earlier all-frame prompt review.
  Keep the influencer performance; a physical laptop/phone beside the performer
  is not automatically unwanted. Prior prompt review observed tails correctly
  but accepted the wrong product behavior by instructing generation to retain them.
- Three agents inspected all 9,773 decoded frames of the 98 active Hook references.
  79 have no unrelated scene cut; 18 have clear unwanted tails (22 frames total):
  ordinals 1, 2, 3, 4, 6, 7, 20, 30, 39, 40, 42, 43, 53, 54, 71, 78, 88, 89.
  These ordinals are audit identifiers, not new product-facing catalogue labels.
  Exact permanent IDs, source hashes, removed ranges and prompt proposals are in
  `scripts/data/hook-reference-scene-audit-2026-10-19.json`.
- Hook 18 continuously pans from an airplane window to a seated smiling performer.
  It is an authored reveal, not an inserted demo. User asked for the original
  video and labelled frames at the end of the chat for manual guidance; leave it
  unchanged until that guidance. Do not choose a crop/trim based on elapsed time.
- User deferred ALL audio analysis to avoid provider cost. Background music is
  acceptable; the concern is spoken commentary. No paid audio/model calls were
  made. Existing Hook 03 silence decision remains separate. The new video audit
  neither certifies soundtracks nor globally removes singing, music or native audio.
- `scripts/trim-hook-reference-frames.mjs` creates new lossless H.264 derivatives,
  checks source SHA before/after, exact decoded retained pixels, frame count,
  relative PTS and end boundary. Preserve the last performer's display hold up to
  the first excluded frame PTS; packet-duration-only cuts shorten VFR holds.
  Disable B frames and set final packet duration without duplicating frames.
  Native audio in four affected sources is explicitly packet-copied and checked
  by payload hash/timestamp, without listening or re-encoding. Account for FFmpeg
  input normalization by container start when aligning nonzero video timestamps.
- All 18 derivatives and exact revised prompt/Remix-timing proposals are staged
  in `outputs/hook-reference-audit-2026-10-19/`. Original videos, soundtracks,
  active catalogue and production remain unchanged by this audit. The review HTML
  puts ambiguous cases last. Trimming retains baked-in captions; the existing
  generation text-removal instruction remains. Do not claim pixels were de-texted.
- Before activation, upload/verify content-addressed derivatives and paired previews,
  then release matching generation video, duration, prompt source hash and caption
  source hash/timing together. Keep old media/provenance available for historical
  jobs. New prompt paragraphs remove discarded-cut instructions. Staged cleanup
  is not evidence that the current deployed catalogue already uses cleaned inputs.
- Validation includes real media pixel/PTS/packet checks on all derivatives and
  regression cases for non-keyframe head/tail trims, VFR holds, nonzero starts,
  native-audio preservation, invalid ranges, hash mismatches and repeat writes.
  No paid generation, provider-quality test, deployment or authenticated
  production workflow acceptance is part of this local audit.

### Hook 03 spoken soundtrack removed — 19 October 2026, local

- User rejected the spoken background audio on Instagram reel `Dd394l1gRWG`,
  reference `explore-paired-hook-ef59f4b5e69bc9e125f8ada7`. Its 3.766992-second
  source MP4 is already silent; the audible preview and generated Hook instead
  attach `ReelAudio-77704.mp3` (31.63425 seconds). Frame review alone never
  establishes soundtrack suitability. The speech complaint is user-reported;
  this audit did not transcribe or independently listen to its words.
- This exact release item now has `audioPolicy: silent`. Catalogue/MCP omit its
  automatic paired audio and preview the existing silent source. Generation
  strips provider audio using video stream copy, rather than merely lowering
  playback volume or relying on a prompt. New outputs omit soundtrack receipts
  and do not infer a track from this reference ID. Explicit historical receipts
  retain their immutable mappings for recovery/editing; old rendered media is
  not automatically rewritten. Other references retain their existing policy.
- Rechecked all 110 decoded frames in sequence. The performance paragraph is
  accurate: reclining, blink, widening eyes, right/left glances, return to lens
  and final sideways glance. Frame 109 at 3733 ms cuts to hand/stylus and screen;
  keep that single-frame tail brief. Added explicit silence, no speech/voiceover/
  singing/lip-sync/music, while retaining naturally parted lips. Overlay removal
  and separate Remix caption wording/timing remain unchanged.
- Review, exact prompt, silent output and receipt: `outputs/hook-03-review/`.
  The actual audible preview was stripped and all 110 decoded pictures and
  timestamps match the silent source; ffprobe confirms zero audio streams.
  Local source hashes match production catalogue object names read through MCP.
  Direct production byte fetching failed DNS in this shell. No paid generation,
  deployment or authenticated production acceptance is claimed. Release worker
  and web/MCP together; already selected browser state may require reload.
- Worker build, app TypeScript, scoped lint and focused catalogue/prompt/audio/
  generation checks pass. The wider release test still expects Hook 01's old
  final-frame Remix block, conflicting with the earlier caption normalization;
  that unrelated expectation was left unchanged. Full audio suite passes when
  run independently (an initial concurrent run exited before completion).

### Single Hook opening text follows trim — 19 October 2026, local

- Root cause: shared trim handling uses `min(previous text end, new length)`.
  Shortening a 3s clip to 1.5s overwrites the text end with 1.5s; extending to
  3s leaves it at 1.5s. The shortened interval can survive draft recovery,
  manual styling and Remix because those paths retain previous timing.
- User explicitly limited this correction to the Hook Video workflow's opening
  editor. `FormatWorkspace` opts that opening into `fullDurationHookText`.
  Never infer this policy from `format: hook`: Talking Head opening/demo and
  other shared editor callers also use that render format but MUST retain
  independent timing. Hook's separate demo editor is not opted in either.
- With exactly one text block, timing is normalized to 0–selected duration on
  local/server/receipt/metadata restoration, editing, trim changes, Remix and
  drag updates. Preview, saved draft and final composition use the same JSON.
  A short explanation replaces the single block's separate timing inputs.
  Multiple blocks retain authored per-block timing; adding a second block
  restores the timing inputs. Removing down to one restores full-clip coverage.
- Keep copy, position, font, preset, sound, trim and legacy draft shape. No
  worker/global parser policy or database schema change; no provider requests
  or existing rendered-media rewrites. Changed recovered timing still needs an
  explicit Save edits and final preparation to replace previously saved output.
- This specific exception overrides the general instruction to carry shared
  editor fixes across workflows. Wall, Talking Head, demo and slideshow timing
  behavior stays as it was. This correction is local and not deployed.
- Validation: 216 focused checks pass, including repeated shrink/expand/shift
  cycles, local/server/receipt/metadata recovery, style/copy preservation and
  negative checks for Talking Head/demo callers. Actual-component desktop and
  phone browsers verify end-of-clip visibility, reload and switching between
  one and multiple blocks. Real exports show Hook text at 2.8s after expanding
  1.5s back to 3s while independently timed demo text still ends at 1.5s.
  App TypeScript and scoped lint pass. These are local checks, not authenticated
  production acceptance. Evidence: `.tmp/hook-text-timing-tests-20261019.log`
  and `.tmp/explore-demo-loading-browser/hook-single-timing-*.png`.

### Trending history survives leaving and refreshing — 19 October 2026, local

- User clarified that the repeated scroll-back failure occurs after leaving
  Trending or refreshing, not during the same visit. React-only review snapshots
  disappeared on unmount; gesture-only fixes did not address that lifecycle.
- Authenticated Trending opts into owner-scoped browser history for up to 120
  recent posts/seven days, including the selected historical post. Recovery
  lives above the gallery's empty/loading branches so an empty server feed cannot
  hide View previous posts. Other accounts never receive those previews.
- Browsing recovered posts does not replay a decision, Library save or scheduling
  action. Demos remain visit-local. This does not recover visits already lost
  before the change or synchronize between devices. See CAROUSEL_CONTEXT.md for
  storage bounds, failure handling and the exact acceptance boundary.
- Actual-component browser checks cover leaving/returning, refresh, backward and
  forward browsing, final-post recovery, account switching and unavailable
  storage. Local only; no deployment or authenticated production acceptance.

### Edit-screen space usage correction — 19 October 2026, local

- Repeated mistake reported by the user: the focused Hook/demo edit screen
  reserved a full-width bottom row for Back and Save, repeated the edit title
  inside a padded tools card, and left a broad empty band above those tools.
  Shrinking buttons alone did not fix the unnecessary layout containers.
- Focused Hook opening/demo actions now live in the compact editor header.
  The bottom action container is removed. The duplicate tools heading is hidden
  in that frame; the nested tools border, background and padding are removed.
  The outer editor keeps one short title, then starts preview/tools directly.
- Talking Head's shared focused panel places supplied clip actions above its
  scrollable tools and omits its bottom footer. Duplicate clip headings are
  hidden there too; the preview identifies the current clip. Wall's actual
  FormatWorkspace uses a separate action target, now also above its tools with
  the legacy footer hidden during Edit. Keep Wall's Back to text control.
  Panel border/padding are removed only during focused editing. Create, Demo
  setup, Schedule and slideshow retain their own layout and action behavior.
- Carry corrections across shared workflow editors automatically. Preserve
  mounted preview/tool/draft targets, Back/Save handlers, disabled/error states
  and reachable actions while scrolling. Do not create empty header/footer rows
  or duplicate cards merely to hold actions; use compact controls and measure
  usable space with long text/block lists on laptops as well as mobile.
- This correction is local, not deployed. Isolated component/browser checks
  do not constitute authenticated production acceptance.
- Validation: 197 editor/navigation/source/draft/drag checks pass. Browser
  checks cover Hook demo upload/edit continuity at 1280×720 and 1536×864,
  seven text blocks and 390px mobile scrolling, paired opening/demo and Wall
  at 320–1920px. Hook's header actions measure 44px, nested tools padding/border
  and initial tools gap measure zero; shared top actions use 56px including
  spacing. TypeScript and scoped lint pass. Evidence screenshots are in
  `.tmp/explore-demo-loading-browser/` and `.tmp/talking-head-editor-layout/`.

### Trending slideshow shared styling and history edit — 19 October 2026, local

- These changes belong to Trending Carousel Edit, not manual Explore Slideshows.
  Body style/position changes share by default; hook and per-slide copy/media
  stay separate. Individual styling is persisted and protected from future
  shared changes unless the user explicitly rejoins that slide. Existing manual
  styles without metadata are treated as individual to preserve authored work.
- New manual text motion reaches canvas edges without the former fixed inset,
  while glyphs/panels stay contained. Body overflow is surfaced for individual
  review. Existing generation typography and Explore image pixels are unchanged.
- Existing owned Carousel edits can reopen from Trending review history; other
  formats retain current restrictions. This requires a local trigger migration
  as well as UI/API changes, with no automatic skip/schedule state changes.
  See CAROUSEL_CONTEXT.md for the exact access boundary and release requirements.
- No deployment or production mutation; local fixtures are separate from final
  authenticated production acceptance.

### Drag text directly on clip previews — 19 October 2026, local

- Text in the focused Hook, Wall, Talking Head opening and demo editors can be
  dragged horizontally and vertically on the live preview. Starting a drag
  pauses video/audio; pointer capture supports mouse, pen and touch. Arrow keys
  move focused text in small steps; Shift uses larger steps. Read-only overview
  and sequence previews retain their playback behavior without drag targets.
- Only the visible text region intercepts input. A subtle boundary appears on
  hover/focus. Movement uses the displayed frame scale and clamps the complete
  text within the video. Existing timing, copy, style and other blocks remain.
- The optional normalized text `x` field is parsed and saved through existing
  clip drafts; absent `x` retains legacy shape and centered rendering. The same
  layout drives browser SVG, bundled glyph outlines and legacy FFmpeg text.
  Snapchat's full-width background remains full width. No saved media is
  rewritten; users save edits and prepare the resulting video as usual.
- Deployment must release the updated worker parser/renderer before the website
  can submit edits containing `x`. This change is local, not deployed. Browser
  fixtures and local real-video exports are distinct from authenticated
  production acceptance.
- Validation: 165 focused checks pass, including strict draft round trips,
  blank/neighbor block preservation, all 160 font/size/preset/frame boundary
  combinations, and actual video exports through all three text render paths.
  Actual-component browsers pass mouse/keyboard and saved-position recovery at
  laptop/desktop/phone sizes, touch on phone, and the complete Talking Head
  opening/demo and Wall editors at 320–1920px. App TypeScript, worker build and
  scoped lint pass. Screenshots: `.tmp/talking-head-editor-layout/` and
  `.tmp/explore-text-fonts-browser/`.

### Video text preset switching — 19 October 2026, local correction

- Reproduced Snapchat Classic → Bold white staying on Snapchat in the shared
  dropdown. `applyFormatTextPreset` correctly removes `preset` and
  `backgroundOpacity` for Bold, but the editor's partial-update merge restored
  both from the previous text object. This kept the Snapchat background and
  selected option even though some typography changed.
- Preset changes now replace the selected text block with the helper's complete
  result. Individual field changes still merge only their changed fields. Copy,
  selected font, other blocks and timing remain; Wall retains full-clip timing.
- The same control is used by Hook, Wall advanced styling, Talking Head opening
  and demo editors, and Hook demo editing. No slideshow preset behavior changes.
  Existing persisted/rendered content is not rewritten; users can change the
  preset through the corrected editor. This fix is local and not deployed.
- Validation: the new dropdown regression failed before the fix with Snapchat
  still selected. All 107 focused editor/draft/export/finishing checks now pass.
  Actual-component browser checks verify Snapchat → Bold, removed preview
  background, retained copy/font, and saved/reopened Bold in Hook at laptop,
  desktop and phone sizes, plus Wall advanced styling on phone. TypeScript and
  scoped lint pass. These are local fixtures, not production acceptance.

### Generation image picker multi-selection — 19 October 2026, local correction

- Hook/Wall-of-Text's Choose image popup and Talking Head's shared creator
  picker remain open after choosing saved or catalogue images when multiple
  references are supported. Each thumbnail shows an empty square or a ticked
  square; pressing a selected thumbnail again deselects just that image.
- A selected-count row and Done close action replace duplicate selected-image
  previews inside the popup, keeping the grid stable while selecting. The
  existing sidebar tile still displays the selected-image mosaic.
- At the model's image limit, unselected tiles cannot add images; selected tiles
  remain removable. Saved images still resolve their current owned record;
  catalogue copies retain their existing upload scope. Pending work, errors,
  account guards and generation reference delivery are preserved. Single-image
  callers retain their existing close-on-selection behavior.
- This correction is local and is not deployed. Browser fixtures use isolated
  auth/storage boundaries, without paid generation or production changes.
- Validation: 121 reference/collection/generation regressions, TypeScript and
  scoped lint pass. The actual Hook and Talking Head pickers pass six browser
  scenarios at 1536×864, 1366×768 and 390×844: checked multiple selections,
  individual deselection, catalogue/saved-image mixing, Done/reopen persistence
  and unchanged instructions. Screenshots: `.tmp/workflow-image-library-browser/`.

### Approved reusable backgrounds workflow — 19 October 2026, local

- The user confirmed Settings collection management followed by applying images
  to the existing Trending slideshow through its Edit screen. Removed the local
  libraryImages URL/import handoff to Explore; it was the wrong destination for
  that requirement. No standalone library action creates/replaces an Explore draft.
- Existing Explore background and Add slides pickers still work. The shared
  background picker now selects images/collections, then Preview backgrounds,
  then Use these backgrounds. Normal Save remains separate. Multiple images fill
  all slides in selection order, repeating; collections follow saved order.
- Shared selection/preview is full width, with no preview side panel or up/down
  reorder buttons. Collection use appears above its grid, selection survives
  management, and management uses Done with immediate-save wording. Thumbnail
  crops affect browsing only; composed previews retain each editor's renderer.
- Source rechecks, unchanged target guards, text preservation and draft/save
  boundaries remain. Shared music behavior is unchanged. See CAROUSEL_CONTEXT.md
  and docs/media-library-trending-flow-2026-10-19.md for the approved workflow.
  Local browser evidence is distinct from signed-in production acceptance.

### Shared text glyph serialization fix — 18 October 2026, local

- Trending's missing letters were reproduced in saved glyph output with intact
  input copy. OpenType.js `toPathData(3)` can emit NaN from near-integer floating
  coordinates, damaging character segments. The shared finite SVG serializer
  now replaces both Carousel manual and Explore bundled-font video callers.
- Preserve text, font, wrapping and layout; reject invalid geometry. Regression
  coverage verifies visible glyph ink in all 12 faces and real video exports,
  including the existing fallback/timing behavior. No generation prompt, image
  input, schema, saved receipt or publishing behavior changes.
- See CAROUSEL_CONTEXT.md for exact reproduction and validation. This fix is
  local; old rendered media is not repaired automatically. Existing immutable
  finish receipts remain recoverable; a new explicit edit/render uses the fix.

### WAN/ReAPI completed-output collection — 18 October 2026, local correction

- Production WAN job `56b8b792-b13f-448d-9fed-8e14b4cf9c52` completed at
  ReAPI but returned `file.deepytb.com`, while the adapter admitted only
  `cdn.reapi.ai`. Recovery exhausted three attempts and reported a generic
  failure. The provider video already exists; do not submit another generation
  as its recovery. See `docs/video-generation-quality-audit-2026-10-18.md`.
- Admit those two exact HTTPS hosts with no embedded credentials/nonstandard
  port; reject lookalikes and redirects. Keep API credentials off CDN requests.
  Record provider completion/settlement before collection, without persisting
  untrusted links. Retries poll the same saved task and refresh the output URL.
- Collection failures now retain a safe `PROVIDER_OUTPUT_COLLECTION_FAILED`
  reason through worker retries and website/MCP reporting. Historical pending
  failures explain recovery of the existing request instead of an unknown cause.
- Targeted API/worker/recovery checks, 12 MCP-operation tests, worker build and
  scoped ESLint pass. The corrected local adapter also collected the actual
  existing production task with two GETs, no POST or database write; its bytes
  match the previously audited video. This is live read-only adapter validation,
  not acceptance of a deployed fix. The website job remains failed/exhausted.
- Full app TypeScript currently reports an unrelated readonly-array assignment
  in `components/media/image-library-browser.tsx:85`. No deployment, production
  job reset or billing change was made. Worker deployment and website/MCP error
  rollout, followed by controlled recovery of the original job, remain separate.

### Seedance 2.5 in Explore video model selectors — 18 October 2026, local correction

- The modern Hook and Wall-of-Text composer had an explicit model allowlist
  containing only Omni and WAN. Seedance was supported by generation settings
  and the API but absent from this dropdown. Include Seedance 2.5 there, using
  the existing provider availability flag. The production website's public
  Seedance flag was checked and is already enabled; no flag change was needed.
- Talking Head uses the shared workflow creation form, whose model list already
  includes enabled Seedance. Preserve its model normalization, saved settings,
  reference policies and existing provider routing. The modern composer's default
  remains Omni; selecting Seedance uses its own duration and quality options.
- This correction is local, not deployed. Component request tests exercise the
  model actually offered in the dropdown and its submitted settings. No paid
  generation or signed-in production visual acceptance was performed.
- Validation: 147 model/settings, composer, client and API contract checks pass,
  including Talking Head saved settings. Full TypeScript and scoped ESLint pass.

### Stable generation reference controls — 18 October 2026, local correction

- The compact video-workspace override forced two columns even when Image,
  Video and Audio were all visible. Audio consequently appeared on a second
  row. The shared generation reference component now exposes its visible slot
  count, and three visible controls use three equal shrinking columns, capped
  at the existing 128px tile width. Selected images remain a mosaic inside the
  single Image tile; adding images does not add controls or displace Audio.
- Applies wherever the shared control is used, including Hook, Talking Head
  and Wall-of-Text configurations that expose audio. Two-control layouts retain
  their existing dimensions. Generation inputs and selection handlers are unchanged.
- This correction is local and is not yet deployed. Signed-in production visual
  acceptance remains separate from local source/component checks.
- Validation: 72 reference/upload/workflow regressions, full TypeScript and
  scoped ESLint pass. Covers zero, one, two and six images, unchanged slot order,
  two-input configurations and selected audio retained after a model change.

### Hook generation references — 18 October 2026, redundant library entry removed locally

- Optional references uses the existing Choose image and Choose video tiles.
  Removed the separate Choose reference from library button and its unused
  picker state/import from the shared generation-reference component. Choose
  image still opens upload, Your images and UGC Pilot images; reference selection,
  removal, ownership validation and generation delivery retain their handlers.
- This also removes the duplicate entry wherever that same component is used.
  Slideshow background libraries and other independent library pickers remain
  available. No assets, saved references or generation data are deleted.
- This is a local UI removal; no deployment or production write was performed.
- Validation: 103 existing reference-upload, generation-flow and creation-form
  checks pass, including saved image reuse, upload failure recovery and delivery
  of image/video references. Scoped ESLint passes. Production UI was not tested.

### Library picker clarity and upload continuity — 18 October 2026, local

- Image selection is focused on choosing media. Management is reachable within
  the same dialog through Manage library; collection rename/removal/new-collection
  controls are no longer mixed into the selection grid. Upload stays direct.
- This slide/All slides is chosen up front, images preview immediately, and Apply
  stays outside the scroll region. Explore's preview uses the same SVG text
  function and actual loaded image dimensions as its editor/export. Trending
  supplies its separate EditorPreview renderer with the proposed background.
- One Apply resolves every used image before an atomic draft update. Failed
  validation/cancel retains the current sequence. Existing dirty/save/recovery
  boundaries are unchanged. The earlier multi-screen image→Use→scope→review
  interaction is superseded by this single selection/preview workspace.
- Whole collections retain deterministic order and repeat behavior, with visible
  image/slide/repeat counts. Earlier/later controls adjust this slideshow's
  proposed image order only, not the saved collection. Mobile uses a compact
  collection dropdown; portrait thumbnails preserve the complete source image.
- Music panels retain state between tabs and pause hidden/competing previews.
  Library upload/update work blocks tab switches, dismissal and selection Apply
  until settled. Failed image/music files can retry without uploading successful
  siblings again. Saving music still does not attach it automatically.
- 313 regression checks, TypeScript, scoped ESLint and isolated actual-component
  browser checks pass. See `docs/library-ui-clarity-2026-10-18.md` for laptop/mobile
  evidence. No deployment or authenticated production acceptance was performed.

### Library image hover controls — 18 October 2026, local

- The reported image-with-search overlay is consistent with Edge Visual Search,
  not an app-owned library action. Library thumbnails contain no outbound links.
- Library and image-picker dialog images no longer receive pointer hit testing;
  their containing selection buttons retain pointer/keyboard interaction. This
  suppresses image-hover browser controls without removing library selection,
  collections, preview or upload. Scope stays inside shared library surfaces.
- This is a local browser-overlay workaround, not a browser preference change.
  Browser-provided overlays are outside the page DOM; headless checks verify
  hit targets and selection, not all browser versions' native chrome.
- The actual library browser fixture passes pointer hit-testing over thumbnails,
  click/Space selection, no new tab/navigation, and its existing collection,
  replacement, music and mobile checks. No deployment was performed.

### New workflow edit text defaults — 18 October 2026

- New manual overlays and Remix-created text with no previous authored style
  default to Inter Bold (700) across the shared Hook, Talking Head, Demo and
  Wall-of-Text video editors. Keep existing size, position and compact controls.
- Existing saved font/weight choices and explicit text preset selections remain
  authoritative. Do not rewrite old drafts or alter the baked-in footage text.

### Automatic 4:5 slideshow uploads — 18 October 2026, local implementation

- Edit slides → Add slides → Upload images and Replace image automatically
  prepare non-4:5 photos on a 1080×1350 canvas before uploading. This includes
  9:16, square and landscape images. Exact 4:5 files pass through unchanged.
- Preserve the full, orientation-corrected image without stretching or cutting
  off existing text. Center a proportionally fitted foreground over a soft
  blurred cover copy. This is deterministic canvas processing, with no AI
  generation, credits or additional manual step. The user's local file is not
  modified. Conversion errors block that upload and retain the existing draft.
- Upload the actual fitted bytes as the owned source asset, so preview, text
  overlays, saved Library output and scheduling use the same ratio. Process at
  most two images at a time; retain successful files in source order and existing
  partial-upload/retry guards. No historical saved or scheduled image is rewritten.
- Scope is new device uploads/replacements in the manual Explore editor. Existing
  generated images, selected reference originals and Library selections retain
  their current contracts. Generation's reference uploads are not normalized.
  4:5 is this product decision, not a claim that TikTok prohibits other ratios.
- Verification is local; no production image, schedule or migration is written.
- Local results: 130 focused tests, TypeScript and scoped ESLint pass. The actual
  editor/Add slides browser suite passes marked 9:16 upload, square replacement,
  saved asset/reopen, partial failure, ordering, retry and mobile/touch checks.
- Broader `explore-slideshow.browser.cjs` passes upload/save/retry/owner checks
  but fails its final image-panel recreation assertion: after changing the edit
  target, the generation request omits the previously attached owned IDs. A
  temporary fixture restoring the pre-conversion upload function fails at the
  same assertion. This is separate from fitting and remains unresolved; do not
  report full generation acceptance from the passing conversion tests.
  No deployment was performed for this change.

### Shared image collections and music library — 18 October 2026, local

- Settings → Media library and Trending's Library pill share owned image
  collections and music management. Explore slideshow Add slides, selected-slide
  image replacement and Your slides → Library backgrounds open the shared picker.
  Optional generation references can also reuse a saved image.
- Preview one image on the selected slide/every slide, or a collection in its
  displayed order, repeating from the beginning if needed. Apply rechecks every
  used source before one draft change; cancellation/failure preserves the draft.
  Slide identities/order and editable text survive, and changes invalidate the
  saved output so normal Save still gates scheduling. Collection membership
  changes never update an existing draft or post automatically.
- Image collections reuse existing asset groups. Removing a collection/member
  keeps original files; archive hides future image selection but preserves existing
  draft/saved sources. Collection order uses added time plus asset ID; manual
  collection reordering is not implemented.
- Music management accepts uploads up to 25 MB/10 minutes. Existing edit audio
  pickers expose Add music to library in place and list those owned tracks.
  Whole-video background music can reuse a verified media ID directly, without
  another upload or implicitly enabling music. Dedicated speech/voice-reference
  libraries and demo/whole-video audio scope remain separate. Native image
  slideshows do not acquire a new music publishing/composition stage.
- No migration, worker release or production write. Local API/component tests,
  TypeScript, scoped ESLint and isolated browser checks pass; hosted authenticated
  acceptance remains pending a website deployment. See
  `docs/media-library-collections-2026-10-18.md` for the validation evidence.

### Trending slideshow text controls — 18 October 2026, scope clarification

- Follow-up correction: movement must not introduce a white background. Trending
  now separates position from explicit None/Per line/Text box styling and uses
  compact controls, multiline hooks, wrapping width, alignment, weight and line
  spacing. Saved styles and line breaks share preview/worker geometry. See the
  latest CAROUSEL_CONTEXT.md entry for compatibility and local validation. The
  user-reported implicit panel and single-line input were implementation defects;
  compilation alone did not establish that these controls were usable.
- The requested advanced text controls belong to Trending → Carousel Edit,
  which has a different persisted edit contract and worker from manual Explore
  Slideshows. Added per-slide typeface, size, color and free text-group placement
  there. See CAROUSEL_CONTEXT.md for the rendering/persistence decision.
- Explore's generated image text remains baked into the image. This change does
  not turn those pixels into editable text or change Explore generation, its
  existing added-text overlay tools, or the preview Save/Schedule correction.

### Simple scheduling and repeat posts — 19 October 2026, local

- The user-approved flow is accounts/caption/date/time → **Schedule post** →
  **Post scheduled** with **View in Scheduling** → **Schedule another post**.
  The last action opens a fresh intent for the same content and keeps the form
  settings available to edit. This applies to background-prepared video,
  prepared Hook/Wall/Talking Head/Phone video, and Explore slideshow scheduling.
- Remove the user-facing Check saved request / Confirm the same saved request
  controls. After a lost POST response, reconcile the exact receipt with a
  read automatically. If it is still unconfirmed, expose one **Try again**
  action that preserves the original request; do not invent success or silently
  create a replacement. Hydration and preparation polling remain read-only.
- Retain time/account validation, receipt verification, cross-tab locks and
  double-click protection. Local fixtures are distinct from production
  acceptance; this change has not been deployed by this task.

### Repeat scheduling — 18 October 2026, local

- A confirmed schedule is a completed post, not a permanent lock on its media.
  Hook, Wall-of-Text, slideshow, Talking Head and background-preparation
  workflows now show **Schedule another post** after confirmation. The user can
  choose a different date, time, caption or account and create another post
  from the same completed content.
- Confirmation remains intentionally different from an interrupted request. A
  network-uncertain request keeps its exact idempotency key and is checked
  automatically or retried through Try again; it cannot be replaced by editing
  the form. A confirmed request is
  archived locally before a new intent is opened, so a late response or another
  tab cannot replace the active request or create a duplicate post.
- Background preparation retains its durable request and delivery guarantees.
  A newly requested repeat is a separately recorded schedule intent; successful
  posts remain available in Scheduling. Local regression coverage includes an
  hour-later repeat, double clicks, tab races and owner-scoped cache updates.
  No production post or media generation was made by this verification.

### Slideshow preview Save and Schedule — 18 October 2026, local implementation

- Create → Your Slides exposes the existing Save slideshow action below its
  current sequence. After a confirmed save it becomes Schedule slideshow;
  users no longer have to enter Edit slides just to save or continue.
- Reuse the same mounted editor, save receipt, retry identity and dirty state.
  Reordering, removing or adding slides invalidates the saved sequence and
  restores Save. Never schedule unsaved edits or silently save on navigation.
- Show one action footer in the visible surface: preview when Create is active,
  inspector when Edit slides is active. Keep progress/errors and pending-save,
  upload, generation, recovery and minimum-slide protections in both surfaces.
- Scope is Explore slideshow UI only. Scheduling still opens its existing
  account/date confirmation step; no post is submitted by this action.
- Entering Schedule from the preview reveals the scheduling controls on compact
  screens, instead of leaving the saved-post preview selected.
- Validation: 189 focused workspace/editor/generation/import tests, TypeScript,
  scoped ESLint and actual-editor desktop/mobile browser checks pass. Covered
  save/retry identity, duplicate clicks, preserved text/order, dirty invalidation,
  reload and the scheduling handoff. No production save or post was submitted.
  This implementation is local; deployment and authenticated production
  acceptance have not been performed for this change.

### Scheduling navigation freshness — 18 October 2026, local fix

- Confirmed schedules from Format Hook/Wall/Slideshow, Talking Head finishing
  and background preparation now update and invalidate the current owner's
  shared schedules query. Unconfirmed requests never create calendar rows;
  restoring a verified receipt updates the cache without another POST.
- Scheduling keeps cached rows visible but always reconciles the schedule list
  on entry, bypassing its 30-minute freshness window. Media and connection
  catalogues retain their existing caching. Existing focus/visibility refresh
  and bounded preparation/publishing polling remain intact.
- This fixes the workflow → View in Scheduling handoff that otherwise needed
  a browser reload. Router refresh alone does not invalidate React Query data.
  Exact request identity, duplicate protection, saved drafts and account cache
  isolation are retained. Local regressions are separate from deployment and
  authenticated production scheduling acceptance; no real post is scheduled by
  this verification.

### Source-post entitlement loophole — 17 October 2026, production audit

- Audit of deployed commit `a493dbd6` found that Talking Head and Hook reference
  source icons use `useAIStudioAccess() === "pro"`. That flag comes from
  `isAIStudioProUser`, which admits inactive/free subscriptions whenever their
  lifetime free-generation grant is positive, even after the grant is spent.
  Such free users receive real TikTok/Instagram links instead of Upgrade to Pro.
- The button/dialog component correctly blocks a locked access value, but prior
  mocked free/Pro browser checks did not verify the actual entitlement resolver.
  Passing those tests is not proof that a real free subscription is restricted.
- Source-post access needs its own active-Pro entitlement, separate from free
  AI generation eligibility. Preserve free generation credits and apply the
  source restriction to Talking Head, Hook Format and Recreate entry points.
  Wall-of-Text reference cards currently render no source-post icon at all.
- Executing the deployed resolver with inactive/free fixtures confirmed grant
  zero → locked; positive grant with remaining credits OR remaining zero → pro.
  This is an audit finding, not a fix: no entitlement or production change was
  made in this turn. A complete regression must cover free accounts with grants,
  spent grants, active plans, checking/error states and both social platforms.

### Source-post entitlement fix — 17 October 2026, local

- `ReferenceSourceAction` now needs a fresh, verified active Starter or Growth
  billing subscription before it renders an external TikTok or Instagram link.
  Free generation credits, whether remaining or spent, retain generation access
  but show the social icon as an Upgrade to Pro control.
- The inherited generation-access flag remains an extra fail-closed condition.
  This covers Talking Head, Hook Format and Recreate galleries through their
  shared source action. Wall-of-Text still renders no source-post icon.
- Regression checks cover free grants, spent grants, valid active plans, and
  unavailable billing states. Local coverage is distinct from authenticated
  production acceptance; deployment evidence belongs in the release record.

### TikTok slideshow publishing and stale status — 17 October 2026

- Accept PNG uploads and create platform-compatible JPEG publishing copies
  automatically. Do not make users re-upload JPG/WebP, overwrite originals,
  replace Library slide URLs or reorder their sequence. The shared publisher
  covers manual Explore slideshows and automatic Carousel Library items.
- A failed physical publishing job must settle its currently linked owned
  platform target, clear its retry date and retain any other platform success.
  Retry budgets cannot advertise attempts beyond the worker's actual limit.
  Upcoming and overdue retry times have distinct neutral UI wording; photo
  failures must not claim that a video failed or that retrying unchanged helps.
- Production migration `20261017105341` repaired the reported TikTok target to
  Failed with no retry date; the overall schedule is Partially failed because
  Instagram published successfully. Original 11:10 IST time and the Instagram
  receipt remain unchanged. No historical publishing attempt was submitted.
- Conversion, worker retry-limit handling and revised UI wording are tested
  locally and await worker/website release. Database status protection is live.
  Keep this distinct from successful end-to-end TikTok publishing acceptance.
  See `docs/tiktok-slideshow-publishing-fix-2026-10-17.md`.

### Complete TikTok mark in references and scheduling — 17 October 2026, local

- The shared TikTok SVG path extends to y=25.522, beyond its former 24×24
  viewport. This clipped the lower curve in reference source buttons and
  Schedule platform choices. Pad the full mark with `viewBox="-1 -1 26 28"`
  and prevent flex shrinking; retain the existing size/color at each use.
- The complete-workflow browser regression reproduces the old clipping by
  comparing the path's measured bounds with the SVG viewport. With the fix,
  the path fits fully inside reference icons and selected/unselected Schedule
  icons at laptop and mobile widths. This fixes all consumers of the shared
  icon, including other scheduling/account interfaces. No platform gating,
  publishing permissions, destinations or source-link behavior changes.
- Older section tests assumed Demo had a separately conditional overview;
  check the single shared Create/Demo overview instead. Visibility rollback
  tests inspect TikTok choice attributes rather than rejecting a preserved
  saved TikTok draft's required music-agreement notice. These are fixture
  updates to current product behavior. Local checks remain distinct from
  authenticated production acceptance; this change is not deployed.

### Talking Head gallery simplification and complete-screen review — 17 October 2026, local

- The user rejected the reference gallery's repeated card names, duration/type
  rows and long limitation paragraphs. Keep References / Your videos above
  the gallery, portrait previews, source icons over the footage and one compact
  action button per card. Remove the additional gallery heading and description.
  Preserve accessible video names. Preview only is a working playback action;
  its generation-limit explanation belongs in accessible text/title, not a
  paragraph repeated beneath every long clip.
- Match Hook's 200px minimum responsive gallery grid instead of fixed three
  columns: 1366/1536 laptop layouts show four cards, approximately 209×371 and
  245×435 respectively. Mobile keeps two columns. Retain the original files.
- Recurring review mistake: a gallery-only fixture omitted the real Create /
  Demo / Schedule navigation and References / Your videos, leaving the user
  unable to assess the actual screen. Present screenshots of the complete
  `HookWorkflowPreview` component and label local previews accurately. The new
  full-workflow browser fixture verifies both navigation sets, empty and selected
  Your videos states, Demo setup, in-place Saved demos Change, demo text editing
  and return to the same Create overview at 1366, 1536 and 390px.
- Talking Head's focused editors intentionally hide Sound setup, but that also
  left no original-demo-volume control in the Demo sidebar. Mount the demo's
  existing edit draft immediately and portal its original-volume slider into
  Demo; use the same edit JSON, preview and Save demo edits operation. Keep
  uploaded demo audio separate from whole-video background music. Returning to
  the clip editor must preserve the sidebar volume and other text/trim edits.
- Local acceptance uses browser-only media uploads with generation disabled;
  no production/API writes. Full-workflow checks prove live demo-volume preview,
  text edits, correct Saved demos inventory and compact cards. Production still
  requires authenticated verification after deployment.
- Final local checks: 101 focused regressions, TypeScript and scoped ESLint
  pass. Full-workflow browser screenshots use the actual component at laptop
  and mobile sizes; shared Hook/Demo/Wall editor checks also pass from 320–1900px.

### Talking Head references and Create overview — 17 October 2026, local

- Talking Head + Demo uses References / Your videos in the first-screen right
  workspace, matching Hook's navigation. Your videos reuses the **one mounted**
  hook/demo overview from Demo, including empty, opening-only, demo-only and
  two-clip states, independent text/trim drafts and in-place Change menus.
  Generated videos opens existing generation results/progress; returning to
  Your videos does not stop generation or unmount the clip editors. Demo setup
  and audio controls remain in Demo. Wall remains a single-video workflow;
  Slideshow already has its analogous current-sequence overview.
- The separate Talking Head catalogue contains the nine explicitly selected
  nonignored MP4s from folders 24, 25 (including child folders), 35, 37, 38 and
  41. Folder 40 contains no selected video. Ignore `fullvideo_ignore` originals.
  The user said **keep them** when offered opening excerpts: preserve all nine
  supplied files byte for byte, including mixed/long clips; do not silently
  cut them to ten seconds. Each has a poster and its matching TikTok source.
- Video-reference inputs currently support at most 30 seconds with Seedance
  and 15 with WAN. The 35.267s and 46.416s examples remain full-length previews
  with an explicit Preview only reason. The 27.867s example requires Seedance.
  Keep a compatible selected model; otherwise choose an available compatible
  one. Round generation duration to the nearest supported whole second, respecting
  model bounds (WAN 3.3 → 3; Seedance minimum 4). Display source and generation
  durations separately; reference length is not a promise of output length.
- Use as reference attaches the actual clip and editable reference directions.
  Keep the user's own instructions and demo untouched; submit both instruction
  fields together. Directions guide a talking-head opening and explicitly omit
  source phone demos/overlays. Never insert a reference into Demo/Saved demos.
  Persist the catalogue ID and edited directions in verified workflow sessions;
  reacquire the exact static clip on return. Recovery must preserve directions
  typed during download. Failed replacements retain the prior attachment but
  block generation until retried, replaced or removed.
- Reuse custom reference playback without a Download option and the existing
  free-user Upgrade to Pro source-link gate. Original source links open for Pro.
- Verification is local: 117 focused regressions, TypeScript (after Next route
  type generation) and scoped ESLint pass. Catalogue/source hashes, authenticated catalogue reads,
  model limits, exact attachment, prompt composition, reference recovery and
  shared overview navigation are covered by focused regressions. Subsequent
  browser verification plays all nine originals, checks decoded frames/full
  durations, picker thumbnails, laptop/mobile layouts, in-place Change, pending
  demo uploads and shared hook/demo/Wall editors. The production browser reaches
  sign-in; authenticated production acceptance is still pending. Not deployed.

### Reference videos inside the workflow preview — 17 October 2026, local

- The isolated Talking Head gallery initially looked correct, but the surrounding
  workflow's broad `.preview video` rules capped its footage at 300px: a 281×499
  card contained only 169×300 media. Reproduce sizing checks inside the actual
  workspace/stage/preview CSS, not only a standalone gallery wrapper.
- Mark reference-card footage with `data-reference-preview-video` and exclude
  it from the shared output/editor caps using zero-specificity `:where`. Cards
  retain their own full portrait frame. Keep existing editor/player sizing
  specificity, natural aspect ratios and whole-frame rendering intact.
- Added a browser assertion for card/media geometry within the surrounding
  workflow CSS at laptop and mobile widths. All nine reference previews decode
  and play without native controls; their supplied full durations remain intact.
  Shared Hook/Demo/Wall tests cover paused edits and portrait/landscape/square
  edges. Local display regressions pass (155 tests); production remains separate.

### MCP finishing fixture font dependency — 17 October 2026, local

- `scripts/mcp-video-finishing.test.mjs` sandboxes the shared
  `explore-format-edit` module to validate the MCP finisher. When that module
  gained the bundled Explore-font metrics dependency, the harness failed before
  registering any finishing tools because it only mocked the overlay-width
  module. Load the real, static font-metrics module through the same sandbox
  before loading the editor contract.
- This is test-fixture dependency wiring, not a change to rendering, font
  choices, saved drafts, MCP permissions, or customer media. Keep the fixture
  loading the actual metrics JSON so a missing or malformed bundled metrics
  resource fails the focused MCP regression.

### Slideshow Create overview and cross-workflow follow-through — 17 October 2026, local

- Recurring mistake: fixing Hook's Create → Your videos without checking the
  equivalent Create → Your Slides left slideshows showing generation's generic
  placeholder instead of the current edited sequence. For workflow corrections,
  check Hook, Talking Head + Demo, Wall of Text and Slideshow applicability in
  the same task; preserve meaningful workflow differences and record exceptions.
- Slideshow Create → Your Slides now uses the same mounted editor preview,
  ordered sequence and text overlays as Edit slides. Add slides, preview,
  reorder and removal operate on that one draft. Edit slides opens its text
  inspector; Create keeps its existing generation instructions in the sidebar.
- Generated slides opens the existing generated versions and History. New or
  recovered jobs reveal generation results/progress; explicit Your Slides
  returns to the current sequence without stopping polling. Recreate slide
  reveals generation results. Selecting a generated version remains explicit
  and continues to archive earlier edited drafts; generation never replaces a
  current sequence automatically. References remains the reference gallery.
- Scope is manual Explore presentation/navigation. No Carousel planner, slide
  generation, saving, scheduling or slideshow data contract changes.
- Local verification: 180 workspace/editor/generation/grouping tests pass;
  TypeScript and scoped ESLint pass. The real editor/Add slides browser fixture
  passes Create/Edit text continuity, adding from Create, save/reload, reorder,
  recovery and mobile checks; Create preview screenshots inspected at laptop
  viewport sizes (1366 and 1536). These are isolated fixtures, not authenticated
  production acceptance. Not deployed.

### Hook Create Your videos overview — 17 October 2026, local follow-up

- In Hook Video, Create → Your videos shows the same mounted Hook/Demo clip
  overview as the Demo stage, including no footage, demo-only, opening-only and
  two-clip states. Do not show the generic generation empty-state placeholder
  merely because Generate is selected and no opening has been chosen yet.
- Keep source cards, selected media, independent edits, in-place Change and
  Saved demos identical between these views; switching Create/Demo must not
  mount another demo draft. Demo setup/audio controls still belong to Demo.
- References retains its gallery. Generated videos stays available from the
  overview even before a clip is selected and reveals the existing results/
  History. Starting a generation reveals progress; explicitly clicking Your
  videos returns to the cards while the generation component/polling remains
  mounted. Do not discard pending jobs, results or prior selections.
- This view decision is specific to Hook's existing Create → References/Your
  videos tabs. Wall stays a single-video workflow; slideshows are unchanged.
  Local validation and deployed acceptance remain separate.
- Local verification: 122 workspace/demo regressions, TypeScript and scoped
  ESLint passed. Checks exercise empty Create cards, the shared Demo portal/
  draft identity, References, generation progress, results/History access and
  return while generation is busy. No new CSS/layout is introduced; this reuses
  the existing Demo cards. A fresh production interaction check and deployment
  of this follow-up have not been performed.

### Slideshow thumbnail arrangement — 17 October 2026, local implementation

- Your slides exposes a small, always-visible bin on every thumbnail and a
  separate drag handle. Removing a thumbnail removes it only from this draft;
  it does not delete the owned image or submit generation. Keep the existing
  Earlier/Later controls as an additional keyboard-friendly way to arrange slides.
- Mouse and touch dragging commit one reorder on drop. Show the destination,
  scroll a long filmstrip at its edges, and cancel without changing the draft
  when Escape is pressed or the pointer is cancelled/released outside the rail.
  Handles also support Left/Right and Home/End, with a screen-reader announcement.
- Move stable slide identities, not image URLs or text positions. Keep the
  selected image and all its text/appearance/provenance together when moving
  another slide or removing a preceding slide. Deleting the selected slide
  selects its nearest remaining neighbor. Preserve existing draft recovery,
  save invalidation and the two-slide minimum for saving.
- Lock ordering/removal during save, upload, recovery and active generation.
  Verify actual pointer/touch gestures, cancellation, saved order and reload;
  passing pure move-array tests alone does not establish usable dragging.
  Local implementation and production deployment remain separate.

### Demo inventory correction — 17 October 2026, local follow-up

- Repeated mistake: copying a Hook source menu into Demo exposed Creative
  Assets, even though reusable demo footage belongs to the **Demo** screen
  (`/library`), not Creative Assets. Never infer the demo inventory from the
  fact that both are represented as playable media assets.
- Hook Video and Talking Head + Demo now show **Saved demos** in both sidebar
  setup and empty/selected preview-card menus. Keep direct Upload video and
  in-place Change. Saved demos opens the content picker using
  `/api/demo/sources`, owner-scoped Content demo records with ready `demo_upload`
  playable projections. It must exclude ordinary creative/generated videos.
  Hook/opening selectors continue to use Creative Assets.
- New Talking Head demo uploads and its edit-preparation fallback use the same
  Demo upload pipeline as Hook: MP4/MOV/WebM, 1–60 seconds, up to 100 MB.
  Uploads appear on the Demo screen and can be selected later through Saved
  demos. Do not keep a generic `explore-demo` upload hidden in Creative Assets.
  Already accepted legacy workflow media/edits remain recoverable; no automatic
  migration, deletion or re-upload of earlier files is performed.
- Preserve independent Talking Head demo audio and whole-video music. Wall of
  Text has no Demo stage; its single background/opening source still uses
  Creative Assets. The storage boundary is a workflow difference that must
  survive shared UI work. Local verification is separate from deployment.
- Local verification: 143 targeted tests, TypeScript and scoped ESLint passed.
  Actual-component browser fixtures verify Saved demos in the sidebar/Change
  menu, separate picker inventories, poster/first-frame selection, draft
  retention and laptop/mobile fit. These tests use isolated account/API data;
  no production upload, migration, publishing or deployment was performed.

### Hook Remix final-frame captions — 16 October 2026, local fix

- The reported 3.167s Hook switched from “SaaS founders!! / This app is a game
  changer” to a smaller “I used to think marketing my SaaS / would take so much
  time” caption. Production Remix receipts confirm two blocks. The reference's
  second block occupies only its final 3067–3100ms screen-cut frame; scaling
  moved it to 3133–3167ms. The generated raw footage contains no captions.
- Hook remix excludes the reviewed one-frame screen-cut captions for paired
  references 4585ee949081c4e5cd835cd3 and 7c53cba88343579e7e15c8b0 only when
  their exact two-block timing signature matches. Extend the main caption to
  the full clip. Keep catalogue transcriptions unchanged; do not globally drop
  short captions, rewrite Wall/slideshow copy, or flatten authored sequences.
- Apply this to reference text shown for Remix, new server requests, legacy
  completed Remix recovery and explicit Apply. Reuse immutable paid receipts;
  cleanup must not trigger another model request. An older applied clip draft
  with the exact inherited timing signature is repaired in its derived editor
  state, preserving main copy, font, weight, size, position/color, trim/audio.
  Explicit Save persists the corrected draft; existing exported media is not
  rewritten. Manual timing changes and unrelated reference identities survive.
- Keep full-duration text visible over the last paused clip frame, including
  the exact endpoint; intentionally earlier text end times remain respected.
  Preview, clip-save content and final sequence all use the corrected edit.
- Local implementation and production acceptance are separate. No production
  data was modified and no generation or deployment was performed for this fix.
  The 53 focused checks, TypeScript, scoped ESLint and actual-component ending/
  legacy-recovery browser test passed. Broader slideshow mock and older preset
  browser failures are recorded in `docs/hook-remix-final-frame-2026-10-16.md`.

### Scheduling preparation timing failure — 16 October 2026, local fix

- Production Hook + demo posts selected for 20:18 and 20:37 failed before
  platform scheduling with `COMPOSITION_TIMELINE_UNSUPPORTED`. The uploaded
  opening `06 Hook07 Detailed` starts its pictures at 25 ms and audio at zero;
  the demo starts both tracks at zero. Unchanged retries repeat this failure.
- Local composition now accepts nonnegative input starts up to 100 ms and
  preserves relative timing: first-frame padding for delayed pictures, sample
  silence for delayed audio, and bounded end-frame padding for its audio tail.
  Common origins normalize together. Zero-start filters, duration/file limits,
  source ownership/hashes and strict zero-start output validation are retained.
  Larger, negative, nonfinite or inconsistent timelines remain blocked.
- Unsupported timing now has an allowlisted actionable message instead of
  silently falling through to generic finishing failure. Never expose arbitrary
  worker errors or suggest unchanged retries will repair a deterministic file.
- The exact production hook/demo/music, saved trims and text rendered locally
  with unchanged input hashes using bundled and installed media tools. Synthetic
  checks verify event timing and leading silence, not just successful encoding.
  This is not deployed production acceptance. Do not auto-retry past schedules
  or publish during verification. See the investigation/fix report in
  `docs/scheduling-video-preparation-failure-2026-10-16.md`.

### Slideshow attachment/history correction — 17 October 2026, release preparation

- Preserve the product flow: selected reference slides, ONE editable prompt and
  optional attached images go to AI image editing. Generated images remain
  ordered/grouped by version. The star receives text only; generation receives
  the actual references and attachments. Do not add per-slide prompt forms,
  corner selection, manual placement or automatic compositing to this release.
- The rejected manual placement/area editor and unfinished automatic vision
  placement experiment have been removed, including worker helpers and tests.
  They were local experiments, not a production correction.
- Composer drafts now retain prompt and ordered uploaded-asset IDs by owner and
  reference selection. Restore revalidates owned ready assets; failed recovery
  blocks submission and offers retry or clearing attachments while keeping text.
  Explicit uploaded-screenshot requests without an attachment fail before billing.
  This conservative English preflight does not interpret every possible request.
- Image history recovers prompt/model from the owned saved job, including legacy
  images lacking prompt metadata. Worker output records submitted/effective text.
- Local flow tests establish input delivery/recovery, not visual fidelity. A prior
  production request included the screenshot yet the model redesigned it; exact
  screenshot reproduction remains unproven until inspecting a real provider result.
  Track deployment and production acceptance separately in the release report.

### Slideshow live recurrence — 16 October 2026, investigation only

- Distinguish individual batches: the 14:46 IST Sunburst v3 jobs included the
  uploaded Explore screenshot; the 20:45 IST Flare v3 jobs contained only two
  catalogue originals and zero attachment references. The screenshot still
  exists as ready owned media. Upload inventory is not current selection.
- The production star receipt confirms a text-only Luna rewrite (979 to 620
  characters), and both latest job inputs equal the rewritten text exactly.
  Do not diagnose this as an unused rewrite or assume the star removed images.
  Its hook changes text only. Current attachment selection is component state;
  the specific browser action preceding the omission is not established.
- Prompt history really lacks job-backed image prompt enrichment: completed
  media metadata omits prompt/model, `/api/media` adds only slideshow position
  for image jobs, and browser-local fallback can conceal the gap. Original and
  rewritten text remain recoverable from server receipts/jobs.
- Full-image generation still has no screenshot compositor. Prompt wording and
  successful reference delivery are not exact-placement acceptance. These
  findings justify attachment draft recovery/admission validation, history
  recovery and separate exact placement; this audit implements/deploys none.
  Evidence: `docs/slideshow-live-root-cause-2026-10-16.md`.

### Shared video-workflow parity — 16 October 2026, local follow-up

- Apply meaningful common improvements across Hook Video, Talking Head + Demo
  and Wall of Text without waiting for separate requests for each caller.
  Slideshow editing remains separate. Audit actual caller/state paths rather
  than assuming a shared editor updates every surrounding screen.
- Talking Head's older creator picker lacked Your images. Its shared creation
  form (also used by creator/phone) now offers Your images / UGC Pilot images,
  refresh/retry, rounded source tabs, Add images and thumbnail clipping. Use
  the same owner-scoped uploaded-image inventory as Hook/Wall. Opening a picker
  or selecting a reference must never generate a video.
- Saved image selection resolves the current owned record, stays pending from
  the click, preserves existing references on failure, and obeys model limits.
  Talking Head/phone generation revalidates the saved image ID under the owner
  and uses its current URL, without uploading another copy. Local uploads and
  catalogue references retain their existing generation/upload behavior.
- Talking Head overview uses the same in-place Hook/Demo source menus as
  Hook Video, with direct upload and the appropriate inventory: Creative Assets
  for the opening and Saved demos for Demo; Generate alone navigates
  to Create. Preserve independent demo-only audio and whole-video music.
  Do not clear accepted demo audio or leave a rejected demo pending indefinitely.
- Wall exposes Change directly in its text editor: upload or Creative
  Assets stays within Edit; Generate goes to Create. Its top-left Create return
  matches its footer and retains the draft; Explore remains a separate exit.
  Keep text-first editing, advanced-only trim/style/audio, full-duration text,
  one complete background track, and no Demo stage or clip.
- Shared font/weight presets, compact style controls, custom preview playback,
  removed Hook/Talking Head Crop/Sound panels, and retained drafts already use
  shared clip components. Do not add redundant controls while closing parity
  gaps. Record local validation separately from deployed production acceptance.
- Local verification: 293 regression tests passed, plus TypeScript and scoped
  ESLint. The actual Talking Head form/library passed saved/catalogue selection,
  unchanged instructions and popup bounds at 1536×864, 1366×768 and 390×844.
  Shared Hook/Demo/Wall editor fixtures passed in-place menus, keyboard dismissal,
  retained trim/text/fonts and layout checks across eight laptop/mobile sizes.
  Auth/storage/API boundaries were isolated; no paid generation or scheduling
  was performed. This follow-up is not deployed or accepted in production yet.

### Contextual Remix emojis — 16 October 2026, local implementation

- Hook and Wall of Text generated remixes choose emojis for the rewritten
  line's meaning, emotion, business context and requested style. Do not retain
  reference emojis automatically. Replace or remove mismatched emojis, keep
  usage sparse and allow none. Positive discoveries/free resources should not
  inherit crying/distress merely because the original caption used it.
- Explicit requests to keep particular emojis or omit emojis take priority.
  Original catalog transcriptions retain their exact emojis; this policy changes
  generated copy only. Existing saved remix results recover without regeneration.
- The shared provider prompt records version 2 for new requests. Both workflows
  use the same prompt/service; timing, styling, review-before-Apply and saved
  business-context behavior are unchanged. Local checks do not establish live
  model quality or deployment; no paid generation was requested for this change.

### Contextual editor return and in-place Hook replacement — 16 October 2026, follow-up

- In Hook Video and Talking Head + Demo focused clip editors, the top-left
  arrow is labelled **Videos** and returns to the current workflow's video
  overview, using the same close action as the footer's Back to videos.
  Keep the selected clips and mounted editing drafts. Returning is not saving
  or preparing a video. The overview's normal exit remains unchanged.
- Keep a separate Explore link in the editor header for leaving the workflow;
  a Content Demo entry retains its separate Demo/library destination instead.
  Talking Head retains its existing unsaved-work warning on the external exit.
- Hook Video's overview **Change** buttons open a compact anchored menu in
  place, rather than redirecting to Create or focusing the Demo sidebar.
  Hook offers Upload video, Creative Assets and Generate video; only choosing
  Generate moves to Create. Demo offers Upload video and Saved demos only.
  Reuse the existing owned-media selection/upload handlers, limits and filters.
  Cancel leaves the current clip and edits intact; failed replacement restores
  the accepted demo. Accepted replacements invalidate stale final output.
- Talking Head and Wall now also use in-place replacement menus as documented
  above. No tab, Edit button or workflow names are renamed.
  Avoid repeating the mismatch between the editor header exit and its footer
  return, or making Change navigate before the user chooses a source.
- The preceding preview/picker UI release is live at commit 702fe9d3. These
  navigation/menu changes are subsequent local work; production acceptance
  and deployment of this follow-up remain pending.
- Local verification: 134 selection, clip-draft, navigation and source-menu
  regressions passed, along with TypeScript and scoped ESLint. Real-component
  isolated browser checks cover Demo Change/keyboard dismissal at 1280×720 and
  1536×864, plus retained trim/text/font drafts after the Videos action across
  the eight laptop/mobile editor fixture sizes. These fixtures disconnect live
  authentication/storage and are not production acceptance.

### Recognizable clip selection and balanced Demo previews — 16 October 2026, local change

- Keep Create → Demo → Schedule for Hook Video and Talking Head + Demo. Demo
  is the setup stage; Hook video and Demo video identify the two preview cards.
  Do not rename the stage to Edit, Play Demo or Attach during visual work.
- Latest user decision: keep **Edit hook video**, **Edit demo video**, **Change**
  and **Demo** unchanged. The suggested Text & trim / Text & edit names were
  not approved. Deployment of the completed UI changes is now authorized again.
- Remove the visible Optional badge from Hook/Demo video headings and Demo
  upload. This is a presentation rule, not a new validation requirement: keep
  existing one-clip paths, demo-only Hook scheduling, ownership and limits.
  Demo sound remains a separate optional audio feature for Talking Head only.
- The shared Creative Assets/Demo video picker must show a recognizable poster
  or the video's first decoded frame beside its name and duration/ratio. Load
  footage only for visible rows; use a neutral icon if media genuinely fails.
  A missing saved thumbnail must not reduce every selectable video to an icon.
  Preserve owner filtering, ready-only selection, demo inventory separation,
  retry and refresh. Thumbnail loading must not block choosing a valid video.
- Hook overview media uses available viewport height instead of the former
  180–360px height/328px card caps. Wider/taller laptop workspaces get larger
  previews; compact/short windows remain bounded. Physical laptop inches are
  not detectable: test CSS viewports (1280×720, 1366×768, 1536×864, 1920×1080)
  and mobile. Preserve natural video aspect ratio; never stretch footage.
- Talking Head overview cards share header and preview-slot sizing, including
  empty/one-clip/two-clip states. Keep Edit and Change together beneath the
  selected clip. Empty hook has Add hook video; empty demo has Upload demo video.
  The newer shared in-place Change menus are documented above. Do not couple
  these actions to playback load.
- Recurring mistakes to prevent: generic media icons hiding identity; fixed
  tiny portrait caps leaving wide gaps; inconsistent header buttons shifting
  video tops; oversized Remove text competing with filenames; duplicate or
  misleading Optional badges; casual stage renaming; replacing source-change
  actions with edit actions. Preserve the established audio ownership rules.
- Local checks and deployed acceptance are separate. These changes were made
  after the user paused release 24a6faa4; they are not included in that frozen
  release, and deployment must not resume without the user's request.
- Local verification: TypeScript (after Next route type generation), scoped
  ESLint and 117 workflow regressions passed. Actual-component browser checks
  cover visible first frames/failed posters/lazy rows/keyboard selection and
  separate inventories; aligned previews at 1280–1920px and 320/390px mobile;
  empty/uploaded/cropped demos; Edit/Change before upload confirmation; retained
  pending edits; and existing Hook/demo/Wall advanced editing controls. These
  are isolated fixtures, not signed-in production acceptance.

### One-box slideshow prompt rewrite — 16 October 2026, local implementation

- Latest user correction supersedes the per-slide improvement dialog proposal:
  keep ONE prompt field. A sparkle button inside its lower-right corner rewrites
  the existing conversational text in place. Do not add separate prompts,
  per-image forms, attachment checkboxes or another review dialog. The rewritten
  text stays editable; Undo restores the exact pre-rewrite text. Generation
  remains a separate explicit action and uses the current text-box contents.
- Icon clarification: show one four-point star only, without extra sparkles,
  surrounding circles, visible border or button background. Keep an accessible
  label and keyboard focus indication. Reserve a footer in the prompt box so
  text cannot scroll underneath the star or attachment controls.
- The text-rewriting endpoint accepts only {prompt}. No selected-slide numbers,
  attachment metadata, business profile, image URLs, OCR or pixels are sent.
  User-typed URLs remain ordinary text; the rewriter does not browse or claim to
  inspect images. Preserve exact wording, URLs, exclusions, per-slide scope and
  reference labels as authored. Do not invent scenes, props, claims or CTAs.
- Return ONE prompt plus optional clarification notes displayed below the input.
  Users resolve those by editing the same prompt; no extra per-slide workflow.
  Duplicate clicks are fenced, and delayed results cannot overwrite text after
  the user changes the request, reference inputs or account.
- The prior per-slide generation compiler and attachmentLabels worker changes
  were removed. Existing image-generation request/worker contracts, reference
  delivery, business context, billing, version grouping and recovery are retained.
  Actual reference/uploaded images are still sent during image generation.
  Exact screenshot compositing remains separate and is not implemented here.
- Private improvement receipts and a service-only invoker claim RPC prevent
  automatic repeated provider calls and enforce 20 attempts per rolling 24h per
  owner. No image-generation credits or image jobs are created by rewriting.
  Browser recovery reuses request identities after uncertain responses. Provider
  SDK retries are off; terminal failure retries require an explicit new click.
- Local tests, browser fixtures and deployment acceptance are distinct. Apply the
  slideshow_prompt_improvements migration, deploy the web API/composer and enable
  EXPLORE_SLIDESHOW_PROMPT_IMPROVER_ENABLED=true. No worker change is required for
  this simplified feature. OPENAI_SLIDESHOW_PROMPT_MODEL optionally overrides the
  existing text-model default. Deployment and actual provider-output quality
  evaluation remain pending. See docs/slideshow-prompt-improvement-2026-10-16.md.
- Local verification passed: 161 focused/regression tests, TypeScript, scoped
  ESLint, desktop/mobile one-box browser checks and full 166-route builds.
  Payload checks confirm no saved business context reaches the text rewriter;
  existing image-generation tests confirm its owner-frozen profile still does.

### Video text fonts and compact inspector — 16 October 2026, local implementation

- The user approved Inter, DM Sans, Roboto Condensed and Montserrat, then
  clarified that the existing compact Text style card must remain. Add only
  one small bottom row with Font and Weight side by side. Do not turn the
  inspector into a wide form or add another section/page. Keep the existing
  preset, position/color and sliders in place. The wide isolated font fixture
  is not the product layout; full-editor screenshots verify the compact card.
- Fonts and weights (Regular 400 / Medium 500 / Bold 700) are independent
  overrides. Both existing presets remain. Selecting a preset resets its weight
  while retaining the chosen family; font/weight changes retain authored copy,
  timing, color, size and position. Original (Arial) preserves legacy appearance
  and offers its existing Regular/Bold weights. New Hook text starts in Inter
  Medium; new Wall text uses Inter Regular. Existing edits gain no new defaults.
- The shared clip editor supplies these choices to Hook and Talking Head/demo
  clip editing. Wall keeps these controls behind its existing advanced Edit
  action and retains full-duration text. Speech-caption styles and slideshow
  typography are separate and are not changed by this feature.
- Optional, whitelisted font/weight fields survive save/reopen, sequences and
  Remix. Missing fields retain old normalized drafts, wrapping, fingerprints
  and rendering paths. New faces use matching bundled WOFF2/TTF assets with OFL
  licenses and pinned-source hashes, prepared by `prepare-explore-text-fonts.py`.
  Their advance metrics drive shared line wrapping. Fonts load locally; no
  Google Fonts request is required when a user edits or exports a video.
- Export draws supported glyphs directly from the bundled face into the existing
  SVG/PNG text layer. Do not rely on runtime system-family substitution: initial
  native-lookup tests produced duplicate faces. Unsupported glyphs retain the
  existing system fallback (including emoji/CJK). Legacy exports are unchanged.
  The worker adds opentype.js; install its locked dependencies before rendering.
- Local verification: worker build, TypeScript and scoped lint passed; 128
  focused tests covered all 12 distinct faces, actual timed video export,
  validation, legacy drafts, blank drafts, Remix and clip behavior. Browser
  checks covered all 12 web faces, save/reopen, Wall advanced-only controls and
  the real Hook/demo/Wall layout at 320–1900px. Font and Weight share one row
  under 65px high; the existing desktop inspector remains at most 300px wide.
  These changes are not deployed. Production acceptance requires the updated
  worker (dependency/assets) before the web release and a signed-in check.
- Final combined Next build compiled successfully, but its TypeScript phase
  failed in concurrent slideshow work: `slideshow-prompt-improver.tsx:35–36`
  passes a number where AbortSignal is expected and assigns unknown to its
  result type. Earlier TypeScript checks passed before that new component
  arrived. Do not report the combined build as passing or deploy on that basis.

### Choose image picker polish — 16 October 2026, local change

- The user's circled Add image and image-source tabs requested UI polish only.
  Keep Choose image, Add image, Your images and UGC Pilot images labels and
  existing selection/upload/generation behavior. Opening the picker or selecting
  an image must not start video generation.
- Add image is a compact rounded button with a plus icon; sources are separate
  rounded tabs with a clear selected state. Use rounder clipping on saved,
  catalogue and selected image thumbnails. Keep keyboard focus, owner scoping,
  limits, pending state and saved-image reuse intact.
- Local checks: 16 existing reference-picker tests, scoped lint and TypeScript
  passed. Actual-component browser fixture checked source tabs, saved selection,
  native upload chooser and laptop/narrow fit. No deployment or authenticated
  production acceptance is claimed for this change.

### Slideshow assembly and Add slides — 16 October 2026, local implementation

- The user authorized only assembly/UI work; exact screenshot placement and AI
  generation-quality corrections remain deferred. Group each generated version
  as one ordered horizontal strip with explicit **Edit these N slides**. Do not
  auto-populate drafts on completion. Whole-version switching archives the prior
  draft; individual Add and Replace labels reflect the actual pending action.
- Add slides opens an in-place picker: Generated images / Original reference /
  Upload images. Create new slides alone navigates to Create. Original selection
  is optional and explicit, includes source numbers and Select all remaining,
  and marks already represented originals/recreations. Never include all source
  slides automatically. Show the 10-slide capacity and block oversized choices
  without truncating a 12-slide master.
- Catalogue originals are registered as owned ready images through the new
  authenticated reference-images endpoint using server-resolved IDs and immutable
  storage objects. Uploaded references reuse owned IDs. No AI generation credits
  are consumed. Keep v2 owned-source save/editable-draft contracts and legacy
  fingerprints unchanged. New originals fill source-order gaps while existing
  slide order, text and edits are preserved; generated/upload additions append.
- Local verification: 150 tests, TypeScript, scoped lint and full 164-route build
  passed. Real editor/picker desktop/mobile checks and existing recovery browser
  regressions passed. These changes are not deployed and signed-in production
  acceptance remains pending. See `docs/slideshow-assembly-ui-2026-10-16.md`.

### Catalogue video previews and source-post access — 16 October 2026, local change

- Hook and Wall reference popups use the shared custom play/pause, seek, mute
  and fullscreen controls. Do not reintroduce native video controls, a Download
  action, picture-in-picture or remote playback here. Suppress the reference
  video's context menu. This concerns catalogue reference footage; owned output
  downloads retain their existing rules. UI restrictions are not copy protection
  for media delivered to a browser.
- Keep the Hook Instagram/TikTok source icon visible for free accounts. Clicking
  it opens **Upgrade to Pro** with a pricing link, without opening the source,
  selecting Recreate or opening the preview. Only verified Pro access supplies
  the external source link. Unverified access must not expose a clickable source
  link. Apply this to both overlay and compact-caption icons and both Explore
  workspace entry points. Wall continues to have no source-post icon.
- Verify mouse and keyboard upgrade actions, Pro navigation, Hook/Wall custom
  playback, close/unmount, and short/narrow viewports. Local checks are separate
  from authenticated production acceptance; the production browser currently
  redirects to sign-in. This change has not been deployed from this chat.
- Local verification passed: 65 focused tests, TypeScript and scoped ESLint.
  The real-component Edge fixture covers free mouse/keyboard gating, Pro source
  links, independent Recreate, play/pause, keyboard seeking, mute, custom-control
  fullscreen, suppressed context menu, close/unmount, 1280×720 and 390×844 fit.
  Wall uses the same dialog/player with Wall format metadata in this fixture;
  this does not establish authenticated production playback or entitlement state.

### Add slides and exact-asset use — 16 October 2026, user clarification

- Retaining unchanged originals is the user's choice: they may add some or all
  remaining master slides. Do not automatically add every ungenerated original.
  Proposed Add slides opens an in-place picker with Generated slides, Reference
  slides and Upload images sources; only Create new slides navigates to Create.
  Reference slides should offer numbered thumbnails, multi-select, select all
  remaining, existing-slide indicators and an explicit Add selected action.
- Generated results remain grouped by batch/version; users can use the version
  or choose individual outputs. Reference identity/source position is distinct
  from output position. Additions retain reference order and existing edits;
  users can reorder/remove before saving. Imports consume no AI generation
  credits and must retain owned-media/readiness validation and the current cap.
- A sparkle/prompt-improvement button may offer an editable, optional per-slide
  brief, but cannot guarantee exact screenshot insertion or silently rewrite
  instructions. Recommend a separate Place image operation: choose the uploaded
  asset, target slide and four screen corners; preview a perspective transform
  of actual pixels. Use relevant business facts only, not an automatic request
  to invent a brand interface. These design decisions are not implemented yet.

### Fresh v3 fidelity and master-slide assembly audit — 16 October 2026

- Release `d73ef153` deployed the earlier local v3, notice, provider-error and
  Explore corrections. Historical local/pending notes below describe their
  earlier state; they are not evidence that v3 is still undeployed.
- Fresh batch `09e14462-478d-4a58-af80-d04a2cef4847` completed at 14:47 IST
  with v3 and Sunburst, Marketing slides 1/4 and the uploaded Explore screenshot.
  It still invents a white website instead of inserting the actual dark screen.
  Exact screenshot compositing and visual-fidelity acceptance remain absent.
- The user now requires a version's generated images to appear together and
  a way to retain/add unchanged master-reference slides around replacements.
  Grouping metadata exists, but cards remain individual; image selection appends
  unless an explicit replacement is pending. The current owned-image editor has
  no master-original picker/import. Do not claim these are supported already.
- Marketing 01 has 12 originals; saved slideshows currently support at most 10.
  Preserve original positions and batch provenance; never silently truncate or
  weaken ownership checks. The safe design imports chosen catalogue originals
  as owned media and retains the current editable save contract. These are
  requirements/proposals, not completed implementation. See
  `docs/slideshow-fidelity-and-master-assembly-2026-10-16.md`.

### Nearest-second reference selection — 16 October 2026, latest correction

- The user's latest instruction replaces the earlier round-up policy for new
  Hook/Wall Omni reference submissions. Auto-select the nearest whole second:
  3.3 → 3, 3.49 → 3, 3.5 → 4, 3.7 → 4, 6.3 → 6 and 6.7 → 7. Retain the existing
  three-second minimum. UI seconds, submitted admission duration and the server's
  new credit reservation calculation must use the same rule.
- The Duration field shows this rounded selection. A compact hint retains the
  actual reference length and states that Omni keeps source timing. This request
  changes the seconds selection; it does not authorize silently trimming,
  stretching or padding an Omni source edit. Fractional source metadata and the
  output-duration validation remain intact. Existing admitted jobs/receipts are
  not rewritten. Scratch/WAN output selection remains independent.
- This supersedes references below and in the earlier audit to ceil/round-up
  billing and the previous Reference length field label. These changes are local;
  deployment and authenticated production acceptance remain pending.

### Close-edit slideshow default — 16 October 2026, local clarification

- The user clarified that selected slides should be reproduced as closely as
  possible with only requested changes. New v3 prompts explicitly call this a
  close edit, rather than inspiration or mood-board reinterpretation. A changed
  background does not authorize changing typography, camera or unrelated objects.
- Screen replacements preserve device boundaries, perspective and surrounding
  scene and apply only to the requested output. This is still generative edit
  guidance; exact screenshot fidelity needs a separate compositor, not yet built.
- Existing v2/legacy retry prompts remain frozen for compatibility. V3 is local
  and must deploy worker first, then web. No actual generation-quality acceptance
  is claimed by provider-stub regression tests.

### Latest slideshow quality investigation — 16 October 2026

- Completed batch `2324bf8d-02c7-4010-8b76-19a93fcb94b7` correctly contains
  Marketing slides **1 and 4**, the unchanged user prompt, business snapshot
  and uploaded dark Explore screenshot. Do not apply the earlier batch's 1/5
  mismatch to this request. Both latest outputs were saved and billed.
- The supplied outputs still redesign the reference scene/text treatment and
  invent light dashboards. Saved jobs use v2; preservation v3 remains local.
  Matching fingerprints in a stubbed real-worker replay verifies input delivery,
  not model fidelity. No screenshot compositing or semantic acceptance gate
  exists in this image-worker path. Completed is technical success only.
- Correction needs preservation/scoped prompts plus fresh visual acceptance;
  exact UI insertion requires compositing actual pixels. The audit does not
  change model, quality, provider credits, job records or application behavior.
  See `docs/slideshow-output-fidelity-audit-2026-10-16.md`.

### Slideshow failure-banner dismissal — 16 October 2026, local repair

- The slideshow generation error badge now has an accessible × and disappears
  after three seconds. A stable attempt/job identity prevents unchanged status
  polls from reviving it; a distinct failure gets a new notice and timer.
- Dismissal changes only the banner presentation. Stored job status, generation
  recovery, History, selected references, generated images and credit settlement
  are untouched. Progress remains visible; other workflows retain their existing
  error behavior. Returning in a fresh mounted visit can show the failure again.
- Local API-free browser checks cover timing, mouse/keyboard dismissal, polling,
  replacement/unmount cleanup and desktop/mobile layout. Deployment and signed-in
  production acceptance remain pending. See
  `docs/slideshow-error-notice-2026-10-16.md`.

### Slideshow provider-credit errors — 16 October 2026, local repair

- The two reported Flare slideshow batches reached OpenAI but failed with
  `credit_balance_exhausted`. All four one-credit app reservations were released.
  This is separate from worker capacity, reference delivery and prompt policy.
- Known provider billing failures must be terminal and clearly identified;
  HTTP 429 alone does not imply a temporary rate limit. Genuine rate limits
  retain retries and uncertain submissions retain duplicate-charge protection.
- The local worker/public-error repair requires deployment. It does not buy
  provider credits, switch models or replay historical failed requests. Actual
  recovery needs a funded provider account and a fresh authorized generation.
  See `docs/slideshow-provider-credit-failure-2026-10-16.md`.

### Slideshow reference preservation — 16 October 2026, local implementation

- New Explore slideshow jobs use reference contract v3: each selected slide is
  its output's base. Preserve its visual style, composition and tone by default;
  adapt only relevant business details. Explicit user requests override these
  defaults within their scope. Business brand tone, visual keywords and CTA ideas
  must not silently turn a reference into a redesigned advertisement.
- All selected image bytes and uploaded attachments still reach the provider.
  Numbered attachment roles and output positions identify the intended inputs.
  Prompts scope slide-specific changes to the corresponding selected output and
  ask screenshot replacements to retain the actual uploaded interface. This is
  model guidance, not deterministic instruction extraction or pixel compositing.
- Reference headlines remain editable Remix Text by default. Explicit requests
  for visible image text retain the reference typography/position/boxes and exact
  supplied wording unless the user requests changes to those properties.
- Already-admitted v2/legacy jobs keep their original prompts and fingerprints.
  Deploy the compatible image worker before the web API begins admitting v3.
  Local regressions pass; new model-output visual and authenticated production
  acceptance remain pending. See `docs/slideshow-reference-preservation-2026-10-16.md`.

### Finishing worker warm-instance preference — 16 October 2026

- The user elected to keep Explore finishing warm for faster first-request
  response. Its service-wide minimum is now 1, revision minimums remain 0 and
  unused historical tags remain removed. Request-based CPU/billing and the
  existing authenticated HTTP processing contract are unchanged. This replaces
  the idle-zero preference below; it does not alter heavy Cloud Run Jobs.

### Finishing worker idle-cost policy — 16 October 2026

- The authenticated interactive finishing HTTP service remains enabled with
  the same image, environment, ownership rules, task URL, request timeout and
  one-request concurrency. It can now scale to zero when idle; enabling
  interactive finishing no longer forces a warm instance. Accept the first
  request's startup delay. Heavy rendering retains its existing Cloud Run Job
  launcher, slots and execution lifecycle. No editor, save or schedule flow
  changes accompany this infrastructure-only change.
- Old unused tagged revisions were detached after endpoint checks. Startup and
  authenticated no-work task delivery passed, and 51 related regressions passed.
  This does not constitute a newly rendered customer video or measured cold
  start from zero. Detailed evidence: `docs/worker-idle-cost-rollout-2026-10-16.md`.

Last reconciled: **15 October 2026**.

### Reference prompt submission and fractional timing — 16 October 2026, local follow-up

- Generate video submits the current visible reference instructions followed by
  the user's separate instructions, joined once. Remove prompt omits that block
  while retaining the video. Editing/restoring it changes the submitted prompt;
  recovery reuses the frozen combined request without appending it again.
- Reviewed performance prompts remain a Hook catalogue capability. Wall shares
  the composer but does not acquire invented Hook-style performance prompts.
  Its own instructions still reach the worker, with the existing clean-background
  instruction added by the server.
- Omni source-video edits use the source timeline. A 3.7-second Hook or
  6.7-second Wall reference is not submitted as a fresh fractional-duration
  text-to-video request: the provider receives the source bytes and `task: edit`,
  without an output-duration override. Current app admission allows source edits
  up to ten seconds. Output duration is measured and must stay within 0.25 seconds
  of the source; otherwise the worker rejects it before storage. This is a
  validation contract, not a promise of frame-exact provider quality.
- Display **Reference length** and **Uses source timing** in this mode. The
  rounded duration in admission is the existing credit calculation (ceil, minimum
  three seconds), not permission to stretch/trim the source. Ordinary scratch and
  WAN reference generation retain the selected supported whole-second output
  duration. Do not show fractional source length as their requested output.
- Reference prompt actions use 12px text (32px desktop / 44px coarse-pointer
  targets); the reference text is 13px. Keep user instructions separate and fully
  editable. See `docs/explore-reference-prompt-and-duration-2026-10-16.md` for
  tests, primary provider documentation and local/production limits.

### Video provider routing — 18 October 2026, local implementation

- User clarification: ReAPI means `reapi.ai`, a distinct provider from
  OpenRouter. Every newly admitted Seedance 2.5 and WAN 3.0 request now freezes
  `provider: "reapi"`. Seedance uses `doubao-seedance-2.5-face` with the explicitly
  requested Less Restriction setting (`content_filter: false`). WAN uses
  `wan3.0-video` with `content_filter: true`; never switch review channels on
  rejection. The ordered images/audio/video reach their native `image_urls`,
  `audio_urls` and `video_urls` fields. Existing UI model IDs remain stable.
- Previously accepted OpenRouter, Runway and Higgsfield jobs retain their exact
  provider and fingerprint for recovery. Untagged legacy jobs keep their older
  routing. Lost POST responses stay uncertain and cannot create a second task.
  ReAPI task IDs are saved before polling, costs come from settled usage, and
  completed CDN files are copied into the existing application storage.
- Preserve ownership/readiness and the six-file limit. ReAPI admission permits
  Seedance audio/video 2–30 seconds, WAN 1–15 seconds, MP3/WAV audio up to 15 MB,
  and MP4/MOV video (Seedance up to 200 MB; WAN retains the stricter 32 MB app
  cap). WAN reference video plus output cannot exceed 30 seconds. Validate
  before billing; never silently trim, drop, or reinterpret a reference.
- Migration `20261018062729` adds `reapi` to the provider check without changing
  existing rows or access rules. Release order: migration, funded worker-only
  `REAPI_API_KEY`, compatible generation worker, then web. Historical
  `NEXT_PUBLIC_ENABLE_OPENROUTER_*` flag names remain deployment-compatible.
  Local regressions verify requests and recovery with mocked HTTP; deployment
  and authenticated paid production acceptance remain pending. See
  `docs/reapi-video-routing-2026-10-18.md` for the verified provider contract.

### Slideshow input fidelity audit — 16 October 2026

- Production batch `618eb823-1cb6-4e0d-9456-c2993aedbfb8` contains applied
  business context, selected Marketing slides 1 and 5, and the user's uploaded
  Explore screenshot in both output jobs. Worker replay matches production
  operation fingerprints and passes all three references to the provider.
- Input delivery is not proof of output fidelity: the inspected result invents
  a white dashboard instead of preserving the uploaded dark Explore screen.
  The create prompt describes references as style inspiration, sends all
  multi-slide instructions to every output, and does not promise exact screen
  compositing or minimal-change preservation. The audit itself changes no
  behavior; the local v3 follow-up above corrects the prompt policy, with output
  fidelity still awaiting fresh generation and production acceptance.
- Earlier production slideshow jobs really lack a business-context snapshot.
  Keep historical missing-context behavior distinct from this latest batch.
  Evidence: `docs/slideshow-input-audit-2026-10-16.md`.

### Demo loading and focused-editor footer — 16 October 2026, local implementation

- Hook Demo overview **Edit demo video** and **Change** are navigation actions;
  they must not wait for full playback buffering, another clip's loading or an
  upload acknowledgement. After local metadata validation, trim/manual text can
  be edited while the demo uploads. Save and Schedule still require confirmed
  owned media and their existing validation. Remix generation remains gated
  during an unconfirmed upload; no paid request is triggered by opening Edit.
- Keep pending edits separate from the last accepted recoverable draft. Upload
  confirmation preserves the pending trim/text. Failed replacement restores the
  prior clip, edits, framing and source mode. A newer upload, saved-media choice
  or removal supersedes the pending request; late completion cannot replace it.
  Source controls stay usable during the video upload. This Hook implementation
  does not establish the same pre-upload editing capability in Talking Head.
- Demo upload's additional browser metadata read has a 15-second timeout so a
  missing event cannot leave the upload busy forever. It is not a network-upload
  deadline and does not bypass server ownership/readiness checks.
- Focused Hook/Talking Head/Wall editors omit the routine “Changes appear in the
  preview immediately. Save edits to keep them.” footer row and horizontal rule.
  Keep compact Save/return actions, button saving/saved labels and actionable
  loading/error/retry feedback. Never reserve an empty instruction row after it
  is removed. This does not remove scheduling review or necessary upload errors.
- Evidence and acceptance limits: `docs/explore-demo-loading-and-editor-footer-2026-10-16.md`.
  These follow-up changes are local and are not part of deployed `cdf8c936`.

### TikTok promotional disclosure default — 16 October 2026, local implementation

- Settings → Preferences → Publishing defaults → TikTok defaults now exposes
  **Label posts as promotional content**, off by default for existing and new
  accounts. Enabling it selects TikTok's own-brand disclosure and adds the
  “Promotional content” label. AI disclosure and paid partnerships are separate.
- New Explore schedules use the saved account preference. Trending and the
  scheduler share the same off default. Saved target choices and already queued
  posts retain their settings; changing preferences is not a bulk post update.
- This supersedes the October 9 background own-brand-on default recorded in
  `docs/tiktok-ui-visibility.md`. A new database migration and web release are
  required. Local tests are separate from authenticated production acceptance.

### Influencer workspace references and downloads — 16 October 2026, local implementation

- Build AI influencer results support independent multi-selection. Selected images
  become numbered reference thumbnails beside the composer; My influencers also
  supports selecting up to ten saved images and applying them together with
  **Use images as references**. Each reference can be removed individually or
  cleared together. A selected reference stays attached when its result card is
  dismissed from the workspace. Uploading a reference retains the existing
  uploaded-image mode and replaces the saved-image selection.
- The × on a completed result only dismisses that card from the current visit.
  It never deletes media, removes a saved influencer, or discards job recovery or
  History. Opening an image explicitly from History can show it again.
- Result cards and My influencers provide authenticated image downloads with
  short-lived attachment URLs. Ownership and ready media are verified by the
  server using the saved asset ID; browser-supplied storage URLs/keys are ignored.
- Multi-image requests carry ordered owned influencer IDs through admission,
  durable retries and every supported worker/provider adapter. The user's prompt
  stays unchanged. Reference order participates in idempotency. Partial reference
  restoration blocks generation instead of silently dropping context.
- These changes require both web and worker deployment. Local fixture/API checks
  do not constitute authenticated acceptance on `https://www.getugcpilot.com`.
  See `docs/influencer-image-actions-2026-10-16.md` for verification details.

### Reference performance prompts — 16 October 2026, Hook catalog released

- The user selected the original detailed approach: a short replacement
  instruction, one clip-specific action/expression paragraph and preservation
  priorities. The later numbered five-part template is not the default.
- Selecting a reviewed video exposes an editable **Reference prompt** block
  beside the user's instructions. Remove prompt keeps the video attached;
  Restore prompt restores the approved suggestion. An info disclosure explains
  its purpose. Switching reference replaces its suggestion without overwriting
  the user's separate instructions. The submitted prompt joins exactly those
  visible fields; the server must not secretly append removed suggestions.
- Each suggestion contains overlay text/caption/emoji removal and no-new-text
  instructions. Physical signs/packaging text are preserved. Do not hardcode
  the test influencer's hair, clothing or image into library entries. Identity
  replacement is conditional on an attached influencer image. User instructions
  follow the suggestion and may request deliberate changes.
- All 98 active Hook references have reviewed entries in
  `lib/explore/reference-video-prompts.ts`. The first three were initially sampled;
  all reviewed entries have been inspected through every decoded frame. Hooks 01–09 have
  92, 92, 110, 94, 96, 112, 78, 79 and 85 inspected frames respectively.
  Review method is `all_decoded_frames`, not a claim of real-time playback,
  audio review or generation-quality acceptance. Hooks 01–03 and 06 have
  single-frame screen-view tails; Hook 07 also has a single-frame laptop/pen tail.
  Hook 04 has a brief caption/browser tail; Hooks 05, 08 and 09 stay in their
  original scene. Keep source tails brief; do not extend them or
  silently trim the original. Version 2 paragraphs record the precise gestures.
  Scope clarified by the user: only Hook video workflow references for now.
  Its active catalog contains 98 videos: 98 reviewed prompts and none remaining.
  The earlier 195/192 totals incorrectly included 97 Wall videos. Wall of Text
  and slideshows are outside this prompt rollout. No Wall prompts were prepared.
- Review Remix source captions during the same video inspection. Use the existing
  source-hash-bound `reference-text-catalog.json`, preserving original wording,
  emojis and caption timings; exclude app UI, packaging and incidental text.
  Do not put Remix captions into the footage-generation prompt. Hooks 01–98
  now have all-frame caption checks, including the first three pilot entries.
  Hook 04's final instruction begins at 3033 ms, correcting its earlier 3200 ms
  sampled boundary. Individual caption notes distinguish corrected boundaries
  from retained approximate timing. Original source claims are not fact-checked.
- Additional all-frame caption corrections: Hook 42 changes at 3400 ms; Hook 43
  at 3167 ms; Hook 48's additional caption starts at 2333 ms and its first emoji
  is 🤨; Hook 64's additional caption starts at 1733 ms; Hook 72's first emoji is
  😳; Hook 74's sequence is 👹😨🤯😭 and ends at 3567 ms; Hook 85's caption ends at
  6033 ms before its last two frames. Hooks 94–95 have graphic formulas only:
  retain `no_text` with empty Remix blocks and remove those overlays in footage.
- Hook 14 cuts to a calm second take at frame 170 / 5667 ms; the creator caption
  ends there, correcting its prior 5333 ms sampled timing. Hook 27 has a background
  colleague: replace only the foreground performer's identity. Full source takes,
  subtle gestures and brief screen tails must be described as observed.
- Hook 07 retains its original top caption while adding the website instruction
  in the final frame; overlapping caption blocks are intentional. Hook 08 is a
  stretch, not a surprise reaction. Its floating logo equation is transcribed
  semantically in the existing Remix record, while the generation prompt removes
  that added graphic and preserves physical laptop stickers. Hooks 07 and 09
  lift glasses onto the head, unlike Hook 02 which removes and lowers them.
- Suggestions bind to permanent reference ID and content-addressed source hash.
  Changed source bytes invalidate the suggestion. New references require review.
  This local content review does not deploy the website, alter soundtracks or generate
  paid media. Authenticated production acceptance remains a release check.
  Completion evidence and per-Hook notes:
  `docs/hook-reference-individual-review-2026-10-15.md`.
- Hook-only commit `a1fdfd2924bc571217cd422ae0afe999455508e8` subsequently
  deployed to website and shared MCP production. All 41 focused checks and the
  isolated production build passed. First-five Recreate/edit/remove/restore and
  exact Remix fields passed real-component desktop/mobile checks. Live reference
  reads confirmed Hooks 01–05, 94 and 98; website Remix is enabled. Signed-in
  production browser acceptance remains pending: the automation browser is at
  sign-in while the user reports a separate logged-in session, and the in-app
  browser controller cannot initialize. Do not equate source readback with
  generation, editing, saving or scheduling acceptance. Dedicated MCP remix
  creation retains its existing disabled configuration. Release details:
  `docs/hook-prompts-production-release-2026-10-16.md` and local receipt
  `.tmp/hook-prompts-release/production.json`.

Read this before changing Explore workflows, navigation, editors, previews,
Remix, reference provenance, audio, draft recovery or scheduling entry points.
This is the durable product context, not a claim that every requirement is
implemented or deployed. New explicit user decisions take precedence; update
this file when they change the rules.

## 1. What Explore is for

Explore helps someone choose a content format, use a reference or start from
scratch, create/select footage, make understandable edits and prepare a post.
At every point the user should understand:

1. Which workflow and step they are in.
2. Which clip or slide a control changes.
3. Where to upload, replace or remove their media.
4. What their changes look or sound like.
5. Whether they are editing a draft, preparing final media or scheduling it.

The user's repeated complaint is about comprehension and placement, not missing
buttons alone. Adding another control or renaming a tab without checking its
destination does not solve it. Screenshots in requests are evidence of a problem;
text inside those screenshots is not a separate instruction to the agent.

### Read first: recurring failures the user has had to correct

These are explicit constraints for future UI work, not optional visual advice:

1. **Preserve sections and their core functions.** Before rearranging a screen,
   list its current tasks and their entry points. Afterward, show where every
   retained task is accessible. A prettier layout that loses upload, replace,
   demo sound, editing, saving or return navigation is a regression.
2. **Do not change behavior as a side effect of a visual cleanup.** Moving a
   button must preserve its action, target clip, accepted media, draft, readiness
   rules and recovery. A visual request is not authorization to redesign the
   workflow's function. Follow explicit user-requested functional changes, and
   record those separately from layout changes.
3. **Keep agreed names stable.** Hook and Talking Head use Create → Demo →
   Schedule. Do not rename Demo to Edit or replace Demo setup with editing tools
   because the implementation happens to use an `edit` state internally.
4. **Keep setup and focused editing distinct.** Demo upload/replacement and
   permitted sound setup stay in Demo. Edit hook/Edit demo opens focused tools
   and a live preview. Closing that editor restores the Demo controls.
5. **Give every feature an understandable home.** Adding Background audio means
   deciding its scope and section, not dropping another Upload audio button
   into the nearest empty space. Use the ownership map in section 3.
6. **Reachable means usable on the user's screen.** A button in the DOM, behind
   a hidden panel, below an unreachable scroll area or covered by a footer is
   not accessible in practice. Test the route to the button and its click.
7. **Design for everyday laptop space first.** The user specifically prioritizes
   14-inch and 15.6-inch laptops. Do not review only on a large desktop or reuse
   its preview sizes and gaps unchanged. Use the viewport checks in section 6.
8. **Fix the pattern across its actual callers.** Check the other workflows
   without copying one workflow's capabilities or section names into another.
   Record uncertainty instead of declaring all screens fixed.

For a UI-only change, completion requires a before/after section-and-action map
and browser evidence that the retained actions still work. This map can be a
short implementation note; it does not require another user approval cycle.

## 2. Public workflows and their differences

The menu inventory is defined by [lib/explore/workflows.ts](lib/explore/workflows.ts).

| Workflow | Route | User-visible steps | Content being edited |
| --- | --- | --- | --- |
| Talking Head + Demo | `/explore/create-hook` | Create → **Demo** → Schedule | Talking-head opening, optional demo, final composition |
| Hook video | `/explore/hook-video` | Create → **Demo** → Schedule | Hook opening, optional demo, one shared background track |
| Wall of text | `/explore/wall-of-text` | Create → Edit → Schedule | One background video with full-duration wall text; optional advanced video controls; no demo composition |
| Slideshows | `/explore/slideshows` | Create → Edit slides → Schedule | Ordered images with text and appearance per slide |

**Do not mechanically rename every second tab to Demo.** That decision applies
to Hook and Talking Head, which have a demo step. Wall edits one video;
Slideshows edits slides. Extending either with a demo is a separate product change.

Creator Shows App on Phone remains hidden, even though retained components share
some code. Recreate redirects into current workflows; it is not a fifth public
workflow. AI influencer creation, AI Studio and Audio generation are adjacent
tools, not covered end to end by a video-editor check. Explore Slideshows and
the separate Carousel system must not be conflated; Carousel changes also require
reading `CAROUSEL_CONTEXT.md`.

### Naming traps in the implementation

- Talking Head uses `HookWorkflowPreview` and internal section value `edit` for
  the user-visible **Demo** step. A label change need not change saved URL values.
- Hook video uses `FormatWorkspace` with `format="hook"`; its overview uses
  internal step `demo`. A focused clip editor is additional state, not another
  top-level workflow tab.
- Wall uses `format="wall_text"`; Slideshows uses `format="slideshow"`.
- `FormatVideoEditor format="hook"` is also used by Talking Head. This does
  **not** give those products identical reference or audio capabilities.

Preserve existing deep-link/restoration behavior when changing visible labels.

## 3. Screen responsibilities and navigation

### Feature ownership: where controls belong

Choose the user's task and scope before choosing a position. Do not split one
feature across unrelated sections merely to fill space. Related controls should
have one named group with the entry, current selection, replacement/removal and
relevant feedback together.

| Task / feature | Home and grouping | Placement to avoid |
| --- | --- | --- |
| Generation source, references and instructions | Create; group source choices with their accepted selection and status | Putting generation inputs inside a focused clip editor |
| Demo upload, replacement and removal | Demo overview in Hook/Talking Head; selected filename and Replace/Remove next to its source controls; card Change may lead to that same group | Hiding the entire group once a preview exists; replacing it with trim/text tools |
| Edit hook / Edit demo | Compact action attached to the matching preview card; opens that clip's focused editor | Unlabeled Edit far from its clip, or a top-level Demo tab repurposed as editing tools |
| Workflow background audio/music | One clearly named composition group in Demo for Hook/Talking Head, showing the track's whole-video scope; any Create entry must reflect the same choice | Separate competing hook/demo background selections, duplicate Upload audio groups with unclear scope |
| Talking Head Demo sound | Distinct optional group beside Demo setup; clearly says it affects the demo only | Treating it as the whole-video background track or removing it during layout cleanup |
| Hook demo's original volume | Inline, text-only `Adjust demo sound` control beside the selected demo filename in Demo setup; it reveals the compact original-sound slider and preserves the existing footage sound | Sound panels or separate demo-audio upload/library groups in focused editing |
| Text, Remix and appearance | Focused editor; reference Remix prominent, style controls beside the text where width permits | Duplicate Remix on overview; style sliders in a distant unrelated panel |
| Clip Save and return | Stable editor footer with distinct primary/secondary emphasis | Schedule occupying Save's role or a footer covering controls |
| Final preparation and scheduling | Composition overview/preparation status and Schedule review respectively | Repeated preparation/refresh controls overwhelming the clip editor |

For example, “add background audio” must answer: does it span the whole video,
which existing group owns it, how is the current track shown, and where can it
be changed? For Hook, it is one choice spanning opening and demo; Talking Head's
allowed Demo sound remains a separate, explicitly scoped capability. The music
prototype described in section 4 does not create an exception to this rule.

### Create

Keep generation, upload and Creative Assets entry points understandable. A
reference is optional where supported. Generation instructions belong here;
Remix instructions belong with text editing. Keep generation progress and ready
results reachable after selecting a clip.

Talking Head's Create action reads **Continue** and opens Demo. Hook's next-step
action must also lead to its Demo overview, with labels matching the destination.
Do not add a second overview Remix form to make text editing discoverable.

### Demo overview: Hook and Talking Head

- Show separately named opening and optional Demo video previews.
- An absent demo has upload/selection actions; an existing demo has visible
  replacement/removal actions and **Edit demo video**.
- Show **Edit hook video** for the opening. These compact actions edit the
  named clip; replacement selects different footage.
- Keep Demo upload/replacement controls accessible alongside the preview cards.
  Showing cards must never hide every way to replace their media.
- Change opens replacement choices in place, including on mobile. Opening
  footage offers upload/Creative Assets/generation; demo footage offers upload
  and Saved demos from the Demo inventory. Failed replacement retains accepted
  footage and edits. The earlier `chooseDemoInDemo` sidebar-focus behavior is
  superseded; never restore it or direct demo selection to Creative Assets.
- Final composition settings belong here. Apply the workflow's audio rules below.
- Returning from Schedule must retain both clip edit entry points, even when a
  final video has already been prepared.
- Empty Hook/Demo slots use portrait **9:16 upload areas**, with source selection
  centered inside each slot. Center the pair within the available preview panel;
  do not leave two shallow cards anchored at its upper-left with a large unused
  area to the right. Scale placeholders with usable viewport height and wrap when
  two no longer fit. This shape is for empty slots only: selected footage keeps
  its actual ratio and its existing edit/replace actions.
- Apply the same empty-demo canvas treatment in Talking Head's overview without
  transferring its separate demo-audio capability into Hook. The public second
  step remains **Demo**; opening a focused editor does not rename that stage.

### Focused clip editors

Edit hook video, Edit demo video and Wall's advanced editor show the selected clip's tools
and live preview. Hide Create/Demo/Schedule tabs and unrelated upload/composition
settings while focused editing is active. Returning restores the overview and
its controls without clearing the draft.

Use a compact draggable trim timeline, text/Remix controls and a narrower
appearance inspector. Hook and Talking Head's focused clip editors do not need
a Sound panel: audio setup belongs in Demo. Hook's demo editor also has no
Crop & zoom tools; their presence was unnecessary and lengthened the inspector.
Wall remains a single-video workflow, so its one audio group stays in advanced Edit.
On desktop, use the available width deliberately;
on narrow screens keep the preview usable while tools scroll. Do not restore
full-width style selects, two enormous trim sliders or a long unstructured form.

### Wall of text: simple text editing, optional advanced controls

Wall's Edit step first shows the live preview, **Remix text** and **Your wall of
text**. Reference-backed clips keep the reference Remix expanded; scratch/upload
clips retain the nearby optional Remix entry without fabricated reference text.
Keep the text column compact and use its width; do not leave a blank inspector
column beside simple text editing. One compact **Edit** action below the text
opens the full advanced tools (trim, text style and the single video audio group).
**Back to text** returns to the simple view. These views share one mounted editor,
draft and player; opening/closing advanced tools must not clear text, style,
audio or trim, submit generation, save implicitly or restart the preview.
Leaving and re-entering Edit starts with the simple text view and keeps the draft.

Wall overlays cover **0 through the end of the selected trimmed clip**. Do not
show Show from / Until, per-block timing badges or instructions about individual
block timing in Wall, even inside advanced tools. Normalize recovered legacy
Wall text and newly applied Remix/manual text to the whole selection. Shortening
or lengthening trim updates the end of every Wall block. Preserve all existing
blocks and their separate styles/positions; do not drop blocks as a shortcut.
Hook and demo timed blocks retain their existing timing behavior.

### Slideshows: reference, generation and slide editing

Catalogue cards use topic names such as **Fitness**, **Goal Tracker** and
**Interview App**, without import sequence suffixes such as 01. Apply this at
the catalogue-to-reference boundary so gallery cards, selection and dialogs agree.
Keep original catalogue metadata, reference/slide IDs, media URLs and ordering
unchanged. Do not remove slide-position numbers from editing/navigation, rename
user uploads or apply this rule to Hook/Wall reference names.

Create selects catalogue/uploaded reference images and accepts instructions.
**Selected slides × Versions determines output count.** Five selected reference
slides and two versions produce ten independent image jobs, grouped as two
ordered five-slide versions. Each output uses the corresponding reference slide
as its primary layout, the other selected slides as context, and the same frozen
business context/instructions. Quantity is versions, not total images. Show the
total credit estimate before submission. Selecting more than ten source slides
blocks submission rather than clipping the selection. Recreating one existing
slide still produces versions of that single slide. Legacy requests without a
slide count keep their original one-image-per-quantity behavior for recovery.

Business context is loaded server-side from the authenticated owner's applied
Settings profile, whitelisted and frozen into every new slideshow job. Missing or
unavailable context blocks admission before billing; do not silently generate
without it or trust a browser-supplied business profile. The worker builds the
provider prompt from that snapshot; the visible user prompt stays clean. Flare
is the default slideshow image model, with Sunburst and Nano Banana also offered.
The existing `gpt_image_2_5` ID continues to mean Sunburst for saved jobs.

Edit slides supports selecting, reordering, removing, uploading/replacing and
recreating a slide, plus manual/Remix text and appearance with a live preview.
Replacement retains that slide's identity, text and neighbors. Text baked into
image pixels requires Recreate/Replace; added text is directly editable. Save
prepares edited images and stores the exact sequence in Library. Interrupted
saves retain their request identity; editing invalidates the prior schedule output.
Schedule uses the saved image sequence, without a video/demo/audio stage.

The first complete generated version can populate an **empty** editor. Never
replace a user's current draft when another version finishes. **Edit version**
opens all of that version's owned images in source order. The account-owned
**History** entry remains visible even when the current session is empty; new
batch metadata reopens a whole version. Older ungrouped generations remain
individual reusable images, not invented slideshow sets.

Changing versions archives the current editable draft, with an **Earlier drafts
on this device** selector (up to twenty). The active draft also restores on this
browser. **Saved slideshows** opens Creative Assets → Saved, where Explore items
have **Edit slides**. New saves store validated editable source IDs and text in
Library metadata alongside rendered outputs; reopening makes a new editable draft
and never mutates the existing Library item. Original images are rechecked for
ownership/readiness. Legacy saves can reopen their retained owned rendered-image
IDs, but text baked into those images cannot become separate editable text.

Current restriction: the slideshow composer requires a catalogue reference, an
attached instruction image or a regeneration image. Plain prompt-only scratch
generation is blocked. Users can upload their own output slides without a
catalogue. Do not claim prompt-only scratch creation is supported. Saving still
supports **2–10 slides per version**, not all versions combined. Production
saving requires its rollout flag and access. Local tests are not proof of
provider quality, visual acceptance or production execution.

Hook and Wall now also expose their existing account-owned generation History
in Create, without requiring current-session results. Talking Head + Demo retains
its separate Saved drafts entry (`/explore/create-hook?drafts=1`) and Creative
Assets reuse; it does not yet have the same in-workflow generation-history drawer.
Media history, browser-local editable drafts and server-saved outputs are different
recovery capabilities. Never describe one as proof of all three.

Returning to earlier work must be explained per workflow:

| Workflow | Where users resume | Limit to state honestly |
| --- | --- | --- |
| Slideshows | Create → History for generated versions; earlier editable drafts in the editor; Library → Edit slides for saved Explore sets | Older Library images can contain baked-in text; that text cannot become an editable overlay automatically. Device-local drafts are not cross-device history. |
| Hook video | Create → History or Creative Assets to select earlier footage, then Demo → Edit hook video / Edit demo video | Clip edits are scoped to the owned source and editor scope. Generation History is not a gallery of every previous two-clip composition. |
| Wall of text | Create → History or Creative Assets, then Edit for text and optional advanced controls | Reopening the same owned source can restore its saved clip draft. A final rendered MP4 alone does not reconstruct all editable text. |
| Talking Head + Demo | Saved drafts from the workflow / `/explore/create-hook?drafts=1`, or Creative Assets for existing media | Its saved workflow session is different from the Hook/Wall generation-history drawer. Do not claim an equivalent drawer exists. |

### Save, return, final preparation and Schedule

| Action | Meaning and placement |
| --- | --- |
| Save edits | Primary editor action; saves the selected clip draft, not an implicit paid regeneration or final render |
| Back to videos | Secondary editor return to the opening/demo overview; retains draft state |
| Back to Create | Wall/slideshow return where that is the actual destination; never label it Back to previews if it opens Create |
| Prepare final video | Combines the current composition when required; does not replace clip editing |
| Schedule video | Proceeds to review/scheduling under the existing readiness rules; must not obscure or substitute for Save edits |

Keep primary and return actions in a consistent, visible footer. Final-render
status should not flood the clip editor with preparation/refresh buttons. Source
replacement and edits invalidate stale final output as appropriate. Schedule
must use the current confirmed composition, not an older prepared file.

Wall without a selected clip should expose Create's source controls and gallery,
not an isolated full-screen empty editor with all navigation hidden. A saved
`editVideoId` still requires restoration/loading/error handling; do not discard
it just because the asynchronous asset has not arrived yet.

## 4. Audio rules — keep the products distinct

| Workflow | Background music | Demo-specific added audio | Original footage sound |
| --- | --- | --- | --- |
| Hook video | **One track across hook and demo**; reference audio is not a second simultaneous background track | **No separate demo-audio picker**, in overview or focused demo editor | Original footage may have sound; any retained original-volume setup belongs in Demo, not a second editor Sound panel |
| Talking Head + Demo | One optional background-music track across opening and demo | Optional separate **Demo audio** track plays **only during the demo** | Talking-head footage already contains the influencer's speech; no default extra talking-head audio upload is required |
| Wall of text | **One complete background track** for its single video | Not applicable | Single clip's original sound is distinct from its background music |
| Slideshows | Do not infer video/demo music support from shared UI | Not applicable | Not applicable to still-image footage |

### Talking Head: name the three audio layers by scope

The user's latest clarification distinguishes these layers. Avoid using
“Demo sound” to mean both a demo-only track and whole-video music:

1. **Talking-head speech (in the video):** the influencer is already speaking
   in the generated/selected footage. Keep that speech. Do not make an extra
   talking-head audio upload the default or require one to continue.
2. **Demo audio — demo only:** optional user-added audio for the demo segment.
   It starts with the demo, stops with the demo, and is not played over the
   talking-head opening. The current UI's Demo sound control represents this
   capability. Its content may be music or another user-supplied recording;
   the defining rule is its demo-only timing.
3. **Background music — entire video:** optional music underneath the complete
   talking-head-plus-demo sequence. “Background sound” means music in this
   requirement. It is one composition track, not the demo-only attachment.

An optional audio reference in Create, where supported, guides generation; it
is not a required post-generation speech upload or another background track.

Example: with a 3-second opening and an 8-second demo, the opening's speech is
heard from its footage; demo-only audio plays during the 8-second demo; the
whole-video music can span all 11 seconds. Removing demo-only audio must not
remove the whole-video music, and changing the whole-video music must not
replace speech or the demo attachment.

For Hook, the same 3+8-second sequence has one background track spanning the
11 seconds and **no second demo-only added track**. Wall has one background
track spanning its single video's selected duration. Do not infer new soundtrack
capabilities from a shared component or from the ambiguous word “sound.”

### Control location and removal rules

Audio selection/setup belongs in the Demo overview for composition workflows.
Focused Hook/Talking Head editors retain trim, text, Remix, appearance, live
preview, Save and return. They do not duplicate Sound/upload/library panels.
Hook's focused demo editor also excludes Crop & zoom. Removing those panels
must not silently reset existing saved volume/audio/framing data. Legacy Hook
demo framing may be retained and explicitly reset from Demo when necessary;
this recovery action is not a new crop/zoom editor.

This clarification defines product behavior; it does not establish that every
audio combination has been validated in production. Speech preservation and
the separate mix/timing layers require preview/export checks as well as UI checks.

The latest user correction removed Hook's separate demo sound upload/library
controls. `FormatDemoSection` defaults `allowDemoAudio` to false and excludes
legacy demo-only audio when restoring its local/server clip draft. Do not
re-enable that capability simply because generic component tests support it.
Talking Head's separate demo audio is handled through its own composition path.

Music must agree across preview, final preparation, Schedule and reload. Failed
or cancelled replacement must retain the prior accepted choice. Changing music
must not regenerate the video or silently mute speech. Avoid doubled tracks.

Talking Head's Demo overview now offers **Upload music** and the existing
**Audio Library** under Background music, explicitly scoped to the entire video.
The accepted owned track has preview, repeat/play-once and removal controls.
New videos start with music **Off**. Uploading or choosing a track retains the
current On/Off setting; the user turns music on explicitly. Turning it off retains
the choice, while Remove
music clears it and turns music off. The no-custom-track On state uses approved
default music. Demo sound stays independent and demo-only. This is a local
implementation; production acceptance is still required.

**Planned, not fully implemented:** the compact Create music row with reference,
custom and none choices is documented in
[the Hook music plan](docs/hook-background-music-ui-plan-2026-10-15.md). Its
development prototype is not proof that production track replacement/removal
works. Older mixed footage may lack a clean source; changing a button cannot
make baked-in music removable. Preserve reference provenance independently from
the selected playback track.

## 5. Remix: purpose, placement and source identity

Remix adapts a reference's **text**, using the user's business context, to make
a relevant new version. Supplying reference video pixels alone does not fulfill
this purpose. It is not the same operation as video generation or manually
adding an overlay.

| Starting material | Expected editor behavior |
| --- | --- |
| Video linked to prepared reference text | Show the complete expanded Remix box prominently, populated from that video's original reference; keep manual text editing available |
| Scratch generation, ordinary upload or asset with no linked text | Manual editing comes first; keep one compact Remix entry for the user's own text/idea; do not invent reference copy |
| Demo | Independent text/draft/target; never copy the opening's reference or remix into it automatically |
| Slideshow | Resolve original reference and stable slide ID; reordering must not change which source text belongs to a slide |
| Reference explicitly marked as having no text | Request user input rather than fabricate source text |

Rules the user has explicitly established:

- Only one Remix form/entry per focused clip or selected slide. No duplicate
  form on the workflow overview and no second Remix button beside an already
  visible expanded Remix box.
- One **Text to remix** box accepts source copy and any guidance. No separate
  Additional information/Additional instructions disclosure.
- No orange glow or heavy decorative highlight. Emphasize reference Remix by
  position and expansion, not visual noise.
- Keep Generate remix compact and adjacent to the relevant context/input.
- Generate produces a reviewable draft; Apply is explicit before changing the
  video's text. Do not overwrite manual copy just by opening Remix.
- Business context comes from the authenticated owner's settings/server path.
  Missing, loading, signed-out or unavailable context must not say Saved.
- Bind text to the source used to generate that asset. Selecting another gallery
  reference later must not silently change an existing clip's Remix source.
- Preserve trim, timing and style when applying copy; isolate targets and owners.
  Recover accepted requests without duplicating uncertain paid generation.

Known gaps are listed in section 8. Do not describe prepared catalogue text as
automatic transcription of every uploaded video.

## 6. Preview and layout quality floor

- Trim edits immediately seek to the changed boundary and pause; playback
  respects the selected duration. Text edits show their active timing, style
  and position without requiring Save or Prepare final video first.
- Style and supported volume changes update locally. Preserve framing and the
  actual footage aspect ratio; do not stretch or arbitrarily crop the preview.
- Distinguish an editing preview from the final exported mix/subtitles. If an
  effect requires preparation, state that accurately; never promise exact final
  parity for an effect the live preview does not implement.
- Keep the preview and action footer usable at **1280×720**, including after
  scrolling. Check **390×844** and **320px** narrow layouts where relevant.
- Use space for the task: text needs a writing area; presets, color and timing
  need compact fields. Avoid empty columns and excessive nested cards/help text.
- Secondary desktop actions generally use content-sized widths and ~34px height;
  touch/coarse-pointer targets retain at least 44px. Save/Schedule stay prominent.
- Check top and scrolled states, long names, disabled/busy/error states and
  keyboard focus. No horizontal overflow or footer covering the last controls.
- Upload tiles can be larger when they are the actual source entry. Once media
  is selected, Preview/Replace should be compact, not another giant empty tile.

### Laptop-first layout: 14-inch and 15.6-inch users

Physical diagonal size alone does not determine a browser's usable space.
Resolution, operating-system display scaling, browser zoom, browser chrome and
the app's own navigation change the **CSS viewport**. A 15.6-inch laptop can
have less usable space than a 14-inch laptop. Do not infer device inches from
screen width or build a rule called “14-inch mode.” Adapt to measured available
width **and height**, using container queries where panel width matters.

Use the following representative checks; they are layout scenarios, not exact
mappings from inches to pixels:

| Scenario | CSS viewport to review | Required behavior |
| --- | --- | --- |
| Constrained everyday laptop | 1280×720 | Clear task entry, usable preview, reachable upload/replace and visible editor Save/return; no large-screen minimum sizes forcing clipping |
| Common compact laptop workspace | 1366×768 | Check overview cards, reference Remix discoverability, footer and scrolled tools without hiding core controls |
| Wider laptop workspace | 1536×864 | Use extra width for readable preview/tools and useful grouping; avoid simply stretching every field or inserting large gaps |
| Larger workspace / comparison | 1920×1080 | Preserve grouping and bounded control widths; do not let the large layout dictate the smaller laptop layout |
| Short usable browser area | 1280×600 | Reflow/compact media and scroll tools so actions remain reachable; no lost last field or trapped nested scroll area |
| Narrow fallback | 390×844 and, where relevant, 320px wide | Stack or switch panels clearly; retain the preview/controls route and reveal the destination before focusing |

Also check a representative laptop at 125% and 150% browser zoom where tooling
supports it, and record the resulting viewport. Browser zoom checks do not claim
to emulate operating-system scaling or a particular physical laptop. A resized
browser with desktop pointer input does not verify coarse-pointer touch sizing.

At each laptop viewport, inspect both the top and the lower scrolled state:

- **Preview sizing:** portrait, landscape and square media retain aspect ratio.
  A tall portrait must not push its Edit/Change/playback actions out of reach.
  A wide clip must not force an oversized empty video column. Scale within the
  available width and height, not a single fixed video size for all laptops.
- **Space use:** reduce avoidable padding, vertical gaps and repeated headings
  before shrinking readable text. Bound preset/color/time controls; give writing
  and preview areas the useful space. Do not remove functions to make the form fit.
- **Layout change:** use columns only while the preview and tools remain usable;
  reflow when they do not. Shorter screens may need shorter media and independently
  scrollable tools even if the width still supports two columns.
- **Button access:** check the actual viewport intersection and scroll path,
  not only `display`, DOM presence or a full-page screenshot. Save/return must
  remain reachable; Replace must visibly expose its picker/section. Focus must
  not land in a hidden or covered region.
- **Scroll boundaries:** the last control is visible above the footer at the end
  of the tools' scroll area. Avoid multiple nested scrollers that strand an action.
  Browser chrome and app headers consume real height; `100vh` is not all content.
- **State changes:** repeat with a selected demo, long filename, expanded Remix,
  validation/error message and prepared output. Empty screens alone are not enough.

For a layout-affecting change, record viewport dimensions, which workflow/state
was inspected, and screenshots of top/scrolled states. If a size or zoom level was
not checked, list it as unverified. These are acceptance requirements for future
changes; this document update does not mean those sizes have now been tested.

## 7. Mistake log — do not repeat these

Status: **Local fix** means implementation/local checks were recorded, not
production acceptance. **Rule** means a recurring design requirement. **Open**
means unresolved or not established by the evidence. Keep the history when a
mistake recurs; add the recurrence and its cause rather than deleting the row.

| ID | Mistake and user impact | Prevention / current status |
| --- | --- | --- |
| EX-01 | Edit tab mixed demo setup, clip editing and final settings; users could not identify the step | Name Hook/Talking Head's second step Demo; distinguish overview from focused editors. **Local fix** |
| EX-02 | Continue wording/destination did not match what opened | Match the visible action to its actual destination; test the click. Talking Head Continue → Demo. **Local fix** |
| EX-03 | Create/Edit/Schedule tabs appeared again inside a selected clip editor | Hide outer stages while editing; retain a clear return action. **Local fix** |
| EX-04 | Hook and Demo were represented by one ambiguous preview/action | Separate named cards and compact Edit hook/Edit demo actions; show upload when missing. **Local fix** |
| EX-05 | Hiding sidebar demo setup alongside preview cards removed replacement access; Change focused a nonexistent selector | Keep source choices visible; mobile panel reveal plus real focus destination. Recurred after an earlier cleanup. **Local fix, regression added** |
| EX-06 | Talking Head Demo upload/sound disappeared in a simplification pass | Restore task-relevant controls; never equate fewer controls with clearer UX. **Local fix** |
| EX-07 | Remix form duplicated in overview and editor; another Remix button appeared next to the expanded form | One editing entry and one scoped form; remove obsolete portal targets, not just their labels. **Local fix** |
| EX-08 | Remix was closed or below the first visible area, especially at 1280×720 | Reference text leads with expanded Remix; scratch editing has a visible nearby entry. **Rule with local fixes** |
| EX-09 | Separate Additional instructions, orange glow and repeated helper text added complexity | One text/guidance box, neutral styling and concise status. **Local fix** |
| EX-10 | Huge Generate/audio buttons, full-width preset fields and stacked sliders wasted space | Compact secondary actions/inspector; draggable trim with small numeric inputs. **Local fixes; recheck each screen** |
| EX-11 | Oversized selected-demo Preview tile repeated an upload-sized empty box | Use compact Preview and directly accessible Replace controls. **Local fix** |
| EX-12 | Changes did not appear immediately, leaving users guessing about trim/text/style | Wire draft state to player and overlays; verify actual visual updates, not only saved JSON. **Local checks recorded; final-render parity remains effect-specific** |
| EX-13 | Opening optional Remix hid manual text or style controls | Keep manual editing available while Remix opens. **Local fix** |
| EX-14 | Hook and Demo inherited each other's text, reference or audio assumptions | Independent drafts and explicit per-product audio capability. **Regression coverage; provenance gaps still open** |
| EX-15 | Hook exposed separate demo music although one background track should span both clips | Remove Hook-only demo audio controls and reject hidden legacy attachments; retain Talking Head Demo sound. **Local fix after user correction** |
| EX-16 | Back to previews actually returned to Create; Demo used Apply demo edits while others used Save edits | Use truthful, consistent labels; test destination and retained state. **Local fixes** |
| EX-17 | Save, return, preparation/refresh and Schedule competed without a clear hierarchy | Reserve primary Save, secondary return, and composition/scheduling actions in their appropriate screens. **Rule with local fixes** |
| EX-18 | Preparing a final video replaced clip cards, removing later edit entry points | Demo overview keeps editable clips; Schedule owns final output. **Local fix** |
| EX-19 | Wall opened an isolated empty edit screen with no selected clip and hid normal controls/gallery | Source-less entry stays in Create; preserve genuine saved-asset restoration. **Local fix** |
| EX-20 | Slideshow called its source Video reference; business status implied missing context was saved | Use format-specific source names and truthful readiness states. **Local fix** |
| EX-21 | Later gallery selection could supply the wrong source copy; slide position confused source identity | Resolve generated-asset provenance and stable slide ID; never use current selection as a substitute. **Coverage in Hook/Wall/Slideshows; Talking Head gap open** |
| EX-22 | Claimed all workflows were fixed based on shared code, tests or old screenshots | Inventory each route and inspect its actual rendered interaction; report test/visual/production evidence separately. **Ongoing verification rule** |
| EX-23 | A black demo frame was visible but its cause was not established | Inspect loading, source, media errors and playback. Do not assume every black frame is one known codec bug or call it resolved from metadata alone. **Open for the originally reported asset** |
| EX-24 | Huge gaps, nested boxes and long scroll made preview/actions hard to use | Review both top and scrolled states with real content and compact dimensions, not a full-page screenshot alone. **Recurring design rule** |
| EX-25 | Forgot a section's purpose while changing its layout, losing core functionality | Make a before/after map of every retained section, task and action; missing or newly inaccessible functionality blocks completion. **Recurring process failure; preservation rule** |
| EX-26 | Changed what a feature did while attempting to improve how it looked | Preserve handlers, target media, audio scope, drafts and readiness during visual changes; record any explicit functional request separately. **Recurring process failure; behavior-preservation rule** |
| EX-27 | Renamed sections casually or replaced Demo with Edit tools despite the agreed workflow | Treat the public stage map as a product contract. Internal state names do not define user-facing names. Keep Demo setup and focused editing separate. **Repeated user correction; stable naming rule** |
| EX-28 | Buttons existed but users could not reach them at their laptop size | Check on-screen geometry, occlusion, scroll path, focus and successful click at constrained width and height. DOM presence alone is insufficient. **Repeated access failure; viewport acceptance required** |
| EX-29 | Used large-laptop spacing and preview sizes unchanged on a smaller usable workspace | Review constrained and wider laptop CSS viewports; reflow columns and bound media by available height and width. Never use physical screen inches as the breakpoint. **Repeated responsive-layout failure; laptop matrix required** |
| EX-30 | Added audio or other controls in whatever empty space was available, separating them from their meaning | Assign one named group by task and scope; keep selection, change/remove and status together. Background music spans the composition; Talking Head Demo sound is explicitly separate. **Repeated grouping failure; ownership map required** |
| EX-31 | A simplification pass removed or hid working features and was called an improvement | Keep core functions and navigation intact; compare before/after capabilities and test round trips. Fewer visible controls is not evidence of clarity. **Repeated regression; functional and visual evidence required** |
| EX-32 | Kept irrelevant Crop & zoom and Sound panels in focused Hook editing, creating excess scroll and unused inspector space | Hook demo editing excludes crop/zoom; audio setup stays in Demo for Hook/Talking Head. Keep Wall's single-video audio path distinct. Do not restore generic panels simply because a shared editor supports them. **Local implementation and regression checks passed; fresh visual acceptance pending** |
| EX-33 | Used “audio,” “Demo sound” and “background sound” interchangeably, obscuring speech and track timing | Name Talking Head's embedded speech, demo-only added audio, and whole-video background music separately. Hook and Wall each have one complete background track. **Audio-scope contract clarified by user** |
| EX-34 | Treated a Background music On/Off switch as proof that users could upload their own whole-video track | Keep upload/library selection, current track, playback and removal in Background music. Carry that exact owned selection through preview, captions, preparation, recovery and Schedule without reusing demo-only audio. **Locally implemented 15 October; production acceptance pending.** |
| EX-35 | A recovered render/default-music cache could reuse a previously removed custom track | Persist the explicit off/default/custom choice alongside the finishing receipt; require the current choice before reusing an output or default snapshot. Never substitute old custom audio when switching back to default. **Regression covered.** |
| EX-36 | Showed trim/style/audio alongside Wall's primary text tasks, adding complexity and unused inspector space | Default Wall Edit to Remix/manual text and live preview. Place one compact Edit action below text for advanced tools, with Back to text and the same draft/player. Audio remains available in advanced controls. **Locally implemented; fresh visual/production acceptance pending.** |
| EX-37 | Gave Wall text Show from/Until and timing badges even though it must stay to the end | Hide timing UI and normalize Wall text to the full selected duration on recovery, editing, Remix and shorter/longer trims. Preserve Hook/demo timing and legacy Wall blocks/styles. **Functional regression checks passed.** |
| EX-38 | Exposed import names such as Fitness 01 and Goal Tracker 01 as slideshow card titles | Show the category/topic consistently throughout reference selection. Preserve stable IDs and source metadata; slide position numbers remain useful inside editing. **Locally fixed for all 58 catalogue slideshows; production acceptance pending.** |
| EX-39 | Treated five selected slideshow slides as context for two individual images instead of generating two five-slide versions | Freeze slide count and version-major positions into jobs, recovery, result groups and editor selection. Estimate credits for every output. Keep legacy request semantics intact. **Local 5×2 regression passed; production pending.** |
| EX-40 | Assumed slideshow image generation included business context, while only Remix used it | Read the authenticated owner's applied profile on the server before billing, freeze it per job and test the actual provider prompt. Keep private context out of visible prompt labels. **Locally fixed.** |
| EX-41 | Hid History when the current Explore session was empty, and had no way to reopen saved slide sets | Keep History reachable, distinguish generated versions from edited drafts and saved Library items, preserve drafts when switching, and offer Edit slides for saved Explore sets. Do not infer legacy grouping or unbake pixel text. **Slideshow/Hook/Wall locally improved; Talking Head history differs.** |
| EX-42 | On the reported 15.6-inch laptop, two shallow empty Hook/Demo cards stayed at the upper-left of a much larger preview area | Use centered portrait upload slots with centered source actions, bounded by usable height; check empty/one-clip/two-clip and narrow/short viewports. Keep actual media ratios and existing selection actions. **Local layout change; browser screenshot and production acceptance pending.** |
| EX-43 | Exposed Hook 01/02/03 catalogue numbers as user-facing reference names | Show **Hook** consistently for active, archived and development references. Preserve reference IDs, provenance, reviewed prompts and saved-job lookup; automation must identify media by stable identity rather than depend on visible numbering. **Catalogue regression passed locally; production pending.** |
| EX-44 | A playable local demo still had disabled Edit/Change and replacement controls while its upload awaited confirmation | Separate navigation, local editing and source replacement from owned-media Save/Schedule readiness. Preserve pending edits on success and the accepted draft on failure; reject late superseded completions. Bound metadata reads. **Local regressions and delayed-upload browser checks passed; production acceptance pending.** |
| EX-45 | Routine editor footer instructions and a horizontal divider consumed laptop height above Save/return | Remove the repeated instruction row and divider; compact the footer while retaining real loading/error/retry feedback and visible Save/return buttons. Check the bottom of the scroll region and actual footer bounds. **Local implementation; production acceptance pending.** |
| EX-46 | Labeled a fractional source-video length as generic Duration, making Omni source editing look like unsupported fractional fresh generation | Label source length explicitly, distinguish native edit timing from selected generation duration and rounded billing, and verify both prompt fields and decimal timing through admission/provider/output validation. Never round the footage itself or claim every model shares edit semantics. **Local checks passed; no paid production generation submitted.** |
| EX-47 | The opened reference popup kept native video controls and exposed Download even though the surrounding editor used custom controls | Audit the opened popup as well as gallery/editor players. Hook and Wall reference playback must use custom controls without download/native menus; preserve ordinary playback and fullscreen. Do not claim browser-delivered media is impossible to copy. **Local change; production acceptance pending.** |
| EX-48 | Hook source icons navigated free users straight to the original social post | Check verified Pro access at every source-icon rendering path. Free clicks open Upgrade to Pro; Pro links retain safe external navigation. Keep Wall source-free and Preview/Recreate independent. **Local change; production acceptance pending.** |
| EX-49 | Font controls were demonstrated as extra full-width rows that made Text style tall and pushed useful controls away | Preserve the compact inspector. Add Font and Weight together in one small bottom row; verify inside the real editor at laptop and narrow sizes. Do not use an isolated wide fixture as the product design. **Compact full-editor checks passed locally.** |
| EX-50 | A font appeared selectable in the browser while native export lookup could silently substitute another face | Bundle matching faces and licenses, validate the saved choice, and render glyphs from that exact file. Verify all four families at all three weights with actual raster/video output and save/reopen. Preserve legacy appearance. **Local checks passed; production pending.** |

Process incident: an intermediate edit introduced an invalid UTF-8 byte and
temporarily broke local compilation. It was corrected. Preserve UTF-8 and check
the actual page after edits; tests that transpile source alone can miss this.

## 8. Known gaps and verification limits

1. Uploaded video references, including Talking Head uploads, do not have a
   general automatic OCR/transcription path into Remix. Users currently need to
   supply copy. This remains open, not an accepted permanent product limitation.
2. Talking Head's shared editor does not receive the same reference catalogue
   wiring as Hook/Wall. Reusing a catalogue-generated asset may lose usable
   reference-text association despite provenance in owned-media metadata.
   Recheck and fix that path before claiming all reference cases are supported.
3. The new music reference/custom/none row is a prototype/implementation plan;
   clean-source retention and the complete replacement/removal pipeline must be
   verified before release. The music plan reports a Hook 76 HEVC compatibility
   issue; investigate that exact asset rather than generalize the diagnosis.
4. Latest recorded local suite: **380 tests passed**, with targeted ESLint,
   TypeScript and whitespace checks. This is dated evidence, not a permanent
   test count or proof of first-time-user comprehension.
5. Actual local browser checks covered Hook demo replacement (desktop/mobile),
   Talking Head upload/replacement and restored sound controls, and Wall's
   source-less entry. Earlier reports contain additional editor/slideshow checks.
   Earlier browser quota/compiler failures are historical; later local checks
   succeeded. Do not copy an old blocker forward without rechecking it.
6. Production Explore redirected the checked browser session to sign-in. These
   local UI changes were not deployed as part of these checks. Authenticated
   generation → edit → preparation → Schedule/publication acceptance remains
   outstanding. Do not silently submit paid jobs or publish posts as UI checks.
7. Latest audio-scope/editor-panel follow-up: 243 targeted tests passed, with
   11 additional clip-control/Talking Head checks; the final Demo/Talking Head
   rerun passed 62 tests (overlapping the earlier checks). TypeScript, targeted
   ESLint and whitespace checks passed. Logs are in
   `outputs/explore-editor-scope-tests.log`,
   `outputs/explore-editor-scope-extra-tests.log` and
   `outputs/explore-editor-scope-final-tests.log`. Fresh full-page browser
   acceptance remains pending: the local application bundle reported Invalid
   or unexpected token and stayed on Opening your workspace; an isolated local
   fixture was not reachable by that browser. Do not reuse earlier screenshots
   as evidence for the newly removed panels. The temporary helper was stopped.
8. Talking Head custom whole-video music is now locally implemented through
   `use-workflow-background-music.ts` and the existing Audio Library picker.
   Owned asset ID and playback are saved in workflow session options separately
   from demo-only audio. Missing music blocks preparation until replaced or
   removed. Failed replacement retains the prior selection. See
   [the music implementation report](docs/talking-head-background-music-2026-10-15.md)
   for evidence. Production acceptance remains outstanding; the older scope
   audit's missing-upload finding describes the state before this change.
9. The 15 October scope recheck confirmed the current local callers hide Sound
   in both Talking Head clip editors and Hook opening editing; Hook demo's
   focused controls contain no Sound or Crop & zoom. Wall intentionally retains
   its single-video audio controls; Slideshow is images-only. See
   [the scope recheck](docs/explore-workflow-scope-recheck-2026-10-15.md) for
   current verification evidence and limits. Local removal is not proof the
   deployed authenticated editor contains the change.
10. Wall now defaults to text-only controls with optional advanced video tools.
    The shared focused editor remains mounted between modes; text, style, audio,
    preview and draft ownership are retained. Local functional suites (96 tests),
    TypeScript and targeted ESLint passed. Fresh browser/laptop screenshots and
    authenticated production acceptance are still pending. See
    [the Wall simplification report](docs/wall-text-simple-editor-2026-10-15.md).
11. Slideshow naming and flow recheck: 137 local checks passed across generation
    admission/recovery, image results, editing, save/recovery and schedule inputs;
    TypeScript and targeted ESLint passed. These include stubbed service boundaries,
    not paid provider execution. Production `/explore/slideshows` redirected to
    sign-in on 15 October, so authenticated generation, deployed saving enablement
    and publication remain unverified. Prompt-only scratch generation is blocked
    by the current composer; output sequences have a ten-slide maximum. See
    [the slideshow report](docs/explore-slideshow-flow-2026-10-15.md).
12. The subsequent user correction supersedes that audit's single-image quantity
    semantics. Selected slides × versions now generates grouped image jobs;
    business context, Flare, history and editable Library reopening are locally
    implemented. **249 application tests and 20 worker/provider tests passed**,
    with TypeScript, worker build and targeted ESLint. Network/provider/database
    boundaries are stubbed in these suites. The local browser fixture compiled,
    but Edge launch failed and the MCP browser could not reach its local server;
    fresh laptop screenshots and signed-in production acceptance remain pending.
    A final production navigation retry reported the browser profile already in
    use; the shared browser was not closed or reset.
    See [the versions/history report](docs/explore-slideshow-versions-and-history-2026-10-15.md).

### Portrait overview and recovery follow-up — 15 October 2026

- Local changes center Hook's overview cards and give empty Hook/Demo source
  slots a viewport-bounded 9:16 shape with centered source selection. Talking
  Head's empty overview canvas uses the same portrait treatment. Selected video
  ratios, focused editors, replacement handlers and audio ownership are retained.
- Hook reference labels now read **Hook** for published, staged and archived
  references. Browser-card checks target stable reference IDs so duplicate
  display labels do not select the wrong media.
- **236 targeted tests passed** across source/replacement, demo state, saved
  Talking Head composition, slideshow editing/recovery, workflow sessions,
  live clip controls, catalogue identity, reference actions and previews.
  TypeScript, targeted ESLint, CSS parsing and whitespace checks passed.
- Fresh visual acceptance is **pending**: the production browser retry reported
  its profile already in use; a separate headless Edge launch then failed during
  profile initialization. The shared browser was not reset. This pass therefore
  does not claim screenshots, laptop/zoom interaction acceptance, deployment or
  authenticated production end-to-end success.
- Recovery is available through the distinct paths listed in section 3. A
  universal gallery of every historical editable composition across all video
  workflows is not implemented; do not describe generation History that way.
- Release review on 16 October found that legacy slideshow reference-role paths
  could drop frozen business context/output position. Every provider-prompt path
  now uses the contextual slide prompt; all three legacy roles have a regression.
  See `docs/production-release-2026-10-16.md` for ordered rollout and actual
  deployment evidence; older local reports are not production acceptance.

## 9. Where the implementation lives

Paths below are pointers, not an excuse to treat every shared component as the
same product. Inspect current callers and props before editing.

| Concern | Main files |
| --- | --- |
| Menu and route inventory | `lib/explore/workflows.ts`, `app/explore/` |
| Hook/Wall/Slideshow workspace, stages and portal ownership | `components/explore/format-workspace.tsx` |
| Talking Head entry, composition and clip integration | `hook-workflow-entry.tsx`, `hook-workflow-preview.tsx`, `talking-head-clip-editing.tsx`, `workflow-composition-panel.tsx` under `components/explore/` |
| Shared clip editor / separate Hook demo editor | `components/explore/format-video-editor.tsx`, `components/explore/format-demo-section.tsx` |
| Trim, playback, text and appearance | `clip-trim-timeline.tsx`, `clip-preview-controls.tsx`, `format-video-text-fields.tsx`, `format-text-overlays-editor.tsx` under `components/explore/` |
| Remix UI and source resolution | `components/explore/remix-text-section.tsx`, `lib/explore/remix-source.ts`, `reference-text-store.ts`, `remix-text-edit.ts`, `remix-text-draft.ts` under `lib/explore/` |
| Slideshow identity/text/preview | `components/explore/format-slideshow-editor.tsx`, `format-slideshow-text-tools.tsx`, `lib/explore/slideshow-draft.ts` |
| Preview vs final composition | `components/explore/workflow-sequence-preview.tsx`, `workflow-edit-workspace.tsx`, `format-schedule-panel.tsx`, `pending-schedule-panel.tsx`, `lib/explore/wall-pending-composition.ts` |
| Layout/button behavior | `format-workspace.module.css`, `workflow-video-layout.module.css`, `workflow-section-layout.module.css`, `format-video-editor.module.css`, `workflow-creation.module.css`, `workflow-secondary-action.module.css`, `remix-text-section.module.css` under `components/explore/` |
| Draft lifecycle and media ownership | `components/explore/use-workflow-source-video.ts`, `use-local-workflow-media.ts`, `use-clip-draft-save.ts`, `lib/explore/clip-draft-contract.ts`, `workflow-draft-lifecycle.ts` |

Historical evidence, in order of relevance:

- [Demo step/replacement/audio follow-up](docs/explore-demo-step-fix-2026-10-15.md)
- [Workflow recheck and overview cleanup](docs/explore-workflow-recheck-2026-10-15.md)
- [Reference/scratch edge-case audit](docs/explore-remix-edge-case-audit-2026-10-15.md)
- [Earlier UI review](docs/explore-workflow-ui-review-2026-10-15.md)
- [Earlier clip editor review](docs/explore-clip-editor-clarity-2026-10-15.md)

Older reports contain superseded choices such as calling Demo Edit, hiding
sidebar upload controls, or permitting separate Hook demo audio. Follow this
document's current decisions and the latest user instruction, not those lines.
Media inventory counts and exact reference batches change; inspect current
catalogue/release records rather than copying counts from historical audits.

## 10. How to change Explore without repeating the mistakes

1. Read this context and relevant repository instructions. State the specific
   workflow, screen and scope being changed; inspect its actual caller/state.
2. Sketch the responsibility split: source setup, overview, focused editor,
   preparation, Schedule. Record current section names, tasks and entry points,
   then map each retained function to its new location. Do not solve
   discoverability with duplicate forms or silently replace Demo setup with Edit.
3. Trace actions through handlers, visibility conditions and real DOM targets.
   A button existing in JSX does not mean it is visible or usable.
4. Check reference-backed and scratch content, no media, existing media,
   replacement failure/cancel, restore/reload, and prepared output → edit again.
   Keep accepted media/drafts on failed changes and invalidate stale outputs.
5. For a shared change, examine all four public workflows. Include independent
   Demo text/audio and slideshow reorder/source identity where relevant.
6. Run meaningful existing regressions. Useful suites include
   `scripts/explore-format-source-workspace.test.mjs`,
   `explore-format-demo-state.test.mjs`, `explore-format-common-editor.test.mjs`,
   `explore-clip-live-controls.test.mjs`, `explore-slideshow-editor.test.mjs`,
   `explore-slideshow-text-tools.test.mjs`, `workflow-composition-panel.test.mjs`,
   `explore-background-composition.test.mjs` and `workflow-sections.test.mjs`
   under `scripts/`. Add a regression for a repeated functional defect; avoid
   brittle tests that merely assert decorative CSS or mirror implementation.
7. Inspect actual browser interactions using the laptop matrix in section 6,
   plus narrow layouts, scroll and error states. Verify preview sizes and button
   reachability, not just CSS presence. Capture screenshots of the final code.
   Label isolated fixtures honestly; do not present a mockup or old image as a
   current app capture. Report untested sizes and zoom states explicitly.
8. Record what changed, evidence, remaining gaps and deployment status. Final
   authenticated acceptance uses the production domain per `AGENTS.md`.
9. Update this context and the mistake log when a decision changes or a defect
   recurs. Do not close a mistake just because code compiled or tests passed;
   record visual verification and production acceptance separately.

### Decision history

| Date | Decision |
| --- | --- |
| 2026-10-15 | Focused clip editing hides workflow tabs; keep immediate preview, compact controls, truthful return actions and independent drafts. |
| 2026-10-15 | Reference-backed text leads with expanded Remix; scratch uses optional Remix; source copy and guidance share one input; remove glow and duplicate forms. |
| 2026-10-15 | Restore visible Demo upload/replacement; label Hook/Talking Head's second step Demo. Wall remains a single-video text workflow. |
| 2026-10-15 | Hook has one shared background track and no separate demo audio picker; Talking Head retains optional Demo sound. |
| 2026-10-15 | Establish this file as the durable Explore context, with explicit historical mistakes, open gaps and verification limits. |
| 2026-10-15 | Strengthen recurring-mistake prevention: preserve section identity/core functions during visual work, map feature ownership, and require constrained/wider laptop viewport checks rather than assuming a single desktop layout fits both 14-inch and 15.6-inch users. |
| 2026-10-15 | Remove irrelevant Crop & zoom from Hook demo editing and duplicate Sound panels from Hook/Talking Head focused editors; audio setup stays in Demo. Wall keeps its single-video audio path. Preserve existing saved edits and explicit legacy-framing recovery. |
| 2026-10-15 | Clarify Talking Head's embedded influencer speech (no default extra upload), optional demo-only audio attachment and optional whole-video background music as three distinct layers. Hook and Wall each use one complete background track. |
| 2026-10-15 | Implement Talking Head whole-video music upload and Audio Library selection in Demo, with independent owned-track recovery, repeat/play-once, removal and preview/preparation/Schedule plumbing. Preserve embedded speech and separate demo audio; guard old custom-track render reuse. |
| 2026-10-15 | Whole-video Background music starts Off for new Talking Head videos; selecting/uploading a track preserves On/Off until the user explicitly enables it. Existing saved choices retain their setting. |
| 2026-10-15 | Wall Edit leads with Remix/manual text and preview. A compact Edit action opens advanced trim/style/audio; Back to text retains the same draft. Wall text spans the whole selected clip and has no per-block timing UI; Hook/demo timing stays independent. |
| 2026-10-15 | Slideshows generate selected slides × versions, with server-owned business context and Flare default. Compact reference selection retains direct thumbnail toggles; History, full-version editing, earlier drafts and saved Library Edit slides restore prior work without overwriting it. |
| 2026-10-15 | Hook/Demo empty overview slots use centered portrait upload areas with viewport-bounded sizes; Talking Head's empty-demo canvas follows the same principle. Hook reference captions omit catalogue numbers while keeping stable media IDs. Recovery entry points and their distinct limits are recorded per workflow. |

### Rejected Hook background soundtracks — 19 October 2026

- User rejected ONLY Hooks 3, 13 and 59 background tracks as incomplete. Removed those three MP3s from the manual audio-review collection; retained all other background/native tracks and all 98 videos. Exporter tombstones prevent accidental re-export.
- Production policy is audioPolicy: silent for the three permanent reference IDs. New generation strips provider/native sound and does not attach a catalogue soundtrack; gallery metadata omits pairedAudio. Historical renders/explicit saved audio receipts are retained.
- Native audio means sound embedded in the original MP4. It exists for Hooks 6, 53, 54, 55, 69, 73, 74 and 88; Hook 78 has none. Extracted review M4As are manual-review artifacts, not production inputs. Providers currently receive original MP4s, including embedded sound; normal final output replaces provider sound with the separate catalogue MP3.
- All 18 trimmed MP4s were independently verified in the exact original D: import folders; Hook 18 stays unchanged. This soundtrack release does not switch production video source URLs to the local trimmed derivatives.

## Combined Hook, Seedance, image picker and Trending correction — 19 October 2026

- This release activates the 18 user-approved tail trims and matching gallery previews, durations, reviewed prompts and caption source hashes. Hook 18 remains unchanged. Immutable old media identities and original text/prompt records are retained in scripts/data/hook-reference-scene-release.json.
- Background tracks for Hooks 3, 13 and 59 remain disabled; all other reference music remains unchanged. This does not rewrite historical generated output.
- Seedance 2.5 now passes Explore Hook/Wall model admission and the corresponding gallery/audio guards, retaining ReAPI routing, model limits, ownership and billing checks. No paid generation is part of validation.
- Shared image pickers use small public previews, 24 initial entries, no hidden-tab downloads and a one-minute owner-scoped metadata window. Multi-reference Add images accepts a batch with bounded uploads and existing limits.
- Trending body-only slide edits now resolve copy from the same submitted fields as the editor; renderer version advances so cached blank renders are not reused. Previously saved blank images require a new save/render. Earlier deployed quota-history behavior is retained by basing this release on main 283afc17.
- These are release preparation decisions. Production acceptance is recorded separately after deployment; successful local checks alone are not live acceptance.

### Hook Your videos scheduling shortcut — 20 October 2026

- User approved only a **Schedule video** shortcut in Hook's **Your videos**
  overview. After user feedback about excess scrolling, the separate footer
  was removed. The button now sits in the existing overview header action row,
  next to Generated videos when available, without a separate bordered panel or
  bottom padding. It is hidden during focused clip editing. No background audio
  shortcut was requested or added.
- The overview and existing Demo button share the same rendered action,
  disabled conditions and `requestSchedule` handler. Opening-only, demo-only
  and combined compositions retain the existing preparation and Schedule form;
  this shortcut does not submit or publish a post.
- Local validation: 169 existing source-workspace, demo-state and common-editor
  checks passed, plus TypeScript, targeted ESLint and whitespace checks. The
  common-editor suite needs the existing next-server-only test loader for its
  extensionless imports. Browser access to the local preview timed out, so fresh
  visual acceptance remains pending. This change has not been deployed or
  verified on production.

### Hook / Wall generation sound and input roles — 21 October 2026, local

- New Hook and Wall generation requests have an explicit **Sound off / on**
  switch at the bottom-right of Your instructions. It defaults off for each
  workflow/account and is frozen with a pending submission. This controls the
  generated clip, not the gallery preview player's playback volume. Explicit
  later editing music or Demo sound remains a separate user choice.
- Server defaults missing workflow sound values to false and rejects malformed
  values before reserving credits. Both admission paths persist `generateAudio`.
  Seedance/ReAPI sends `generate_audio`; WAN/ReAPI sends `audio`. The current
  direct Omni SDK route has no supported native sound flag: prompt instructions
  plus a final local audio strip enforce silence, without promising provider
  cost savings. OFF stream-copies video and removes every audio stream.
- Explicit sound choices supersede automatic catalogue music, including ON:
  provider-generated sound follows the prompt and explicitly selected audio
  references. Do not replace requested speech with a gallery MP3. Legacy jobs
  without this field keep their accepted fingerprints and soundtrack behavior.
  Hooks 3, 13 and 59 rejected catalogue tracks remain disabled.
- Person photos + video use the video for performance, expressions, pose,
  clothing and scene; photos supply facial identity/proportions. Regenerating the
  body is allowed. Photos + prompt without video create a new performance and
  must not receive an instruction to preserve a nonexistent source. Other images
  do not receive person-photo instructions. Seedance uses `@Image N` / `@Video 1`;
  WAN uses `Image N` / `Video 1`. This clarifies inputs; facial fidelity remains
  unproven until a separately approved visual generation test.
- Pricing is route-specific. ReAPI WAN documentation explicitly says sound off
  costs the same as on; Seedance documentation does not establish an independent
  sound-off discount. Keep app estimates unchanged until a verified rate applies.
- Local verification: 29 API/input-role tests, 77 UI request tests, 49 provider/
  worker recovery tests, 10 real-media/legacy-audio tests and 68 workspace/provider
  regressions passed. Audio-off
  output has no audio stream and identical decoded frames/timestamps. TypeScript,
  worker build, local production build and targeted ESLint passed. The first
  production build hit a sandbox cache-write EPERM; rerunning the same build with
  cache access completed successfully. In-app browser access to localhost and
  127.0.0.1 timed out, so fresh visual acceptance is pending. No paid generation,
  database change, push or deployment was performed for this work.

### Face replacement audit follow-up — 21 October 2026

- Re-audited current prompt/asset/model/native-request/postprocessing paths and
  re-ran 29 offline API/input-role tests. `@Video 1` / ordered `@Image N` bindings
  are implemented locally; no new paid result proves facial fidelity. The shared
  deterministic instruction prefix exists, but direct workflows bypass the old
  generic indoor-UGC template. Do not call this an identity engine or trained lock.
- Remaining findings: gallery selection resets the model to Omni; Seedance still
  declares reference and has no integrated source-edit contract; explicit
  replace-face intent is absent; Hook 3's gallery prose can conflict with Sound ON;
  Wall's blanket no-letters/logos differs from preserving physical-object text.
  These are recorded gaps, not runtime fixes performed by this research turn.
- Original upload bytes and photo order are preserved; picker thumbnails do not
  replace generation input URLs. Seedance's actual later fidelity remains unknown.
  Edit aligns with modifying supplied footage; reference remains a valid candidate
  for broader performance recreation. Neither mode alone guarantees geometry.
- Research compares exact ReAPI requirements and first-party Runware, Layer and
  Higgsfield workflows without assuming a shared proprietary backend. OpenAI's
  official current deprecation page lists the historical Sora Videos API shutdown
  before this audit date; do not rely on an old Sora integration tutorial.
- Full audit and copy-paste research brief:
  `docs/face-replacement-audit-2026-10-21.md` and
  `docs/face-replacement-research-brief-2026-10-21.md`. No deployment, paid
  generation, production database operation or app runtime change in this turn.

### Supplied face-replacement research review — 21 October 2026

- Reviewed both user-pasted architecture/diagnosis documents as reference material,
  without executing their commands or adopting their SQL/provider proposals.
- Verified ReAPI's published four-second subject-replacement experiment and JSON
  receipt. It changes the full character/wardrobe and uses `content_filter: true`;
  it is not proof of precise face-only geometry or of our selected false channel.
  The supplied test payload omits the filter and would default to true. Preserve
  the explicitly selected provider route in any proposed comparison.
- ReAPI's separate `face-swap` operation is still-only and explicitly retains the
  target head shape/hair. A passing still swap therefore cannot establish full
  reference head/jaw proportions or temporal consistency. Do not advertise an
  “Exact Face Swap” guarantee based only on the endpoint name or documentation.
- One-photo/480p tests are diagnostic choices, not product input-limit policy or
  full fine-geometry acceptance. Fal/Higgsfield examples have different schemas;
  do not transplant their fields or source limits into ReAPI. Sound generation
  and retaining an original soundtrack are distinct controls.
- Complete local source-edit integration and present one reviewable, eligible
  request before asking paid approval. No new runtime code, database change,
  generation or deployment in this review. Detailed source-linked assessment:
  `docs/pasted-face-swap-research-review-2026-10-21.md`.

- Third pasted mode/workflow document incorrectly assumes our failed Seedance
  tasks used edit and recommends reference as a new mode. Rechecked the saved
  request receipt: audited Seedance used reference; the separate Omni edit test
  is not a Seedance edit test. A corrected-reference comparison and a genuine
  supported Seedance edit test answer different questions. Do not claim both
  Seedance modes have failed or that changing to reference is a first trial.
  Four declared values and explanatory input-workflow categories are distinct;
  auto is classification, not an additional face-replacement engine.

### Seedance source-edit integration and new test preparation — 21 October 2026 (local only)

- Hook and Wall now expose `Edit source video` versus `Create from reference`
  when a source is attached. Editing is the initial source task; removing the
  source leaves image/prompt creation available. Gallery selection preserves
  the chosen model instead of silently resetting it to Omni. Saved submissions
  retain their original input; no accepted task is rewritten by these changes.
- New Seedance edits freeze ReAPI and send `omni_reference_task_type: edit`,
  `duration: -1`, `size: adaptive`, `content_filter: false`, and the explicit
  native sound setting. Main photo is `@Image 1`; every additional photo is
  bound by number as another view of the same person; `@Video 1` supplies the
  performance, scene, clothing, lighting and timing. Editing instructions
  describe modifying footage rather than creating a new scene. No face-geometry
  or pixel-preservation guarantee has been established by these code changes.
- API and UI reject short Seedance edit sources (under 4 seconds), unsupported
  edit models and excess inputs before credit admission. Worker validation
  independently enforces the provider contract. Seedance edit app credits use
  the verified source duration rounded up; provider automatic-duration reserves
  and settlement are separate, with a 30-second provider output reservation.
- Photo-only creation retains its own performance instructions. Reference
  creation remains a separate choice; it must not be presented as a tested
  exact replacement. Legacy jobs without the new edit declaration continue
  their recorded reference contract and recovery fingerprints.
- Sound remains OFF by default for Hook/Wall, reaches the native provider flag,
  and is enforced by removing output audio without re-encoding its pictures.
  Removed conflicting hardcoded silence from visual gallery performance prose:
  the explicit sound choice now owns that instruction. Rejected Hook 3/13/59
  soundtrack mappings remain disabled; this does not restore their tracks.
- User supplied `csdss.mp4` (104 frames, 3.467 seconds) and six new portraits.
  User explicitly approved a separate four-second test copy with a final-frame
  hold. Offline preflight verifies all 104 retained decoded pictures exactly,
  appends 16 copies of the last picture, strips audio, hashes originals and
  copies all six photos without alteration. The frontal `Softly Lit Neutral
  Bedroom Portrait.png` is main. Originals stay unchanged. Preparation script:
  `scripts/prepare-seedance-face-edit-test.mjs`; ignored artifacts:
  `outputs/seedance-edit-test-2026-10-21/`.
- No paid submission, upload, production database change or deployment in this
  implementation. Paid test needs the reviewable cost approval first. Local
  mocked-provider tests establish routing, roles, billing boundaries, recovery,
  timeline checks and actual silence, not facial fidelity or live acceptance.

- The user later explicitly approved ONE four-second paid diagnostic using
  these new assets. ReAPI accepted task
  `task_01a15b20ef8b77bbaf8d7faf0606023e` with the corrected edit contract,
  all six ordered portraits and sound OFF. One POST only; local durable receipt
  under `outputs/seedance-edit-test-2026-10-21/paid-test-receipt.json` protects
  against duplicate submission. Direct adapter test uses existing media storage
  without application jobs, app-credit charges, database changes or deployment.
  Provider output and visual acceptance are pending; recover this ID before
  considering any further paid work.

- That one accepted task subsequently COMPLETED and was collected locally.
  Settled ReAPI usage is 1,281 credits (US$1.281), one paid POST, no database or
  application-credit changes. Actual output is 720×1280, 24 fps, 89 frames,
  3.709 seconds from the verified four-second source; current 0.25-second edit
  timeline guard rejects the 0.291-second difference. Do not hide this mismatch
  with output padding or confuse it with failed collection. Preserve the saved
  provider result/receipt; no automatic regeneration is authorized.
- All 89 decoded frames inspected: caption removed and silence confirmed;
  source room/clothing/hair and reaction broadly retained, but reference-face
  fidelity does NOT pass visual acceptance and exact performance timing is not
  locked. Input-flow fixes have live acceptance evidence, not a solved-fidelity
  claim. Generated output is
  `outputs/seedance-edit-test-2026-10-21/seedance-generated-silent.mp4`;
  audit/comparison artifacts are in the same directory. No deployment or second
  paid attempt. Detailed observations are recorded in
  `docs/seedance-source-edit-implementation-2026-10-21.md`.

### Proposed Hook recreation through an approved starting image — 21 October 2026

- User proposes replacing the direct video face-edit attempt with a staged
  Recreate flow: extract source frame, choose/upload/build influencer, generate
  and approve a new starting image, then animate it with the reviewed Hook action
  prompt. Current work is research/design and a static audit; not implemented
  runtime behavior, a new paid test or deployment.
- Recommend actual first frame by default and optional deliberate frame selection;
  cache by canonical trimmed-source hash/frame index. Posters are not necessarily
  first frames. Starting image is required; ending image is optional for specific
  final pose/loop needs, not an identity guarantee. Keep source hairstyle/clothes
  unless explicitly changed; image approval precedes any billed animation.
- Verified all 98 active release Hook prompts exist and match source SHA-256.
  All 98 use original-video wording; 97 use source-duration wording. Reuse action
  observations but author/review separate keyframe-image and self-contained
  motion prompts. Missing/new hashes require review; do not call every legacy
  prompt qualified for the new image-only input path.
- The current image API restricts multi-reference image generation to Slideshows;
  Hook needs a proper keyframe purpose/contract, not a Slideshow disguise.
  Current ReAPI video adapter does not yet emit explicit first/last-frame roles.
  Existing character identities/history and Build character flow can be reused.
- ReAPI's new path must use `image_with_roles` with `first_frame` and optional
  `last_frame`, adaptive shape, fixed output duration and the existing explicit
  sound/filter choices. Omit original video URLs, generic image_urls and edit
  declaration. Sending source video with frame roles changes their treatment to
  reference guidance. Separate photos belong to image-editing stage; the approved
  full-scene frame supplies appearance/composition to animation.
- Keep prompt/photo-only Generate available separately. Default sound remains
  OFF. Present two separate costs; no claim that an extra image stage or image-
  to-video is automatically cheaper. Source clip need not be padded to four
  seconds when only its extracted still is passed to a fixed-duration animation.
- Detailed plan and wireframe:
  `docs/hook-keyframe-recreation-plan-2026-10-21.md`. Offline prompt audit and
  actual first/last stills from the hash-verified original test-source copy:
  `outputs/keyframe-recreation-plan-2026-10-21/`. No AI image was generated here.

- User confirmed the first iteration should use **only a starting frame**, then
  they will test it before deciding further changes. Defer ending-frame controls,
  requests and generation; earlier optional-ending recommendations are future
  scope, not version-one requirements. Implementation sequence is Hook wizard +
  free extraction/owned influencer selection, image-stage role/prompt/API + image
  approval, separately adapted motion prompts, explicit fixed-duration first-frame
  animation with sound OFF, then offline validation and user review. No new paid
  test or deployment is authorized by this planning discussion.

## Combined deployment resumed — 23 October 2026

- The user explicitly resumed the complete release and required the documented deployment order. Earlier deployment-pause notes are historical. Verify the already applied slideshow migration, freeze all intentional work, deploy and verify the matching generation worker, then merge/release website and MCP.
- Current checks: 1,099 combined focused tests, 346 worker tests, 324 MCP tests, scoped lint, production compilation/TypeScript, native route traces and compiled MCP rejection checks pass. Local fixtures and source/media reviews remain distinct from hosted authenticated acceptance and paid generation quality.
- The complete scope and every ignored path exclusion are recorded in `docs/combined-release-deployment-2026-10-23.md`. No unrelated migration, billing change, paid quality run or sibling-project retirement belongs to this release.
