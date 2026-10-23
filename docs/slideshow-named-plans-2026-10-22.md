# Manual Explore slideshow: named images and per-slide execution plans

22 October 2026. Local implementation; production migration and deployment have
not been performed by this task. Automatic Trending Carousel is unchanged.

## User experience

The user keeps one input bar and can write, for example:

> Change the headline on Source slide 1. Put Upload C inside the laptop on Source
> slide 4. Keep the rest of both slides unchanged.

Selected source numbers refer to the original slideshow. Selecting originals 1
and 4 produces outputs 1 and 2, while their names remain Source slide 1 and Source
slide 4. The manifest carries original reference ID, slide ID and number next to
the exact selected URL; the server checks that pairing against the catalogue or
owned uploaded source before planning.

Attachments have visible Upload A/B/C labels inside the same input bar. The
owner/source-scoped composer saves the name registry, including removed names:
removing A leaves B unchanged, and a new image gets C. Recovery migrates old
image-ID-only drafts. Existing accepted results are named Current slide.
Recreating within the same selected source set retains its attachments; changing
accounts or source sets keeps drafts separate. Changing the active source during
an edit cannot renumber the source-scoped attachment draft.

When assignment is ambiguous, short questions appear beside the same input bar.
The user amends the instructions and clicks Generate again. There are no new
per-slide setup forms and no automatic paid generation on hydration or typing.

## Planning and validation

- The new UI submits `slideshowContext.version = 1` alongside the original
  prompt, ordered reference URLs, owned upload IDs and optional edit-target ID.
- One explicit Generate makes one image-aware structured planning request. The
  planner sees labelled pixels, original source numbers, stable upload names and
  the user's full request. The optional sparkle rewrite remains text-only.
- The result has ordered target IDs, per-target instructions and preservation
  requirements, semantic attachment roles, explicitly unused uploads and any
  unresolved questions. Server validation rejects invented targets/uploads,
  duplicate or orphaned assignments, unselected targets and count changes.
- Roles are screenshot, product, person, background, style or other. The same
  upload can intentionally serve multiple slides. Distinct logical roles survive
  physical deduplication if a source and attachment resolve to the same URL.
- With uploads but no selected source/current result, the planner must identify
  the requested uploaded base explicitly. It cannot automatically choose the
  first upload. An unclear base requires a question.
- Only validated plans without questions can reserve image credits. Each plan
  must fit the provider prompt bound; inputs are never silently truncated.

## Durable admission and execution

Migration `20261022092140_slideshow_execution_plans.sql` creates private
owner-scoped receipts with RLS, no anon/authenticated grants, a service-only
security-invoker claim function, payload-hash conflicts and a separate 200/day
planning bound. The optional text rewrite keeps its own existing quota.

Claims precede text-provider submission. SDK retries are disabled. Pending,
uncertain, failed and completed requests reuse their receipt rather than making
another planning call. Pending receipts older than five minutes become failed;
the service's 90-second acceptance deadline and pending-only save prevent a late
result from starting image work after expiry. Questions reject image admission
and clear only the pending browser submission, retaining the editable draft.

New image jobs use reference contract v4. Each job freezes:

1. The full original user prompt for history and recovery.
2. One compiled per-output plan and stable image-ID/name/index assignments.
3. Physical provider inputs with the target base first, followed only by that
   target's assigned uploads. Sibling sources and unrelated uploads are omitted.
4. The server-frozen business context and original-source Remix provenance.

The worker builds the effective prompt from that plan, rather than re-sending
the full multi-slide request. Nano Banana receives names interleaved with their
image parts. OpenAI receives the same physical image order, named files and the
number/name/role crosswalk in the prompt. The complete plan participates in the
provider-operation fingerprint. A plan/output-position mismatch fails before
provider reservation. Source Remix provenance survives later edits of accepted
results without substituting their generated pixels or a newly selected source.

Previously accepted v2/v3 jobs keep their original prompts, input order,
fingerprints and provider-recovery behavior. Legacy clients without the new
manifest remain on v3; new UI requests never silently downgrade if planning is
unavailable. Shared worker helpers use explicit TS source imports where consumed
by Next; TypeScript rewrites these to JS in the worker build.

## Verification and limits

Final local checks: 244 API/planning/receipt/composer/editor/recovery tests,
48 worker/provider-adapter checks, and the additional same-input clarification
regression passed (293 distinct checks). Application TypeScript, scoped ESLint,
worker compilation, production `next build` and the postbuild route-bundle check
passed. The first production build exposed shared worker `.js` source imports;
explicit `.ts` imports repaired resolution while emitting the same worker JS.
The final production build receipt is `.tmp/slideshow-named-build.exit` = 0.
Three real-component browser suites passed: the named attachment strip, source
picker and slideshow editor/recovery suite. Browser fixture 503/404 responses
are deliberate failure/recovery cases, not hosted-service acceptance.

The local tests exercise the actual API parser/queue compiler, worker and provider
adapters with stubbed external services. Cases include original slides 1 and 4,
different uploads per slide, skipped upload letters, repeated versions, owned
edit targets, duplicate pixels with separate roles, missing/stale/foreign inputs,
questions before credit reservation, lost-response recovery and legacy jobs.
PGlite verifies receipt replay/conflicts, expiry, owner isolation, role grants and
late-save fencing. Browser checks use the real composer, picker and editor with
local media/API fixtures, including upload removal/reload, recreation, owner
switching, keyboard/touch previews and 14-image scrolling at 320px. Source-picker
layout is checked from 320px through 1900px.

These checks establish image delivery, identity and execution scope. They do not
prove that a live planner understands every natural-language request, that an
image model preserves all requested details, or that a screenshot is inserted
pixel-exactly. Exact screenshot compositing, persistent multi-turn conversation,
editable-text automation and visual acceptance grading remain separate work.
No paid model requests were made for these tests.

Local evidence is in `.tmp/slideshow-named-*.log` and browser screenshots in
`.tmp/slideshow-reference-stack/` and `.tmp/explore-slideshow-browser/`.

## Release sequence

1. Apply the private-plan migration to the intended environment.
2. Release and verify the v4-aware image generation worker before the website.
3. Release the website with its verified vision-capable planning-model config
   (`OPENAI_SLIDESHOW_PLAN_MODEL`, otherwise the existing prompt/text model).
   Planning requires the existing server OpenAI and database credentials.
4. Check the signed-in production domain with an approved real request; inspect
   each saved job's scoped plan, actual inputs and visual result.

This task does not deploy, modify existing saved images, or authorize the
previously deferred public upload of staged reference-catalogue images.
