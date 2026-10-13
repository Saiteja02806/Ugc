# Explore performance audit — 12 October 2026

The Explore screen has concrete performance issues and several paths that can amplify intermittent waits. The strongest finding is that the shared Explore menu is cached in production, while all five workflow destination pages still require uncached server rendering. Eager cover videos, sizeable workflow JavaScript, blank creation-panel loading states and repeated library requests add further pressure.

A persistent multi-second character-builder freeze was **not** reproduced in the signed-in browser session. This audit confirms avoidable waiting and identifies credible causes of intermittent slowness; it does not establish the exact cause of a historical long wait or a production p95.

## Follow-up status check — 12 October 2026

Rechecked the current worktree and production after the user asked whether these issues had been solved. **None of the seven findings below has been addressed by the current source changes or shown to be fixed in production.** The preceding work was an audit, with no performance implementation or deployment performed by this chat.

| Finding | Current status | Follow-up evidence |
| --- | --- | --- |
| Uncached workflow entry pages | Still open | All five production destinations still return MISS / private no-store. |
| Eager cover-video loading | Still open | All five signed-in production elements still use autoplay and preload=auto, with the same video sources. |
| Sizeable workflow code / blank control fallback | Still open | All eight checked routes reference the same script URLs as the audit; the common workspace imports and null creation-panel fallback remain. |
| Repeated library fetches | Still open | Video/audio pickers still fetch on every open; My influencers still explicitly refetches. |
| Per-character source-job lookups | Unaddressed scaling risk | The list implementation still fetches one source job per selected asset. Large-library impact remains unmeasured. |
| No bounded deadline on several opening reads | Unaddressed stall risk | The audited read paths still have lifecycle cancellation without an application request timeout. |
| Missing Quick start pending indicator | Still open | All four signed-in production shortcuts still lack the pending indicator; source still renders a fixed arrow. |

Fresh public document response-header samples were 610 ms for characters, 576 ms for Talking Head, 552 ms for Hook, 1,702 ms for Wall of text and 1,626 ms for Slideshows. These are server-response observations, not full authenticated click-to-ready times. Explore and Audio generation returned HIT. All eight checked routes referenced the same script URLs as the original audit.

In a fresh signed-in tab, the character destination URL, main heading and prompt appeared in 629 ms. Generation access was initially still checking and subsequently completed; its full completion duration was not measured. No captured warning/error was reported. The severe intermittent opening stall remains unconfirmed, and a fast individual opening does not prove it has been fixed.

The earlier static Explore menu and return-navigation improvement remains in place. Current local character changes concern generation progress, model labels and failed-batch recovery; they do not resolve the audited navigation/caching/library findings. Raw follow-up public evidence is in `.tmp/explore-performance-audit/status-recheck.json`.

## Scope and method

- Tested the real production domain, `https://getugcpilot.com`, reached through `https://www.getugcpilot.com/explore`, using the existing signed-in in-app browser session.
- Opened all nine Explore entry links: five workflows and the four Quick start tools. Reviewed their page, component, authentication, data-fetching and loading paths.
- Exercised character History/My influencers, reference previews, slideshow slide switching, reference pagination/filtering, Talking Head Edit/Schedule, and the existing-video Creative Assets picker. No paid generation, upload, media save, schedule submission or publishing was initiated.
- Measured each of the five workflows twice after visiting the destinations, waiting for the destination URL, its `h1`, and its prompt field. These are warm-session automation wall times, including browser-tool overhead, not native Interaction to Next Paint measurements or cold first-visit measurements. Returning to Explore used its visible Back to Explore link.
- Made three public document GET requests per route and retrieved their referenced public JavaScript files. These unauthenticated requests measure the publicly served document response, cache headers and decoded script sizes; they do not measure authenticated APIs or complete page readiness. The initial requests to the eight routes ran concurrently. First-observed latency is not proof of a function cold start.
- Checked public cover sizes with HEAD requests and verified the five production video elements' autoplay/preload attributes.
- Earlier timing attempts that matched workflow-card headings were discarded. The accepted repeat measurements distinguish the destination URL and `h1` from the card heading.
- No application source was changed. Existing and concurrently changing worktree edits were preserved. The findings combine deployed measurements with source inspection; the entire current worktree was not asserted to match the deployed commit.

## Production measurements

### Public document response

Time to first response headers, in milliseconds. All requests returned HTTP 200.

| Destination | Three samples | Production cache | Decoded JS referenced by document, KiB |
| --- | --- | --- | ---: |
| Explore | 369, 84, 154 | HIT | 837 |
| Build AI influencer | 548, 305, 361 | MISS / no-store | 1,319 |
| Talking Head + Demo | 711, 320, 367 | MISS / no-store | 1,585 |
| Hook video | 569, 318, 293 | MISS / no-store | 1,582 |
| Wall of text | 1,038, 307, 295 | MISS / no-store | 1,582 |
| Slideshows | 1,870, 344, 342 | MISS / no-store | 1,582 |
| AI Studio | 623, 296, 368 | MISS / no-store | 1,240 |
| Audio generation | 824, 89, 87 | PRERENDER, then HIT | 885 |

