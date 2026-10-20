# Idle-tab performance investigation — 19 October 2026

Follow-up: the verified manual refresh/polling paths and File memo retention were
subsequently corrected locally. See [the implementation report](idle-tab-refresh-fix-2026-10-19.md).
The findings and probes below record the pre-fix investigation; production
acceptance remains outstanding.

The reported symptom is returning to the same browser tab after roughly 20–40 minutes idle and seeing the same screen lag or load again. Closing an editor or quitting the browser is not the reported trigger. The exact route has not been identified.

The leading code explanation is work triggered when the tab becomes visible again, potentially combined with old media URLs and slow requests. This investigation confirms several contributing code behaviors. It does **not** establish which one caused the user's particular incident or establish an application-wide memory leak.

Scope: current local working tree, including existing uncommitted work. No application source was changed, and no deployment was performed. Current local source is not proof of what the deployed release contains. Historical performance reports were checked against current code rather than treated as current findings.

## 1. Duplicate reads on return to Demos and Creative Assets

**Confirmed code defect and isolated reproduction; high relevance if either page was open.**

- `components/demos/demos-workspace.tsx:295` registers the same refresh handler for both window `focus` and document `visibilitychange`. Both invoke `loadDemos({ silent: true })` when visible. The loader uses request IDs to prevent an older result winning, but does not prevent starting another request or abort the older read.
- `components/media/user-media-collection.tsx:426` does the same for `loadEditProjects({ silent: true })`. There is no shared in-flight guard between these handlers and its four-second render-status poll.

When a return produces both events, both callbacks can fetch the same endpoint. The audit executed the current source handlers against synthetic event targets with the reads held pending. Each page started **two reads**. These are isolated callback probes, not observations of the user's actual browser event sequence.

This explains a return-time burst and extra state updates, not continuous growth merely from elapsed idle time. The two pages are alternatives; their listeners should not be assumed to run together. Silent Demos refresh does not deliberately replace the entire page with a loading screen.

Recommended correction: one shared, deduplicated refresh operation per account/resource, shared by visibility events and timers; bounded reads; preserve current content during refresh. Scheduling already has an in-flight `refreshing` guard (`components/scheduling/scheduling-workspace.tsx:550`), which is useful counterevidence against an application-wide duplicate-refresh claim.

## 2. Saved hook polling permits overlap and repeatedly enters loading state

**Confirmed code defect and isolated reproduction; relevant while hook renders remain pending.**

`components/library/hook-video-library-tab.tsx:95` sets `loading=true` for every `loadItems` call. Its effect at line 131 invokes that loader every five seconds while a draft is queued/rendering. There is no in-flight guard, visibility check, request deadline or fetch cancellation in that loader. Clearing the interval on cleanup does not cancel an already-started fetch.

The audit extracted and transpiled the actual loader, mocked token retrieval and held fetch responses pending. Three simulated interval ticks started **three concurrent fetches** and entered loading state three times. This validates the overlap mechanism; it does not measure actual hidden-tab timer frequency or claim a fixed number of requests accumulated during 30 minutes.

`components/media/user-media-collection.tsx:405` has a related unguarded four-second edit-status poll. Demos polling also permits overlap, although Demos has a finite attempt limit. Several newer flows are better protected: Audio skips hidden/busy polling; pending schedules and Carousel edits have in-flight guards.

Recommended correction: sequential, abortable, visibility-aware polling; stop or slow down on persistent failures; use a separate background-refresh status so existing content remains usable.

## 3. Private media URLs expire well before some cached UI data

**Expiry verified using the real implementation; conditional relevance.**

`lib/media/media-delivery.ts:13` sets protected URL lifetime to five minutes. `lib/media/media-storage.ts:583` puts that URL directly into `MediaAsset.url` for assets marked `private_user_media`. The delivery route rejects expired tokens with HTTP 404 before reading storage (`app/api/media/delivery/[assetId]/route.ts:13`).

The actual signer/verifier probe accepted a newly issued URL and rejected it at simulated +20 and +40 minutes. Meanwhile, the shared query defaults retain inactive queries for an hour and consider data fresh for 30 minutes (`components/providers/job-query-provider.tsx:25`). Asset data is also retained directly in editor state. `components/media/video-preview.tsx:152` retries the existing player using `load()` without obtaining a new asset URL.

