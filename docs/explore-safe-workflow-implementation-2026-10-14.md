# Explore workflow integrity and recovery implementation

Date: 2026-10-14. Status: implemented and verified locally; not deployed.

This is the user-approved implementation following the Explore review in
`outputs/explore-deep-review-2026-10-14/REVIEW.md`. The focus is Talking Head +
Demo, shared scheduling integrity/recovery, saved workflow state, and Edit and
Preview clarity. Existing intentional changes from other work in this shared
worktree were preserved.

## Scheduling integrity and recovery

- Direct scheduling now uses the service-only
  `create_direct_scheduled_post` transaction to commit the schedule, its complete
  target set, and each existing `social-publish:<targetId>` job together. Quota
  and job creation failures roll back the complete operation.
- Exact idempotent replays keep the accepted source, destination, time and job
  identities. Lost acknowledgements and interrupted external scheduler handoffs
  recover the existing work, including when the original lead time has elapsed.
  Changed snapshots conflict instead of silently modifying an accepted request.
- Legacy schedules that contain a parent without a trustworthy original target
  snapshot return an explicit incomplete-schedule error requiring review or
  cancellation. Recovery does not invent their destinations.
- Authentication, HTTP and response parsing share a 20-second deadline. Native
  browser fetch is called without a foreign receiver. A late authentication
  response cannot dispatch after timeout. Uncertain mutations retain their
  original receipt; there is no automatic mutation retry.
- Pending TikTok confirmation compares canonical provider options while still
  rejecting changed accounts, timing, visibility and disclosure settings.
- Talking Head uses the account/saved schedule timezone rather than assuming
  the browser device timezone. Completed render output lookup remains a read
  recovery operation; its processing label says the video is still preparing.

## Workflow state

- The owner-scoped, versioned browser session retains the exact selected source
  mode/result, owned source/demo/audio IDs, current stage, generation settings,
  finishing options and word corrections, demo framing/playback, and unsent
  schedule fields.
- The child workflow waits for hydration. Restoration verifies exact IDs through
  authenticated owned-media reads, with one shared token read and a bounded
  deadline. It cannot substitute another generated result, expose another
  owner's assets or overwrite saved choices with initial defaults.
- Browser state stores IDs and validated controls; it stores no credentials,
  media URLs, blobs or File objects. Interrupted uploads and missing assets
  have explicit recovery/remove/reset actions. Browser-local generation
  reference files must be chosen again, or explicitly omitted, after reload.
- Reset remounts local controls while preserving separate accepted generation,
  finishing and scheduling receipts. Mounting/restoring never uploads, generates,
  renders or schedules automatically.
- Replacing a demo invalidates pending audio metadata/upload work. Late audio
  from demo A cannot attach to demo B. A rejected replacement retains previously
  accepted media and cancels the pending candidate.

## Editing and preview

- Save edits persists a JSON clip snapshot. Final preparation consumes both raw
  source IDs and their exact clip edits independently of background scheduling
  capability. Unsaved edits, including reverting an earlier saved edit to its
  defaults, must be saved before final preparation.
- A talking head without a demo has one larger preview and an explicit Add
  optional demo action. A selected demo produces the two-clip sequence.
- Edit previews show saved trim/text/audio settings. Prepared publishing video
  is separately labelled. Landscape demo framing uses the opening video's
  output dimensions; raw pan timestamps remain aligned with the clip trim.
- The desktop Schedule sequence receives a definite height, preventing its
  size-contained video stage from collapsing to zero height.
- Custom opening music uses the same pre-trim audio clock as export. Raw demo
  music restarts on the trimmed demo clock used by composition. Paired reference
  audio retains its deliberate timing. Pause, replacement and unmount cancel
  preview animation/audio work.

## Verification

- Combined regression suite: **203/203 passed**, covering session ownership,
  restoration, upload races, scheduling deadlines/receipts, atomic database
  rollback, replay, early-publishing guards, saved composition and audio parity.
  Evidence: `outputs/explore-safe-implementation-2026-10-14/final-combined-tests.log`.
- After the native-browser fetch correction, **74/74 relevant transport and
  scheduling UI tests passed**, including the added receiver regression. These
  overlap the combined suite; the totals are not additive. Evidence:
  `outputs/explore-safe-implementation-2026-10-14/native-fetch-regression-tests.log`.
- Headless Edge, real components and mocked HTTP: opening/demo JSON saves make
  no renders; one final raw composition preserves exact trims/text and framing;
  failed completed-output lookup recovers by GET; double-click sends one direct
  schedule; reload sends no uploads/renders/posts; changed source and removed
  demo cannot reuse old edits/audio/framing. Evidence: `edit-schedule-browser.log`.
- Desktop 1440×900 and mobile 390×844: larger single preview, optional two-clip
  sequence, nonzero Schedule video surface, no horizontal overflow, portrait
  output for a cropped landscape demo, and truthful preparation state. Evidence:
  `preview-browser.log`, `preview-browser-measurements.json` and preview PNGs.
- Real FFmpeg audio tests compare custom opening/demo/reference preview clocks
  against generated export samples. Browser fixtures use locally generated test
  media and mocked authentication/render/scheduling boundaries.
- TypeScript checking and scoped ESLint passed. The default Turbopack run made
  no visible progress during compilation and was stopped. The first webpack
  build was blocked by sandbox permissions when creating generated output; the
  approved local rerun **passed the complete production build**, including
  TypeScript, all 162 static pages and build tracing. Its complete outcome is
  recorded in `outputs/explore-safe-implementation-2026-10-14/production-build-webpack.log`.

## Release order and limits

1. Apply `supabase/migrations/20261014100508_atomic_direct_schedule_creation.sql`
   before releasing the website. Keep the existing scheduled-time recovery and
   claiming guards in place. The new website fails closed with
   `schedule_atomic_storage_unavailable` if this RPC is missing.
2. Release the website containing these changes, and confirm the hosted database
   exposes the service-only RPC. The existing worker job contract is retained.
3. Verify the authenticated Talking Head + Demo flow on
   `https://www.getugcpilot.com`: saved/reloaded selections, both clip edits,
   final output, one explicit schedule, and recovery without duplicate work.
   Local fixture acceptance does not establish production acceptance.

No migration, deployment, live generation, schedule or publication was performed
for this implementation. The available production browser was signed out, so
authenticated production acceptance remains a release step.

Provider transcription rate-limit/terminal-uncertainty handling and elimination
of redundant no-op encodes are separate findings from the original review. They
are outside this accepted batch; changing encode bytes can affect the speech
cache identity and needs its own verification. This implementation does not
claim to resolve every issue listed in that broader audit.