The five workflow responses and AI Studio identified `bom1::iad1` in their Vercel request IDs: the probe reached Mumbai's edge and the dynamic function ran in the US East region. This adds a remote-server dependency for these requests. Database-region alignment was not measured, so moving functions alone is not an established fix.

Script sizes are decoded file sizes, including shared framework/authentication code, not compressed network transfer. Browser caching and prefetching can mean these files are already available before a click. Script URLs absent from Explore's document account for approximately 493 KiB on the character page and 756–760 KiB on the other workflows; this is a file-set comparison, not an authenticated navigation waterfall.

### Signed-in workflow navigation

| Workflow | Destination shell visible, two samples | Prompt visible, two samples |
| --- | --- | --- |
| Build AI influencer | 512 / 469 ms | 532 / 484 ms |
| Talking Head + Demo | 577 / 777 ms | 598 / 790 ms |
| Hook video | 554 / 480 ms | 627 / 496 ms |
| Wall of text | 478 / 527 ms | 748 / 542 ms |
| Slideshows | 507 / 608 ms | 525 / 625 ms |

Warm Back to Explore observations ranged from 99 to 704 ms. The existing static Explore menu and return-navigation work are functioning in this session.

The first observed Slideshows destination shell appeared in about 1.38 seconds, initially with its Create heading and without its image prompt. The prompt appeared subsequently. Its complete first-visit prompt-ready time was not captured.

The four Quick start links reached their respective destinations in approximately 0.91 seconds for AI Studio, 1.48 seconds for Video generation, 1.20 seconds for Image generation, and 1.15 seconds for Audio generation. The image measurement waited for the prompt; the others measured destination visibility. AI Studio history and Audio recommended voices still showed loading states at initial arrival, so these times must not be treated as complete data-ready times.

Reference dialogs and local tab/slide/pagination actions generally responded within several hundred milliseconds in the automation checks. A category checkbox action took about 1.1 seconds, including the browser action; no sustained filter freeze was observed. Reopening Creative Assets took **1,460 ms** until its loading status disappeared and its 34 usable video choices were available.

The browser's captured warning/error log was empty at the end of the signed-in checks.

## Findings and recommended order

### 1. Workflow entry pages unnecessarily require an uncached server response — highest priority

**Confirmed in production and source.** Every workflow returned `x-vercel-cache: MISS` with `private, no-cache, no-store` headers. The character, Hook, Wall of text and Slideshows pages await `searchParams` solely to determine a development preview. Their production page shells do not fetch user data. Talking Head also awaits a preview flag and applies generation feature flags.

Relevant source: `app/explore/build-character/page.tsx:12`, `app/explore/hook-video/page.tsx:6`, `app/explore/wall-of-text/page.tsx:6`, `app/explore/slideshows/page.tsx:6`, `app/explore/create-hook/page.tsx:7`. Compare the existing static production pattern in `app/explore/page.tsx`.

Default Next Link prefetching partially prefetches dynamic destinations with a loading boundary. It does not reliably make their complete dynamic page available before navigation. `app/explore/loading.tsx` already exists, and workflow cards already have pending indicators; this is not a missing-global-loading-boundary finding.

**Recommendation:** Make the shared production workflow shells prerenderable and move development preview query handling into a client-only preview entry. Preserve Talking Head's production feature flags and its preview disabling rules. Keep authentication, business-profile checks and owned account data protected and separate from the shared shell. Evaluate intentional full-route prefetching only after considering its extra work and bundle cost.

### 2. Explore eagerly mounts five cover videos totalling 8.34 MB

**Confirmed configuration; device impact not profiled.** All five deployed cover elements use `autoplay` and `preload="auto"`. Their deployed file sizes total 8,341,843 bytes, approximately 7.96 MiB. The Talking Head, Wall of text and character covers each exceed 2 MB. The components only gate playback on reduced-motion preference; they do not explicitly gate source attachment/playback on viewport or document visibility.

Relevant source: `components/explore/explore-workflow-card.tsx:12` and `:42`; `components/explore/ai-character-card.tsx:15` and `:39`.

**Recommendation:** Keep posters available immediately; attach/preload video sources on visibility or user intent, pause hidden/offscreen covers, and reduce cover file sizes where acceptable. `preload` is a browser hint, so 8.34 MB is the aggregate asset size, not proof that every browser transfers all those bytes immediately. No CPU or frame-drop trace was captured, so the videos are a plausible contributor to weaker-device lag, not a proven cause of a particular freeze.

### 3. Initial workflow code is sizeable, and creation controls can arrive into a blank panel

**Confirmed size and observed loading behavior.** The non-character workflow documents reference approximately 1.55 MiB of decoded JavaScript. `FormatWorkspace` imports video editing, slideshow editing, Demo and Schedule functionality in the common workspace. Image/video generation panels load dynamically but are wrapped in a `Suspense` boundary with a null fallback. The first Hook and Slideshows arrivals showed the workflow shell before their creation prompt appeared.

Relevant source: `components/explore/format-workspace.tsx:24`, `:46`, and `:444`.

