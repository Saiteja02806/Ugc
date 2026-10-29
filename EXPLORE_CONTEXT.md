# Explore context and UI decision record

28 October Wall next batch: three non-numbered source-hash-bound profiles (652f/e95c/2fe0) added locally, bringing this continuation to eleven new profiles. 41 tests/types/lint and fixture browser editing/reopen/blank/full-duration/mobile checks pass. Saved styles retain priority; automatic Wall remains gated off. No deploy/generation. See docs/prompt-reviews/wall-three-nonnumbered-admission-2026-10-28.md; hosted and remaining reference acceptance unverified.

28 October 2026 Wall placement continuation: user authorized scoped context/evidence preflight. Added eight local source-hash-bound profiles (49/52/56/58/62/63, then45/57), preserving existing profiles, saved edits and duration. Wall58 outline8, Wall63 outline4 readability adaptation, Wall52 top.525. 38 tests/types/lint and actual-profile fixture browser pass. No deployment/video generation; automatic Wall flags stay disabled. Receipt: docs/prompt-reviews/wall-eight-local-admission-2026-10-28.md. Other references remain unfinished.

## 2026-10-26 Public Hook Video Bundle (local; hosted verification pending)

- Owner requests no sign-in, one ZIP of all ordinary public Hook references and
  a global cap of100download starts. Frozen manifest contains104public clips;
  private creator sets/customer outputs excluded. /hook-video-bundle serves
  everyone; signed-out /explore/hook-video shows the same offer after auth init.
  Signed-in workflow and adjacent API/route guards retain their existing policy.
- Generation-conditional GCS writes admit at most100starts across instances;
  duplicate request IDs cannot start another stream. GET/prefetch do not count.
  At100: HTTP410 and100downloads reached. Interrupted admitted transfers count;
  no unique-human/completed-save claim. Never reset on errors or rollback.
- Real104-file ZIP and all hashes/CRCs verified independently.36focused tests,
  types/lint, isolated production build and desktop/mobile browser fixtures pass.
  Current-device hosted counter read returns403; no production counter write,
  slot or deployment. Fixtures are not hosted acceptance. Receipt/release gate:
  docs/hook-video-bundle-2026-10-26.md.

## 2026-10-25 Slideshow planner follow-up

- Named-source planning receives the validated server-owned business snapshot
  already used by image jobs. Snapshot, model and planner version are included
  in the durable request hash. Changed facts cannot silently reuse an old plan.
- Explicit business adaptation permits supported replacement copy; visual-only
  requests preserve copy. Shared same-person photos can both guide applicable
  slides without asking for a primary-photo mapping.
- This corrects the missing handoff recorded below. 141 regression tests,
  TypeScript and scoped lint pass, covering the actual API handoff, captured
  planner message, profile/hash conflicts, both person uploads, immutable old
  clarifications, UI submission and private plan storage. Model responses are mocked; live wording and
  generated image quality still need authenticated acceptance.
- Follow-up source 20228597 is deployed to website and MCP; production aliases
  and twenty real-domain HTTP checks pass. Deployment evidence and limits are in
  docs/combined-release-2026-10-25.md.

## 2026-10-25 Combined release deployed

- Website/MCP c32a7893 and all eight worker targets (matching worker tree at
  45bf657b) are deployed. Includes the local changes below, saved-caption and
  scheduling fixes, and explicit 24-hour time. Migration 20261025114510 is applied.
- All 83 ordinary Hook frames are stored and independently verified. Website
  stored-frame and automatic-text server/client flags are enabled. No MP4 decode
  occurs in the stored-only path. Cold storage-network latency still exists.
- Local: 1,168 combined tests, 104 worker tests, 89 additional schedule/migration
  checks, production builds and caption/scheduling browser fixtures pass. Live:
  40 public layouts and 20 HTTP checks pass. User chose checks without sign-in;
  signed-in generation, editing and real scheduling are not accepted by these
  public tests. The planner recurrence below remains an open separate issue.
- Full identities, exclusions and evidence: docs/combined-release-2026-10-25.md.

## 2026-10-25 Slideshow planner clarification recurrence (production read-only)

- The new screenshot matches production plan `29708ff4-e4fc-470d-bb1d-3aa1ce57214a`
  at 17:50:24 IST, following two equivalent attempts. Six source targets and two
  uploads reach planning; zero output slides are planned. Neither saved business
  context field is present. The 23 October handoff defect below remains in code:
  the API loads the server-owned profile but passes only named image context to
  the planner. Its blanket business-copy prohibition compounds the missing facts.
- A second clarification unnecessarily requests Upload B/C primary-face mapping.
  Per-slide execution already supports both uploads with role person; no required
  primary-face field exists. Existing tests prove compiled support, not that the
  live planner will choose the expected assignments from conversational text.
- Clarifications return 422 before image credit reservation/dispatch. Completed
  plan status means a stored planning response, not completed generated slides.
  Do not diagnose face-model quality or failed image uploads from this response.
- Investigation only: no runtime correction, paid generation or deployment.
  Proposed correction and exact evidence: docs/slideshow-planner-recurrence-2026-10-25.md.

## 2026-10-25 Explicit 24-hour scheduling time (local)

- User requests 24-hour display instead of AM/PM. The shared workflow field
  displays exact HH:mm text with a 24-hour label and 00:00–23:59 guidance,
  avoiding locale-dependent native time controls. Existing drafts and scheduling
  payloads retain their HH:mm values and selected timezone.
- The main Scheduling picker uses hours 00–23 and minutes 00–59 with no period
  rail. Its selected time, current clock and earliest-slot help all use 24 hours.
  Noon is 12:00; midnight is 00:00. Existing future-time checks remain in place.
- This supersedes earlier AM/PM presentation guidance. Local change only;
  no schedule submission or production deployment in this adjustment.
- Validation: 112 scheduling tests, application TypeScript and scoped ESLint
  pass. The shared field regression covers midnight, noon, afternoon, invalid
  time formats and preservation of the remaining draft fields. Browser fixture
  assertions are updated; a fresh browser run was not made.

## 2026-10-25 Slideshow click reduction and combined save actions (local)

- Create's Source slides now has Select all for generation references. This does
  not generate or import images; Add slides' original-image bulk import remains
  a separate action. Reference order and explicit generation/cost approval stay.
- Upload reference slides and Use my finished slides now identify the two paths.
  Finished slides open the file picker directly from Create or Your slides;
  choosing that source inside Add slides also opens the picker immediately.
  Existing upload validation, 10-slide limit and 4:5 fit behavior are preserved.
- Clip editors offer Save & return; Wall and Slideshow offer Save & review post.
  Save-only remains available. Navigation waits for confirmed saved edits; failure
  stays in the editor. Slideshow interrupted saves retain the same request identity.
  Review does not submit a scheduled post.
- Slideshow Edit offers Apply appearance to all or selected slides and Undo.
  Copy only font, size, color, alignment, position, background shape/color/opacity;
  never copy words. Undo preserves later words and manual style changes, does not
  resurrect removed slides, and resets after sequence/image changes. Existing
  preview/export text fitting remains authoritative; baked-in text is unaffected.
- Recreate slide opens a dialog inside Edit with the existing generation composer
  and result picker. It submits the owned regeneration target without catalogue
  references or the whole-slideshow count field. Multiple image alternatives may
  be requested, but a replacement changes only the selected slot after an explicit
  choice. Existing text, order and neighbors remain. Close clears the pending
  replacement target; already-submitted jobs continue through existing recovery.
- Local tests and production acceptance remain distinct. No deployment, paid
  generation or authenticated production visual verification in this change.
  See docs/slideshow-click-reduction-2026-10-25.md for validation and remaining checks.

## 2026-10-25 Remember the last photos; no photo packages (implemented locally)

- User replaces the earlier photo-package proposal with simple automatic reuse.
  Do not introduce named packages, a default-package toggle, or main/supporting
  roles in the UI. Recreate shows "Your photos", equal photo thumbnails and
  Choose/Change photos. The shared photo chooser and guide remove role badges,
  "Use as main" and reference headings for person photos. Internal ordered-photo
  generation contracts remain unchanged; users choose photos of the same person.
- Explicit photo changes in starting-frame preparation remember only ordered
  asset IDs, scoped to the signed-in account in this browser. A fresh preparation
  resolves those IDs through the existing authenticated media API before reuse.
  No backend package table, reupload or automatic generation is introduced.
- Existing drafts, including intentionally empty selections, always take priority.
  Restoring an older draft does not update the remembered selection. Clearing
  photos remembers an empty selection. Photo editing remains gated while initial
  restoration runs, and unmount/account changes discard late reads. Invalid or
  unavailable remembered photos load no partial selection and allow choosing again.
- Applies to shared Recreate preparation for Hook, Wall and Talking Head; it does
  not inject photos into existing animation drafts. Model caps and explicit paid
  generation/frame approval are preserved. This browser preference does not sync
  between devices. UI copy states that scope.
- Local verification: 78 focused tests, application TypeScript and scoped lint
  pass, covering restoration, clearing, account separation, failed reads and late
  results. Production deployment and authenticated browser/visual
  acceptance remain separate and have not been performed. Earlier photo-package
  notes below are superseded by this decision.

## 2026-10-25 Stored frames and automatic Hook text (implemented locally)

- User selects these two improvements for the first implementation plan. Deliver
  durable ordinary-reference frames first, then automatic editable Hook text.
  Photo sets and other click-reduction proposals remain separate future scope.
- Plan: `docs/hook-automatic-text-and-stored-frames-plan-2026-10-25.md`.
  Reuse current source snapshot/object storage, prepared Remix source and prompt
  rules, request recovery and revision-checked clip drafts. Background text must
  be linked to the accepted video batch and survive page closure. Recommend one
  adapted copy per batch, fitted separately per result, with no late overwrite.
- Automatic initial text includes fitting/persistence and main-preview display.
  Keep existing deliberate frame approval and scheduling; unresolved text cannot
  silently disappear from a scheduled snapshot. Existing private frames remain
  private.
- Ordinary Hook frame zero now has a durable, immutable object-store index keyed
  by source SHA and extractor version. The stored-only read path verifies PNG
  bytes/hash/dimensions; it never downloads or decodes the MP4 on a cache miss.
  Prepare existing active ordinary references with
  `scripts/prepare-hook-source-frames.mjs --write`, then run without `--write`
  to verify. Hook release publishers prepare frames before catalogue activation.
  Curated/private frames and Wall/Talking Head fallback paths stay separate.
  Missing/corrupt stored frames fail visibly and require preparation/restoration;
  user Recreate requests do not start background extraction or storage writes.
- Automatic text is optional and checked by default for eligible reference-backed
  Hook generations when enabled. The composer preflights reviewed source,
  business context and the existing 20-per-24-hours Remix allowance. Server
  admission freezes the source, business context, prompts, model and batch text
  identity. The video worker runs text alongside video, using one durable Remix
  claim per batch with no provider retries or extra quality-review model call.
- Worker outputs carry a fitted editable overlay and a text receipt. Migration
  `20261025114510_automatic_hook_text_drafts.sql` initializes scope `hook` in the
  same transaction as media/job completion. Existing drafts always win, including
  empty drafts after deliberate text removal. The existing editor restores the
  draft into the main preview and uses identical edit JSON for rendering.
  Failed/uncertain text keeps the video and requires adding text or explicitly
  continuing without it; that decision can be saved as an ordinary draft.
- Rollout remains OFF in example configuration: stored-frame server flag
  `EXPLORE_STORED_SOURCE_FRAMES_ENABLED`; automatic-text server/client flags
  `EXPLORE_AUTOMATIC_HOOK_TEXT_ENABLED` and
  `NEXT_PUBLIC_EXPLORE_AUTOMATIC_HOOK_TEXT_ENABLED`. Deploy the migration and
  worker before enabling the automatic-text UI. Existing Remix must also be on.
- Local evidence and production acceptance are separate. See
  `docs/hook-frames-and-automatic-text-implementation-2026-10-25.md` for tests,
  rollout sequence and remaining hosted checks. No production rollout or paid
  generation was performed during implementation.

## 2026-10-25 Saved-caption drawer and scheduling timeout recovery (local)

- User screenshots show Saved captions expanding below the post caption with
  nested list/per-caption scrollbars, pushing the date/time and Schedule actions
  down. The shared caption field now opens a right-side dialog drawer with one
  list scroll area, a fixed close header and full-width mobile layout. Save
  caption keeps the drawer closed; Use caption applies the exact text, closes
  it and returns focus to the field. Defaults/intentional blank rules remain.
- The screenshot also shows raw `signal timed out`. The saved-caption library
  is not awaited by scheduling; do not claim its layout caused a network timeout.
  Preflight reads now retry a timeout once and identify the failed settings
  check. Background music token/download/body reads have a bounded deadline.
  Background scheduling reports settings, media and save/recovery progress,
  describes pre-submit media timeouts, and retains uncertain submitted requests.
  No automatic schedule POST retries or new idempotency keys on a lost reply.
- Local checks: 76 focused tests, scoped lint and application TypeScript pass.
  Updated browser fixture is not executed: browser access was disabled earlier.
  No hosted reproduction, successful production schedule or deployment is claimed.
  Vercel denied the read-only request-log query (HTTP 403); no retry against that
  denied source. Exact production timeout cause remains unverified. Details:
  `docs/saved-caption-scheduling-fixes-2026-10-25.md`.

## 2026-10-25 Automatic text on newly generated Hooks proposed

- User wants generated Hooks to arrive with adapted Remix text already fitted
  and visible on the main video. Current generation selects footage; generating
  Remix and applying it are separate actions. Proposed initial scope is new
  reference-backed Hooks with prepared source text and saved business context.
- Link one text request to the accepted video request and prepare them in
  parallel. Persist an editable overlay on that exact output once, retaining
  minimal source-word adaptation, readable wrapping/sizing, Hook timing and
  preview/export parity. Keep Demo text independent. Show Edit text/Remove text.
- Initial auto-apply is a proposed exception to manual Remix's review/Apply
  rule. Existing drafts, user edits/removal and late results must not overwrite
  each other; reopening/history must not start new generation. Missing context,
  text failure or allowance limits retain footage and offer truthful recovery.
  Keep final publishing confirmation explicit. This remains a proposal only;
  no automatic Remix request, billing change or generation implementation.

## 2026-10-25 Reusable person photo sets proposed

- User proposes selecting multiple person photos once, saving them as a small
  package, and auto-selecting/showing them when Recreate opens. Current code
  restores photos per owner/draft/reference; new preparations start empty and
  changing saved influencer resets supporting photos to prevent mixed identities.
- Recommended design, not yet accepted implementation: a named Photo set with
  main/supporting photos and an explicit default for new recreations. Reuse owned
  assets and existing influencer/library entry points. Show set name/thumbnails
  and Change without automatically opening the picker. Saving a set is optional.
- Existing draft choices (including cleared photos) override defaults. Replacing
  a set replaces the whole person selection; accepted requests retain frozen
  asset IDs/version. Preserve model limits, ownership and explicit Generate/cost
  and result approval. Opening Recreate must not submit a paid request.
- Full rationale, first-use/repeat-use flow and acceptance checks are in
  `docs/explore-click-friction-review-2026-10-24.md`. Photo sets are distinct from
  stored source frames and generated results; no identity-quality guarantee.
  This turn records a proposal only, with no runtime change or deployment.

## 2026-10-24 Recreate source-frame latency recurrence (issue and proposal)

- User reports a long source-frame wait every time Recreate is opened and asks
  to prepare the reference frame once and store it in the backend. Add this as
  a P1 latency issue in `docs/explore-click-friction-review-2026-10-24.md`.
- Current ordinary-reference fallback still reads/downloads MP4 and decodes
  frame zero on a process-cache miss: eight entries / 24 MiB / five minutes.
  Curated and private creator frames already use stored PNGs; do not attribute
  their remaining wait to repeated extraction without a production timing trace.
- Proposed direction: precompute/backfill exact selected source frames into
  durable versioned storage and serve them on Recreate. Preserve source/frame
  hash bindings, approved later frames, legacy receipts and private access.
  Reuse existing stored frames, separate display readiness from unrelated loads,
  and measure click-to-frame on cold and warm paths. Personalized generated
  frames remain bound to their own person/instructions/accepted receipt.
- This records the recurrence and recommendation only. No runtime change,
  migration, media upload, paid request, production measurement or deployment.

## 2026-10-24 Four-workflow click-friction review (recommendations only)

- User reports excessive clicks after heavy Hook and Slideshow use and requests
  checking all four public workflows, including Wall and Talking Head + Demo.
  Prioritize removing repeated choices, indirect picker actions and unnecessary
  return navigation while preserving intentional content and publishing decisions.
- Current code review identifies indirect video pickers, per-slide-only generation
  selection, nested slideshow uploads, split save/return actions and ambiguous
  reference-versus-finished-slide uploads. Proposed fixes and acceptance checks:
  `docs/explore-click-friction-review-2026-10-24.md`. No workflow behavior changed.
- Reuse existing Hook scheduling shortcuts, whole-set slideshow assembly,
  overview Save/Schedule, draft recovery and single-account auto-selection. Do
  not count these as missing, make Demo compulsory, or flatten audio scopes.
- One fresh authenticated production Explore landing capture was inspected.
  Browser access was then disabled in Work settings; all four deeper workflows
  were assessed from current code, not visually accepted in production. Agent
  review stopped at a usage limit; parent completed the source review. No paid
  calls, production mutations, implementation tests or deployment were run.

## 2026-10-24 Creator identity fidelity audit

- User reports source appearance retained after choosing influencer photos.
  The completed Creator Account 1 clip 6 production request has v4, Pro and both
  owned face images in source/main/support order. Exact prompt/hash and offline
  real-adapter byte replay pass. Its existing output supports the quality concern;
  input correctness does not qualify facial likeness. This is distinct from the
  earlier pre-submission v3 model-routing failure.
- Both creator Hook accounts use normal v4. Preserve the previously approved
  baseline and immutable accepted receipts; do not silently promote v5/v6 or
  claim stronger wording fixes fidelity. Prior stricter trials were mixed.
  A new identity-focused prompt needs a versioned, controlled output comparison.
- Private TikTok sets use the ordinary per-slide planner, not Hook face roles.
  Choosing the collection alone does not request person replacement. Explicit
  per-slide replacement instructions and assigned person attachments survive
  compilation; generated quality and live planner behavior remain unqualified.
- 54 application and 135 worker tests, 36 creator/model simulations and the
  saved-input offline replay pass. No paid calls, production changes or deployment.
  Details: docs/creator-identity-prompt-audit-2026-10-24.md.

## 2026-10-24 Creator repair and PR 85 production release verified

- Website and MCP now serve reviewed main commit `e9f441e6`, which includes
  Recreate release `0f9f2eba`, the integration of PR 84, and correctly merged
  PR 85. Website deployment `dpl_F8NBi11GSzP3MdVwJyPUmaxA4G39` owns apex/www;
  MCP deployment `dpl_68dGPSrZVBAVgGU28k32RV5jMLSy` owns its production host.
- Generation worker `ugc-ai-generation-worker-r-e8cf2663` serves 100% traffic
  using a pinned image with verified baked/runtime commit `e8cf2663`. That
  worker Git tree is identical to `e9f441e6`. Functional configuration matches
  the previous revision. The v3 Gemini receipt-routing fix is deployed.
- Production checks pass: 13 public/authorization/media checks, 30 SEO checks
  across 23 pages, MCP health, exact hook-library PDF hash and all 12 private
  selected frame hashes through short-lived provider capabilities. PR 85's
  page titles and hidden unreleased posting-default tool are verified live.
  Normal automatic-build settings are restored. No paid generation was run;
  signed-in performance, playback and new output fidelity remain separate.
- The new how-to guide intentionally uses Article/HowTo/VideoObject schema.
  The public-page audit now verifies its five matching visible step anchors
  rather than applying the older founder-guide FAQ/breadcrumb requirements.
- Full rollout and exact exclusions: docs/creator-recreate-release-2026-10-24.md.

## 2026-10-24 Creator starting-frame failure and loading recurrence (local fix)

- Two production creator Gemini 3 Pro starting-frame jobs failed before Google
  submission. The worker recognized model selection only on v2 receipts, so
  approved v3 clearer-frame receipts were misread as legacy Flash and rejected
  with a misleading scene-mismatch message. Both existing app credit reservations
  are released; no provider submission or paid retry occurred. Use the shared
  v1/v2/v3 model resolver and explicit v3 Flash routing. Preserve exact scene
  byte/dimension, prompt and receipt checks; report model/contract mismatch
  separately from a true scene-byte mismatch. Details:
  docs/creator-starting-frame-generation-fix-2026-10-24.md.
- Creator galleries previously waited for all twelve complete MP4s plus posters
  before showing either account. Publish each account's stills independently in
  bounded parallel batches. Expose canonical metadata immediately for restored
  Recreate references; media hydration must not gate preparation mounting. Load
  a private video only on sustained hover/focus (250ms) or explicit full preview.
  Keep bearer-authenticated, owner-scoped object URLs; abort/revoke on leave
  while loading, source/owner change, logout and unmount. A ready preview can be
  reused on repeat hover. Isolate account loading failures. First playback still
  requires downloading one authenticated MP4; no streaming-latency claim.
- Recreate opens a dismissible loading dialog during its lazy UI download. After
  validating saved draft/checkpoint metadata, source frame and price load in
  parallel with saved face-photo validation. Editing, persistence, approval and
  paid generation remain blocked until the stronger restoration checks pass.
  A failed photo restore preserves the original saved preparation.
- Keep the approved three columns: source; person/model/variations/instructions;
  selected result and its thumbnails. Use a softer 26px outer radius (20px on
  mobile), lighter edges and rounded previews/actions. Generate, credit cost,
  Generate another and Use this frame belong beneath the result in column three.
  No separate full-width action footer. Preserve complete-image inspection,
  enlargement, explicit approval, recovery and pending/error states.
- Local checks pass: 43 preparation/variation tests, 16 loading/playback tests,
  135 worker image tests, scoped lint, app TypeScript and webpack production
  build/native decoder bundle checks. Independent review finds no blockers.
  Browser fixtures verify seven creator Hook sizes, three slideshow sizes and
  twelve Recreate layout cases with four variations, approval/enlargement and
  dismissal during delayed UI loading. Source/auth/provider boundaries are
  simulated locally; no new paid output fidelity or positive production browser
  acceptance is claimed. These fixes are now deployed as recorded above.

## 2026-10-24 Combined production release verified

- Website and MCP are promoted from app commit `4cb252d5`; all eight Cloud Run
  targets use the pinned worker image from `5f7b7747`. Their worker Git trees are
  identical. All service traffic and generation startup source identity pass;
  functional configuration remains unchanged. A clean hosted build caught a
  final plaintext identity import, corrected before promotion.
- Production read-only checks verify all 12 private selected frame PNGs and all
  39 slideshow originals through approved temporary capabilities, with exact
  hashes; anonymous browser metadata/media reads and unsigned frame links fail.
  The package remains encrypted in Git and runtime access remains restricted
  to verified `vtu19403@veltech.edu.in`. No paid generation in release checks.
- User elects to verify the signed-in gallery personally. Do not present fixture
  checks or provider-byte delivery as positive production browser playback or
  generated-output fidelity acceptance. Details and exclusions are in
  docs/combined-release-2026-10-24.md; earlier local-only entries are historical.

## 2026-10-24 Combined release: private creator packaging

- The Git remote is public. The user explicitly approves encrypted creator
  deployment with a dedicated server-only CREATOR_PRIVATE_PACKAGE_KEY on the
  website and MCP. Keep plaintext creator manifests, captions, media and detailed
  private frame/browser evidence out of Git and deployment uploads. AES-256-GCM
  packages use a random nonce and per-path HKDF/AAD binding. Production always
  decrypts ciphertext; it cannot fall back to local plaintext. Existing exact
  verified-email authorization still controls every browser access and admission.
- Public clones without the private package key have no private collection.
  Fixture-dependent tests explicitly skip there; auth and synthetic tamper,
  capability and expiry checks remain active. Full local fixtures pass all
  private checks. No existing production secrets were downloaded.
- Combined local release validation: 1,135 root tests, 118 worker tests, all 79
  encrypted-file digest comparisons, 36 encrypted creator/model simulations,
  Analytics/editor/result browser fixtures, TypeScript/lint and webpack build
  pass. Hosted deployment/acceptance is recorded separately in
  docs/combined-release-2026-10-24.md.