A fresh range request or reopening a preview can therefore reuse an expired URL even though the asset still exists. This can explain a failed/reloading preview after idle. It does not explain CPU lag throughout the application. It applies to protected private assets, not every public generated video, cover or reference. No production private asset failure was observed. Current browser upload creation uses the public upload path; protected-delivery relevance depends on the actual asset metadata. Some other preview systems already have renewal logic, such as Trending hook previews; they must not be classified as missing renewal without tracing their distinct delivery contract.

Recommended correction: renew protected asset URLs using the owned asset ID before expiry or on visible resume/media authorization failure; retry once with the new URL. Preserve the existing short authorization lifetime.

## 4. Resume revalidation exists, but the 30-minute cache is not a reload timer

**Confirmed behavior; important distinction for diagnosing the symptom.**

- Global query defaults use `refetchOnWindowFocus: false`, `refetchOnReconnect: true`, 30-minute freshness and one-hour inactive retention.
- `components/generation/use-ai-studio-access.ts:25` overrides focus refresh to `"always"`.
- AI Studio and connected Explore generation opt billing into focus refresh (`components/generation/ai-studio-workspace.tsx:46`, `components/explore/workflow-generation-boundary.tsx:98`). Shared query keys deduplicate matching query reads; multiple hook consumers do not automatically mean duplicate network requests.
- Trending refreshes its feed on becoming visible (`components/trending/trending-workspace.tsx:1100`). Scheduling refreshes on focus/visibility, with its guard noted above.

Returning to these pages can start multiple **different** reads, token acquisition and UI updates. The network/CPU cost in the user's session has not been measured.

The audit tested the installed query implementation with cached data aged 31 minutes and an unresolved new read. On remount it reported `status=success`, `isPending=false`, `isFetching=true` and retained the old data. Thus stale cached data alone does **not** justify claiming that the complete screen must blank/reload at 30 minutes. Freshness does not itself schedule a refetch. Inactive-cache garbage collection is distinct from active-screen freshness.

Recommended correction: retain content during revalidation, coordinate related reads and measure their durations. If a full startup screen appears, check whether the document actually reloaded, an auth/account boundary remounted, or a failed background query switched a guard to an error view. `AuthGuard` can replace children on profile-query error even with previously cached data; that error path is not proof that it ran in this incident.

## 5. Uploaded Files are retained for the lifetime of a finishing hook

**Confirmed strong-reference retention; secondary relevance after active editing.**

`components/explore/use-workflow-finishing.ts:45` owns `Map<File, string>`. Successfully uploaded files are added at line 124. There is no deletion/clear when inputs are replaced. Each key retains the original File while the hook remains mounted, even after the visible input is replaced. Local video selection permits files up to 250 MiB (`components/explore/use-local-workflow-media.ts:32`). Retaining several such files can retain substantial backing storage, although File size does not equal JavaScript heap size or guarantee resident RAM consumption.

This grows with distinct uploaded selections, not idle duration. It cannot by itself explain an untouched fresh screen becoming slow after 30 minutes. No heap snapshot or process-memory growth was measured.

Recommended correction: use a WeakMap for object-identity upload reuse, or explicitly retain only currently needed files and clear settled entries. Separately verify preview decoder resources with a browser profile.

## Explanations not established by the evidence

- **“Explore autoplays all five covers forever.”** Historical reports described that behavior, but current `use-cover-playback.ts` gates loading on interest/visibility, removes sources when stopped and cleans up its observer/listeners.
- **“Every timer leaks across navigation.”** Reviewed effects generally clear their timers/listeners. Request overlap or un-aborted fetches are separate issues from leaked intervals.
- **“All background job polling runs every five seconds while hidden.”** The installed TanStack Query observer checks focus before interval fetches unless background interval polling is enabled. Manual intervals need separate review.
- **“Firebase logs everyone out at 20/30 minutes.”** No such application timeout was found. The token helper requests a current SDK token; token refresh/network failures would require request evidence. The UI auth cookie is configured for 30 days.
- **“Long caches prove a memory leak.”** Retention is real, but no continuously growing retained heap or disconnected DOM population was measured.
- **“The browser discarded the tab.”** Possible explanation for a complete startup screen, but unverified. Capture `document.wasDiscarded`, document navigation timing and page lifecycle on the affected browser. Distinguish a new document from an in-place refresh before changing caches.