**Recommendation:** Split functionality by format and defer heavy editing/scheduling UI until first use, retaining it after activation when needed to preserve drafts and job polling. Give creation controls a useful loading skeleton instead of an empty area. Measure chunk download/parse and main-thread work before assigning a specific library blame.

### 4. Library pickers repeat network waits instead of immediately retaining fresh results

**Confirmed code and a live repeated wait.** Creative Assets refetches on every open, switches back to a loading view, and calls unfiltered `/api/media` before filtering to usable videos in the browser. That API lists broader media and then loads generated-job metadata. Saved audio similarly clears its list and reloads `/api/audio/history` on every open. My influencers explicitly refetches its query whenever opened, even when its account query is fresh, although cached character rows can remain visible there.

Relevant source: `components/explore/workflow-video-asset-picker.tsx:17`, `app/api/media/route.ts:43`, `lib/media/media-storage.ts:192`, `components/explore/workflow-saved-audio-picker.tsx:23`, `components/characters/character-workspace.tsx:87`.

**Recommendation:** Use account-scoped query caches, retain visible fresh results while refreshing, and invalidate after relevant changes. Give the video picker a video-only paginated read instead of requesting the broader library. Keep selected-asset ownership/readiness checks in place.

### 5. Character library verification grows to one list query plus up to 100 job queries

**Confirmed scaling risk; not reproduced with a large character library.** The initial character-builder visit starts the saved-character lookup even before My influencers is opened. The server lists up to 100 selected assets, then fetches each asset's source job through `Promise.all`. Those requests are parallel, not serial, but they can create a large database fan-out. Opening My influencers can trigger this again through the explicit refetch.

Relevant source: `components/characters/use-character-builder.ts:65`, `lib/characters/identity.ts:67`, `lib/characters/identity-service.ts:256`.

**Recommendation:** Batch source-job retrieval, preserve the existing owner and trusted-character validation, and consider pagination/lazy fetching for library browsing. This lookup runs alongside generation access and does not gate rendering the whole character shell. It should not be described as 100 sequential queries blocking the page.

### 6. Several opening requests have cancellation but no application timeout

**Confirmed risk; a stalled request was not reproduced.** Character reads, reference-catalog reads, the business-profile gate and the video/audio pickers lack a bounded request deadline. AbortController cleanup cancels abandoned work, but it does not time out a request while the screen remains open. A stalled request can keep references/pickers loading, generation access checking, or the initial workspace gate visible for a long time. Retry happens after rejection; it does not resolve a request that remains pending.

Relevant source: `components/characters/use-character-builder.ts:13`, `components/explore/recreate-workspace.tsx:260`, `lib/business-profiles/profile-gate-query.ts:19`, `components/explore/workflow-video-asset-picker.tsx:26`, `components/explore/workflow-saved-audio-picker.tsx:36`. Token acquisition in `lib/firebase/auth.ts:240` precedes these fetches and is another distinct wait to instrument.

**Recommendation:** Add bounded deadlines to read paths, combine them with lifecycle cancellation, show explicit retry states, and record token wait, API duration and data-ready time separately. Do not apply aggressive timeouts or blind retries to generation/publishing mutations.

### 7. Quick start links lack the pending feedback already used on workflow cards

**Confirmed source difference.** Workflow/character cards use `ExploreLinkIndicator` with `useLinkStatus`; Quick start links show a fixed arrow only. On a delayed AI Studio transition, a click can look ignored until the next route or its fallback appears.

Relevant source: `components/explore/explore-workspace.tsx:38`, `components/explore/explore-link-indicator.tsx:10`.

**Recommendation:** Reuse the pending indicator and status text on Quick start links. This improves perceived responsiveness; it does not shorten the underlying request.

## What is already helping

- Explore is static and returning from workflows was fast in the repeat sample.
- Business-profile results are cached for 30 minutes, rather than rechecked on every normal workflow click.
- Reference data shares an account-scoped 30-minute cache across the three format workflows.
- Reference grids initially render a limited batch; videos use `preload="none"` and start on hover/focus rather than all autoplaying like Explore covers.
- Character history is fetched on demand and paginated. Generation-access and character-list queries run independently.
- Local preview/filter/tab actions do not start paid generation. Their shared controls were responsive in the tested session.

## Remaining verification limits

The browser connection exposed DOM state and console logs but not a Performance/INP trace or authenticated per-request network waterfall. Browser timings therefore do not prove image decode, video first-frame readiness, complete generation eligibility, or server/database processing time. No low-end-device CPU profile, slow-network emulation, large-character-library benchmark, stalled-request test or historical invocation logs were available in this audit.

After implementing the fixes, repeat authenticated production checks for first visit, fast clicks before prefetch completes, return after router-cache expiry, large libraries and unstable connections. Capture destination-shell, controls-ready and API timing separately. Suggested targets such as immediate click feedback and sub-second cached controls should be treated as proposed acceptance criteria, not existing guarantees.

Raw public measurements and probe scripts are retained under `.tmp/explore-performance-audit/` and `.tmp/explore-performance-audit.mjs`. This report contains the accepted measurements needed to assess the findings.
