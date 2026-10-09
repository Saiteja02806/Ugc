# Explore workflow audit — October 9, 2026

The owner subsequently authorized deployment of every intentional project change.
This audit accompanies the combined release; hosted integration acceptance is
recorded separately after rollout to https://www.getugcpilot.com.

## Save latency: observed cause and remaining investigation

Read-only inspection of five recent completed Explore finishing jobs found:

| Stage | Observed duration |
| --- | --- |
| Job creation/queue to worker claim | 119–190 seconds; median 161 seconds |
| Dispatch acknowledgement | 1.07–1.49 seconds |
| Dispatch launch to worker claim | 117.9–188.4 seconds |
| Actual processing after claim | 5–26 seconds; median 11.5 seconds |
| Media download | 0.3–0.6 seconds |
| Upload/finalization | 0.5–0.8 seconds |

The principal observed wait occurs before the worker claims the job. These
measurements do not establish that encoding, media download, or the front-end
button causes the multi-minute delay. Cloud Run execution provisioning took
11–21 seconds, followed by roughly 100–170 seconds before the recorded worker
start/claim. The executions used 2 vCPU / 4 GiB. Increasing finishing queue
concurrency alone would not address this measured startup interval.

The exact startup cause is still unproven. The worker eagerly imports handlers
for multiple job families and providers. A local import measurement was about
2.4 seconds, which is insufficient to explain the production interval. Next
investigate entrypoint/container startup timestamps and compare a lean render
entrypoint or a warm render service in an isolated deployment. A warm service
changes infrastructure and cost and should be reviewed as a separate release.

Safe changes implemented locally:

- Bounded parallel downloads retain owned-media checks and await settled
  transfers before cleanup.
- Pending status distinguishes queue/startup, download, rendering, transcription,
  upload and finalization. Cancellation polling preserves the current stage.
- The existing durable receipt, request identity and per-owner finishing limit
  remain. Hook edits, demo edits and composition are prepared in order.

An isolated 720p / 30fps benchmark using a 3-second hook and 18-second demo
measured separate text composition/edit at 1.254 seconds combined versus
0.864 seconds for one pass; combination took 2.631 seconds. This is local
evidence for investigating redundant render passes, not a production estimate.
No claim is made that the observed startup latency has been fixed.

Reproduce the read-only audit with
`scripts/explore-finishing-latency-audit.mjs` (optional `--cloud-run`) and the
local benchmark with `scripts/explore-finishing-latency.benchmark.mjs`.
The audit output omits owner identifiers, prompts, signed URLs and credentials.

## Slideshow flow and corrections

The user confirmed these product rules:

- The selected catalogue slideshow guides layout. An image attached through
  the plus button in Your instructions guides subject/style.
- Edit slides contains the user's generated/uploaded images. Catalogue
  examples do not become output slides automatically.
- Business context is optional; explicit instructions must not be silently
  rewritten or supplemented with unrelated business copy.

The original editor populated output from the catalogue and replaced a single
catalogue slide. That did not match the confirmed output ownership rule.
The revised editor keeps an owner-scoped sequence of 2–10 actual output images,
supports upload/add/remove/reorder, and replaces the selected output on
regeneration. Generated-job IDs are resolved to ready owned media IDs before
selection. Async selection locks the target while this lookup completes.

The Instructions attachment supports an owned image upload or an existing
owned image. Generation waits for upload completion and rejects invalid or
unready media before reserving credits. Provider input puts layout first and
subject/style second, with explicit role guidance when both are present.
Single-reference provider input retains its prior prompt behavior.

Save v2 checks ready owned image assets and exact output order. It uses the
existing atomic Library RPC; no new migration is required. Interrupted saves
lock their sequence and retain request identity after an ambiguous response.
A fresh rejected request can unlock, while a reused interrupted request cannot
silently change content. Existing legacy v1 receipts can still be recovered.
Missing owned legacy replacements remain unavailable placeholders; they do not
fall back to an unrelated catalogue image. A newer v2 draft, including an empty
draft, wins over an older completed v1 receipt.

Local verification includes the real editor, attachment and generation-selection
components with isolated HTTP fixtures, plus owned image resolver/API checks.
`scripts/explore-slideshow.browser.cjs` covers editing, reorder, selected-target
replacement, interrupted/rejected save recovery, reload, legacy recovery,
attachment failure/stale completion and generation/selection races.
`scripts/explore-workflow-panels.browser.cjs` exercises the actual Next preview
and confirms catalogue guidance alone leaves Edit slides empty.

Still requires deployed acceptance: authenticated upload, both live image
providers receiving the two references, real Library save/reload, and scheduling
the exact saved slideshow. Local fixtures do not prove those hosted integrations.

## Video editor layout: local comparison and chosen refinement

The user asked to compare placement before changing the default. The fixture is:

`http://localhost:3000/e2e/explore-format-preview?format=hook&compare=1`

- A has Create / Edit video / Demo / Schedule, with editor controls on the left.
- B has Create / Demo / Schedule, with controls beside the video in the preview
  area. When that area is too narrow, its panels stack to keep the video readable.
- The A/B switch preserves the same clip and draft. Back to preview and Edit
  reopen the draft. Both use compact Save edits and Back to preview actions.
- Generation, saving and posting are disabled. Local video uploads stay on the
  device. The comparison route returns not-found outside development.

After trying the local comparison, the owner preferred B. The local Hook app
now uses Create / Demo / Schedule and opens editing from the button beneath
each clip. Uploaded/selected hook previews offer Edit hook video and Continue
to Demo. Generated Hook results also name the edit button explicitly.
Both editors share an Edit hook video / Edit demo video header, a description
of the affected clip, a readable live preview and compact save/back actions.
The hook editor remembers whether it was opened from Create or Demo, so Back
returns to that view. The preview stays visible beside long controls on wide
screens; narrower preview areas stack the panels. The left source panel no
longer stretches to the editor's full height. This remains undeployed.

Each video editor shows one empty text box by default. Typing creates its local
overlay draft; Add text creates an additional empty block. Removing all blocks
leaves the first empty box available again. Blank/whitespace-only entries never
appear in the video preview or render request. They can still preserve their
local timing/style across reload. The API/worker text parser remains strict.
Legacy no-text and nonblank request shapes remain unchanged; adding a blank
block alone does not invalidate an otherwise identical saved output.

`scripts/explore-editor-layouts.browser.cjs` passes playback, trim, two separate
timed text blocks, A/B draft preservation, preview/reopen, direct B navigation,
compact buttons and no horizontal overflow at 1440, 1280, 390 and 320 pixels.
At desktop/laptop widths it also checks that the video stays at least 300px wide.
There were no browser errors or non-GET API calls. Screenshots are in the ignored
`.tmp/explore-editor-layouts` directory. TypeScript and scoped ESLint passed.
The extended browser check also passes the default field, blank draft reload,
separate hook/demo text and return destinations. The scheduling fixture proves
empty fields are excluded from render requests, while the two nonempty demo
messages retain their timing and the final schedule keeps its exact media ID.
Six draft helper tests and the real FFmpeg export checks pass. The generation
fixture was updated to load shared prompt/image imports and await its async
submit boundary; all fourteen generation cases pass.

Suggested hands-on task: play the clip, trim its start/end, add one message for
0–2 seconds and a second for 2–4 seconds, adjust style, return to preview and
reopen editing. Repeat using the other placement on the same window size.
Assess discoverability, how often you scroll between controls and video, and
how easy it is to return to the previous step. The automated checks establish
functional behavior. The chosen placement is based on the owner's local trial;
authenticated production acceptance remains pending after deployment.