## Validation and remaining acceptance

Diagnostic: `.tmp/session-lag-audit/probe.mjs`; output: `.tmp/session-lag-audit/results.json`. The five probe results passed after correcting the diagnostic harness's TypeScript transpilation and cross-context async flushing. Those harness corrections did not modify application code.

Command:

```powershell
node --import ./scripts/next-server-only-test-loader.mjs --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON .tmp/session-lag-audit/probe.mjs
```

Existing targeted tests: **12 passed, 1 failed** across media delivery, scheduling refresh policy and Trending polling contracts. The failing Trending source-pattern assertion expects `getTrendingPreparationCopy(useContext(TrendingPreparationContext))`; current code calls `getTrendingPreparationCopy(preparationState)` at line 1480. It is an existing assertion mismatch in this working tree, not evidence of the idle-tab cause. It was not changed as part of this analysis.

Production entry was checked at `https://www.getugcpilot.com/explore`, which redirected to `https://getugcpilot.com/explore` and then sign-in in the available test browser. There was no authenticated production soak test, no production request waterfall and no heap/CPU recording. No sign-in bypass or customer mutation was used.

To establish the actual cause, profile the affected authenticated production route: baseline, 20–40 minutes hidden, then resume. Capture document lifecycle/discard state, requests and duplicate counts on return, protected-media 404s, outstanding reads, long tasks/input latency, React commits, and process/heap/DOM measurements before and after. Use the same route with and without prior uploads. Browser timer advancement and isolated mocked probes do not substitute for this acceptance check.

Suggested implementation order: deduplicate return refreshes and manual polling; keep background refresh visually quiet; renew protected media URLs where applicable; release obsolete File references. Validate each against the real production resume scenario before declaring the reported incident resolved.

## Cross-check requested by the user

The follow-up independently re-read the current loaders, event registrations, rendering conditions, query focus implementation, private-media boundaries and upload cache. It re-ran the original diagnostic and added `.tmp/session-lag-audit/cross-check.mjs`, with results in `.tmp/session-lag-audit/cross-check-results.json`. These checks passed. No application behavior was changed.

The stronger callback checks execute the actual TypeScript-transpiled Demos and Creative Assets loaders, including their response handlers, with mocked token/data services and controlled pending responses. They are still isolated probes rather than mounted React or production-browser reproductions.

| Claim | Cross-check result | Required qualification |
| --- | --- | --- |
| Demos can fetch twice on focus plus visibility | Two actual mocked fetch invocations; only one accepted content-state update | The request-ID guard suppresses the older response. The return refresh makes zero main-loading-state updates. Duplicate network work does not prove duplicate accepted rendering or a full-page loading transition. |
| Creative Assets can fetch edit status twice | Two actual mocked fetch invocations and two content-state updates | Both return callbacks are silent; neither enables the main library loading state. A React state write is not a measured commit or long task. |
| Saved hook polling can overlap reads | Original actual-loader probe again produced three pending fetches and three loading activations | Existing cards remain rendered because the list is conditioned on `items.length > 0`. Skeletons require `loading && items.length === 0` (`hook-video-library-tab.tsx:319`, `:360`). Polling activates the loading label/spinner; it does not automatically blank an existing list. |
| Focus return globally refetches everything | Not supported | With fresh cached data, installed QueryClient/QueryObserver focus handling produced zero requests for the global `false` policy. An `always` override produced one request shared by two consumers, retained data and `isPending=false`. |
| Previously uploaded Files remain cached | Actual extracted upload function retained two distinct File keys after two uploads and reused the first without another upload | Strong-reference retention is confirmed. No heap measurement establishes RAM growth, and idle time alone adds no entries. |
| Private URLs expire | Original real signer/verifier again rejected +20/+40 minutes | Deliberate expiry is not itself a defect. A stale-link recovery defect matters only for a screen actually holding such a private URL. Current generic upload creation does not implement switching to private writes. This is not an established cause of whole-app refresh. |

The observed return refresh mechanisms are real. Calling all of them proven causes of the user's application-wide lag would exceed the evidence. There is no verified 20–40-minute application-wide reload timer, no authenticated production reproduction, and no measured proof of sustained CPU or heap degradation. The user's observation that multiple parts refresh is consistent with the explicit per-page resume handlers and query overrides; it does not determine their cost or establish that every finding participated in that incident.