## 2026-10-24 Private TikTok slideshow collection and creator parity (local)

- Add the supplied `D:\slideshow\slideshow explore\marketing\creator` as
  **TikTok Creator Account** under Explore → Slideshows → Recreate the account.
  It contains 10 sets / 39 images. Keep verified `vtu19403@veltech.edu.in` gating
  on metadata, original bytes, imports and generation/Remix, matching Hook pilots.
  All references restores the normal gallery. Keep canonical slide identity
  separate from authenticated object-URL previews and temporary provider URLs.
- User explicitly approves private slide images, source captions and instructions
  for existing AI providers in Recreate/Generate and Remix. Hash-bound originals
  remain outside public; fresh ten-minute image capabilities are created at
  provider use. Website/worker share their key. Preserve source slide order,
  actual JPEG/WebP type, dimensions, editor imports, owned output and recovery.
  Source claims are adaptation material, not business facts. Only two supplied
  original-post URLs are shown; do not infer the other eight.
- Supersedes the earlier frame-zero/four-sample Hook qualification below. A
  twelve-sample-per-clip review plus transition frames selects 10 later starting
  frames and retains two at zero. Shared tuples and source-pose directions now
  agree across UI, API and worker, including v3 receipts at index zero. Accepted
  legacy preparations retain exact original frame/approval without resubmission;
  **Use clearer source frame** explicitly begins a new preparation. Creator 2
  clip 3 still has partial lower-face occlusion; do not call it unobstructed.
- 326 focused regression checks and 47 worker checks pass. All 12 × 3 API/contract
  scenarios, 12 new + 12 legacy browser preparations, seven Hook viewport sizes
  and all 10 slideshow selections at three viewport sizes pass with fixtures.
  TypeScript/scoped lint, webpack build and private asset packaging pass. These
  checks do not qualify paid generation fidelity or hosted acceptance; no paid
  call or deployment. Details: docs/creator-slideshow-and-parity-2026-10-24.md.

## 2026-10-24 Five medium-reasoning paid Remix requests completed

- User requests five paid tests after selecting medium draft reasoning. Exactly
  five completed with gpt-5.6-luna, Hook v8, the saved UGCPilot business context
  and original Claude/dating/marriage/research/LEGAL sources. No reviewer calls
  or automatic retries. All five pass output validation and match the intended
  edits in this sample: UGCPilot, marketing guy, marketing guy, MARKETING, and
  unchanged LEGAL hook. No new low-reasoning control or general reliability claim.
- Exact pairs: docs/hook-remix-medium-five-review-2026-10-24.md; frozen inputs,
  responses and usage: docs/hook-remix-medium-five-results-2026-10-24.json.
  Reported 5,400 tokens, no inferred invoice cost. No app receipt/media/edit or
  deployment. Five-request authorization fully used; no extra calls queued.

## 2026-10-24 Private creator-account selector for Hook references (local)

- User supplies two local folders, mapped in order: Creator Account 1 from
  `D:\reference1\New folder\New folder`, Creator Account 2 from
  `D:\reference\New folder\New folder`; each contains six videos. Show
  **Recreate the account** only to verified `vtu19403@veltech.edu.in`. Dropdown
  selection replaces the Hook reference gallery, with All references restoring
  the normal gallery/filter. Existing preparation, draft and generated-video
  source identity must survive gallery switching.
- Enforce the same email on server metadata, media, frame, paid-image/video and
  caption/Remix boundaries. These are private imports, excluded from the public
  reference/MCP catalogue. Package hash-bound originals/stills outside public/;
  authenticated browser fetches become revocable local playback URLs.
- User explicitly approves reference media delivery to existing AI providers
  when Generate is clicked, plus caption/direction use in Recreate and Remix.
  Reuse starting-image preparation and owned-image animation. Do not upload
  private snapshots into public catalogue storage. The worker creates a fresh
  ten-minute capability for one exact PNG immediately before provider submission;
  original videos retain authenticated delivery. Persist canonical receipt URLs
  so delayed jobs/recovery do not inherit expired links. Website and worker must
  share their delivery signing key and deploy together.
- Caption and movement records are source-hash-bound and adapted from four
  sampled frames per clip. They are not paid fidelity qualification. Preserve
  selected identity photos, generated-image approval, motion editing, history,
  Remix and idempotent billing. Do not freeze browser playback URLs into jobs.
- 245 focused tests, worker checks and local seven-size browser verification
  pass; TypeScript/scoped lint and webpack production build pass. Browser uses
  actual menu/cards/API/media hook/preparation with fixture auth/photo selection
  and surrounding layout. No paid generation or production acceptance. Full
  scope and deployment limits: `docs/creator-account-pilot-2026-10-24.md`.

## 2026-10-24 Remix draft reasoning changed to medium (local)

- User requests medium reasoning effort. New shared Remix draft calls now send
  reasoning_effort=medium for the existing GPT-5 model route, including the
  default gpt-5.6-luna. Experimental review was already medium and stays gated
  off by default. Model, prompts, non-reasoning-model temperature, receipt recovery
  and output schema are unchanged. Historical paid pilot inputs/results retain
  their actual low-draft/medium-review settings; no new quality comparison claimed.
- No paid requests or deployment for this change. Focused tests verify medium
  reaches the Hook/Wall provider payload. Deployment remains paused.

## 2026-10-24 Hook quality system: bounded pilot, calibrated review gated off

- User wants reliability beyond repeated prompt patches and authorizes a bounded
  paid test; later explicitly approves 23 reviewer-only follow-up calls. Added
  draft → calibrated proofread → deterministic checks for new Hook requests,
  opt-in via EXPLORE_HOOK_REMIX_REVIEW_ENABLED=false by default. No real env or
  deployment changed. Wall/slideshow remain single-pass. Old receipts recover
  unchanged; no unreviewed fallback, third call or automatic retry. Claims record
  review version 2 when enabled; provider phases have a shared bounded deadline.
- Pilot covers 24 cases/six contexts (real saved UGCPilot facts + five synthetic
  profiles). First round: 46 responses, one unresolved draft and one unsubmitted
  dependent review. Unresolved call was never repeated. Follow-up: 23 additional
  review-only responses on identical original drafts. Total completed 69, plus
  one unresolved attempted request. Reported completed-call tokens: 84,240;
  unresolved billing/usage unknown. No extra calls queued.
- On 23 comparable cases, fixed checks pass 20 baseline / 19 first-review /
  22 calibrated. Final guards block one unsupported 3-day claim despite the model
  calling it grounded. No baseline-passing case regresses under these checks;
  zero delivered fixed-check failures is not proof of semantic perfection.
  Final flow keeps approved brand wording, human roles, LEGAL, THIS and language
  choices. Initial reviewer degraded valid copy, so keep-default calibration was
  necessary. One scorer substring bug (a week matching a weekly plan) is corrected
  transparently; raw old scores/results remain intact.
- Code guards cover schema, review consistency, named-tool evidence/exact brand,
  common no-brand preferences, English human slots and unsupported quantities.
  They are partial, not a multilingual semantic oracle. Six contexts and an
  in-sample reviewer calibration do not qualify hundreds-of-users reliability.
  Add held-out cases and human calibration before enabling. Reviewer adds one
  call: observed combined median 6.42s/p95 10.22s on this small serial experiment,
  not a concurrency/production latency guarantee. No new model selection claimed.
- Local validation: 51 focused tests, TypeScript/scoped lint and offline replay
  pass. npm run test:hook-remix-quality and audit:hook-remix-quality are unpaid.
  Report/evidence: docs/hook-remix-quality-system-2026-10-24.md and
  docs/hook-remix-quality-summary-2026-10-24.json. No schema/production write,
  account remix creation or media job. Production acceptance remains pending.

## 2026-10-24 Recent Remix audit: Claude failure confirmed on deployed v7

- User reports Claude → marketing app for marketing and asks for an audit of
  uploaded changes. Owned receipt 32c168f2 confirms that exact bad output. Saved
  context includes UGCPilot, correct product summary, profile v2, prompt v7 and
  empty extra instructions. A later WhatsApp receipt 919ad968 correctly uses
  UGCPilot with the same model/context/version: brand handling is inconsistent,
  not explained by absent business context. Apply/serialization preserve both
  stored outputs unchanged in local checks.
- Real website/MCP alias metadata reports READY commit 4d786d5c on 24 October;
  immutable source at that commit uses v7, corroborated by the live receipts.
  Local named-tool v8 is not in that deployed commit. Its provider tests mock
  output, so passing them is not live quality acceptance. No v8 provider call
  or deployment was performed in this audit. Existing receipts remain immutable.
- Earlier twelve-case evaluation had no Claude/WhatsApp named-tool source. The
  person-role fix did not qualify named-brand replacement; validators accept both
  the bad generic wording and intended UGCPilot wording. Intended minimal edit:
  how to use UGCPilot for marketing, retaining source lines and POV setup.
- 34 focused local tests pass; two real receipts round-trip unchanged. No app,
  profile, saved-result or production configuration write; no paid requests.
  Findings/limits: `docs/hook-remix-production-audit-2026-10-24.md`.
  Exact receipt metadata: `docs/hook-remix-recent-audit-evidence-2026-10-24.json`.

## 2026-10-24 Starting frame + optional face photos, three-second output and Hook 100 (local)

- User explicitly requests parallel implementation and a review of three changes. Approved starting-frame animation now shows two independent controls: Starting frame and Face references · Optional. Photos do not replace the scene; changing a scene/model preserves photos. The compact picker supports uploaded images and saved influencers, with per-photo removal even if the current model does not support the combination. Starting frames history remains a scene-only chooser, separate from face photos.
- Omni accepts up to five distinct owned ready PNG/JPEG/WebP photos alongside its approved scene. The client freezes scene IDs and photos separately; API ownership/readiness/size checks run before credits, the worker binds exact person roles and authoritative job owner, and Omni serializes Image1 as FIRST_FRAME with Image2+ as facial references. Scene clothing/background/pose remain authoritative. Existing no-photo prompts, request fingerprints and accepted-operation recovery remain compatible. Seedance/WAN mixed-frame/reference routes are not enabled; generation blocks with a clear message while keeping selections, rather than silently dropping photos or changing models.
- Omni and WAN starting-frame animation offer three seconds (Omni 3–10, WAN 3–15 whole seconds); Seedance retains 4–15. Shared UI policy, API admission, prompt construction, worker and provider serialization agree. Reviewed source-motion duration sets are not automatically expanded or called visually qualified. A shorter output is a user-selected animation duration, not a promise of an identical source performance.
- Independent review found and resolved two concrete issues: saved influencer assets live in collection influencer (now admitted with the same owner/media checks as uploaded images), and unsupported-model photo removal must remain possible outside a disabled picker. Regression tests cover both, stale async selections, source/photo preservation, exact roles, owner denial, billing paths and recovery.
- The first visible reference is Hook 100 (fc44f6214b6e17413600ec13). Reviewed all 112 source frames and selected frame 70 at elapsed 2.333333s / absolute PTS 2.399349s, with both eyes and complete face visible and glasses/hand no longer obscuring it. Added a hash-bound PNG and matching motion directions. There are now 21 curated replacements, with the original twenty unchanged. Existing frame-zero drafts/receipts remain recoverable. Motion starts after glasses removal; it must not request that completed gesture again. Details: docs/first-hook-clearer-frame-2026-10-24.md and docs/starting-frame-animation-face-reference-contract-2026-10-24.md.
- Local browser fixture reached simulated v3 image generation/approval, then selected an optional face photo while retaining the starting frame. No paid request was made. Later duration-dropdown browser interaction was not executed because automatic approval review hit the account usage limit; subsequent interactive acceptance remains unverified. Automated checks and build evidence are separate from that browser limitation. This follow-up has not been deployed or accepted on production.
- Combined follow-up verification: 297 UI/client/API/draft/history/motion/curated tests, 36 worker/Omni checks and 19 ReAPI checks pass. Production build, TypeScript and scoped lint pass; both API bundles contain all 21 approved PNGs with exact hashes. Original twenty bindings remain unchanged. Evidence: outputs/starting-frame-followup-*. No paid facial-fidelity or production acceptance is implied.

## 2026-10-24 Poppins Bold is the new-caption default (local)

