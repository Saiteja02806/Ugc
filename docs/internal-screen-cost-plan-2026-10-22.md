# Internal-screen cost optimization plan — 22 October 2026

Planning and source review only. No additional application changes, deployment,
production data changes or paid generation were made in this review. The earlier
homepage/font/video implementation remains locally validated and undeployed.

## Article review and application

The complete [Medium article](https://medium.com/pagepro/how-to-lower-vercel-hosting-costs-by-35-639c4cda0c61)
was read. It describes measuring usage, choosing static rendering appropriately,
reducing repeated frontend/backend reads and analyzing bundles/builds. The
[linked case study](https://pagepro.co/case-studies/vercel-cost-optimization-for-saas-scalability)
did not expose its body through the article reader; direct public retrieval
returned an HTTP 403 access challenge. Its full contents were not reviewed.

These are techniques to adapt, not evidence that UGC Pilot will reproduce the
article's percentage saving. Current screen-specific production cost attribution
has not been measured. Rankings below reflect concrete code opportunities,
shared reach and implementation risk, not demonstrated dollar savings.

UGC Pilot already has account-scoped TanStack React Query, asynchronous workers,
many static application shells and several lazy-loaded editors. Retain these
mechanisms. Do not introduce SWR alongside the existing query cache or blindly
apply shared ISR/CDN caching to private dashboard/API responses. Use the installed
Next.js 16.3.8 bundled documentation for implementation rather than copying the
article's older framework examples.

## Recommended screen order

| Order | Screens | Source evidence | Proposed work |
| --- | --- | --- | --- |
| 1 | Demo (`/library?tab=posts`) and Creative Assets (`/avatars`) | Both use `components/media/video-preview.tsx`. Its intersection observer stops after initial entry, and a no-poster preview can retain a loaded source after scrolling away. Recent upload/refresh fixes already exist separately. | Measure simultaneous media elements and requests during long scrolls. Release inactive/offscreen sources where safe; use existing posters first. Preserve playback position if required by the surface. Improve shared preview lifecycle before separately patching each grid. |
| 2 | Trending (`/dashboard`), especially Reaction editing | `components/trending/reaction-text-editor.tsx` polls preparation every 2.5 seconds and retries errors every five seconds without a component visibility/offline guard. Some Hook previews assign a source with `preload="auto"` while active state primarily controls play/pause. | Apply the existing foreground polling lifecycle to the remaining handwritten loop. Measure active/next-card video loading before changing prefetch. Keep smooth swipe navigation and final render recovery. |
| 3 | Explore Hook / Wall of Text / Slideshows, plus AI Studio | `lib/jobs/background-job-client.ts` has active-list discovery and individual job reads at five-second intervals; empty discovery uses 30 seconds. Current Explore boundaries also observe individual jobs. Some workflows already use the shared foreground helper and dynamic imports. | Trace actual observer combinations by screen before batching. Populate detail caches from suitable list results or use bounded batch reads where contracts permit. Review picker/sequence video source lifetimes. Do not remove recovery reads just because they resemble duplicates. |
| 4 | Audio generation (`/audio-generation`) | Active history polling in `components/audio/audio-generation-workspace.tsx` runs every 1.6 seconds. It already skips hidden-tab reads and avoids overlap. | Add or verify offline handling, backoff after read errors and prompt reconciliation on return. Preserve live audio streaming, voice choices and accepted-request recovery. |
| 5 | Settings (`/settings`) | `components/settings/settings-workspace.tsx` statically imports several section components, while rendering only the selected section. This shows a bundle-analysis opportunity, not proof of unnecessary API requests. | Measure route chunks, then lazy-load heavy account/media/support sections when worthwhile. Keep the section deep link, cached data, focus and navigation behavior. |
| 6 | Analytics (`/analytics`) and Scheduled (`/scheduling`) | Existing local audits already correct stale return, cancellation, hidden/offline polling and several sequential reads. | Validate the existing work and establish production timings after release. Tune cache/payload/bundles only when measurements show an unresolved issue; do not repeat already completed local fixes. |

The current sidebar and route imports were inspected to identify active screens.
Older library tabs and dormant dashboards must not be mistaken for the current
Demo or Analytics user flows.

## Regression checks for each batch

**Demo and Creative Assets**

- Cold load, long scroll down/up, multiple previews, play/pause, source change,
  dialog open/close, hidden/offline return, desktop and mobile.
- Record media request bytes, loaded video elements and decoder/source cleanup.
- Preserve correct previews, thumbnails, upload/retry/delete behavior, owned
  assets, saved collections and cached list recovery.
- Never re-encode or replace user originals merely to reduce grid transfer.

**Trending**

- Verify swipe/next-card responsiveness, current-card playback and sound rules.
- While preparation is pending, hide/offline the screen: unnecessary status
  reads stop, the worker continues, and one authoritative completion read is
  recovered on return. Preserve text, revisions, errors and retry behavior.
- A failed status read must not submit a second render/generation request.

**Explore and AI Studio**

- Check one job, multiple variations, terminal jobs, delayed/error responses,
  navigation, refresh, another tab and account switching.
- Record requests per active job and per completed batch; ensure completion
  still appears promptly and cross-device/accepted-request recovery survives.
- Preserve uploaded references, original media, source provenance, exact prompt
  text, sound rules, saved drafts and credit/idempotency boundaries.

**Audio**

- Check pending speech, saved audio recovery, stream playback, completion, read
  failure and hidden/offline return. Verify polling stops at terminal status.
- Never interpret a delayed read as a reason to purchase/generate another clip.

**Settings**

- Compare initial chunks before/after and confirm heavy sections load only when
  needed. Exercise section links, browser back/forward, focus and account changes.
- Preserve save operations, connection state and billing behavior. Read-only
  tests must not initiate checkout, reconnect or external publication.

**Analytics and Scheduled**

- Verify cached return, stale revalidation, ranges/calendar boundaries, reconnect
  identity, failure recovery and account isolation.
- Provider refresh, scheduling submission and publishing must not be replayed
  automatically on tab return. Scheduling must validate current data on submit.

## Workflow and acceptance

For each independently reviewable batch:

1. Establish a reproducible before case and record requests, bytes and relevant
   timings. Inspect route cost attribution where available.
2. Make the smallest shared change that addresses that case; retain existing
   owner-scoped caching, invalidation and async job contracts.
3. Run focused behavior/browser regressions, TypeScript, scoped lint and an
   appropriate production build check. Inspect screenshots for visible changes.
4. Compare the same case after the change and record any latency/quality tradeoff.
5. Keep deployment paused. Final authenticated/hosted acceptance must use the
   real production domain after a separately authorized release.

No workflow can guarantee the absence of every regression. These checks provide
specific evidence that the existing behaviors survived, while isolating changes
so they can be reviewed and reverted independently.

The first recommended implementation batch is **shared Demo/Creative Assets
preview lifecycle**, followed by **Trending/Audio polling guards**, then
**generation-status consolidation**. Settings bundle work follows measurement.

Build/deployment storage, Proxy execution and MCP CPU remain a separate
infrastructure review: screen changes alone do not address every billed meter.