- User accepts the Poppins treatment and requests it by default. Fresh captions
  in the shared workflow text editor and newly applied Hook/Wall Remix copy with
  no previous text style now use Poppins 700, white (#ffffff), black outline 8
  on the existing 1080px coordinate scale, normal spacing and no shadow.
- One shared initial-style constant supplies the editor and Remix paths. Adding
  another text block uses this default; existing saved/custom styles, legacy
  drafts and Remix applied over an existing style keep their chosen appearance.
  This changes initial styling only; other font choices and presets remain.
- Local worker build, type/lint checks and editor/export/browser checks are run
  for this follow-up. Production deployment/hosted acceptance remain pending.
  Evidence is appended to `docs/poppins-font-correction-2026-10-24.md`.

## 2026-10-24 Font correction: Poppins Bold and adjustable outline (local)

- User rejects the earlier TikTok Sans preview and supplies Poppins Bold (700)
  as the preferred match: white, black outline around 2–3 screen pixels, normal
  letter spacing and no shadow. Poppins Bold is visually closer in the direct
  comparison; the small crop still cannot prove the original font. Do not repeat
  the earlier TikTok-only preview as the accepted match.
- Add actual licensed Poppins Regular/Medium/Bold to the shared font list and
  bundle its static TTF/WOFF2 faces. Keep the other selectable families and saved
  choices. The font builder supports pinned static sources as well as variable
  faces; each Poppins source file has its own SHA-256 in the manifest.
- The old outline was fixed at 2px on a 1080px canvas, only about 0.6px in a
  320px preview. Hook/Wall text controls now expose Outline thickness (0–16 at
  the existing 1080px coordinate scale). A value of 8 produces approximately
  2.4px at 324px display width. Optional outlineWidth survives save/reopen, blank
  drafts, presets and export; omitted values retain the old rendering/receipt
  shape. Explicit Original/Arial outline edits use the outlined glyph renderer
  too. No shadow is introduced.
- React preview, SVG and worker glyph export share the same scaled thickness.
  Browser fixtures compare the original crop and both fonts using the same size
  and outline; desktop/mobile checks verify actual Poppins loading and saved
  choices. Real-video tests check glyphs, black outline pixels and timing.
  Worker/website rollout and authenticated production verification are pending.
  Evidence: `docs/poppins-font-correction-2026-10-24.md`.

## 2026-10-24 Named-tool Hook Remix correction and TikTok Sans (local)

- The exact reported Claude-to-UGCPilot production receipt included the correct
  business name and product summary. Hook v7 returned a generic marketing-app
  substitution: context was present, but the minimal-edit/no-extra-brand rule did
  not distinguish replacing an existing named product. New Hook requests use v8:
  replace an existing named tool with the exact supplied business name when its
  capabilities fit, preserving the sentence and human roles. Generic hooks do not
  acquire extra branding; explicit no-brand requests and factual limits remain.
  Existing receipts (including v7) recover unchanged, without a second AI call.
  Wall/slideshow prompts and provider/model settings are unchanged.
- User clarifies that the font request means identifying the supplied image's
  lettering and adding that font, not helper text or an identification button.
  Initially estimated TikTok Sans Bold; the user rejects that preview and the
  Poppins correction above supersedes this estimate. Add the actual licensed
  TikTok Sans family in Regular/Medium/Bold to the shared text controls, with
  bundled WOFF2 preview faces and TTF export faces derived from the same pinned
  source. Existing saved typography and new-text defaults are unchanged.
- Local checks cover all fifteen faces, save/reopen, exact multiline copy,
  desktop/mobile previews and actual video export pixels/timing. Shared manual
  slideshow font controls also gain the family; automated slideshow generation
  typography is independent. Font/Carousel render tests and Hook API regression
  tests pass. The Remix tests mock the provider; no new AI-output quality claim
  or production UI acceptance is made. Website and worker deployment are pending.
  Evidence: `docs/hook-remix-brand-and-tiktok-font-2026-10-24.md`.

## 2026-10-24 Starting frame plus optional animation face references remains missing

- User reiterates that an approved starting frame and uploaded face photos must coexist for video generation, especially when the approved pose hides part of the face. This differs from the already implemented main/supporting photos used to generate the still. The compact preparation-picker follow-up does not implement animation face references.
- Verified current blockers: video workspace clears uploaded/additional photos when choosing a starting frame, derives referenceImages as empty in starting-frame mode, and omits photos from the paid submission. Video API and worker explicitly reject mixed starting-frame/person inputs; both Omni and ReAPI adapters enforce one starting image. This is a missing end-to-end feature, not only a picker-tab issue. No runtime fix or paid test is claimed by this audit.
- Required UI direction: retain a distinct approved Starting frame tile and a compact Face references (optional) control. Changing photos must not replace/remove the scene; changing the scene must not silently erase optional face selections. Keep roles explicit through owned-asset validation, frozen submission/recovery and provider payloads. Test that references are actually forwarded, not only visibly selected.
- Official Google Omni guide (checked 2026-10-24, https://ai.google.dev/gemini-api/docs/omni#using-tags-in-prompts-to-set-image-and-video-roles) explicitly documents FIRST_FRAME@Image1 together with IMAGE_REF_0@Image2. This supports an Omni implementation candidate, not a claim of tested facial fidelity. Preserve the approved first-frame role and label extra images as facial appearance only, without borrowing their clothes/background/pose.
- Connected ReAPI Seedance docs (https://test.reapi.ai/docs/seedance-2-5, checked 2026-10-24) disallow frame roles and reference_image in one image_with_roles array and also disallow combining image_urls with image_with_roles. Do not assume this route accepts the same combination or switch to reference-only generation silently. WAN's mixed-role support remains unqualified. Enable the optional control only for a confirmed route; explain model incompatibility and require an explicit model choice instead of discarding references. No automatic extra-frame generation is requested or necessary for the UI proposal.

## 2026-10-24 Generated video stays left; prompt occupies upper-right column (local)

- Recurring user correction with marked screenshot: preserve the video position
  at the results' left edge, and move its prompt into the distinct upper-right
  area. The prior compact-height change did not fulfill this placement request:
  its 48rem card cap kept the prompt close to the player, and tests checked size
  and overflow without asserting the requested relative positions.
- Compact workflow result rows now span the available width. At result widths
  >=580px, the first column occupies 36% plus a 28px gap before the prompt. Video
  height/aspect budget and left edge remain; prompt stays top-aligned and capped
  at 26rem. On narrower result panels the prompt follows the video vertically.
  Pending/completed results use the same grid, including landscape ratios.
- Hook/Wall share result markup; Talking Head/Phone now reuse the same grid and
  extracted prompt disclosure/copy component. Pending prompt text is frozen at
  submission; recovered completed prompts come from the owner's original job
  through an explicit generationDetails media read. Ordinary media reads retain
  their fast path. Do not substitute current composer text for an older result
  whose prompt is unavailable. Playback, result selection and Studio layout stay
  independent of this workflow-only placement rule.
- 181 focused tests and 96 local browser layout cases cover ratios, desktop,
  mobile, both pending/completed states, selection and prompt disclosure. Exact
  screenshot dimensions and a comparable scaled capture are inspected; browser
  position assertions now verify video-left and upper-right prompt coordinates.
  This is local fixture acceptance, not a new hosted release. Details/evidence:
  `docs/generated-video-prompt-placement-2026-10-24.md`.

## 2026-10-24 Compact starting-frame photo library

- User reports that expanding Choose/Change photos makes Recreate excessively tall. Remove the repeated Choose person photos heading/instructions, empty main-photo placeholder, duplicate selected-photo cards and Use as main area specifically from the starting-frame picker. Keep the main/supporting photo strip once above its trigger; the regular standalone image chooser retains its selection controls.
- The starting-frame library now uses an anchored, non-modal popover within the current preparation flow. It adds no document height, respects available viewport space and scrolls only the library; Upload photos, library tabs, selection status, Clear selection and Done remain available. Opening does not move focus/scroll to the library; Done restores trigger focus.
- Local browser checks at 1366x768 confirm unchanged dialog height (649.375px), unchanged settings top (465.212px) and unchanged outer scroll extent after opening. At 390x844 the picker remains within the viewport with internal scrolling and no page-width overflow. Selecting a saved sample influencer and Done succeeds. No paid generation or production deployment for this UI follow-up.
- The development-only keyframe preview was stale after cleaner-frame rollout: it used a curated source identity with an opening-frame fixture, causing receipt validation to reject it. It now loads the exact approved PNG and frame metadata for Hook 14; production admission remains unchanged.

## 2026-10-24 Combined release completed

- Commit `4d786d5c87508b3dab32a42f6d17535b32b3e733` is on main and was promoted to website/MCP production aliases, with original automatic-build settings restored. All six Cloud Run worker services and two production jobs use the matching pinned image/source. Production checks confirmed 104 references, twenty exact approved PNG hashes, the cleaner Recreate source, inline photo picking and five image model choices; loaded gallery videos were paused with autoplay disabled. Saved-frame reuse was not fully exercised live. Later local analytics edits and this compact-picker follow-up are not part of that deployed commit.

## 2026-10-24 Combined release resumed by user; rollout in progress

- Initial complete source commit `4ff070d20393ac2d9bbed802d3a08fdae28cc1ba` reached main. Its pinned image was deployed and verified on all six services/two production jobs, with edit queue/instance concurrency two. Website/MCP automatic builds remain held until final producer promotion.
- CI's MCP functional tests passed, but its dependency audit found body-parser/Zod high-severity advisories and a fast-uri moderate advisory. Compatible root-lockfile updates resolve all production advisories; worker audit was already clean. All 1,316 app checks pass with the updated lockfile. A follow-up also aligns the shared image worker with the API's existing Wall starting-frame tag; previously it accepted only `hook` and rejected valid `wall_text` preparations. Exact scene/person receipt verification remains mandatory. Dedicated worker regression covers that workflow before the final image rebuild.
- User explicitly resumes deployment of all intentional worktree changes and requests live verification afterward. The earlier deployment pause is lifted for this combined release; historical paused entries below describe earlier stages.
- Scope includes cleaner-frame receipt v3 and twenty PNGs, three discovery exclusions, five starting-image model options, shared v4 image prompt/frame-specific motion suggestions, Hook Remix v7, inline photo picking, hover-only card playback, responsive result inspection, scheduling/footer fixes, saved post captions, slideshow edit recovery/concurrency, and current landing branding/copy/documentation changes. No intentional source/configuration/migration/test/documentation path may be silently omitted.
- Applied additive saved-caption migration through the connected production project. Canonical source is renamed to `20261024061601_saved_post_captions.sql` to match its actual production ledger entry. Verified RLS, denied anon/authenticated SELECT and permitted service-role operations. No customer rows were added or changed.
- Wider release regression review repaired outdated fixture imports, exact-duration display and archive/audio catalog counts. Also removed an unnecessary generation-job lookup on ordinary video asset reads; image history metadata and explicitly requested Remix provenance retain their lookups.
- Required rollout sequence: hold automatic website builds; push the complete source snapshot; migration prerequisites; pinned backward-compatible workers including the dedicated edit worker and its queue/instance limits; staged website/MCP; promote and restore original build settings; authenticated production checks. Evidence/report: `docs/combined-release-2026-10-24.md` and ignored `outputs/release-2026-10-24/`.

## 2026-10-24 Twenty cleaner frames wired locally; deployment remains paused

- User authorizes safe implementation and asks why the replacement filter showed 21. There are twenty approved entries and one unapproved Hook 88 proposal. Local audit filters now separate Approved replacements (20) and Proposed replacement (1). Hook 88 keeps frame zero. Hooks 27/84/89 are excluded by stable ID in their owning release manifests; local new discovery has 104 references. Original media, soundtrack/text identities and saved work remain archival/recoverable.
- Twenty exact approved PNGs (11,422,314 bytes) are bundled under `public/explore/curated-hook-frames/v1/`; `worker/src/lib/hook-curated-frames.json` binds source hash, image hash, dimensions, index and timestamp. Both source preparation and generation API routes trace the PNG assets. API/client/draft/worker/result paths agree on the selected frame. Missing or altered assets/source versions stop rather than silently returning frame zero.
- Draft/receipt v3 accepts only those exact approved selections. Legacy v1/v2 input keys and frame-zero receipts remain unchanged. Curated requests require the matching preparation key before snapshot storage or credit reservation; accepted-request recovery is retained. Keep the v1 curated catalog's approved bindings immutable for historical v3 recovery. Existing scene snapshot storage is reused.
- Shared image prompt v4 remains active. Curated later frames omit frame-zero-specific prose; original openings keep their existing guidance. Twenty adapted motion suggestions begin from the selected moment, but remain preparation previews without video visual qualification. Starting frames history now passes the saved receipt's actual source frame into motion preview, including legacy opening results.
- Combined validation: 242 automated tests pass, including all twenty asset hashes, browser receipts, stale admission, all five mocked still-model routes, history, variations, discovery/archive and audio regressions. Worker build and full website production build pass, including type checking/native bundle checks. Both API traces include all twenty unique PNGs with matching hashes (normalize Windows trace path spellings). Local review serves HTTP 200 and filter counts verify. No new paid image/video test, authenticated browser/production acceptance, push or deployment. Implementation report: `docs/cleaner-hook-frame-implementation-2026-10-24.md`.
- Release implementation differs from the earlier plan's separately uploaded source assets: PNGs ship with the website/API bundles. When resumed, deploy the backward-compatible worker first, then website producer/catalog plus PNG assets, then authenticated hosted acceptance and a reviewed motion pilot. Deployment pause remains in force.

## 2026-10-24 Production visibility and curated Recreate rollout requested; plan prepared

- User requests hiding Hooks 27, 84 and 89 from user-facing production references, and making Recreate load approved cleaner source frames. This supersedes Hook 27's hold and the provisional retention of 84/89 for new discovery. Preserve original media, archived identities and existing saved/generated work; hide via stable-ID release exclusions, not CSS or deletion. Expected new-discovery count is 104 from current local 107. No live change is claimed yet.
- Twenty approved selections remain exact/hash-bound in `docs/approved-hook-frame-selections-2026-10-24.json`. Hook 88's candidate remains unapproved and should keep the original opening. User-accepted openings for 45/63/73/78/83 remain unchanged.
- Traced the source-frame service/API/client, frame-zero draft/worker contracts, result resolution, active/archive gallery membership and frame-bound motion requirements. A preview-only thumbnail change is insufficient. Plan `docs/cleaner-hook-frame-rollout-plan-2026-10-24.md` specifies immutable curated PNGs, versioned selection/receipts, shared preview/admission resolution, compatible history recovery, matching motion review, tests and hosted acceptance. No runtime source/config mutation or deployment performed in this planning turn. Deployment pause remains in force.
- Release order when resumed: source assets, backward-compatible generation worker, website producer/catalog, then real authenticated production acceptance. Keep local audit review distinct from production checks. Review full action sequences before marking new frame-specific motion plans ready; preserve old paid-request recovery and prevent stale frame-zero directions.

## 2026-10-24 User approves twenty frame selections; four difficult clips fully rechecked

- User approves all nineteen proposed alternatives and Hook 18's displayed later face frame (44). This explicitly supersedes preserving the airplane-window opening for this image-based adaptation. Hook 27 stays on hold. Hooks 45, 63, 73 and 83 retain their current review-section openings by user acceptance; no alternative was displayed for 63/73, so “use that” is interpreted as retaining those openings. Original source videos are not overwritten or trimmed.
- Inspected every decoded frame of Hooks 78 (47), 84 (342), 88 (74), 89 (77): 540 total, with seven contact sheets and full-resolution detail on 88/89. Hook 78 never uncovers mouth: keep original under user's fallback authorization. Hook 84 never reveals lower face: no better alternative; keep current provisionally pending decision. Hook 89's later clearer eyes coincide with sleeve covering mouth: no clearly better whole-face option; current frame retained provisionally pending decision.
- Hook 88 has one new, unapproved candidate: frame 23 at elapsed 0.766667 s. Mouth remains uncovered and more eyes fall below caption than at opening, but strip still overlaps upper-eye/brow area, and footage remains dim/soft. Do not auto-approve or call it a clean full-face frame.
- Gallery now distinguishes twenty user-approved replacements, eighty-three keep openings, one new proposal (88), and three hold/review cases (27/84/89). `review-initial.json` preserves earlier recommendations; `user-decisions.json` and current `review.json` record decisions. Exact source/frame hashes and timestamps for twenty approved choices: `docs/approved-hook-frame-selections-2026-10-24.json`. Detailed report: `docs/hook-frame-decisions-2026-10-24.md`.
- Local gallery remains `http://127.0.0.1:8201/opening-frame-audit`; full-resolution source links, full-frame evidence and video controls available. Integrity/source-frame hashes and 251 local routes pass. Browser interaction not asserted. These are approved preparation records, not runtime implementation: current generation contract still assumes frame zero. Versioned extraction/receipt/history integration and frame-bound motion plans remain necessary before Recreate uses later frames. No paid calls or deployment; deployment remains paused.

## 2026-10-24 Opening-frame screening covers all 107 local active Hooks

- User authorizes starting the catalog audit and review gallery. Verified source SHA-256 for all 107 references in the current local active catalog, including the nine newer additions; no live production acceptance claimed. Screened every extracted opening image. For 29 flagged clips, reviewed nine decoded timeline samples each (261 images) plus larger opening/candidate pairs. This is a first-pass screening, not a new exhaustive all-frame/full-video qualification or proof of earliest/optimal selections.
- Final groups: 78 keep opening, 19 proposed clearer frames, 10 need review. Proposed Hooks: 12, 14, 19, 25, 29, 34, 38, 46, 47, 50, 52, 64, 71, 85, 93, 94, 96, 101, 104. Review Hooks: 18, 27, 45, 63, 73, 78, 83, 84, 88, 89. Hook 73 was demoted after larger comparison still showed eye obstruction. Side angles/glasses alone do not fail; keep-opening status is not a generation-quality guarantee.
- Hook 18's later face frame is illustrative only because the existing airplane-window reveal was explicitly preserved by the user. Persistent mouth coverage, cropped faces, caption strips over eyes and multiple-performer handling remain review cases. No forced replacement when no clearly better sampled option exists. Every proposal records an action/timing tradeoff; not all original opening beats can be preserved from the new pose.
- Read-only review gallery: `http://127.0.0.1:8201/opening-frame-audit`, with filters/search, original/candidate images, elapsed timestamps, full-image links, source video controls and timestamped sample sheets. Provenance saves exact source/frame hashes, decoded frame indices and absolute PTS as well as elapsed time (important for nonzero first PTS). Record `runtimeApplied` remains false.
- Evidence: `outputs/opening-frame-audit-2026-10-24/`; report `docs/opening-frame-audit-2026-10-24.md`. Integrity checks pass: 107 unique active references, source/opening/candidate hashes, proposal completeness, script syntax and 243 HTTP routes including video byte ranges. Local browser interaction remains unverified because browser use was disabled. No paid requests, runtime prompt/extraction/receipt change, catalog mutation or deployment. Review full performance and selected-frame transitions before applying proposals; deployment remains paused.

## 2026-10-24 Second clearer-frame pilot: Hook 29

- User prefers Hook 50's clearer-frame output and authorizes another reference. Selected Hook 29 (`explore-paired-hook-9309a041061ae5abc6970d52`), source SHA `5274157ba66683e03c31de91fff5395fe7eabee7ea4780789e87f7275719d451`. Inspected all 63 frames in the contact sheet plus full-size frames 0 and 40. Opening hand overlaps mouth; frame 40 at 1.333333 s reveals the open mouth and widened eyes with hand lower. Source remains soft; clearer refers to facial visibility.
- Two fresh Gemini 3 Pro / 2K / 9:16 results completed without retries. Same exact v4 prompt as Hook 50 (no optional opening description), same three influencer photos, labels and order. Both retain recognizable selected-person features and remove captions visually. However the later-frame output covers the mouth again, turns toward camera and changes the gray sleeveless top to a gray short-sleeve shirt; original-opening output also changes gaze/background. Do not label this a demonstrated clearer-pose preservation success.
- Frozen prompts/receipts, original outputs, source probe and comparison: `outputs/recreate-ui-preview/prompt-test-clearer-hook29-2026-10-24/`. Both completed outputs and input/output hashes verified; local preview `http://127.0.0.1:8200/comparison-clearer-hook29`. One sample per arm, no fixed seed, no video test or production acceptance. Deployment remains paused; no runtime prompt/frame-selection changes.

## 2026-10-24 Clearer-frame pilot completed on Hook 50; mixed image fidelity

- User authorizes selecting one difficult-opening reference, extracting a clearer frame and regenerating with the existing influencer photos. Reviewed the complete 84-frame contact sheet of Hook 50, source SHA `483e11b3aba9bee6b50d202836be545df6374dceab472c07233fec38bb189da8`, and full-size frames 0, 24, 30. Selected frame 30 at decoded timestamp 1.00 s: both eyes/more facial structure visible, same scene and finger-at-lip gesture. Original frame 0 is side-facing rather than literally half cropped.
- Two fresh Gemini 3 Pro / 2K / 9:16 outputs completed: original opening versus selected frame. Exact same v4 prompt without optional frame-zero description, same ordered three influencer photos/labels/settings. Hashes and receipts verified. One output per condition, no fixed seed; no claim of causal improvement or catalog reliability. Runtime v4/defaults and frame-zero contract unchanged; no video generation/deployment.
- Both remove captions and visibly depict the selected person's features, but both rearrange the room/lighting. Clearer-frame result is more frontal yet looks away from lens and moves the finger toward the chin; expression is less exaggerated. Source selection is feasible, but this pilot does not establish sufficient same-shot fidelity or motion quality. Do not auto-promote or animate without reviewing these differences.
- Initial submissions failed with APIConnectionError; independent Google DNS check returned ENOTFOUND in restricted network. Preserved failure receipts, verified external connectivity, then explicitly retried the two prepared inputs once with host network access. Two completed provider operation IDs saved; no success was discarded/replaced and no further generation queued. No invoice amount inferred from returned token usage.
- Evidence: `outputs/recreate-ui-preview/prompt-test-clearer-frame-2026-10-24/` (source probe, frozen prompts, inputs, receipts, originals, comparison PNG/HTML). Local preview `http://127.0.0.1:8199/comparison-clearer-frame`. Report: `docs/clearer-source-frame-pilot-2026-10-24.md`. Deployment remains paused.

## 2026-10-23 Clearer-frame direction clarified; validate before implementation

- User confirms the objective is a clearer regenerated base image and an adapted performance preserving the reference's main actions/emotion, not merely trimming away the beginning. Suitable original openings retain their existing path. A later selected frame becomes the generated opening; motion may need reordering/timing changes consistent with that actual pose. Do not promise exact original chronology or pixel-identical video reproduction.
- User asks to establish whether the approach works before deciding implementation. Static inspection confirms first-frame conditioning in the Omni adapter, frame-zero-only image receipts and frame-bound reviewed motion plans. This establishes current constraints, not image/video quality. No reference selection or paid pilot has been performed for this proposal.
- Evaluation plan: `docs/clearer-source-frame-validation-plan-2026-10-23.md`. First isolate source-frame choice with identical shared prompt/model/person inputs, then test adapted motion on acceptable images. Manual frame review precedes an automatic selector; do not roll out over the catalog or switch to v6 during this experiment. Deployment remains paused. This clarification supersedes the pending timeline question below.

## 2026-10-23 Clearer source-frame selection proposed; timeline decision pending

- User shifts priority from prompt wording to source-frame suitability: retain frame zero when clear, otherwise choose a clearer frame of the performer from the same video and regenerate that shot with the selected influencer. Do not describe this as face swapping. Treat this as a hypothesis to test, not a proven explanation of all earlier failures.
- Inspected saved glasses/keyboard/can v4-v5 comparisons and source code. Browser access to the local comparison was disabled. Glasses source has nearly closed eyes and glasses across the face; keyboard/can still show composition drift, so clarity does not explain every failure. No later video frames were reviewed in this turn.
- Current draft/worker receipts and generation/result paths explicitly require frame index/time zero. Motion plans are bound to a reviewed source frame; image guidance also assumes frame zero. Supporting a later frame needs coordinated extraction, provenance/cache/receipt, recovery/history and image/motion prompt changes, not simply a thumbnail replacement. Preserve old receipts and prevent old frame-zero motion guidance from attaching to a new frame.
- Proposed pilot: earliest suitable sharp, sufficiently visible face in the same performance shot, maintaining useful gesture/context and avoiding demo segments or unrelated cuts. A side view alone is not automatic failure. Cache reviewed selections per source version; allow a simple Change frame choice. Recreate the selected shot, then bind animation to the approved generated image and chosen action plan. Test original versus clearer frames with the same model, influencer photos and shared prompt before catalog-wide selection.
- Pending user clarification: may generated footage start from the clearer later moment, or must original opening actions also be preserved? A later image used as the first-frame input defines the generated opening; a text prompt alone does not restore earlier chronology. Do not silently discard opening actions, reverse footage, or claim arbitrary middle/end conditioning is available. No runtime change, paid generation or deployment in this review; deployment remains paused.

## 2026-10-23 Reusable post captions (local; migration and website release pending)

- Trending's shared publishing modal and Hook drawer, plus Explore Hook, Wall,
  Slideshow and Talking Head scheduling forms now share Save caption / Saved
  captions controls. Up to twenty exact captions (5,000 characters each) are
  stored per account. Line breaks, URLs, hashtags and emoji are preserved.
- The first saved caption becomes the default; users can select another default
  or toggle it off. Defaults fill only untouched empty new-post forms. Existing
  text wins, and clearing with × records an intentional blank in recovered
  workflow drafts. A late default read cannot replace new typing. Selecting a
  saved caption explicitly replaces the current post's text.
- × clears only the current post. Deleting from Saved captions removes only that
  saved entry; deleting the default unsets it without changing the current post,
  existing drafts, publishing receipts or scheduled posts. Library failures keep
  manual caption editing and scheduling available.
- New authenticated `/api/account/saved-captions` GET/PUT binds ownership to the
  Firebase user. The service-only `user_saved_captions` row uses revision checks
  to prevent stale-tab overwrite. A lost save response is followed by a read,
  with explicit Retry before further writes; there are no automatic PUT retries.
  Caption data is not sent to text/image/video providers.
- Additive migration `20261024061601_saved_post_captions.sql` is prepared and
  tested locally only. Website/migration release remains paused. Local component
  and browser fixtures are not hosted acceptance. Evidence and rollout notes:
  `docs/saved-post-captions-2026-10-23.md`.

## 2026-10-23 Starting-frame same-shot refinement prepared as v6 candidate

- User clarifies: recreate the reference shot with their influencer, preserving position, clothing, background, emotion and lighting. Added explicit opt-in starting-frame v6 derived from v4: tighter opening and scene direction, and visible-source precedence over supplementary opening descriptions. Person features still come from the influencer photos; v4 caption-removal/output instructions stay intact. This version is unrelated to Hook Remix numbering.
- V4 remains the application default and v5 historical prompts remain reproducible. No paid images or deployment; v6 is unproven until a controlled visual comparison. Do not claim the wording guarantees likeness or scene fidelity. Exact changed wording and acceptance plan: `docs/starting-frame-v6-candidate-2026-10-23.md`.

## 2026-10-23 User accepts Hook Remix v7; adopted locally, no deployment

- User says keep it this way after reviewing all twelve v7 results. Adopted the
  exact tested v7 builder for new Hook requests in the local shared Remix API;
  receipt promptVersion is 7. Wall of Text/slideshows retain the exact existing
  v2 prompt/version. No model, user payload, business-context or output-schema
  change. Previously saved requests recover their immutable output before prompt
  selection, without generating again. No historical receipt is rewritten.
- V7 keeps the source with minimal necessary word changes and preserves human
  roles in relationship jokes. Acceptance concerns the selected prompt direction;
  it is not a guarantee against the variability or unsupported-history issue seen
  in the test batch. Review/Apply remains required. Exact paid-test evidence stays
  unchanged in `docs/hook-remix-role-v7-results-2026-10-23.json`.
- Deployment remains paused; no paid requests were submitted during adoption.
  Local validation is distinct from hosted acceptance. Adoption notes:
  `docs/hook-remix-role-v7-adoption-2026-10-23.md`.

## User prefers Gemini; exact prompt artifacts validated before Sunburst

- User prefers Gemini 3 Pro over Seedream and asks to validate prompts before considering Sunburst. Explain revised candidate as experimental starting-frame v5, with v4 still default; unrelated Hook Remix numbering is separate. Audited twelve completed request artifacts: compiler/base prompts, input bytes/order, label text, full Seedream prompt limits, version/model/receipt binding and output hashes all pass. No local truncation or role-order error found. Provider-retained payloads are unavailable, so do not claim internal provider verification.
- Wording concern: glasses opening description “held forward just above the face” is ambiguous against the source's diagonally held glasses in front of the face. Proposed targeted correction only; no production/historical prompt edited. V4 permits scene interpretation and v5 has not demonstrated a consistent benefit. Gemini 2K vs Seedream 1K and interleaved vs appended labels remain comparison caveats. Keep user-preferred Gemini/v4 baseline. No new paid images or deployment in this audit. Details docs/starting-frame-prompt-validation-2026-10-23.md; outputs/recreate-ui-preview/prompt-payload-audit.json. Sunburst comparison pending subsequent testing step.

## Seedream six-image pilot completed; no model or prompt promotion

- Six authorized Seedream 5.0 Pro images completed through OpenRouter using the Cloud inference key in memory: v4/v5 on glasses, keyboard and drink can. Same hashed image bytes/order and frozen shared prompts as Gemini comparisons; roles appended to Seedream prompt. Seedream uses 1K versus prior Gemini 2K, so resolution/transport are disclosed differences. Provider reports $0.054 per output, $0.324 summed; this is returned usage, not an audited account ledger or app-credit charge.
- Local signed-URL preparation failed before submission (unsupported lifetime, then local ADC lacks signing identity). Each temporary uploaded source was deleted. Automatic approval review rejected a public-URL proposal; it was not applied or executed. Used official documented private inline base64 references instead, without further hosted uploads or any storage permission change. This validates local model output, not the application's HTTPS-reference route. No paid retries, environment edits, new credentials or deployments.
- All six remove creator captions on visual inspection. Seedream v4 keeps source scenery/clothing more closely than Gemini v4 in these samples, with pose/scale differences; selected-person appearance is more apparent in keyboard/can than in glasses. Seedream v5 closely retains source-performer appearance in glasses/keyboard despite strong scene fidelity. Neither version establishes reliable likeness across scenes. One output per condition, one person set, no fixed seed/biometric/OCR scoring. Keep current production defaults pending user review; GPT Sunburst not tested. Comparison http://127.0.0.1:8197/comparison-seedream; six verified screenshots and originals in outputs/recreate-ui-preview/prompt-test-seedream; report docs/starting-frame-seedream-pilot-2026-10-23.md. Deployment paused.

## 2026-10-23 Human-role v7: twelve tests complete; targeted cases match

- User explicitly requests twelve paid OpenAI tests using the same saved cases
  and business context, all results shown and focus on #2/#7/#8, no deployment.
  All twelve completed once using unchanged original model/settings/context/user
  messages and the frozen v7 prompt. No extra example answers were appended beyond
  the approved role rule's IT guy to marketing guy instruction.
- Targeted results: #2 is pov: you’re dating a marketing guy; #7 and #8 are POV
  you married the marketing guy. All three preserve the human partner as intended.
  All twelve pass length/block validation; the three LEGAL outputs stay unchanged.
  This is evidence on the supplied examples, not unseen-source reliability.
- Fresh non-target outputs can vary: #1 now has less-clear posts point you back
  to marketing wording, and #5 reintroduces unverified 3 years of marketing.
  Do not treat target-case success as accepting every new output. The previously
  accepted v6 outputs and all experiment receipts remain untouched.
- All twelve pairs: `docs/hook-remix-role-v7-paid-review-2026-10-23.md`.
  Exact provider/prompt/usage record: `docs/hook-remix-role-v7-results-2026-10-23.json`.
  Usage: 10,414 tokens, no inferred invoice amount. Active app still v2; no account
  remix receipts, media jobs, edits or deployment. Authorization fully used; no
  additional calls queued. Scoped lint and experiment-integrity checks pass.

## Google Cloud OpenRouter credential verified; local key was stale

- User asked to check Google Cloud after the local Seedream access block. Read-only check of project ugcsaas / Secret Manager openrouter-api-key version 1 (enabled, currently latest) returns is_management_key=false from OpenRouter's authenticated /key endpoint. The active generation worker references this same secret/version; no inline credential. The earlier management-key block applies to local .env.local, not the cloud credential. No new API key is needed for the prepared test; use the cloud credential in memory without overwriting local files or printing it. Null spending limit/remaining is not proof of funded account balance.
- No generation, secret update, environment edit, key creation or deployment was submitted during this verification. Deployment remains paused. The six frozen Seedream inputs remain pending; credential source must be selected explicitly before running the local harness, which otherwise loads the stale local value.

## 2026-10-23 Hook v7 scope: fix only the human-role substitutions

- User says other v6 examples are fine and singles out #2, #7, #8: dating/marrying
  a marketing SaaS or content app loses sensible meaning. Expected direction is
  IT guy to marketing guy, preserving the human partner and original relationship.
  This supersedes earlier permission to replace a person with an app metaphor.
- V6 explicitly allowed product-for-person replacement. Added a separate v7
  candidate replacing only that permission with role preservation; the rest of
  the minimal-edit brief is identical. Do not rework the accepted other nine
  cases or infer production acceptance from this creative direction.
- Candidate: `lib/explore/hook-remix-role-prompt.ts`; three illustrative corrections:
  `docs/hook-remix-role-v7-2026-10-23.md`. They are not provider results. Frozen v6
  experiments remain intact; active app remains v2. No new paid request, active
  prompt change or deployment is authorized/submitted for this clarification.

## 2026-10-23 Minimal Hook v6: twelve paid results, no active switch

- User explicitly authorizes twelve paid OpenAI tests of the simplified candidate
  using the same saved examples/business context, all twelve pairs shown, no
  deployment. All twelve completed once with unchanged v6 prompt, identical
  original user messages/context/model/settings and no few-shot illustrative
  edits. All pass existing output validation; usage totals 10,218 tokens.
- Smaller edits now predominate: RESEARCH becomes MARKETING; two LEGAL sources
  stay unchanged; audience-callout and relationship sentence patterns survive.
  Weaknesses remain: dating/marrying a marketing SAAS is awkward, the faith-purpose
  line loses its final beat/line structure, the regret line still implies personal
  history, and the third LEGAL repeat changes to AUTOMATED unnecessarily. Do not
  treat length/block validation as editorial acceptance or claim universal quality.
- All twelve source/output pairs: `docs/hook-remix-minimal-v6-paid-review-2026-10-23.md`.
  Exact prompt/provider/usage evidence: `docs/hook-remix-minimal-v6-results-2026-10-23.json`.
  Previous baselines/v4/v5 results in this artifact are reused, not regenerated.
  Active app remains v2. No media jobs, account remix receipts, edits or deployment.
  Twelve-call authorization fully used; no additional provider requests queued.

## Seedream comparison prepared; inference credential blocks submission

- User requested Seedream 5.0 Pro first, with GPT 2.5 Sunburst deferred until further guidance. Previous six images used Gemini 3 Pro/2K. Prepared six frozen Seedream inputs for the same glasses/keyboard/can sources and v4/v5 prompts, exact photo hashes and image order. Existing OpenRouter adapter appends identical role labels, stays under 4,000 characters, and uses 1K; do not call this a resolution-matched Gemini comparison. Listed estimate is $0.342 for six outputs plus four inputs per request.
- Read-only OpenRouter key check returns HTTP 200 and is_management_key=true. Only one distinct key is configured across existing local environment files; it is a management key, not an inference credential. Batch blocked before uploads or paid POSTs: zero submissions, zero new images. Do not infer Seedream quality/provider failure or fabricate comparison outputs. No credential created, environment changed, GPT request or deployment submitted. Local evidence outputs/recreate-ui-preview/prompt-test-seedream/access-check.json and frozen inputs/manifest. A regular inference credential is needed to continue.

## 2026-10-23 Hook Remix clarification: small word edits, not a new hook

- User rejects v5's dating a SaaS founder with UGCPilot output and clarifies the
  task: keep the same source, emotion and delivery; change only the words needed
  for product relevance. Prior instructions to rebuild the scenario or avoid mere
  noun substitution were overcorrections. A small noun-phrase swap may be enough;
  an already applicable source can remain unchanged. Do not invent a new founder
  character or force brand/features into the sentence.
- Added a short, review-only v6 candidate in
  `lib/explore/hook-remix-minimal-prompt.ts`, separate from the app and paid runner.
  Illustrations and rationale: `docs/hook-remix-minimal-v6-2026-10-23.md`. Earlier
  experiments remain intact. The active API still uses v2. No additional paid
  requests or deployment authorized, submitted or queued for this clarification.

## 2026-10-23 Hook source-voice v5: twelve paid tests completed, no promotion

- User explicitly authorizes twelve paid OpenAI tests with the same saved examples
  and business context, no deployment. All twelve completed once using the same
  model/settings and byte-identical user messages as earlier rounds. Frozen v5
  system prompt was unchanged. Illustrative drafts were not sent as few-shot
  answers. Prior results and app receipts remain intact; no new media jobs/edits.
- All twelve pass existing length/block validation. Voice improves relative to
  rejected v4: marriage joke, excited EVERYTHING, NOW cadence and informal emoji
  survive more often; AI mentions fall from 11/12 to 0/12. This is wording evidence,
  not an audience-performance metric or universal quality improvement.
- Material failures remain: the faith-purpose metaphor becomes circular posting
  wording; dating adds an awkward brand mention; regret still implies unverified
  personal experience; all three LEGAL hooks soften to this easy. Several outputs
  remain topic substitutions rather than the quality of the approved illustrative
  drafts. Do not treat technical validation as creative acceptance or switch the
  active app prompt. It remains v2. Nothing deployed; no further calls queued.
- All-source/v4/v5 comparison: `docs/hook-remix-source-voice-v5-paid-review-2026-10-23.md`.
  Exact receipts/prompts/usage: `docs/hook-remix-source-voice-v5-results-2026-10-23.json`.
  The twelve-call authorization is fully used; SDK retries were disabled. Original
  baselines/v4 results in this artifact are reused, not freshly generated controls.

## V4 versus V5 image pilot completed; retain v4

- User approved testing the refined shared prompt. Six fresh Gemini 3 Pro/2K images completed: glasses, keyboard and drink can, one v4 and one v5 per scene. Each pair uses identical hashed images, settings, image order and v4 labels; only shared prompt wording changes. No handwritten focused description added. No retries. Original requests, operations, usage and output digests: outputs/recreate-ui-preview/prompt-test-v5.
- Visual inspection: all six remove creator captions. V5 follows glasses composition/clothing better but appears to retain more source-performer appearance; keyboard v5 moves the shelf to the other side and changes framing; can v5 follows source geometry but is softer and appears less faithful to selected person than v4. No overall improvement demonstrated; keep v4 default. One sample per condition, one person set, no fixed seed or biometric/OCR metrics. Comparison http://127.0.0.1:8196/comparison-v5; details docs/starting-frame-v5-candidate-2026-10-23.md. Deployment remains paused.

## 2026-10-23 Hook source-voice v5: examples before another paid test

- User authorizes a prompt rewrite preserving sauce/rhythm/humor, with examples
  shown first and no deployment. Added a separate review-only candidate in
  `lib/explore/hook-remix-source-voice-prompt.ts`; active API remains on v2.
  Rejected v3/v4 evidence remains intact. No new provider request is authorized
  by this instruction or queued; previous 36-call approvals are already spent.
- Candidate anchors on the source's situation, emotional turn, cadence, emphasis
  and punchline. Preserve deliberate exaggeration, curiosity and contextual emoji;
  avoid mandatory AI/brand/feature/approval wording and universal word quotas.
  Business relevance and claim grounding still apply. Recast unsupported factual
  details without discarding the joke. No automatic feature-description fallback.
- Four assistant-drafted source/remix pairs are review examples, not application
  model results or demonstrated performance. They are stored separately from the
  prompt so they are not silently used as few-shot provider examples. See
  `docs/hook-remix-source-voice-examples-2026-10-23.json` and
  `docs/hook-remix-source-voice-v5-2026-10-23.md`. User feedback precedes paid tests.

## Current-prompt refinement prepared for testing; deployment paused

- User chose the current starting-frame approach after mixed scene-focused comparisons. Added an explicit opt-in v5 candidate to the shared image-prompt builder: more concrete framing/layout/pose preservation, distinct scene versus person-photo roles, source pixels taking precedence over conflicting opening-scene descriptions, and overlay cleanup including outlines/shadows. No per-video manual prompt migration.
- Application requests and previews still compile byte-identical v4. Candidate has not generated images or demonstrated improved quality; no production switch or deployment. Local prompt-contract checks are separate from visual acceptance. Reasoning and proposed comparison: docs/starting-frame-v5-candidate-2026-10-23.md.

## 2026-10-23 User rejects Hook v3/v4: source voice takes priority

- User explicitly says fresh prompts lose the source's sauce/taste. Re-review of
  all twelve cases in both candidate rounds supports that: relationship setups,
  excited callouts, delayed-discovery regret and exaggerated disbelief become
  feature descriptions. Eleven of twelve v4 outputs mention AI despite seven
  distinct source texts. Length/schema success is not creative acceptance.
- Earlier praise for specificity and shorter copy was over-weighted. Do not ban
  excited EVERYTHING, rhetorical this, informal punctuation or expressive emoji
  categorically; they can carry the hook. Preserve social setup, emotional
  reversal, curiosity and punchline before adapting business details. Clearly
  fictional POV/metaphor must not be conflated with factual lived-experience
  claims. Unsupported autobiographical claims still require correction.
- Disconnected experimental Hook helpers from the active local Remix API and
  restored the pre-experiment v2 prompt/version. This contains the rejected
  regression; v2 is not claimed to solve the original complaint. Experimental
  prompts, paid results and historical receipts remain intact. No deployment
  or further provider request was submitted. No new paid round is queued.
- Full all-case review and revised creative direction:
  `docs/hook-remix-source-voice-review-2026-10-23.md`. Establish human-reviewed
  source-faithful examples before another model comparison. The previous v4
  comparison record is historical and must not be treated as release approval.

## New prompt test: drink-can reference (no production switch)

- User requested another different frame. Two fresh Pro/2K outputs completed on Hook 05 with identical scene/person images per comparison condition. Native source and focused description reviewed before submission. Both remove creator captions and retain printed can text. Baseline changes scene geometry but appears closer to selected person photos; focused preserves scene more closely yet appears to retain source-person appearance. Do not label focused successful based on scene fidelity alone. Evidence/limits in docs/starting-frame-prompt-pilot-2026-10-23.md; deployment paused.

## 2026-10-23 Hook prompt comparison and v4 follow-up complete locally

- User authorized a local Hook prompt improvement and then explicitly approved
  sending twelve saved examples/business context to OpenAI for 24 billable text
  calls. All 24 completed: one current-v2 baseline and one Hook-v3 candidate per
  saved case, same model/settings/context/user messages, alternating order.
  Historical receipts stay unchanged. No app account receipts or video edits
  were created. Exact snapshots/results: `docs/hook-remix-prompt-comparison-2026-10-23.json`.
- V3 replaces generic hype with some grounded product details, but is not
  qualified: 11/12 candidate outputs pass length/shape checks versus 12/12 v2;
  one candidate is 83 characters against an 80-character limit, and the regret
  example retains an unsupported first-person years-of-effort story. Some
  inherited emoji/awkward phrasing remains. Do not claim universal improvement.
- User separately approved twelve more billable OpenAI requests. All twelve v4
  follow-up calls completed using identical user messages/context/model/settings.
  V4 adds exact per-source character budgets, stronger unsupported-history
  instructions and AI-partner/emoji clarity. All twelve pass current length/shape
  validation; the former overlong output is now 38/80 characters. The regret case
  becomes an audience scenario rather than the speaker's years of experience.
  This is not blanket grounding acceptance: it still assumes hours of effort.
- Final local implementation passes 36 focused tests, TypeScript and scoped lint.
  Wall/slideshow retain exact v2; old receipts recover without paid regeneration.
  Some copy is now generic/descriptive, source humor can be lost, and one output
  says AI content, approved, leaving human approval ambiguous. Existing explicit
  Apply/manual review remains essential. This is a regression set used to develop
  the prompt, not a held-out audience-performance experiment. No universal win
  or automatic publishing readiness is claimed. Deployment remains paused.
- Completed follow-up evidence: `docs/hook-remix-prompt-followup-2026-10-23.json`.
  All-case comparison and caveats: `docs/hook-remix-prompt-review-2026-10-23.md`.
  Total authorized calls: 36, all completed without automatic retries. No app
  account remix receipts, generation jobs, video edits or deployments were created.

## Starting-frame model extension and plain-language errors (local)

- Added requested GPT Image, GPT Image 2.5 Sunburst and Seedream 5.0 Pro to shared starting-frame contracts and selector. API records selected model/credit quote/receipt, pins Seedream to OpenRouter and validates its full 4K prompt budget before reservation. Non-Google worker routes verify source bytes and preserve ordered scene/main/support roles; GPT uses native ratio. New-route live provider acceptance still pending; no production deployment.
- Known Google content blocks now explain the observed rejection without HTTP jargon or guessing its trigger. Do not infer model-wide failure or a refund from a generic error. Local preview uses the same explanation.
- Two Pro outputs completed on a new reclining reference. Both remove captions. Current is closer to source composition, but focused candidate contained authoring mistakes (closed lips/added chest hand) and is explicitly marked as a flawed comparison. Evidence and limits in docs/starting-frame-prompt-pilot-2026-10-23.md. No catalogue-wide prompt migration; deployment remains paused.

## 2026-10-23 Hook Remix writing-quality audit (no prompt change)

- User requested comparing source copy and generated remixes. Recovered the
  connected account's 12 completed Hook receipts (16–23 October) via application
  history; owner-scoped database reads confirm the same business profile, empty
  extra instructions and model, with six prompt-v1 and six prompt-v2 requests.
  Recent outputs show literal topic swaps, generic hype, lost source humor and
  an unsupported transferred three-year personal-experience claim.
- Current prompt explicitly favors smallest useful changes; validators enforce
  structure/length, not editorial quality. The short-source 80-character allowance
  lets a 28-character hook become 74 characters; prompt input has no timing.
  Recommend a Hook-specific brief preserving persuasive mechanism rather than
  noun sequence, grounded feature selection and duration-aware brevity. Model
  replacement has not been tested. Context contains useful facts plus potentially
  distracting carousel/CTA suggestions. Changed single-box text is also sent as
  guidance, a latent ambiguity absent from these empty-instruction samples.
- All 12 receipt outputs preserve exact copy through actual Apply/serialization,
  except the documented legacy screen-cut-tail normalization, and all 12 source
  texts match the current local catalogue. This does not verify hosted rendered
  videos or establish audience performance. Wider checks: 37 pass, 2 fail because
  the ordinary-media-read assertion conflicts with current metadata job lookup
  and reference inventory has 283 entries versus 296 current references (nine
  Hooks and four slideshows omitted by the inventory helper). Failures recorded,
  not hidden or fixed by relaxing assertions.
- Audit/evidence: `docs/hook-remix-quality-audit-2026-10-23.md` and
  `docs/hook-remix-quality-samples-2026-10-23.json`. No remix prompt, receipt,
  account, API or worker change; no provider requests or deployments submitted.
  Deployment remains paused. Human-written example improvements are illustrative,
  not saved model outputs or proven winners.

## 2026-10-23 Person picker implemented locally; deployment paused

- User authorized separate **My AI influencers** and **Uploaded photos** sources,
  a small labelled **UGC Pilot images** control, inline selection and results below
  setup. The shared Hook, Talking Head and Wall of Text Recreate preparation now
  implements this direction. Catalogue switches the same grid and returns to the
  prior owned source; empty libraries do not silently switch to stock. Upload and
  Create a new influencer remain explicit actions. Main/supporting roles, saved
  media verification and pagination are retained. Choosing a different generated
  influencer retains the existing replacement/reset of prior supporting photos.
- Person selection expands within preparation, without a second dialog. Done
  returns focus to Change photos. Results remain below setup in bounded,
  start-aligned cards. The regular shared chooser and independent Talking Head
  upload chooser also use Uploaded photos and the compact catalogue control;
  generated influencer history remains available in Recreate preparation.
- Completed jobs now have separate preview loading/ready/error state, including
  a 15-second loading timeout. Approval checks that the exact selected asset and
  current URL have loaded. Retry preview reloads the image and reads saved job
  status; it does not submit another paid generation. The screenshot's original
  blank-preview cause remains unverified; this is recovery/readiness handling,
  not proof that its hosted media-delivery cause has been repaired.
- Local evidence: 88 focused tests pass; 12 real-component browser scenarios
  cover all three Recreate workflows at desktop, short desktop, 390px and 320px.
  Six regular Hook/Talking Head picker scenarios plus pagination/cache checks
  also pass. TypeScript and scoped lint pass. Browser fixtures provide account,
  upload and generation responses; these do not establish hosted acceptance.
  The older image-picker-performance test cannot import optimizeImage from this
  installed Next version; no optimizer implementation/configuration changed.
- No deployment or paid generation was submitted for these UI changes. Production
  Hook redirected the available browser to sign-in. Evidence and limitations:
  `docs/explore-person-picker-implementation-2026-10-23.md`.

## HTTP 400 diagnostic replacement confirms provider safety filtering

- User authorized cause investigation and another test. Local SDK exposed error details the old harness had discarded; sanitized message/body capture and block classification now added to local runners, with three passing tests. Two new calls repeated the exact laptop prompts/inputs. Baseline returned explicit safety-filter block, and provider states blocked output is not charged. Focused completed. Specific triggering input is not identified; original missing error body cannot be reconstructed. No format-fix, automatic retry, filter workaround or completed visual comparison is claimed. See docs/starting-frame-prompt-pilot-2026-10-23.md. Production prompt unchanged; deployment paused.

## Third prompt comparison incomplete: baseline provider error

- User requested another comparison. Hook 02 laptop/glasses source used identical Pro/2K and person photos. Baseline returned HTTP 400 with no operation/output retained; cause and billing outcome are unverified. Focused candidate completed and removes captions, but no current-vs-focused winner can be inferred. No automatic replacement/retry. Evidence in docs/starting-frame-prompt-pilot-2026-10-23.md. Deployment remains paused.

## Focused-prompt repeat: second reference did not improve composition

- User requested another source-frame test. Two fresh Pro/2K images completed using Hook 01's native first frame and the same three person photos as the glasses test. Both remove captions; focused candidate widens framing and moves the shelf to screen-left despite screen-right guidance. Baseline follows the source layout more closely in this pair. Do not extrapolate the first sample's apparent improvement or migrate the full catalogue. Findings and source/request/output evidence: docs/starting-frame-prompt-pilot-2026-10-23.md. Deployment remains paused; production prompt unchanged.

## Focused-prompt pilot completed locally; no production switch

- User requested testing before authoring source-specific prompts for the full Hook catalogue. Two fresh Pro/2K provider images completed on the same source and three person photos, comparing current v4 against a fuller scene/caption candidate. Both remove captions; candidate follows glasses placement/background more closely in this pair. This is one stochastic sample per condition, not reliability acceptance or proof of likeness. See docs/starting-frame-prompt-pilot-2026-10-23.md for exact evidence and limits.
- Prototype lists Pro/Flash starting-frame routes and clearly disabled ChatGPT/Seedream candidates from the broader app catalogue. No additional model adapter, production compiler change or release was made. Deployment remains paused. Further representative/repeated comparisons are proposed, not automatically queued.

## Local Recreate interaction prototype (not production integration)

- User requested a visible test UI before implementing the redesign. Local-only prototype at outputs/recreate-ui-preview/index.html, served on 127.0.0.1:8194 by its explicit-asset-allowlist server, uses real earlier source/person images and v2/v3/v4 outputs labelled as previous tests. Generation is disabled; this is not evidence for a new prompt or a connected account library.
- Working prototype interactions: inline main-photo selection and session-only uploads, result selection/enlargement, Use this frame into a sample composer, and replacing through Starting frames history. Desktop/mobile browser checks passed for visible images, selection/history/enlargement and horizontal overflow. Account persistence, supporting-role management, stock source and provider integration remain for the real component implementation. Deployment stays paused.

## 2026-10-23 Scheduling confirmation visibility and distinct photo sources

- User clarified that View in Scheduling remains present after scheduling but
  looks like normal text; this is a discoverability complaint, not a disappearing
  receipt report. Keep the existing confirmation and repeat handlers. All three
  Explore confirmation renderers now use a shared explicit orange, semibold,
  underlined link with an arrow, hover feedback and keyboard focus. A local browser
  reproduced the global unlayered `a { text-decoration: none }` cancelling the old
  Tailwind underline; orange itself remained computed in that local build. Do not
  claim the exact hosted neutral-colour cause was independently reproduced.
- Scheduling cross-checks cover direct and background confirmation, saved receipt
  recovery, time/account validation, lost responses and duplicate prevention.
  All 78 focused frontend/client/service/route checks pass; desktop/mobile browser
  checks pass for four scheduling paths plus Talking Head confirmation styling.
  TypeScript and scoped lint pass. These use local fixture accounts and APIs.
  Two baseline TikTok receipt tests incorrectly depended on the old commercial
  disclosure default; their fixture now explicitly selects disclosure/own-brand
  promotion so they test canonical mapping and changed-setting rejection. No
  publishing default or scheduling API/worker behavior changed.
- User rejects merging generated influencers with uploads. Keep separate sources;
  recommended labels are My AI influencers (created in Build AI influencer) and
  Uploaded photos (Explore reference uploads). Keep UGC Pilot images as a small
  labelled source control in the same inline library. This supersedes earlier
  Your photos merge proposals. Keep starting frames below setup and preserve
  main/supporting roles, selected images and independent preview error handling.
- Production Hook entry redirected the available browser to sign-in. No real post
  was created, modified or published. Deployment remains paused; local scheduling
  checks do not establish hosted end-to-end publishing acceptance. Evidence:
  `docs/explore-scheduling-visibility-review-2026-10-23.md`.

## 2026-10-23 Revised starting-frame and library direction (discussion)

- User corrected the proposal: keep generated starting frames **below** setup;
  do not move them to a right-hand review column. Compact the source/person/settings
  area and the result section without changing that order.
- Earlier proposal, superseded by the later separate-source correction: retain UGC Pilot images. Merge uploads and saved generated person images into
  Your photos; remove only the separate Your influencers tab after preserving its
  contents. This supersedes the earlier proposal to remove the stock catalogue.
- The new screenshot includes a top-right mark near library actions. Reading this
  as a compact secondary catalogue entry is an interpretation, not a confirmed
  icon specification. Recommend a labelled UGC Pilot images control that switches
  the same inline grid, with a visible route back to Your photos. Do not mix stock
  people into the owner's grid or add another popup.
- Inline photo selection and separate blank-preview diagnosis/loading/error/retry
  remain the proposed direction. No person-picker or starting-frame redesign was
  implemented for this clarification; deployment remains paused.

## 2026-10-23 Compact Your videos results (local)

- The separate user request about oversized Your videos content now has a local
  implementation: Explore pending/completed previews use a height budget capped
  at 300px, preserve aspect ratio, and use a narrower two-line prompt summary with
  expansion/copy retained. Hook/Wall share this layout. Talking Head's separate
  generated-result canvas uses the same height budget. Standalone AI Studio retains
  its existing presentation; slideshow outputs do not use these video components.
- TypeScript and scoped lint passed. The local isolated browser harness passed 70
  pending/completed, ratio and viewport cases plus a standalone Studio scope check;
  existing desktop/mobile generated-result action checks also passed. Screenshots
  and receipt: `.tmp/explore-compact-video-results/`; runner:
  `scripts/explore-compact-video-results.browser.cjs`. Auth, inference, surrounding
  workflow state and download transport are isolated; physical touch and browser
  zoom were not tested. No deployed or authenticated production acceptance.

## Reference playback: hover-only implemented locally

- User approved implementing hover-only reference playback while keeping deployment paused. Removed the visible-autoplay option from the shared cover hook and the reference gallery caller. Cards remain on their posters until sustained pointer hover or keyboard focus; leave, blur, click, offscreen visibility, hidden tabs and reduced-motion preferences stop/unload playback. Touch hover does not start playback; the existing tap-to-preview dialog remains.
- Supersedes earlier pending-hover and visible-autoplay notes. The 21 focused cover/navigation/reference-preview checks pass locally. This has not been deployed or freshly accepted in the authenticated production browser.
- Recreate simplification remains a proposal: retain the generation/state flow, expand the photo picker inline, preserve selected photos and completed/pending results, maintain keyboard focus and responsive scrolling, and retain deliberate Generate/Use frame actions. Scene-specific prompt changes require representative comparisons; clearer instructions may improve caption removal but do not guarantee it.

## 2026-10-23 Hook starting-frame layout and photo-library confusion (open review)

- User supplied two more screenshots: a generated starting-frame card sits below
  setup despite unused horizontal space, its selected preview is blank, and the
  person picker splits Your influencers / Your images / UGC Pilot images. Add this
  recurrence to the existing simplification review; no runtime change or release.
- Earlier proposal (superseded by the user's later keep-results-below correction): compact source/person/settings left, principal selected-frame
  review right with variations beneath; responsive stacking and a visible approval
  footer. Expand the photo library inline only on request. A blank selected card
  needs separate preview loading/error/retry handling and production diagnosis;
  neither successful job metadata nor a spacing change proves it viewable.
- Earlier picker proposal (superseded by the separate-source correction): one Your photos grid combining eligible owned Explore uploads
  and generated person history. Remove Your influencers as a separate tab only
  after its media remains selectable there. The earlier proposal to remove stock
  UGC Pilot images is superseded: retain it as a distinct optional source. Preserve explicit main/supporting
  roles, ownership, provenance, pagination and verified asset/job identity. Do not
  include unrelated uploads or scene outputs, delete saved media, or remove the
  influencer builder. Starting frames history remains distinct in the composer.
- Source review confirms shared Recreate exposure in Hook, Wall and Talking Head.
  Normal Hook/Wall image selection repeats two source tabs; Talking Head has an
  independent WorkflowImageLibrary with the same two tabs and needs follow-through.
  Slideshow source/background pickers have different paths: no exact three-tab or
  starting-frame layout recurrence found; preserve their meaningful source roles.
- Screenshot/source audit only; no fresh authenticated browser acceptance or
  cross-workflow reproduction of the blank preview. Evidence, source locations,
  proposed layout and acceptance matrix are in
  `docs/starting-frame-simplification-review-2026-10-23.md`. Deployment stays paused.

## Starting-frame follow-up: optional face references for animation (proposed)

- User requests Add face references beside the selected starting image because a side-facing or obscured face may provide insufficient appearance detail during animation. This is an animation-input request, separate from person photos used to create the still.
- Current worker admission explicitly rejects face photos mixed with an approved starting frame; the Omni adapter also separates these modes. A UI tile alone is insufficient. Verify literal-first-frame plus separate appearance-reference support per provider/model before changing the API/worker contract or enabling this option.
- Prefer optional reuse of the user's selected original person photos, with inline add/change, over automatically generating extra frames. Preserve the approved opening composition and show which inputs are actually submitted. Do not silently discard photos or promise facial consistency. Proposal and evidence are in docs/starting-frame-simplification-review-2026-10-23.md. Deployment remains paused.

## 2026-10-23 Slideshow business adaptation clarification — confirmed production cause

- User reported Recreate asking for exact UGCPilot copy for Source slides 1–6
  despite a saved business profile. Read-only production lookup found the exact
  clarification in three completed planning records (12:44:06–12:44:47 UTC).
  Each had six targets, zero planned slides, one clarification, and no business
  context/snapshot in its durable input. The owner's applied UGCPilot profile
  version 2 already existed, with product summary, value propositions and audience.
- API loads `slideshowBusinessContext` before planning, but passes only `named`
  (prompt, images, target IDs) to `planSlideshowRequest`. That service's model
  message omits business facts. Context is attached only to later image jobs,
  which the clarification branch prevents from being admitted.
- Planner system wording compounds the missing data: “Do not invent business
  copy” treats requested factual copy adaptation like unsupported claim invention.
  The user's explicit adaptation request should authorize writing grounded copy;
  numerical results, guarantees, medical/product claims still require evidence.
- Investigation only: no runtime fix, provider request, database write or
  deployment. Proposed correction must supply the server-frozen profile to the
  planner and durable input/hash, distinguish adaptation from unsupported claims,
  preserve unrelated visuals/wording, and test context handoff plus six-slide
  cross-topic adaptation. Existing completed clarification receipts remain
  immutable; recovery must not silently resubmit them after a prompt change.
  Evidence: `docs/slideshow-business-context-root-cause-2026-10-23.md`.

## 2026-10-23 Deployment paused again; simplify Recreate before further rollout

- The user paused further deployment to reconsider stacked Recreate/image-picker screens and inconsistent starting-image results. The preceding website/worker release is already live; the separate MCP target remains on its prior deployment. Do not describe the pause as undoing the completed release. Hover-only reference playback was requested but has not yet been implemented/deployed.
- Two latest Hook 100 saved requests both use Pro/v4, identical scene/person inputs and an identical prompt with caption removal plus a verified opening description. The supplied screenshot shows retained creator text and scene drift. Current output admission checks ownership/receipt/media validity, not visual caption/likeness/scene quality. These technical checks cannot be presented as image-quality acceptance.
- Proposal under discussion: one focused workspace with a collapsed inline person library, retained explicit person choice, compact default settings, same-screen results, and deliberate image approval before separate paid animation. Preserve Starting frames history in the Create image chooser. A stable identity prompt plus source-bound frame-specific scene/cleanup guidance should be evaluated; no new prompt is qualified or deployed during the pause.
- Read-only findings, evidence limits and proposed checks: `docs/starting-frame-simplification-review-2026-10-23.md`. No new paid generation or production mutation is authorized by this thinking discussion.

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

Recurring open issues added 23 October 2026:

| ID | Mistake and user impact | Prevention / current status |
| --- | --- | --- |
| EX-51 | Starting-frame results sit below a tall setup area while space beside the person remains unused; another large picker interrupts comparison | Results stay below compact setup; person selection expands inline. **Implemented locally; all three Recreate workflows passed desktop/mobile fixture checks. Hosted acceptance pending deployment.** |
| EX-52 | Your influencers / Your images / UGC Pilot images make users understand separate inventories before choosing a person | My AI influencers and Uploaded photos remain separate; UGC Pilot images is a compact source control. Separate Talking Head upload chooser updated; roles/history retained. **Implemented and checked locally; hosted acceptance pending deployment.** |
| EX-53 | Screenshot shows a blank selected result with approval available; job success does not establish a viewable preview | Loading/error/timeout/free retry and selected-image readiness now guard approval. **Recovery implemented and checked locally; original hosted blank-preview root cause remains unverified.** |
| EX-54 | Confirmed View in Scheduling action blends into surrounding text; the global anchor reset also strips its utility underline | Use shared explicit orange/semibold/underline/arrow/focus styling in direct, background and Talking Head confirmation paths. Preserve receipt and repeat logic. **Local change and regression checks; production acceptance pending sign-in and release.** |

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

## 2026-10-25 Full Hook recreation keeps original opening; clear later frame is an identity anchor (clarified plan)

- The user clarifies that there is no fixed later timestamp such as 1.5 seconds. Analyse the complete source and choose any reviewed suitable face-clear frame when the original opening is too occluded, blurred, cropped or angled for reliable influencer identity generation.
- That selected later frame exists for identity/clarity assistance. It does **not** authorize trimming away the viral video's original opening action. The requested recreation still begins from the source video's real first pose/action and continues through its reviewed ending.
- Use distinct roles and names: `identity_clarity_anchor` is the clear selected source timestamp; `animation_opening_frame` is a separately generated influencer image recreating source t=0, including its original hand/object occlusion and scene geometry. The latter, not the clear later image, is the literal first-frame input to ordinary image-to-video generation.
- The full motion prompt starts from the delivered `animation_opening_frame` and describes the timestamped source action from original t=0 through the ending. The later clarity anchor may guide identity continuity as the face becomes visible, but must not be mislabeled as generated time zero.
- If a route can reliably use the complete source video for motion together with separately labeled identity references, it may be evaluated as an alternative. Otherwise use the two-image preparation route or an explicitly supported multisegment method. A text prompt alone cannot make a clear later image used as literal frame zero also depict the earlier occluded opening.
- UI remains compact: after preparation, show one starting-frame preview and one Change action; no permanent duplicate Choose Photos tile. Any internal distinction between identity anchor and animation opening belongs in the Change/review flow and status copy, not as extra always-visible controls.
- This entry records the product contract and implementation plan only. No runtime behavior, database schema, prompt, provider request, paid generation, deployment or production acceptance changed in this clarification. Detailed phased plan: `docs/hook-full-recreation-identity-anchor-plan-2026-10-25.md`.

## 2026-10-25 Middle-frame prompt and Recreate-the-account audit

- Current active data resolves to 104 public Hook references and 12 private Recreate-the-account references. Public has 21 nonzero clarity frames and 83 frame-zero references; private has 10 nonzero and two frame-zero references.
- All 31 nonzero cases fail the clarified full-recreation contract in their default prompt path: the approved/generated later-frame composition is treated as literal animation frame zero and the motion text begins at or after it, so the original viral opening action is omitted or displaced.
- Frame evidence: all 31 locally available nonzero videos were decoded and 118 of 118 native contact sheets covering all 3,110 frames were visually inspected, including exact opening/selected comparisons and transition boundaries. This is not a claim that every frame received a written semantic annotation.
- Code evidence: curated public motion intentionally continues after the selected pose; the image prompt recreates that selected pose; the motion compiler calls it the complete opening; the worker sends it as `FIRST_FRAME`; private Recreate-the-account exposes `selectedFrameDirections` as the generation prompt for matching later frames. Current persistence has no distinct identity-anchor and animation-opening receipts.
- Runtime identity must use stable reference ID plus source SHA. Seven historical audit numbers differ from current gallery titles, so a Hook number alone is not safe provenance.
- Required correction remains: retain the clear later source frame only as `identity_clarity_anchor`; separately generate and approve `animation_opening_frame` from source t=0; bind a full t=0-to-ending timeline to both receipts; pass only the latter as provider frame zero. Keep one preview and one Change action in the UI.
- Detailed counts, all 31 cases, implementation trace, source limitations and acceptance tests: `docs/middle-frame-prompt-and-recreate-account-audit-2026-10-25.md`.
- Audit only: no runtime prompt, UI, schema, provider request, paid generation, deployment or production behavior changed.

## 2026-10-26 Hook 100 full-recreation pilot (local, unpaid)

- Implemented the clarified two-role contract for exactly one stable public reference, Hook 100 (`explore-paired-hook-fc44f6214b6e17413600ec13`, source SHA-256 `405670a27856c31e698a0ef13b178ece82c18cc379c0cec7489b0c1c1414fa1e`). This is a deliberately narrow pilot; every other public and private reference retains its prior path.
- Hook 100's reviewed frame 70 at elapsed 2.333333 seconds / absolute PTS 2.399349 seconds remains the `identity_clarity_anchor`. Its original frame 0 at t=0 is separately resolved from the stored-source-frame path as opening composition evidence. Storage preparation scripts now include this curated pilot, but production storage was not written or verified during the local implementation.
- Server receipt v4 freezes both exact frame roles, the original v3 browser preparation key and ordered influencer asset IDs. Input hashes, timestamps, dimensions, object bytes and provider reference order are checked independently. Existing v1-v3 receipts remain recoverable.
- The opening-image prompt uses original t=0 for scene/camera/posture, the later clear frame only for continuity as the face becomes visible, and the user's photos as sole identity authority. It explicitly preserves the opening glasses/hand state instead of jumping to the clear anchor.
- The Hook 100 motion plan now starts at original t=0, removes the glasses during the opening beat, transitions toward the clear anchor and continues to the reviewed ending. It no longer starts after glasses removal. The worker sends only the newly generated and approved opening-image output as video `FIRST_FRAME`; neither stored source frame is eligible for that slot.
- No new permanent UI control was added. The existing loaded state keeps one starting-frame preview and one Change action. Targeted structural UI tests and responsive browser checks passed at desktop and phone widths without horizontal overflow.
- Local verification proves prompt/receipt/provider chronology, recovery binding and rejection of changed roles before billing. No paid image/video call, real generated-pixel review, deployment or authenticated production acceptance occurred. Do not describe identity/pose/motion fidelity as fixed until an explicitly approved Hook 100 trial is reviewed frame by frame.

## 2026-10-26 Authorized real Hook 100 image trial — rejected at visual gate

- User authorized one real image-first Hook 100 test followed by video review before any wider changes. One Gemini 3 Pro 2K image completed using original frame 0, clarity frame 70 and the previously used owned portrait `495d8905-7a1b-4cbf-a38f-7a526a4dbff5`. The connected MCP supports only one reference, so this isolated diagnostic used the application's actual prompt/receipt/request builders directly; it does not prove deployed job, credit, queue or storage acceptance.
- Retained provider input confirms exact opening/anchor/identity byte hashes, labels and full prompt with caption-removal instruction. The output preserves original t=0 glasses-on/temple-hand/side-gaze posture and source scene, but retains all three original caption lines. Identity resembles the chosen portrait under the oblique glasses pose; it is not fully qualified. Caption removal FAILED, so the image is not approved for animation.
- One image create call, zero video requests, no automatic retries, app-credit/database/production-storage changes or deployment. Other references remain unchanged. UGC-VID-006 recurred; UGC-VID-010 remains open for full-video acceptance. Report and source/output provenance: `docs/hook100-real-trial-2026-10-26.md`. Preserve the accepted interaction and rejected image; any next paid attempt is a separate deliberate trial.

## 2026-10-26 Hook 100 caption fix passes; real video fails ending continuity

- User authorized a targeted caption fix and another image-first trial followed by video review. Hook 100's pilot image prompt now identifies the exact three caption lines, lower-middle region and complete outline/shadow removal, reconstructing the physical scene underneath. No other reference prompt changes. The first accepted trial retains its original frozen prompt/receipt.
- One new Gemini 3 Pro 2K image passes visual review: caption-free, correct original glasses-on/temple-hand/side-gaze opening with selected portrait likeness and source setting. The existing output normalizer supplies a reviewed 720×1280 opening to one real four-second Google Omni request, with the same portrait as optional facial reference. Real retained interactions verify exact input hashes, full prompts and correct FIRST_FRAME/IMAGE_REF roles.
- Reviewed all 96 output frames across four native sheets plus larger 640-pixel-wide extracted critical-frame views. Original opening and single glasses removal are present; no caption returns. Frontal gaze arrives early and becomes a smile. At frame 90 / 3.75 s, all final six frames cut to the portrait's bedroom/gray shirt/necklace. The video FAILS full recreation acceptance; other references remain unchanged.
- All 96 raw-versus-silent decoded picture hashes match, proving the cut originated at the provider. Final video is silent; raw generated audio was removed using existing application post-processing. Provider-internal scene-cut cause UNKNOWN. Ending directions stop at source 3.733 s within requested 4 s, a hypothesis for controlled correction rather than a proven cause.
- Initial diagnostic GCS upload was refused by storage permissions before any video submission. No IAM/config change or object write; verified local files supplied inline to the real adapter instead. One new image + one video create total for this retest, no automatic paid retry, app-credit/DB changes or deployment. New UGC-VID-011 stays OPEN; UGC-VID-006/010 remain qualified only to the evidence above. Full report: `docs/hook100-caption-retest-2026-10-26.md`.

## 2026-10-26 Two dedicated prompt-writing skills

- User requested separate reusable prompting techniques for ordinary first-frame
  recreation and the later-clear-frame case, with clear concise performance
  direction. Added project skills `ugc-opening-frame-prompt` and
  `ugc-middle-frame-recreation-prompt`; existing video-prompt/starting-frame
  skills and AGENTS route to them. They are agent instructions, not code loaded
  by the application's generation runtime. Existing accepted prompts stay frozen.
- The ordinary skill verifies original t=0 and writes the observed timed actions,
  holds, gaze and emotion. The middle-frame skill preserves later clarity evidence
  separately, reconstructs/approves original t=0, then applies full-source motion.
  A literal later first image supports continuation unless the user chooses a
  supported full reconstruction route. Do not mistake the clarity timestamp for
  a gesture boundary or claim earlier poses can be restored by wording alone.
- Both separate detailed analysis from compact provider prose, require explicit
  duration remapping (including requested three-second output), and qualify real
  image/video results independently from correct input delivery. No paid trial,
  application prompt rollout, UI or deployment changed in this skill task.

## 2026-10-26 Hook 100 revised three-second real test

- User authorized rewriting from observed video with the new skills and one new
  test. Re-inspected full 112-frame source. Compact 1326-character prompt retains
  opening hold/removal/sideward pause/blink-turn/frontal reaction/sideward ending,
  remapped from 3.733333 source seconds to exactly three generated seconds.
- Same approved caption-free opening and portrait, same Omni provider/roles;
  one new video create, zero new images. Real output 3.000 s, 720×1280, 24 fps,
  72 frames. Retained provider record confirms exact images and full prompt.
- All 72 frames reviewed. No caption, smile or previous final bedroom/wardrobe
  cut; action order and sideward pause improve. Removal remains about 0.2 s late,
  inner brows become overly worried, eyes lack source surprise, framing moves
  closer. PARTIAL PASS only; wider rollout remains unapproved. Changing duration
  and prompt together does not prove either independently fixed the ending cut.
- Earlier trials preserved; no runtime prompt/default, other-reference, UI,
  scheduling, database, cloud-storage or deployment change. Review/receipt and
  declared source-retimed side-by-side comparison:
  `docs/hook100-three-second-test-results-2026-10-26.md`. UGC-VID-010/011 remain open.

## 2026-10-26 Reconnected slideshow target retry recovery

- Production audit found one October 23 TikTok slideshow target left `action_required` after provider `invalid_grant`, while its Instagram sibling published successfully. The same TikTok connection later published other carousels and a video, proving the connection recovered.
- The target-scoped retry RPC previously returned immediately for every historical `action_required` status and therefore never reached its existing current-connection validation. A recovered connection could not retry the stale target.
- Migration `20261026105718_retry_reconnected_action_required_target.sql` removes that stale-status short circuit. `action_required` targets now participate in active-job deduplication and retry eligibility, then pass through the same media and live connection checks as failed targets.
- If the account is still unavailable, the RPC preserves the `action_required` outcome and queues nothing. If healthy, it creates one durable `publish_social_post` job; repeat requests reuse the queued/processing job. Published sibling targets and their provider receipts are not modified.
- The function remains `SECURITY DEFINER`, owner-scoped by `p_user_id`, and executable only by `postgres` and `service_role`; `PUBLIC`, `anon`, and `authenticated` are explicitly revoked. No schedule picker, timezone, initial schedule creation, slideshow generation/rendering, media-preparation or UI behavior changed.
- Local PGlite coverage passes the recovered, unrecovered, legacy failed-target, idempotent repeat, sibling-preservation, owner-isolation and browser-role permission cases. Production migration/deployment and a real provider retry are separate acceptance steps and remain unverified here.

## 2026-10-26 Talking Head reference removal and shared Hook audit

- User requests removing the two marked fact-check videos. Hide only `talking-outdoor-discovery` and `talking-outdoor-reaction` in Talking Head gallery rendering, including older cached nine-item lists. Seven cards retain order. Keep archival catalogue/media/source hashes and saved-reference recovery. No deployment in this task.
- Focused audit passes 136 tests, including actual source decoding, audio mixing and local schedule database contracts. Full Talking Head component browser passes 1366×768, 1536×864 and 390×844 journeys with local files and isolated auth/API boundaries. Shared panel still uses plain HH:mm text input: interactive 24-hour picker contract FAILS (UGC-SCH-001 recurrence). Broad Explore suite has 1,203 pass / 57 fail, largely fixture drift, and is not a green release gate.
- Talking Head still lacks Hook's optional approved-frame animation face photos and generation-history drawer. Its source-frame cache miss decodes packaged MP4 rather than using ordinary Hook stored frames. These differences are not proof of a specific production lag or identity cause. Hosted browser redirects to sign-in; Comet access timed out. Paid generation, production performance and real publication NOT VERIFIED.
- Full file/skill/command/screenshot receipt and remaining risks: `docs/talking-head-hook-shared-audit-2026-10-26.md`. Existing concurrent work preserved; no prompt, worker, schema, scheduling-runtime or layout changes in this patch.


## 2026-10-26 Talking Head shared-feature fixes (local acceptance only)

Follow-up restores shared interactive 24-hour selection without backend conversion/persistence changes. Talking Head approved-frame animation accepts ordered optional owned face photos via shared Omni validation; unsupported models block without losing selections. Explicit generated-video History reuses the owner-scoped asset chooser. Both clip editors receive canonical references for metadata-bound source text. All nine archival references have hash-verified exact t=0 prepared PNGs, read without on-request decoding. Two fact-check discovery cards stay hidden with old drafts recoverable.

Local broad Explore regression passes 1,283/1,283, production build/types/lint pass, and desktop/mobile fixture checks pass including320px and keyboard time selection. Full receipt/files/tests: docs/talking-head-shared-fixes-2026-10-26.md. Production redirects to sign-in; no deployment/provider calls. Existing Hook recreation quality incidents remain open. Local checks do not establish output quality, hosted latency or publication.


## 2026-10-26 Explicit Post now and complete24-hour picker coverage (local)

Explore shared scheduling adds optional publishMode now/scheduled while retaining manual date/time/zone separately. Old drafts keep manual behavior. Post now submits useDefaultScheduleTime through direct/finishing/background-preparation paths; server chooses earliest supported slot under the existing configured lead (default5 minutes). It does not bypass preparation, ownership/account/default validation or claim immediate publication. Mode changes never submit. Main Scheduling supports automatic timing for new posts only and disallows targetless Post now; existing schedule edits remain exact-time.

Trending Hook and the shared platform modal replace their last native time inputs with the explicit shared24-hour picker. Existing main Scheduling rail picker stays intact. Trending ASAP choice is consistently named Post now; Hook's implicit default timing now has explicit now/later controls. No new provider/queue/schema/migration.

Broad Explore1,285/1,285, focused119/119, pending46/46, build/types/lint and three desktop/mobile browser suites pass (overlap). Full paths, semantics, images and local/production boundary: docs/workflow-post-now-and-time-pickers-2026-10-26.md. Hosted sign-in still prevents acceptance; no deployment or real post. UGC-SCH-001/007 remain production-open.


## 2026-10-26 Middle-frame full-source prompt drafts; rollout held

- Reconciled 21 public and ten private later-frame cases by stable ID/source SHA and selected anchor metadata. Source review evidence covers118 native contact sheets/3,110frames at contact-sheet resolution with targeted larger opening/anchor/transition checks. This is not a written semantic annotation of every frame.
- Drafted separate reconstructed-t=0 image and concise full-source timed video prompts for all31 cases using the Hook100 structure. Later clarity frames remain preparation evidence only; source t=0 composition is reconstructed before literal FIRST_FRAME animation. Original creator text is removed at image preparation, and exact editable overlay copy remains separate.
- The offline compiler validates full contiguous source coverage, retains exact source/generated time mapping, renders compact timecodes and accepts integer3–10-second output durations for the reviewed pilot provider. Proposed per-source whole-second durations are authoring examples, not changed application defaults. Hook12 has a separately prepared exact3-second pilot prompt.
- Full-resolution Hook12 review revealed a thin drink trickle omitted in the thumbnail draft; corrected the draft and logged UGC-VID-012 OPEN. The source begins sipping behind the mug, lowers it, reacts and retains the mug/trickle through the ending.
- User explicitly chose to finish prompt drafts without paid generation after automatic approval review rejected the provider preflight. No image/video create was submitted; no actual generated starting image or video exists for this pilot. Offline input hash/role validation and ten compiler/coverage tests pass.
- All31 drafts remain NOT TESTED for generated-output quality and are not activated. No application generation routes, source manifests, user edits/frozen requests, UI, scheduling, database, storage or deployment changed in this phase. Pilot image approval then complete video-frame comparison remain prerequisites to rollout.
- Readable prompts: docs/prompt-reviews/middle-frame-full-recreation-drafts-2026-10-26.md. Full receipt: docs/middle-frame-prompt-rewrite-receipt-2026-10-26.md.


## 2026-10-26 User correction: one Post now action, no timing-mode sections

User rejects the separate Post now/Schedule for later sections shown in the previous local screenshot. Supersedes that UI decision: remove mode groups/cards and automatic-time explanation. Default final Post now action resolves the time at confirmation. Retain original24-hour/manual controls without extra mode selection; explicit manual edits use exact scheduling, untouched empty Explore forms post automatically. Main review defaults automatic, existing edits remain manual. Server lead/idempotency/account/target policy unchanged.

UGC-UI-013 records the unnecessary UI addition and correction. Focused126/126, build/types/lint and three desktop/mobile suites pass; broad rerun pending at this entry. Full files/evidence: docs/post-now-simple-ui-2026-10-26.md. No deployment or hosted publishing acceptance.

- Final local gate for the simplified Post now correction: broad Explore1,285/1,285 and all focused/browser/static/build checks pass. See docs/post-now-simple-ui-2026-10-26.md. Authenticated hosted acceptance remains unavailable; no deployment.


## 2026-10-26 Talking Head Create duplicate-heading cleanup

User requests removing the redundant visible Talking head video heading beneath Create. Only this caller opts into hideHeading on WorkflowVideoSourceSection; its h2 remains screen-reader-only to preserve the section/source accessible name. Generate/Upload/Creative Assets, other workflow headings and all state logic unchanged. Six source-control tests and full desktop/mobile workflow fixture pass, TypeScript/scoped lint pass. Local Next dev started at127.0.0.1:3000; local preview path /explore/create-hook?preview=1. No deployment or production acceptance claim.


## 2026-10-26 Assign all31 middle-frame prompts to runtime references (local implementation)

- The user explicitly requests assigning the31 reviewed drafts to their respective videos for generation. This supersedes the prior draft-only activation hold; the separate choice not to run paid generation remains in force. No provider inference or deployment is authorized by this code assignment.
- Public21 assignments live in lib/explore/hook-middle-frame-public.json, resolved by stable reference ID, exact source SHA and clarity index/hash/time. Private10 assignments use a separately read server-only creator-middle-frame-prompts.json package; plaintext is ignored and production must contain authenticated ciphertext prepared with the existing package key. No private prompt prose enters the public/browser catalogue.
- Both still and motion stages are assigned. New preparations resolve original t=0 scene pixels separately from the stored later clarity anchor, generate an influencer t=0 image, and persist both roles in v4 receipts. Source0 remains opening authority; influencer photos remain identity authority. Hook100 accepted receipt metadata and v1-v3 history remain recoverable.
- Motion directions retain source-specific actions/holds/endings using normalized phase boundaries; final provider assembly maps the entire sequence to the actual selected duration. Explicit user text remains selected instead of a catalogue overwrite. Empty custom text remains an explicit edit. Existing older images use their selected-pose continuation defaults. A normalized full-source timeline paired with a pre-v4 image is rejected before billing, retaining that image and edits.
- Private opening+clarity inputs use distinct signed private URLs, freshly signed before provider submission in both durable and ordinary worker branches. Neither source image is uploaded publicly. Exact input order and stale-source rejection are tested.
- Existing public frame-preparation scripts now include all21 assigned later-frame references through the expanded full-recreation lookup. Hosted original-t0 objects still need preparation/verification during deployment; no production storage writes occurred here. The local package key is unavailable, so new private ciphertext has not been generated; release remains incomplete until packaging is performed with the existing key. Missing new private package does not break unrelated galleries; full-recreation preparation fails closed rather than animating a later pose with t=0 directions.
- Local coverage:84 preparation/history/source/receipt tests,69 motion/component/model tests (overlapping groups),40 video-admission tests,17 worker/role tests,10 authoring tests; all pass. Worker build, TypeScript and scoped lint pass. Actual-component browser journeys pass Hook/TalkingHead/Wall at1440,1280,390,320 widths with fixture boundaries. Generated fidelity and authenticated production acceptance remain NOT TESTED. Full receipt: docs/middle-frame-runtime-assignment-2026-10-26.md.

- Final runtime-assignment build follow-up: production webpack build completed compilation, TypeScript, static generation and tracing (exit0). Initial disk/cache and test-only TypeScript failures were corrected; no source/media was removed. Local build success does not qualify generated output or deployed private-package/storage readiness.


## 2026-10-26 Device-default clock display (explicit user approval)

Supersedes forced24-hour presentation: both shared WorkflowTimePicker and main Scheduling rail picker derive12/24-hour preference from browser/device locale after hydration.12-hour UI has AM/PM; canonical values remain HH:mm. No extra preference controls or now/later sections. Quick-time labels, manual summaries and clock hints follow the same display. Existing Post now5-minute rendering lead, conversion, durable requests and targets unchanged.

Unit/component/local DB and desktop/mobile en-US/en-GB picker checks pass at this entry; broad/build final rerun pending. Full receipt: docs/device-time-format-2026-10-26.md. UGC-SCH-008 tracks this user-requested preference change; no generation or social publishing submitted.

- Final device-format local gate: focused119/119, broad1,285/1,285, final build/types/lint and en-US/en-GB desktop/mobile browser checks PASS. Local Next3000 and ready-video fixture3107 refreshed. Five-minute Post now policy unchanged; docs/device-time-format-2026-10-26.md is final receipt. No deployment or provider mutation.


## 2026-10-26 Consistent quick publish-time actions (local)

User reports missing In1hour/In3hours on current preview. Shared platform modal had those controls but main Scheduling, Explore shared form and Trending Hook drawer did not. Added a compact shared two-button row near date/time on missing surfaces, with no heading or now/later modes. Buttons resolve from click-time Date.now in selected IANA timezone, round up to supported minute precision and update the existing manual draft; they never submit. Existing modal quick action now also uses the click clock rather than last render time. Post now5-minute default and locale12/24-hour display unchanged.

Focused56/56 (including selected-zone midnight/DST), types/lint and actual desktop/mobile quick-action browser checks pass at this entry; broad/build pending. Local ready-video fixture3107 refreshed. Details/files/tests: docs/quick-publish-actions-2026-10-26.md. UGC-SCH-009 locally implemented; no production post or deployment.


## 2026-10-26 Quick presets clarified:5mins/1hour/3hours/Tomorrow9AM

User replaces interrupted30mins proposal with5mins. Exactly four compact rounded pills shared by all publishing forms, including platform modal, in one nonwrapping row. Internal horizontal scrolling at narrow widths preserves row/page geometry. Tomorrow uses selected-zone next calendar date09:00 and device-format label. All clicks fill the draft only; Post now five-minute lead unchanged. Explicit single callback preserves both date/time in platform modal. Focused106/106, types/lint and laptop/mobile browser checks pass including1280 and320 widths; final broad/build pending. Full receipt docs/quick-publish-actions-2026-10-26.md.

- Final four-pill quick-time gate PASS:106 focused,1,285 Explore, build/types/lint, responsive browser suites and live local DOM inspection. No wrapping at1536/1366/1280/390/320px; internal scroll on narrow widths. Preview3107 and app3000 remain local. No production post/deployment.


## 2026-10-26 Quick schedule caption
User approves small Quick schedule label above preset pills. Shared ScheduleQuickActions adds only that text-xs muted caption; all four pills remain one row and timing/click behavior unchanged. Actual local DOM confirms label above group, exact four options and nowrap. Scoped lint/types/diff checks pass. Local preview3107 refreshed; no deployment.


## 2026-10-26 Private prompt package and hosted t=0 preparation completed; normal prompt quality audited

- User requests completing private package and stored original openings, then checking ordinary frame-zero prompt quality using ugc-opening-frame-prompt. No paid generation requested.
- Existing private package key retrieved narrowly after user restored Vercel CLI access. Prepared only creator-middle-frame-prompts.json.enc (ten entries,37,370bytes), roundtrip verified and all10 assignments resolved through the real production private-package reader. Key matched existing package; no key rotation, secret file or production setting write.
- All104 active public source videos now have hash-verified originalt0 PNG/index objects in the existing GCS bucket:21 missing pairs created,83 existing verified,104read back matching local decoded PNG hashes. Create-only writes, pointer published last, no overwrite/private upload. The site/worker code was not deployed. Vercel sensitive GCS credential was not exportable and was not extracted; used existing active CloudCLI identity without IAM changes.
- Added reusable local preparation/verification script scripts/prepare-reviewed-hook-t0-frames.mjs and offline normal prompt audit script. All104 local frame reads verify without decoding; source-frame-store/assignment9tests and negative/evidence/audit3tests pass. Existing secret/environment and user media files preserved.
- Ordinary audit covers83 public+2 private current source-bound plans;85compile at3/4/8/10s, manual edits remain selected, source hashes match. None has a numeric motion timeline;78public historical static-reviewed and5needs-decision. Fresh11-source review covers46native sheets/1,148frames plus3fullresolution openings. This is not all85fresh visual review or successful generation.
- Primary quality gap is under-specified pacing/holds plus source-specific ending/expression details. Existing Hook22/51/57/72/83 decisions retained. Private1-04/1-05 generic prompts miss lip/brow phases. No normal runtime prompt rewritten/activated here;3source-reviewed timed examples saved separately. UGC-VID-013 remains OPEN; generated fidelity and production acceptance remain NOT TESTED.
- Full audit and completion receipt: docs/prompt-reviews/normal-opening-prompt-quality-audit-2026-10-26.md; sanitized hosted/private evidence: docs/prompt-reviews/frame-and-private-package-preparation-2026-10-26.json. These completed preparations supersede the earlier package/storage-pending notes, but not the separate deployment/fidelity gates.

## 2026-10-26 Starting-frame photographic naturalness audit recurrence

- User requests an audit/discussion because regenerated influencer starting frames can lose the selected source's natural photographic appearance despite a broadly matching pose. UGC-VID-014 links UGC-VID-004/006; provider-internal cause remains UNKNOWN.
- Inspected normal v4 versus full-recreation v5 prompt routing, Gemini reference/request controls, worker normalization and provenance checks. Visually reviewed existing Hook 100 caption-v2 source, identity, raw generated and normalized stills. Broad scene/gesture retained; framing and glasses-to-face geometry approximate; fine skin rendering differs. This is qualitative saved-output evidence, not a new model trial or production check.
- Proposed discussion contract separates source pose/scene/camera/photographic rendering from influencer identity/intrinsic skin characteristics. No runtime decision or default changed. A repeated controlled prompt comparison should precede changes; no guarantee of pixel preservation from prompt text, and no paid generation submitted.
- Receipt: docs/starting-frame-realism-audit-2026-10-26.md. Existing worktree changes preserved; only report and append-only memory entries added.

## 2026-10-26 Isolated normal Hook 02 pilot prepared
User requests one normal-case pilot before broader rollout. Hook 02 exact source f1f7b5ed3d54066e857a354ea2ae735d67c8066b7fc7ff0406831b8418e03a7d reviewed across91 native frames and four contact sheets plus full-resolution boundaries. Actual ffprobe frame PTS and3.066992s source duration mapped contiguously to3s. Source/identity/stored t0 hashes verified; separate image/video prompts and staged acceptance plan prepared in docs/prompt-reviews/hook02-normal-pilot-plan-2026-10-26.md. No runtime prompt assignment, paid generation, model-default change or deployment. Earlier no-paid instruction requires a new user decision before the proposed image then conditional video test. UGC-VID-013 remains OPEN; generated fidelity NOT TESTED.

## 2026-10-26 Hook 02 approved normal pilot stopped on provider rejection
User approved one image and conditional video. Google model lookup succeeded; canonical source/t0/identity/prompt hashes verified. Exactly one Gemini3Pro2K image submission returned HTTP400 safety violations; no output or operation ID returned. No automatic paid retry and zero video submissions. Triggering input and actual billing are unknown. No normal prompt rollout, application change or deployment. UGC-VID-015 records rejection; UGC-VID-013 quality remains OPEN. Receipt:docs/prompt-reviews/hook02-normal-pilot-result-2026-10-26.md.

## 2026-10-26 Hook 02 diagnostics and controlled test prepared
Read official Gemini3ProImage/Interactions/safety docs and installedSDK2.10.0 runtime. Confirmed previous pilot logger preserved only error.message; raw rejection detail cannot be recovered from its receipt without operationID. Live modelGET version3.0 input131072 differs from docs65536; do not assume exact per-route settings from general schema. Offline transport400 check confirms structured error code/requestID capture; never log SDK httpMeta request headers. Six-case manifest freezes model/format/safety defaults and separates service control, source-only, identity-only, pair, full prompt and role labels. C5 recreates frozen request hash. No generation run; new paid decision required. No runtime/config/prompt rollout. Full report docs/prompt-reviews/hook02-diagnostics-and-controlled-test-2026-10-26.md; UGC-VID-015 remains OPEN.


## 2026-10-26 Hook 02 controlled diagnostics, Hook 01 visual rejection, and Hook 01 identity-v2 preparation
- Hook 02 three-condition neutral prompt diagnostic completed earlier: source-only and source+portrait rejected with HTTP 400 safety violations (unspecified reason); influencer portrait alone succeeded (`docs/prompt-reviews/hook02-controlled-diagnostic-results-2026-10-26.json`). Exact Hook 02 source trigger remains unknown.
- Alternate normal pilot Hook 01 (`explore-paired-hook-4585ee949081c4e5cd835cd3`) completed 1 Gemini 3 Pro 2K image (`v1_ChdZaFBmYXJhVUpOUzU2OTRQeEltb29BMBIXWWhQZmFyYVVKTlM1Njk0UHhJbW9vQTA`) with verified input hashes and zero video calls. Formal visual inspection recorded in `outputs/hook01-normal-pilot-2026-10-26/image-visual-review.json`: caption removal, scene/camera, opening pose, and low hands PASS, but identity fidelity FAILS (face retains source performer's jet-black hair, arched dark brows, winged liner, dark brown eyes, blush, lip liner and necklace instead of the selected influencer).
- Code comparison shows the first Hook 01 pilot script bypassed `buildHookKeyframeImagePrompt` (v4) and `hookKeyframeProviderImageLabels` (v4), sending a custom scene-first prompt that anchored on editing Image 1.
- Prepared one offline-verified controlled revision (`outputs/hook01-normal-pilot-2026-10-26/identity-v2/preparation-receipt.json` and `docs/prompt-reviews/hook01-normal-pilot-image-prompt-v2-2026-10-26.txt`) keeping source t=0 bytes, influencer portrait bytes, image order, `gemini-3-pro-image`, `2K`, `9:16` and safety defaults identical, changing only the instruction strategy to the `v4` influencer-first builder/labels (`IMAGE 1 — VISUAL_REFERENCE`, `IMAGE 2 — MY_INFLUENCER`) with influencer-agnostic source-face/makeup exclusion and exact two-line caption removal. Zero paid calls submitted in this preparation; UGC-VID-013/014/015/016 remain OPEN.

## 2026-10-26 Hook01 identity-v2 image and single-frame3s video real test
One frozen identity-focused instruction package image completed on Gemini3Pro2K with exact source/identity bytes and preserved original Attempt1. Visual identity/clean-caption/scene/opening gate passes this sample, with approximate framing and explicitly excluded source necklace. One conditional GeminiOmni3s720p video uses only approved starting image, no extra portraits or ending image. Retained provider roles/hashes/full prompts verified. All72generated frames reviewed through3native+6paired sheets; source91frames previously reviewed. Long opening hold,hand-cover sequence,identity and scene continuity pass; early blink absent and timings approximate. Final camera/edge crop fails to match source; reaching hand withdraws. PARTIAL PASS, no rollout. One image+one video submission, no automatic retry, no app/worker/UI/schedule/default edit or deploy. Evidence docs/prompt-reviews/hook01-identity-v2-test-results-2026-10-26.md; local comparison video outputs/hook01-normal-pilot-2026-10-26/identity-v2/source-comparison/source-vs-generated-3s.mp4. UGC-VID-013 remainsOPEN;016 has one successful candidate sample only.

## 2026-10-26 Source-to-prompt completeness audit preparation
User requests checking written prompts against source frames across normal/middle cases after Hook01 phonehandling/shake omission. Prepared Hook01 camera-v2 draft preserving0–3s timing/earlyhold but explicitly describing maintained offscreen phonegrip,desk-to-handheld shake,physicalapproach and finaledgecrop. Inferred phonepickup labelled as such in evidence. Draft untested,no runtime assignment.116reference register(85normal31middle) with1confirmedgapdraft,10priornormalfindings to revisit,105pending this specific pass; not a claim of full visual audit. Prior middle reviews remain evidence,not automatic completeness acceptance. Protocol docs/prompt-reviews/source-to-prompt-completeness-review-2026-10-26.md. No provider calls,deploy or application edits. UGC-VID-013 remainsOPEN.

## 2026-10-26 Hook01 camera-v2 prompt-only video test
User requests exact revised prompt and1video comparison. Kept accepted image,Omni model,3s720p9:16,singleFIRST_FRAME fixed. Only motionwording changed; explicitlyinferred phonehandling,handheldshake and finaloffedgecrop. Providerretained inputverified.72frames reviewed; shake/blur/tilt and faceoutsideedge nowappear,earlier action intact. Sourcecamera timing/path/scale stilldiffer:IMPROVED PARTIAL PASS,notrollout.0newimages1video0automaticretry. Priorreceipts preserved,no applicationedit/deploy. Compare source/previous/revised in outputs/hook01-normal-pilot-2026-10-26/identity-v2/camera-v2/source-comparison/source-previous-revised-3s.mp4. Report docs/prompt-reviews/hook01-camera-v2-test-results-2026-10-26.md;UGC-VID-013OPEN.

## 2026-10-26 Source prompt completeness batch01
Freshsourceframe review387frames15sheets4fullresolution checks:Hook72,Hook99,middleHook12. Normal99draft adds source-measured hold/blink/release/cameraphases;72draft retains repetitions and finalupwardtilt/lowleftcrop,needsdecisiongateunchanged.12sourcefulltimeline alreadyadequate,no newcontentgap,clarity36/1.2s stays separatefromt0. Actual compiler tested,draftsnotassigned. Currentregister4specificreviewsincludingHook01,112remain;notfullauditcompleted. Newgeneration0,runtimechanges0. Report docs/prompt-reviews/completeness-batch-01-2026-10-26.md.

## 2026-10-26 Cal.com onboarding and historical Hook compatibility hotfix

URL onboarding accepts a hostname-shaped business name only when scraped visible title/body text explicitly supports that brand; URL/link-target/email/lookalike matches remain insufficient. Summary/audience requirements, saved-source ownership/revision fencing, retries, and manual entry remain unchanged. Evidence stays server-local. The historical v3 Gemini3Pro model restriction was already corrected in active worker45bf657b; the exact1.7s receipt/model regression is now explicit. Only the website hotfix is being staged from production source adbfe498; today's unrelated local UI/prompt/scheduling changes are not part of this release. Tests and production acceptance must remain distinct. Receipt: docs/onboarding-domain-brand-hotfix-2026-10-26.md; incidents UGC-OPS-007 / UGC-VID-017.


### 26October2026 — source-to-prompt completeness audit progress
27/116reference-specific reviews completed;89remain.19corrected or timing-specific drafts,8no-new-substantive-gap. Source-confirmed prop/gesture corrections include headphone earcup gripHook11, BOTHpalms mouth coverHook20 and still-held glasses during mouth coverHook22 (UGC-VID-018); Hook15 deliberate cut and late crop must remain explicit. Camera/gesture wording is source-specific, never copied globally from Hook01. Consolidated audit: docs/prompt-reviews/source-to-prompt-audit-progress-2026-10-26.md and reviewed-prompt-candidates-2026-10-26.json. Drafts compiled, no runtime activation or new paid generation. Generated visual acceptance remains NOT TESTED except historical Hook01 improvedpartial. Parallel next batches hit usage limits and are not counted as reviewed.


### 26October2026 — prompt completeness continuation47/116
Added20normalreviews,1626nativeframes/63sheets29fullreschecks. Hook102endinggazereturncorrected;Hook103cameraapproachretainedandwobble/tailmadeexplicit;other18sourceactionsalreadycovered,timingrefined. New shortsourcecandidatesholdfinalposeafteroriginalelapsedactiontofinish3s;longercasesretainfulltimelineunderdeclaredretiming. Register47reviewed/69pending. DraftcompilationPASS,no runtimeactivation/paidcall/UI/schedulingchange;generatedadherenceNOTTESTED. See docs/prompt-reviews/source-to-prompt-audit-progress-2026-10-26.md.


### 26October2026 — prompt completeness continuation60/116
Added13middle reviews:12public retain source-covered actions,1private has source-visible ending framing correction stored only in ignored private draft.1325native thumbnails/49sheets27fullreschecks; original hashes/framecounts/PTS endpoints and actual prompt compilation PASS. Current60reviewed56pending; not full audit or generated acceptance. Short-source final holds and Hook85duration decision gate explicit. No application edits/provider calls/runtime activation/deployment. See docs/prompt-reviews/source-to-prompt-audit-progress-2026-10-26.md; UGC-VID-013/019 remainOPEN.


### 26October2026 — full116reference source-to-prompt audit drafts
Remaining56reviewed:5292decoded thumbnails206sheets63targeted fullreschecks. All116source comparisons complete (85normal31middle104public12private);31correction-drafted statuses85no-new-gap,not116generated passes. New public corrections40stylus,42tailgaze,45smalltrickle,75endinglips,78openinggaze,90finalcrop/lips. Private details remain ignored. Complete source chronology, t0 animation opening and later clarity-only evidence preserved. Actual compiler/hash/frame-count checks PASS; no runtime assignment, UI/scheduling edits, encrypted-package replacement or new generation. Long-source3s candidates remain pacing decisions. Receipt docs/prompt-reviews/source-to-prompt-completion-receipt-2026-10-26.md. UGC-VID-013/019 remainOPEN.

## 2026-10-26 Free tools hub and Batch 2 requests (local)

- Landing nav now Free tools / Guide / Pricing; Guide keeps /guides. Public
  /free-tools offers the unlimited110-hook PDF and the existing104-video ZIP.
  Same100-start Batch1 counter/key/archive; no sign-in/email required to download.
- Closed UI/API says Batch1 fully downloaded, wait for Batch2. Optional explicit
  Batch2-only email consent saves privately through a rate-limited server endpoint;
  no email sent. New RLS migration required before live signup. Do not reset Batch1
  to release Batch2; use a separate approved collection/counter.
- Local tests/fixtures are distinct from hosted acceptance. No deployment or live
  migration/counter claim. Receipt: docs/free-tools-implementation-2026-10-26.md.


### 26 October 2026 — reusable source/prompt audit process
The durable runbook is docs/prompt-reviews/REPEATABLE_SOURCE_PROMPT_REVIEW.md. It records the Hook01 controlled comparison, all116source-review completion, normal versus middle-clarity/t0 roles, complete-frame contact sheets plus targeted full-resolution review, evidence-to-prompt interval mapping, timing policy, per-ID/hash draft validation, private artifact retention, controlled output testing and separate runtime/deployment acceptance. Read this guide when repeating the work. Current restart point: source review complete; revised audit candidates are not live assignments and need generated acceptance. Do not repeat the inventory or claim116generated passes. Existing incident history remains unchanged.


### 26October2026 — Hook04 controlled pilot blocked before image review
User replaced already-testedHook01 with another corrected case;Hook04 chosen. Source92thumbnails/4sheets and original t0 inspected. Frozen normal-v4 image prompt source+same identity, corrected3s motion draft unchanged. Exact-model read-only metadata PASS after network access; single image POST returnedHTTP402 with no usable reason. One image attempt,zero video attempts,no returned image/operation; no auto retry,live assignment or deployment. Starting-image/video/output QA NOTTESTED. Report docs/prompt-reviews/hook04-corrected-pilot-results-2026-10-26.md. Resume after provider billing/access restored and one fresh image retry authorized; never reuse source performer as approved influencer image.


## 2026-10-27 Talking Head full-reference additions (local; not live)
Eleven supplied videos added to separate Talking Head catalogue. Explicit user request replaces three short discovery cards with full48.500s/42.027s/43.838s originals from folders24,25/4,37, overriding fullvideo_ignore exclusion only for those files. Stable -full IDs retain old nine catalogue/source/frame bindings and saved recovery.23 archival entries/18 visible; two fact-check cards remain hidden. Same card layout, source links/platform and t0 PNG bindings; one HEVC source converted to H264 without trimming.49 focused tests/types/lint/integrity/full decode pass. Expanded browser approval and deployment unavailable; content is NOT LIVE. Receipt:docs/talking-head-reference-import-2026-10-27.md.

## 2026-10-27 Five-minute shortcut resolves at final confirmation

User explicitly requests that only the5mins shortcut calculate its actual time from final submission, retaining exact manual scheduling and all existing UI. Supersedes the earlier quick-pills entry that treated5mins as an absolute shortcut-click time. The shared callback now carries the chosen preset. Explore records fiveMinutesFromSubmit only in its unsent draft (round-trip validated); selecting another preset or manually editing either date/time clears it. Caption/account changes preserve it. Main Scheduling, Trending Hook and shared platform modal retain the same intent in component state. Displayed fields remain the click-time preview; final button labels, controls and styling remain unchanged.

At submission, reuse existing useDefaultScheduleTime/server-owned configured lead calculation (default5minutes), including whole-minute rounding. Never bypass a configured lead, alter provider settings, or recalculate an already saved scheduling receipt on retry. Existing Post now semantics and exact manual-time validation remain intact. No API/schema/queue/worker changes.

Demo picker empty wording now points to the Demo screen's existing upload flow: No ready demos yet. Upload a video on the Demo screen, then choose it here. No new upload control.

Incidents UGC-SCH-010 and UGC-UI-016; local evidence and file inventory: docs/five-minute-submit-fix-2026-10-27.md. Production acceptance is separate; no deployment or live publication in this task.


### 27October2026 — notbeen2 source review and staged Hook import
User supplied D:/hookswithlinks/notbeen2,10sets. Applied docs/prompt-reviews/REPEATABLE_SOURCE_PROMPT_REVIEW.md; all1260decoded thumbnails47sheets plus21original-resolution checks inspected. Ten normal t0 routes drafted with actual image/motion builders. User approved default hook_audio_006forfolder8(noMP3) and opening reaction only forfolder10. Folder10original371frames preserved; separate119frame lossless/silent derivative stops before first demo frame119at3.966667s; later demo/bookend not part of retained Hook. All stagedvideo/source hashes and trim/previewdecodedpixels PASS; source D:files unchanged. Local49assetstage with fullsource links/music/storedt0/prompts. Report docs/prompt-reviews/notbeen2-2026-10-27/README.md; packageJSON beside it. NOT active catalogue,uploaded,deployed or generated-tested. No paid calls. Sets4/7long3scompression need pacing decisions; other3scandidates also untested. Prior116register stays unchanged; do not merge new10into old completeness counts.

- Final local five-minute/Demo gate:124focused,63service/localDB, fullExplore1,287/1,287 zero skips, three browser suites, types/lint/diff and production webpack/native bundlesPASS. Overlapping test counts are not additive. Sandboxed Turbopack build stalled; webpack completed exit0. Three unrelated obsolete UI source assertions remain documented separately. No deployment/live publishing; docs/five-minute-submit-fix-2026-10-27.md is final receipt.


## 2026-10-27 Talking Head reference release deployed
Targeted source basec630c66f plus11new references/3full replacements deployed as dpl_B6HT7nNDKy5HXq6ETmk7gY48Fnno and promoted to production.18visible/23archival; old short IDs/media retained. Narrow prepared-t0 reader/hash checks and PNG route tracing included, other Hook paths preserved. All14live MP4 SHA/byte counts, posters and206range checks PASS; hosted build/native checks and isolated5tests PASS. Browser control disabled/unresponsive: signed-in gallery playback/visual acceptance NOT VERIFIED. No unrelated worktree release/worker/migration/provider calls. Receipt:docs/talking-head-live-release-2026-10-27.md; exact file hashes:docs/talking-head-live-release-manifest-2026-10-27.json.


## 2026-10-27 Investing & Money Wall reference batch (media verified; local application only)

- User supplied six MP4/MP3/source-link folders under `D:/wotwithlinks/notbeen_investing and money category` and explicitly requested a visible **Investing & Money** category. This uses the existing Wall category Filter menu in both galleries; no permanent control or layout redesign.
- Separate additive `explore-wall-money-reference-release.json` joins the paired-reference resolver only after media publication. Stable IDs bind the original video and supplied MP3 hashes. Source links retain supplied TikTok URLs. Trending Wall backgrounds and their six-second minimum are unrelated and unchanged.
- All 1,100 decoded thumbnails across 20 contact sheets plus 25 native-resolution frames reviewed through all endings. Original PTS retained. Six source-hash-bound timed motion suggestions use the original opening, preserve source-specific restrained acting/camera/final poses and map complete phases proportionally to the chosen duration. The existing four-second default remains: compression is explicit, not a claim of real-time fidelity. Saved user edits win; other Wall references retain their generic directions. Hook and Talking Head routes remain unchanged.
- Captions are manually reviewed source records for Remix, with original wording/line breaks and full-video visibility. Financial source claims are not independently verified. Footage prompts remove creator-added captions while preserving physical garment print. Clip4 lower-face motion remains unknown behind its baked caption; no exact lip sequence invented. No influencer image or generated output was tested.
- Twenty-four immutable objects uploaded using the existing gcloud CLI account after the unrelated ADC account lacked permission. Stored size/type/SHA and public-byte readback passed. All1,100 source/paired-preview decoded pictures match. No IAM/config/login change. Local catalogue now268 references; all262 pre-existing serialized records preserved.
- New source/category/prompt/audio checks4/4 plus existing focused checks35/35 pass. TypeScript/lint and worker build pass. Production FilterMenu/cards/dialog exercised in a local fixture at1280x720 and390x844: six filtered cards,New badges,selection,preview open/close,clear and no horizontal overflow. Fixture shell/auth/private-preview isolation is disclosed; it is not production acceptance.
- Website and worker NOT DEPLOYED. No paid generation or publishing. User-facing production category/Recreate acceptance NOT VERIFIED. Before runtime rollout review source-specific outputs with an approved caption-free original-opening image. Do not infer fidelity from storage or compiler results.
- Evidence: `docs/prompt-reviews/wall-money-reference-review-2026-10-27.md`, source manifest and completion receipt; `.tmp/wall-money-review-2026-10-26/` retains frames,baselines,storage/pixel receipts and browser screenshots. UGC-VID-020 records preview-field propagation caught by integration testing.


### 27October2026 — notbeen2 assets uploaded to backend
User explicitly requested backend addition. Existing appADCfailed403serviceusage.services.use; existing authorizedgcloudCLIidentity confirmed firstasset404and uploadedmissingobjects withoutIAM/billingchanges. All51objects remotelyhash/metadata/publicHEADverified:49media inclstoredt0plus sanitizedpromptpackage/index. PublicpackageGET/SHA and10source/frame/promptjoins PASS,no localpaths. Folder8defaultmusic/folder10opening119framecopy preserved. Storageavailable,NOTactivecards/runtimepromptassignmentsorwebsite/workerdeployment; generatedadherenceNOTTESTED. Receipt docs/prompt-reviews/notbeen2-2026-10-27/backend-upload-receipt.md. Backend source links/IDs ready for integration; old116register unchanged.


## 2026-10-27 Talking Head audited request and caption fixes
Generation submission now bounds each auth wait and POST+body acknowledgement to30s, retaining exact paid request identity/receipt and enabling explicit recovery after timeout; background job runtime is unchanged. No automatic POST retry. Caption evidence and correction invalidation depend on speech composition (IDs/trims/audio), excluding visual overlay text/styles; final rendering still receives the complete visual composition.118focused primary/release tests PASS; broader primary Explore1289PASS/2unrelated Wall catalogue failures, both pass on isolated release. Hosted staged build and14referencehashes PASS; live/provider acceptance separately recorded in docs/talking-head-audit-fixes-2026-10-27.md. UGC-UI-017/UGC-OPS-008 remain open for fresh authenticated acceptance.


## 2026-10-27 Centered Talking Head resume prompt
The ambiguous-old-link ask state in WorkflowDraftEntryBoundary now uses a compact centered card with existing Resume previous work, Start new video and Back to Explore actions. No modal trapping or extra controls. Mobile layout reserves64px header; short landscape scrolls safely. Draft effects/storage/IDs/URLs, loading/error states and Saved drafts list unchanged.13lifecycle/sessiontests and five-size real-component browser fixture PASS, including existing recovery choices/keyboard order. Hosted staged build PASS. UGC-UI-019; live acceptance in docs/resume-work-prompt-ui-2026-10-27.md.

Resume prompt live follow-up2026-10-27: dpl_7RCmDsbfGBjZsX8E3M78p15keGgE promoted; actual production desktop/mobile centered card and keyboard order verified. Existing old-work URL now shows new UI. No production Resume/Start click or paid action. Receipt docs/resume-work-prompt-ui-2026-10-27.md.

## 2026-10-27 Proxima Nova A Semibold in workflow video editing (local)

- User approved the supplied Proxima Nova A Semibold archive. New shared Hook,
  Wall-of-Text and Talking Head/demo video overlays use that face at Semibold600.
  Existing white color, outline8, size, position and controls remain. Saved edits
  retain explicit or legacy typography; no draft migration or mass restyling.
- Bundle original WOFF2/TTF bytes and measured advances; expose only the supplied
  Semibold weight. Native export uses exact glyph outlines. Preserve the font
  notice separately; do not mislabel this face as OFL. Existing OFL preparation
  retains the imported face. Carousel choices and separate slideshow typography
  remain unchanged.
- Local verification: worker build, TypeScript, scoped lint, 11font tests and
  53related editor/automatic Hook/Carousel tests PASS, including real MP4 glyph
  and outline pixel checks. Actual exported frame inspected. Desktop/mobile
  browser and hosted acceptance remain NOT VERIFIED (browser access disabled).
  No deployment. Receipt: docs/workflow-proxima-font-2026-10-27.md.


## 2026-10-27 Core workflow audit - production versus contract evidence
Website dpl_7RCmDsbfGBjZsX8E3M78p15keGgE and generation worker45bf657be7624aa2b0de6f95f3d19cb049feddd0 verified; four critical adapters match tested source. Omni uploaded-audio references are blocked by client/API; actual live valid-prompt+silent-audio case leaves Generate disabled. Picker still allows unsupported local attachment (UGC-UI-028, UX gap). Seedance/WAN ordered image/video/audio wire fields and special starting-frame/edit rules verified by tests, not fresh paid acceptance. Existing7Explorepublications have target/scheduler/completedjob/provider IDs. UGC-SCH-006 retryRPC remains old and blocks restored connection; local fix4/4PASS not deployed. Historical Seedance collection record remains unpersisted; known exact-host fix active. No recent audio-reference or Kling production jobs. Broader UI fixtures not fully green. No new code/deployment/publication. Receipt docs/core-workflow-audit-2026-10-27.md.

## 2026-10-27 Sign-in entry and Recreate recovery update
Ordinary verified email/Google sign-in now targets /explore; explicit paid-plan checkout and OAuth consent retain their destinations. Recreate warms the starting-frame code on pointer/keyboard intent. Recent account-scoped photos may populate an untouched empty preparation; explicit photo choices/clears, saved requests, generated images and approvals take priority. Photo IDs are resolved through owned APIs before display. Missing uncertain starting-image receipts recover through slow read-only status polling; no replacement generation is submitted. User screenshot job completed with a ready matching media record; the screenshot-specific pending-state cause remains unproven. Incidents UGC-UI-035/036 and UGC-VID-021; production acceptance remains pending.


## 2026-10-27 Failed creator starting-frame retry (local verification)
UGC-UI-038: original-frame creator preparations (v2) must not be treated as obsolete merely because they have a saved image request. Retain the earlier-source gate only when a curated replacement actually exists. Failed/cancelled terminal jobs allow deliberate same-source regeneration with fresh request identity and model selection; running/uncertain requests still block duplicate submissions. Provider402diagnostics now describe failure/retry without exposing httpMeta or inventing credit/refund explanations. Reproduced before/after at1440/390 including reopen;64focused+25API/clienttests,types/lintPASS. No paid inference or deployment; provider402root cause and authenticated production retry acceptance NOT VERIFIED. Receipt docs/starting-frame-retry-fix-2026-10-27.md.

## 2026-10-27 Slideshow generation admission and return recovery (local)

- Latest production plan e4c021d8-3700-4318-8eb8-e0de3253b800 at17:51:29IST saved a clarification about UploadB's destination and zero slides. The saved request links the website screenshot to slide5's replacement laptop; no new slideshow image jobs exist for this attempt. Saved-plan completed is not generated-image completion.
- User supersedes25October's two permanent finished-slide shortcuts: remove them from Create and Your slides; retain Add slides → Use my finished slides and existing reference uploads/fitting.
- Owner-scoped slideshow job hints now restore completed results after clean-route return/reload. Planning clarifications persist even though no job exists. Recovery opens generated results once; deliberate Your Slides/Edit/Library navigation remains authoritative. Recovered history cannot auto-replace the edited sequence, including cached processing receipts; only the mounted visit's explicit submission can auto-assemble. New session clears only slideshow hints/URL.
- Planner revision3 resolves a screenshot linked to a named slide's replacement device; genuine competing destinations still clarify. Old durable plans remain immutable. Per-slide scene/person/screenshot roles, business grounding, credit admission and queues remain intact.
- Local combined204tests, actual-panel recovery fixture, responsive picker and editor/upload/save/touch fixtures PASS. Production browser redirects to sign-in. No deployment or new image generation. Live planner replay was rejected before execution by automatic approval review for missing explicit permission to send the saved private input/images to OpenAI; no bypass. Actual planner/image fidelity remains NOTVERIFIED.
- Incidents UGC-UI-037 and UGC-OPS-012. Full file/check/artifact receipt: docs/slideshow-generation-recovery-2026-10-27.md.


## 2026-10-27 Starting-frame pending feedback and changed-photo audit (local)
UGC-UI-039: shared starting-frame result shows an animated/reduced-motion-safe busy indicator while awaiting an owned request, with checking/queued/generating/finishing text. Pending recreation thumbnails show spinners; terminal/read-error states do not. No new controls, paid retries or polling cadence changes. One-photo first request and three-photo second request confirmed in actual saved production jobs for talking-bittenbyaturtle, and independently by UI/API/provider tests. Each explicit Generate another freezes current photos; older receipt unchanged. Those Seedream runs spent58.43/69.43s in provider-wait stage,under1squeue/outputpersistence; single completed-image download3.37sfromauditmachine. No broad speedup claimed or model changed. Locally128tests,types/lint/workerbuild and1440/390browserPASS; not deployed/authenticatedacceptanceNOTVERIFIED. Receipt docs/starting-frame-loading-audit-2026-10-27.md.

## 2026-10-27 Slideshow gallery names removed by product rule (local)

Slideshow reference gallery cards must not display reference/category names such as Slideshow1/2,Fitness,Marketing beneath their images. This is a format rule in ReferenceCard, not a catalogue rename or removal of source metadata. Retain descriptive accessible Preview/Recreate identities, original IDs, slide-count badges, source links (Creator profile/Original post), selection and exact callbacks. Slideshow Recreate buttons now use pill corners; Hook/Wall styling and captions stay unchanged. Protected rule also recorded in docs/ai-context/nonnegotiables.md. UGC-UI-040-SLIDESHOW; validation receipt docs/slideshow-card-ui-2026-10-27.md. Local change only; no deployment/generation.

## 2026-10-27 Loaded animation controls clarity follow-up (local)

- User screenshot shows shared VideoGenerationStudioPanel loaded starting frame
  with Change plus separate Choose photos. Use the existing compact
  StartingFrameAnimationReferences branch in that caller, retaining both scene
  replacement and optional person-photo controls inside Change. Remove the
  persistent animation/facial-consistency guidance paragraph. Keep actionable
  validation, model-specific face limits and selected-photo preservation.
- New starting-frame handoff and model switch default to3seconds for google_omni
  and wan_3_0,4seconds for seedance_2_5. Existing supported-duration menus remain;
  explicit custom duration survives ordinary rerender. No provider/model rename.
-12focused tests PASS; broader source/generation UI suite99/100, with separate
  slideshow neighboring-card assertion failing. TypeScript/scoped lint PASS.
  Browser access recovered and live Hook page opens, but these newest changes
  are local and post-deployment visual acceptance remains NOT VERIFIED.
  Recurrence UGC-UI-023; receipt docs/starting-frame-controls-clarity-2026-10-27.md.


## 2026-10-27 Restore established Talking Head input cards (local)
UGC-UI-040: user explicitly rejects replacing Choose image/Video reference/Select audio with a verbose starting-frame panel. Keep the existing three-card row visible when a starting frame is selected; the approved frame occupies the image slot. Existing Change opens frame/photo selectors, with no permanent second photo chooser or model-promotion hint. Remove the speech/audio explanatory paragraph. Sound remains in Video settings; existing validation still blocks incompatible image/video/audio combinations. Ratio keeps normal selector geometry, offers the current frame ratio only, and has no From your frame text. Preserve prompt/source/draft/identity and Demo/Schedule behavior.153tests,types/lint/diff plus1440/390actualcomponentfixturePASS; not deployed. User screenshots are requested design evidence, not approved final screenshots. Receipt docs/restore-starting-frame-reference-cards-2026-10-27.md.

## 2026-10-27 Reviewed prompt activation candidate (LOCAL ONLY)

- Corrected116Hook assignments are now wired locally from the completed source
  review:104public/12private,85normal/31middle.111records change;5already match.
  Runtime tables, not audit documents, drive new Recreate preparation. Source-video
  and approved-image animation now share source-bound reviewed motion; full source
  clock and chosen output clock remain distinct. Hook01includes phone pickup and
  continued final shake. Existing image-prompt versions/models are unchanged.
- Private12assignments are repackaged in the two local encrypted runtime files;
  actual production-mode decryption and all12source joins pass. No key exported.
- Preserve user-authored instructions, frozen requests, original frame/clarity
  bindings, legacy continuation paths and five existing decision gates
  (Hooks22/51/57/72/83). Source-reviewed does not mean perfect generated output.
-43prompt tests,38related integration tests,12private runtime checks/types/lint
  PASS. No paid generation or live deployment. UGC-VID-021 remains pending hosted
  activation. User explicitly asks to be told before deployment; do not promote
  this candidate silently. Receipt:docs/reviewed-prompt-activation-2026-10-27.md.

### Investing & Money prompt display — 2026-10-27
Production deployment dpl_C1UzT3KFgb91yCiTtcrhimJA5acV includes the six reviewed Wall prompts and forwards their directions after starting-image approval; its initial Recreate preparation popup omitted the animation prompt. Local correction displays the source-ID/SHA/opening-index-matched compiled preview in an expanded Video prompt disclosure for those six refs only. Saved custom/empty directions retain precedence, the existing four-second preparation preview remains, and final video compilation still follows selected duration/sound. 57 focused tests/types/lint and six-reference desktop/mobile component fixtures pass. No deployment or authenticated hosted acceptance; paid historical usage remains unknown. See docs/prompt-reviews/wall-money-production-prompt-check-2026-10-27.md and UGC-VID-022. Do not conflate this shipped Wall wiring with the separate116Hook activation candidate.


## 2026-10-27 AI influencer horizontal image workspace (local)

User requests removal of the batch-count status and permanent reference helper from the component. Results now share one horizontal, overflow-x:auto / overflow-y:hidden rail across successive batches; fixed 220px desktop / 180px mobile portrait cards include pending and failed results. Two-line CSS-clamped batch prompts retain the existing upper-right Copy control and full-text clipboard payload; native title tooltip is available. Fixed prompt/footer/action space keeps pending-to-completed and appended-batch height stable. Completed images expose a separate expand control on hover/focus and always on touch. Existing shared Dialog opens the original output URL with Close/outside/Escape dismissal and previous/next buttons/arrow keys over completed visible images only. Opening it does not select references or submit generation.

Reference IDs/order, prompt payloads, saving, downloads, workspace-only dismissal, History, account scoping and uncertain-request recovery retain their existing behavior. 89 focused UI/session/API tests, TypeScript, scoped lint and actual-component desktop/mobile/touch browser fixture pass locally. Fixture auth/API/media are substituted; production browser profile is in use, so authenticated hosted acceptance remains NOT VERIFIED. No deployment or paid generation. Receipt: docs/influencer-image-rail-2026-10-27.md.


## 2026-10-27 AI influencer prompt Skills (local)

User explicitly adds opt-in multi-select reusable prompt presets to Build AI influencer. Skills pill sits after Model/Ratio/Count; picker toggles named descriptions and active presets have removable chips above the prompt. Seed only Realistic Skin in lib/characters/prompt-skills.ts; future entries require config edits only. Authored text stays in textarea/two-line result/History preview; Copy uses complete frozen model prompt. No-selected-skills behavior remains unchanged.

The authenticated request carries authored prompt plus optional skillIds. Server validates catalog IDs, duplicates and combined model limits, appends ordered instructions once on first admission, and saves original text/names/instructions in existing job JSON. Status and History expose original text plus names independently of complete prompt. Retry recovers admitted jobs; no second credit reservation or instruction append. Published IDs/instructions must stay immutable; revised wording gets a new ID. Old jobs remain unchanged and are never parsed heuristically to infer skills. No DB migration or worker runtime change.

93focused UI/session/API tests and2actual compiled-worker provider-boundary tests PASS (mock providers); types/scoped lint and desktop/mobile real-component browser PASS. Multi-selection/config extension tested using second fixture-only preset. Original rail/lightbox/reference/download/history/recovery tests retained. No paid generation or deployment; authenticated hosted behavior and generated image realism NOT VERIFIED. Receipt docs/influencer-prompt-skills-2026-10-27.md.


## 2026-10-27 My influencers per-image Copy prompt (local)

User requests a Copy prompt icon directly after each saved image's existing Download icon, using matching styling and brief checkmark feedback. Copy uses that verified image's full persisted v2 user/model prompt, including opted-in Skill instructions, consistently with result-card Copy. The authenticated library already bulk-loads completed source jobs; serialize their verified userPrompt as optional prompt without additional queries. Preserve v1/internal-planner prompt privacy and omit the control when no eligible prompt exists. Names, current drafts and current Skill config are never substituted. Clipboard rejection is displayed inside the modal, with no false copied state; copying neither changes reference selection nor closes the modal. Optional hover/long-press prompt preview is not included in this narrow patch.

44focused UI/list/identity/API tests, TypeScript, scoped lint and real-component desktop/mobile fixture PASS. Existing reference/download/history/recovery/rail/Skills checks retained. Source-job persistence and image-to-job binding are code/test verified; live production database rows and authenticated hosted behavior NOT VERIFIED. No migration, extra per-image fetch, paid generation or deployment. Receipt docs/influencer-library-copy-prompt-2026-10-27.md.

## 2026-10-27 Starting-image photo toggles and receipt/status recovery (local)
- User explicitly requests true multi-selection in saved AI influencer library. Supersedes earlier different-influencer reset behavior: thumbnail clicks add/remove independently, with all selections checked and model cap enforced. Existing strip/Change/upload/Clear/Done and ordered request input remain. User chooses same-person photos; no automatic identity inference.
- UGC-UI-041: JSONB property reordering invalidated nested v4 opening/preparation frame serialization. Canonical field order fixes unchanged persisted receipts without relaxing owner/source/time/hash/model/photo bindings. Exact matching production failed job was pre-dispatch, no output; its credit reservation was already released.
- Job error appears once in result. Refresh status reads unresolved saved jobs/requests only, never POSTs a replacement, reserves credits or restarts a failed job. Unknown outcomes remain guarded. Existing polling and explicit generation/approval stay.
- Local tests/types/worker build/lint and desktop/mobile fixture verification; no deployment, production write or paid generation. Receipt docs/starting-image-selection-recovery-2026-10-27.md. Hosted acceptance remains open.


## 2026-10-27 My influencers footer clarity correction (local)

User rejects repeated visible My AI influencer names and detached icon rows. Supersedes preceding icon-only placement: remove visible name text here (retain accessible image identity), put labelled Download and Copy Prompt buttons inside each card's bordered footer, and keep selection feedback on the image. Copy briefly reads Copied after successful clipboard write. Full saved merged prompt semantics and missing-prompt omission remain. Optional label on ImageDownloadButton affects only this library caller; main results stay icon-only.

UGC-UI-042-INFLUENCER records reported clipboard uncertainty separately from local verified copying.45focusedtests/types/lintPASS; realcomponent desktop/mobile browser verifies exactclipboard,success/failure/retry,non-overlappingcards,attachedfooterbounds,hiddennames and original selection/download/recovery workflows. Local grid-row compression regression caught by browser was corrected with max-content auto rows before completion. No paid generation or deployment; authenticated hosted copying remains NOT VERIFIED. Receipt docs/influencer-library-copy-prompt-2026-10-27.md.

## 2026-10-27 My Influencers in both photo pickers (local)
- User clarifies Person photos remains and Other images becomes a separate My Influencers section in the same header position. This is actual owned-library navigation, not a renamed general-purpose toggle. Compact picker uses the same My Influencers name. UGC Pilot images remains separate; no four-tab redesign.
- General picker lazily reads existing owner-scoped Build AI Influencer history and resolves selected owned assets. Preserve supplied libraries, ordered multi-selection, model caps, uploads and source roles. Refresh targets the active source. No automatic same-person filtering or generation on selection/refresh.
-115focusedtests/types/scopedlint/diffPASS;1440/390actualsharedpickerbefore/afterfixturesPASSselection/caps/refresh/catalogue/reopen/personrole/nooverflow. Screenshots inspected. Auth/API/optimizer/appshell substituted; no hosted acceptance, paid call, production write or deployment.
- UGC-UI-043-PICKER; receipt docs/my-influencers-picker-2026-10-27.md. Preserve prior starting-image recovery and unrelated work.

## 2026-10-28 Source-relative Hook Remix v9 (local)
- User approves implementing the second five-case tested policy for manual Remix and automatic Hook text. Shared base instructions/version9: KEEP suitable copy exactly, SMALL EDIT named tool where sufficient, ADAPT mismatched situations/unsupported claims while retaining reaction. Source-relative length, not universal two lines. Longer hooks may stay long.
- New results have shared per-block source-character budgets with explicit longer named-brand allowance; overflow fails without truncation or paid retry. Old manual receipts and automatic plans retain frozen behavior; user editor changes/empty drafts still win. No model/quota/flag/UI/other-format/schema change.
- Optional reviewer v3 shares KEEP/adapt/budget policy, permits evidenced obsolete-tool removal on a meaningful rewrite, retains grounding/human/no-brand safeguards and v2 caller compatibility. Reviewer remains opt-in; no added model call.
-77focusedtests/types/lint/workerbuild/diffPASS. Five existing paid outputs pass exact-base/budget/editable-layout replay; no new provider call. Broader emoji/default-font and catalogue-count tests fail identically without any changed runtime imports; deployment held. User sees limitations; not a full release green light.
- UGC-VID-023-REMIX; receipt docs/remix-v9-implementation-2026-10-28.md. Production unchanged; compatible generation worker precedes new server plans when rollout is separately cleared.

## 2026-10-28 Remix v9 verification follow-up; no deployment
- Fixed local test font expectation to approved Proxima Nova A600 and proved saved Poppins700 retention. Inventory helper now includes19missing published references and matches302runtime identities/paths. Historical retired Wall08/09 transcripts remain stored but unavailable, explicitly tested against exact hashes.
-77focused +3render/catalogue checks PASS; TypeScript, worker build, scoped lint/diff PASS. No runtime/UI/data change in this follow-up; no new provider calls. Latest user says DO NOT DEPLOY; production acceptance remains NOT VERIFIED. Evidence/changed files: docs/remix-v9-implementation-2026-10-28.md; UGC-VID-023-REMIX.

## 2026-10-28 Original-opening-only rules and Remix readability audit
- User explicitly requires original source frame0 only for all new recreations, with no later clarity input. This supersedes previous middle-frame fallback for future work.31existing nonzero bindings and frozen jobs remain historical and unchanged; runtime migration/pilot acceptance not completed here.
- Source opening lighting (direction/softness/color/exposure/contrast/shadows), outfit, scene, crop, hands/props and pose must survive preparation; identity photos control face/appearance only. Caption cleanup is a separate acceptance gate. Hook7sixstillreport containsv4green-shirtleakage, not proof of a video consistency gain.
- Reuse same selected owned identity photos for video only when connected route supports strict first-frame plus appearance roles; respect explicit user removals/changes. Omni supports those roles; current WAN/SeedanceReAPIframe routes do not combine them. No automatic provider switch or duplicate chooser. Visual consistency remains to be tested.
- Source-faithful motion means observable timed actions, gaze/expression/holds, camera and complete ending, not generic emotion alone. Source-speed+hold is required before trimming excess minimum generation duration; existing stretched timelines must not be cropped blindly.
- New reported automatic Remix narrow/small text issue UGC-UI-044-REMIX; audit separates text-box width, preserved line breaks and shrink-only font sizing. User sketch expresses desired wider readable text, not literal zero-margin bleed or permission to reflow saved edits. No runtime default changed during this audit; visual proposals and evidence are kept separate from acceptance.
- Durable current rules: docs/ai-context/nonnegotiables.md and docs/prompt-reviews/REPEATABLE_SOURCE_PROMPT_REVIEW.md. Old skills/history may describe superseded fallback; current explicit user instruction governs. No deployment or paid generation.


## 2026-10-28 Explore heading cleanup (local)
User removes redundant visible Workflows subheading above Explore cards. Preserve accessible namedregion without visualheight;32pxreclaimedat1440/390,cardlinks/order/geometryunchanged.13navigationtests andisolatedbrowserPASS;notdeployed. UGC-UI-045-EXPLORE. No workflowsettingorbackendbehavior removed.


## 28 October 2026 — New opening-only policy implementation (local, no release)

New starting-image submissions now require frame 0, draft v4 preparation binding, receipt v5 and prompt v7 for public/private source routes. No later clarity image is attached. Historical accepted jobs recover before new-policy validation, retaining their original receipt and exact image inputs. The preparation UI keeps historical results and offers an explicit new original-opening preparation rather than silently relabeling an old frame.

Latest explicit user cleanup instruction overrides preserve-physical-text history: new image/animation instructions remove physical logos, branding and readable text as well as captions, retaining source materials, objects, lighting and wardrobe. Source versus influencer roles are separate. Generated-pixel fidelity is still unverified by a new real pilot.

Omni automatically restores the approved image's owned identity assets via authenticated media reads, preserving order and browser-persisted explicit removals/replacements. Stale restores are cancelled. Unsupported WAN/Seedance starting-frame payloads contain only the first frame. No duplicate chooser or new ordinary Create control.

New timed Hook jobs freeze a source-speed timeline: actions end at source duration if shorter than provider duration, followed by hold; raw output remains full length. Owned completed job output supplies an initial editor trim only when no saved draft exists; pending/local/explicit empty edits retain priority. Legacy jobs/custom untimed instructions do not acquire automatic timing defaults.

New automatic Hook text plans freeze layout v1 (94% safe width, measured bounded growth); manual Remix shares this only for new unstyled Hook text. Missing versions preserve old fitting. Existing copy/newlines/style/position/trim stay intact. Local three-line sample grew from 52% to 90% ink width without an extra line.

Verification receipt: docs/opening-policy-implementation-2026-10-28.md. 104 public + 12 private local prompt drafts have compiled numeric intervals. Prior production export is historical and has older untimed entries; no deployment or live prompt activation was performed here. No paid generation. Real image-first then video/ending acceptance remains pending.

## 28 October 2026 — Frame-zero motion assignment correction (local only)
New original-opening public preparation maps the validated source-bound former-middle motion record to frame0; private workspace uses its full-source generationPrompt for new frame0 instead of the old selected-frame fallback. Explicit edits and historical behavior retain priority. Local21 public and10 private assignment checks plus112 focused tests passed. Two older middle-frame fixture assertions still fail and need investigation; no generated-output or deployed acceptance claimed. UGC-VID-025-OPENING-PROMPT.

## 28 October2026 — Reviewed45/80/86prompts assigned locally
New Recreate selections use source-bound revised motion plans with6second initialduration to preserve observed source pauses/ending. Framehandoff/history/restore carries6;modelchange alsohonorsreviewed6;explicitdurationremainseditable. Existingdraftmotionoverridesstayunchanged. Hook86endingnowloweredeyelids/softsmile. No deployment/generatedqualification. Hook22clarification: right hand removes/retainsglasses andcomes tomouth,otherhandhandles recordingphone; warning reconciliation stillpending.

## 28 October2026 — All revised Hook assignment verification and Hook22clarification
104public+12localprivateoriginal-opening paths verifiedtimed; galleryprivateassignmentexplicitlyrequestsverifiedframe0. Missingprivatecorrectedpackageblocksnewdefaultinsteadofuntimedfallback. Historicalandusereditedtextretainpriority. Hook22warningreconciledwithuser: anatomicalrighthand(screen-leftinselfie)removes/retainsglasses,otherhandpicksuprecordingphone,glassesholdinghandcoversmouth. Revised22planalreadycontainedglassescontinuity;addedroleconstraintandremovedcontradictoryemptyhandgate. No deploy or productionqualification.115focusedtests/types/lintPASS.


## 28 October 2026 — Wall workflow distinction and local storage/recovery fix

User clarified: Wall may exceed five seconds and must not acquire Hook automatic cuts. Wall copy has its own multiline density (typically4–10lines), placement and font sizing; do not inherit Hook's short-copyfit. Sixreviewedmotionrecordsareacceptedcoverage; no request to auditallWallmotion.

Inspected first64decodedthumbnailtiles for each ofsix Investing/Money sources from retained nativecontact sheets (384tiles). SourceMP4pathsfromoldmanifestunavailablelocally; this was existing extractedframeinspection,notfreshplayback/fullvideoreview. Textblocks vary across uppermiddle/center/lower face-chestarea and widths; noexactfont/pixelmeasurement or globalWalllayoutchangeperformed.

Localimplementation: Wallframe0usespersistent content-addressedstore readthrough;missingframeextractsonce,persistsverifiedPNG/index,thenlatercoldservicecanreadwithoutMP4. PublicWallonly;privatecreatorbranchunchanged. Added--wall toexistingprepare-hook-source-frames.mjs soallcanonicalpublicWallframescanbeverified/preparedbeforetraffic. No hostedpreparationexecuted; firstuncachedrequestmaystillwait. Storageoutagesfailrecoverablyratherthanclaimingready. Do notpromiseinstantorzerolatency.

WallhistorynowresolvesmatchinggetWallMoneyMotionbeforegenericfallback;all6reviewedrecordsretainmotiononreuse. TalkingHeadandunreviewedWallfallbackunchanged. NoWallautotrim/textfit/durationdefaultchange. Updatedtestexpectationforrequestedphysicaltextcleanup.

29source/storage/Wall/recoverychecksPASS;tsc/lintPASS. Fixtureprovesnewserviceusesstoredframewithoutvideoread/decode;notrealcloudlatencyorproductionreadback. Nodecommandsuselocalrepositoryloader/transformtypes/modulemocks. Logs outputs/hooks-45-80-86-rewrite-20261028/wall-{fixes,types,lint}.log. No deploy/paidgeneration/remoteassetwrite.

## 28 October 2026 — Six-reference automatic Wall text placement (local, disabled)
New untouched 9:16 Wall generations can use source-ID/hash-bound layout v1 for the six reviewed Investing & Money references. Recovered native opening frames confirm 6/6/4/8/4/10 lines; thumbnail estimates 01/02 were corrected. Different placement/width/size/outline/spacing per reference; existing Proxima face is a candidate, not identified source font. Optional saved lineHeight preserves historical defaults when absent. Exact new words remain editable; saved/local/pending/explicit-empty drafts win. Full actual Wall duration retained, no Hook trim or Hook brevity rule. Existing automatic text checkbox reused only for eligible references behind separate EXPLORE_AUTOMATIC_WALL_TEXT_ENABLED and NEXT_PUBLIC_EXPLORE_AUTOMATIC_WALL_TEXT_ENABLED flags, both left unset/off. No deployment or hosted changes. 73 focused +25 worker +87 integration checks PASS, types/build/lint PASS. Local browser actual controls/draft hook fixture save/reopen/blank/mobile PASS. Seven actual renderer neutral MP4 exports all12seconds, opening/ending text checked. Hosted authenticated/generated copy/footage contrast not verified. Receipt docs/prompt-reviews/wall-automatic-placement-2026-10-28.md.


## 2026-10-28 Talking Head identity handoff and labeling audit (local)
UGC-VID-025: Talking Head now restores ordered owned identity photo IDs from each approved frame using the shared Hook restoration, with current-frame-scoped selection, explicit edits, missing-read blocking and supported-model restrictions. Omni uses generated first frame Image1, appearance Image2+; WAN/Seedance first-frame-only. No prompts/providerpayloadcontracts altered.223application+110worker/provider testsPASS. Live acceptance and visual consistency NOTVERIFIED. Full route matrix and character-route unlabeled-reference observation UGC-VID-027: docs/image-role-labeling-audit-2026-10-28.md.
`n## 28 October 2026 — Wall layout batch 02/05 (local only)`nTwo original-source-hash profiles added for Explore Wall 02 and 05: seven pink lines and nine white lines respectively. Older six snapshots remain unchanged. 32 local tests and two twelve-second neutral export checks pass; browser and generated-scene acceptance remain unverified. Feature flags remain disabled; no deploy. See docs/prompt-reviews/wall-layout-batch-02-05-2026-10-28.md.
`n## 28 October 2026 — Structured Wall Remix handoff (local, disabled)`nWall 04 freezes source, business context and heading/body profile and receives explicit structured text in two editable layers; Wall 03 uses condensed single-block layout. User wording is retained and overflow is reviewable. Existing plans/edits and full Wall duration protected. 35 focused tests plus 26 worker and 10 editor checks passed with fixtures; provider output, hosted browser and generated footage remain unverified. No deployment. See docs/prompt-reviews/wall-structured-remix-2026-10-28.md.
`n## 28 October 2026 — Wall 04 heading fit and grounding (local, disabled)`nReal text-only Wall 04 result exposed fixed-heading wrapping and unsupported source-law/result claims. New structured plans freeze heading fit version 1 and prompt version 3. The exact saved heading fits at 61px; original shorter heading stays 65px; legacy plans remain unchanged and overflow requires review. Prompt discourages unsupported authority/outcome claims, not a guarantee. 38 focused and 26 worker tests plus types/build/lint pass. No new provider call, video or deployment; hosted and new-prompt output quality unverified. Receipt docs/prompt-reviews/wall04-heading-and-grounding-fix-2026-10-28.md.


## 28 October 2026 — Wall to Hook reclassification (staged, not deployed)

User directed Wall 21 be removed and Wall 06, 28 and 59 be moved to Hook with opening reaction clips. Wall 21 is removed from the local selectable Wall gallery, with historical source registry retained. Separate local Hook-only trims retain original files: 06 3.300s, 28 2.033s, 59 3.000s. Hook release, opening-only source text and source-specific phased motion are staged under an inactive release gate. On activation the three old Wall IDs retire from selection but remain resolvable for history. Nine storage objects have not been uploaded; source frames, hosted preview and generated-output quality remain unverified. Do not switch the release active until media/hash, prompt/source, frame and authenticated checks are complete. No deployment or hosted writes. See docs/prompt-reviews/wall-to-hook-reclassification-2026-10-28.md; UGC-VID-028 remains open.

## 29 October 2026 — Video-control responsiveness diagnosis (no runtime change)
User reports blocked Final video Play and stale/missing demo save actions. UGC-UI-048-CONTROLS records distinct mechanisms: export text-fit validation disables the shared preview player; demo save aggregates prerequisites without explaining every pending state; shared draft loading requires localStorage and starts its HTTP timeout only after token acquisition. Actual-component local fixture keeps desktop actions visible/enables save after upload, but mobile390px fails overflow (Save & return right418.92). Focused22tests and isolated playback/hook probesPASS; production redirects to sign-in, exact user save/session cause and full hosted acceptance remain UNKNOWN. No application fix/deploy. Evidence and limits:docs/control-responsiveness-audit-2026-10-29.md.

## 2026-10-29 Sidebar idle recurrence — diagnosis only

User reports sidebar/Explore links fail after 5–30 minutes idle and refresh restores navigation. UGC-UI-050 remains OPEN. Code-only isolated probes confirm a stalled installed Next route transport has no request deadline and sidebar links lack pending/recovery feedback; transient background profile errors replace a verified workspace; profile cancellation omits a post-token abort guard/expected-owner binding. Five-minute static-prefetch freshness is a possible trigger for renewed network dependency, not a proven outage cause. Existing read/auth deadline checks pass. No application patch, browser-control continuation, production idle trace or deployment. Detailed scope/evidence/limits: docs/idle-sidebar-diagnosis-2026-10-29.md.

## 29 October 2026 — Preview/save controls recover without changing workflow layout (local)
UGC-UI-048-CONTROLS: export text-fit and unsaved-draft warnings no longer disable otherwise playable Hook, Wall or shared Talking Head previews. Keep the warning visible and final composition/export validation active; saving exact structurally valid demo drafts is allowed. Save actions show their actual pending/error reason and accessible description. Auth/fetch/body waits for draft receipts and source/audio reads are bounded; storage remains required for durable save identity, with actionable recovery, initial-load retry preserving typing and explicit loaded-draft reload retaining conflict semantics. Existing mobile header actions wrap at320/360/390px; desktop placement and44px ready toolbar retained.193focused regression tests, actual-component browser, types/lint/build/postbuild native checksPASS. Hosted acceptance remains OPEN; no deployment or provider/schedule writes. Detailed files, evidence and limits:docs/control-responsiveness-fix-2026-10-29.md.

## 2026-10-29 Idle navigation recovery implementation (local)

UGC-UI-050: sidebar and Explore Next Links now share shell-scoped opening/recovery feedback. After15seconds without URL commit, explicit Open page in a new tab preserves current work. No forced reload, automatic new tab, cache extension or framework patch. Mobile drawer closure does not remove recovery; newer navigation replaces destination; pathname/query commit clears it. Profile GET binds the expected owner and checks cancellation after token wait. Only typed temporary failure can retain an already successful account-scoped onboarding result; initial failures/authorization denials/incomplete setup remain blocking.59focused tests and isolated1440/390/collapsed fixturesPASS; production real-idle acceptance remainsOPEN. Receipt:docs/idle-sidebar-fix-2026-10-29.md.

## 29 October 2026 — Independent same-platform scheduling account choices (local)
User explicitly wants several Instagram/TikTok accounts per post. Existing connected cards now toggle independently; new accountIds draft groups preserve multiple/empty choices while legacy single fields remain readable. Auto-suggestions never replace an explicit empty choice after remount/reload. Valid cached cards are usable during bounded account refresh; selected expired/unpublishable cards can be removed, and unselected blocked cards retain real permission/reconnect reasons. Existing backend supports at most5distinct accounts per post; UI explains zero/missing/over-limit destinations rather than silently clipping choices. Direct receipts accept repeated platforms with unique connection IDs up to5; exact saved-request replay/owner/target verification remains. Review summaries count all accounts; uncertain-request help explains its frozen original destinations.156schedule+27recovery tests and193priorpreview/editor regressionsPASS; desktop/mobile card browser and local atomic5target/5job replay testPASS. Build running; no deployment, hosted schedule or providerpublication. UGC-SCH-013-ACCOUNT-SELECTION remains productionOPEN. Files/evidence/trace:docs/schedule-account-selection-fix-2026-10-29.md.

29October2026 scheduling-account build follow-up: full webpack productionbuild and native-route postbuild checksPASS(exit0), with376regressions and desktop/mobile browserPASS. No deployment/providerposts; UGC-SCH-013-ACCOUNT-SELECTION remains hostedacceptanceOPEN. Prior account-selection decision and all historical entries retained.

## 29 October 2026 � Wall placement completion, local only
Every one of97 selectable Wall references resolves to its own source text and measured layout; this supersedes earlier incomplete52/remaining47 reports. Six retired/moved sources remain excluded. New Wall-only alignment/box/region support and6000-character dense-copy bounds preserve old absent-field defaults, saved edits and full duration. Manual Remix no longer collapses saved measured regions. New ordinary Wall prompt version4 preserves paragraph roles; frozen old receipts are recovered unchanged. Automatic Wall activation remains disabled and no deployment or generation occurred. Local catalogue, source resolver, request/recovery, fitting, editor save/reopen/mobile and export-JSON checks PASS; real hosted AI/output acceptance remains unverified. Wall37/53 source wording ends abruptly and is recorded for copy review. See docs/prompt-reviews/wall-complete-placement-review-2026-10-29.md.

29 October 2026 Wall recheck: fixed unchanged referenceBlocks losing the original source hash/layout, plus missing Wall automatic-text failure explanation. Final161connected tests and97profile actual-component browser PASS locally. Full-worktree types currently fail in unrelated starting-frame-reference-source.ts/test optional videoFile usage; Hook worker test expects104but sees107. Hosted browser busy; live E2E NOT VERIFIED. No deploy/generation. Receipt docs/prompt-reviews/wall-end-to-end-recheck-2026-10-29.md. Saved edits/full duration preserved.

## 2026-10-29 Reference caption treatments and preview/export glyph parity (local)

User explicitly requests closest possible lettering/outline match to supplied reference screenshots2/3/4. New video text/generic unstyled Remix uses Reference Social (TikTok Sans700, white, outline6, round joins, lineHeight1.2); existing preset selector also offers Reference Classic (DM Sans700) for job/book lettering. Explicit selection preserves words/timing/position/size/width. New automatic Hook plans freeze textStyleVersion1; absent version keeps historical Proxima. Source-specific Wall layouts and saved fonts stay authoritative; no slideshow/Carousel restyle. Reference ASCII uses exact packaged glyph paths in both preview/native render, correcting measured browser-text versus worker-outline edge differences. Final nativeMP4/preview raw glyph overlap95–96%,1pxwhitecoverage100%,darkoutline97–99%. Exact originalfont/platformemoji/uservisual/hosted acceptance NOT VERIFIED; no deploy. Combined website/worker release required for new presets. Receipt docs/reference-caption-fix-2026-10-29.md; UGC-UI-051 remainsOPEN.

## 2026-10-29 Reference caption final type/render verification

Current source-registry/test string narrowing resolves the previously reported optional-videoFile errors; full application types and4source-registry testsPASS. Rebuiltworker,63caption/editor/native-export tests, scopedlint andactualdesktop/mobileeditor+freshMP4parity fixturesPASS. Preview/exportmetrics retained95–96%rawglyphoverlap,100%1pxglyphcoverage,97–99%1pxoutlinecoverage. Closest reference treatments remain visually approximate, with differentplatformemoji; noexactfont/hostedacceptance claim. Noapplicationcodeedit or deploy in this follow-up. Receiptappendix:docs/reference-caption-fix-2026-10-29.md.


## 2026-10-29 Six active Explore audit corrections (local, no deployment)

User authorized only the six confirmed active-workflow repairs and explicitly excluded Creator Phone and deployment. Published imported Wall videos now join the server-owned source registry (all97 selectable Wall sources resolve); unresolved Hook motion decisions block new paid starting images in both UI and API while accepted jobs recover first. Scheduling releases an unconfirmed request only after a definite client rejection plus successful absence reconciliation; time correction, accepted posts, ambiguous conflicts, transport/server failures, request identity and duplicate protection remain. The shared finishing-boundary release branch is Hook-only. Remix application errors have independent recovery state and never erase audio errors. Interrupted slideshow saves restore Resume and exact slides before opening another Library item. Wall reviewed drafts now restore6000characters; Hook600 and Slideshow bounds are unchanged.

297 focused tests plus70 neighboring/service/PGlite tests PASS; types PASS; scoped lint0errors/one pre-existing test warning. Shared Wall/TalkingHead toolbar screenshots at1280/390/320px are byte-identical before/after. Broader browser fixture's later Hook end-of-clip text assertion fails identically against task-start/current versions; root causeUNKNOWN and outside these fixes. CreatorPhone source/route hashes unchanged. No deployment, paid generation, production writes or provider publication. Hosted acceptance and real publication remainNOTVERIFIED. Receipt and every task-owned file: docs/explore-six-confirmed-fixes-2026-10-29.md; incidentUGC-UI-054-EXPLORE-SIX.

Six-fix final gate:298focused+70backend/neighbor testsPASS; local webpack productionbuild/296staticpages/native-route postbuildPASS. Accepted-image recovery after motion becomesblocked has explicitzero-extra-charge coverage. No deploy; documented baselineHookbrowsergap and hostedacceptance remainopen.

### 29 October 2026 — Explicit Hook review decisions
User confirms remove only airplane Hook19 from selectable references. Keep39,51,57,64,72,83 using original frame0 with influencer identity and source text/logo cleanup. Preserve39 sunglasses/offscreen exit,51 original cut,57 can/offscreen exit,64 camera retreat/cafe continuity,72 purple bottle and repeated action,83 intentional partial-face crop. Do not reveal/recenter the cropped face, silently select later clarity or delete props. Existing archive/media/job identities retained. Six static decisions resolved; generated quality still not_tested.106selectableHooks; allactive preview decision checks pass.127local checks/types/workerbuildPASS; one unrelated old wording assertion reproduced on baseline. No deploy/generation. Details docs/hook-reference-decisions-2026-10-29.md; incidentUGC-VID-029-HOOK-DECISIONS.


### 29 October 2026 — Six-fix/106-Hook verification follow-up
Allsix correction suites299PASS, neighboring/catalog/PGlite84PASS, source/API/store/identity43PASS, audio6PASS. PermanentallactiveHook regression now checks canonicalsource/frame0/identityroles/cleanup/validmotion/silence. Existing latecaption browserfailure is an obsolete textContent assertion: current referencefonts use SVGglyphpaths. Test-only exactword/pathgeometry verification passes complete desktop/mobiletrim/ending/reload/multiblock fixture; no applicationrenderer change. SixWall/TalkingHeadtoolbarPNGs byteidentical to priorbaseline. CreatorPhone hashes unchanged. Existing unrelated Hook22 wording assertion still reproduces; no motion adaptation introduced. Details/finalbuildandmedia evidence docs/explore-six-fixes-recheck-2026-10-29.md. No deployment/paidgeneration.


Six-fix finalrecheck:106/106sourcehashes+actualframe0decode/dimensionsPASS andall106mapping/promptsvalid;20publicsourceGETsfilllocalcacheonly. Freshwebpackbuild/305pages/nativetracesPASS. Phonehashesunchanged. BrowsercaptionpathassertionPASS; noapplicationbehaviorchange. RemainingoldHook22wordingtestreportedseparately; no generatedoutputorhostedacceptance/deployment.


### 29 October 2026 — Obsolete stretch-test assertion corrected
Correction: the test previously called Hook22 targets catalogHook08/id d1d14b08f6dd4711ad166ded. Verified canonicalMP4hash and inspected all79stored frame tiles. Existing plan already preserves interlacedopening, forwardstretch, firstside, upright hand switch, oppositeside and keyboardreturn. Updated test-only phrase/beat assumptions to assert that fullorder; no runtimeplan/prompt/UI change.111testsPASS/no skips; resetpose and earlyhandswitch mutations both correctlyFAIL.13protectedruntime/data/Phone hashes unchanged, Phone also matches originalsixfixbaseline. Receipt docs/hook-stretch-test-fix-2026-10-29.md. No deployment/generation.


### 29 October 2026 — WALL-LAYOUT-02 manual structured fields
Canonical heading-body-v1 Wall Remix now requests/saves/reviews/applies explicit heading/body with emptyblocks; manualWallpromptversion5 and frozenoutputStructure. Legacyblockreceipts/drafts keep compatibility; no migration/rebilling. Existing Wallstyles/otherlayouts, Hook/Slideshow limits, trims/audio andCreatorPhone preserved. Structuredbody supports6000characters; heading180; AIbudget counts bothfields. Incompletefields recover but cannotApply. MCPreads accept same ownedreceipt.258testsPASS, actualdesktop/mobileflowPASS,5existingPNGsidentical, types/lintPASS. No deploy/paidcalls. Details docs/wall-layout-02-structured-remix-2026-10-29.md.


WALL-LAYOUT-02 finalrecheck:275testsPASS plusdirect97-layoutpre-fixparity forlegacydrafts/customstyles/apply/export; actualclaimfunctionJSONBroundtripold/newreceiptsPASS; freshdesktop/mobilebrowserPASS;5PNGsunchanged;types/lintPASS.10runtime/layout/Phonehashesunchanged. Onlytestcoverageadded; noapplicationchange/deployment/paidcalls. Hostedproduction/AIqualityunverified. Receipt docs/wall-layout-02-structured-remix-2026-10-29.md.
