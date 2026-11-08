# Explore performance audit — 7 November 2026

Status: read-only production audit plus local microbenchmarks. No application code changed, no build, deployment, paid generation, scheduling write, schema, prompt or model change. User report: Explore is slow/laggy in production, especially after 5–30 minutes idle/returning later, sometimes when clicking a workflow, and across the workflow surface.

Incident: `UGC-UI-20261107-EXPLORE-LAG-AUDIT` (`docs/ai-context/clear.md`, `docs/ISSUES_LEDGER.md`).

## What was measured

- Production domain `https://vidmake.io/explore`, public landing page and public workflow documents.
- Playwright/Chromium (Microsoft Edge channel), 1440×900 and 390×844, `prefers-reduced-motion: no-preference`.
- Controlled A/B: the same page with cover media playing versus blocked, so the difference isolates video/compositor cost from layout/JS.
- Node microbenchmarks of the real text-layout and glyph-path modules used by the editor.
- Warm HTML/headers/asset sizes over HTTPS.
- Signed-in pages, the real 5–30-minute idle failure and the user's physical display were **not** reproduced; see limits.

## Headline numbers

| Area | Measurement | Status |
| --- | --- | --- |
| Explore landing transfer | 4,300,838 bytes / 48 responses; 3,760,742 bytes (87%) is five cover MP4s | MEASURED |
| Explore landing navigation | TTFB 199 ms, DOMContentLoaded 774 ms, load 927 ms (warm edge, this machine) | MEASURED |
| Frame pacing, desktop | 5 covers playing = **30.6 fps** (avg frame 32.7 ms); media blocked = **60.8 fps** (16.5 ms) | MEASURED A/B |
| Frame pacing threshold | 1 cover = 60.8 fps; 2 covers = 30.6 fps; 3 = 30.7; 5 = 30.5 | MEASURED A/B |
| Frame pacing, mobile scroll | 390×844, 3 covers playing = **30.6 fps**; media blocked = **60.7 fps** | MEASURED A/B |
| Workflow initial JavaScript | Hook/Wall/Slideshow: 36 scripts, 1,975 KiB decoded, 597 KiB wire. Talking Head: 40 scripts, 2,248 KiB decoded, 680 KiB wire. Explore: 21 scripts, 875 KiB decoded, 282 KiB wire | MEASURED |
| Workflow document response | 66–80 ms warm TTFB, `x-vercel-cache: HIT` (previously open finding is fixed) | MEASURED |
| Reference catalogue | 464,374 bytes JSON (74,102 bytes brotli); 183,385 bytes are `generationPrompt`; 266 items + 35 archived; `no-store`/`force-dynamic` | MEASURED |
| Text layout cost | 2.9 ms / 100 chars, 6.0 ms / 300, 16.5 ms / 800, 41.6 ms / 2,000, **124.6 ms / 6,000** (single overlay, one layout call) | MEASURED |
| SVG caption paths | **16.6 ms per 600-character line** (600 `<path>` strings); recomputed on editor renders | MEASURED |
| Drag re-layout | `positionFormatText` calls layout again: **123.7 ms** for a 5,600-character wall text | MEASURED |
| 20 overlays | 20 × 300-char layouts = **177.6 ms per render** on top of path generation | MEASURED |
| Hidden → return | All 5 covers unload (readyState 0) and restart from 0 s; returned to 2.37 s after 2.5 s at 30 fps | MEASURED |
| Cover HTTP cache | `public, max-age=0, must-revalidate` on content-hashed MP4/WebP | MEASURED |

## Findings, ranked by user impact

### 1. Five covers autoplay together and halve Explore to ~30 fps — highest priority

Every intersecting cover starts playing (`continuous = true`). The observer treats any intersection, even one pixel, as visible, so desktop has five videos decoding at once and mobile scroll commonly has two or three.

Measured on the same production page:

- 5 playing: 30.6 fps (avg 32.7 ms/frame)
- media blocked: 60.8 fps (16.5 ms/frame)
- 1 playing: 60.8 fps
- 2 playing: 30.6 fps

The five cover files total 3,280,410 bytes; the page transfers 3,760,742 bytes of video across 10 media responses. The 2.2 MB AI-character cover is 30 s long and alone is two-thirds of the video weight.

This is the most likely explanation for the landing page feeling laggy while scrolling or moving the pointer. The 30 fps cap is a controlled Chromium result on this machine; a different GPU/decoder may not have the exact 2-video threshold, but the decode/compositor load and the bandwidth cost are real.

**Recommended repair:** keep all posters, but allow at most one active cover at a time — the hovered/focused card, or the most-visible card on touch/scroll. Pause and release the others, resume with a short stagger. The measured 1-cover case already restores 60 fps. This preserves the cover concept while removing the concurrent-decode cost. Needs explicit approval because it changes the current “all covers play” behavior.

**Also:** add immutable cache headers for the active content-hashed cover assets (`/explore/covers/*-<hash>.mp4|webp`) so a reload/return does not revalidate 3.6 MB. Current headers are `max-age=0, must-revalidate`. Use the exact active paths, not the entire legacy cover directory.

### 2. First workflow entry carries ~1.1–1.4 MiB of decoded JavaScript beyond Explore

The static route is fast now, but the client bundle is large:

| Route | Initial scripts | Decoded | Wire |
| --- | ---: | ---: | ---: |
| Explore | 21 | 875 KiB | 282 KiB |
| Hook / Wall / Slideshows | 36 | 1,975 KiB | 597 KiB |
| Talking Head | 40 | 2,248 KiB | 680 KiB |
| Build AI influencer | 26 | 1,206 KiB | 379 KiB |

`FormatWorkspace` statically imports `FormatDemoSection` (~108 KiB chunk) and `FormatSchedulePanel` (inside a ~368 KiB chunk), and renders all step panels with `keepMounted`. The text-measurement glyph table is a ~141 KiB chunk in the initial entry. So a user who only opens Create still parses demo, schedule, text-style and font-metric code.

Intent prefetch hides this on a normal hover, but a fast hover→click or a touch/pen interaction starts navigation before the prefetch completes. That matches “sometimes when I click on workflow”.

**Recommended repair:** move inactive step panels (Demo, Schedule, editors, glyph tables) out of the synchronous entry while keeping their mounted/draft-preserving behavior where required; measure chunk size and first-click time before/after. Keep the existing intent prefetch and do not switch to eager prefetch of every card.

### 3. Text editing re-measures and re-generates glyph paths on every render/keystroke

This is the likely cause of editor/drag lag when the user selects “all of the above”.

- `formatTextLayout` measures every word and character. It costs 2.9 ms at 100 chars, 16.5 ms at 800 and 124.6 ms at 6,000.
- `FormatVideoTextOverlay` calls `referenceCaptionPaths`, which creates one SVG `<path>` per character for the `reference-social`/`reference-classic` presets. That is 16.6 ms per 600 characters, and 600 DOM path elements.
- `FormatVideoEditor` recomputes all overlay layouts on every render; `FormatVideoTextOverlay` computes its layout again.
- Every keystroke updates editor state, re-renders the editor, calls `onClipStateChange`, and re-renders the parent (which also runs the always-mounted Demo section’s text layout in Hook).
- `onTimeUpdate` updates `time` ~4 times per second and re-renders the same expensive subtree even though the text content did not change.
- Dragging calls `positionFormatText`, which runs layout again (123.7 ms for a 5,600-character wall text).

At the wall-text 6,000-character limit, a single keystroke or drag step can block the main thread for over 100 ms. The default Hook limit is 600 characters, which is already around 30–40 ms per update with path generation.

**Recommended repair:** cache layout and glyph paths by content/font/size/dimensions; pass the computed layout into the overlay instead of recomputing it; render native `<text>` during editing (keep path rendering for the final/exported preview if fidelity requires it); translate a cached SVG group during drag rather than regenerating paths; coalesce pointer/time updates with `requestAnimationFrame` or `useDeferredValue`; keep text styling and export pixels unchanged. Visual comparison is required before changing the glyph renderer.

### 4. Returning from idle restarts all covers and can meet a revalidating cache

Current `useCoverPlayback` deliberately unloads every cover when the tab is hidden (`stop()` removes the source and calls `load()`), then assigns and plays every cover again on `visibilitychange`/`focus`/`pageshow`/`online`.

Measured: after a simulated hidden period, all five covers were at readyState 0; on return all five restarted at 0 s and played at 30.6 fps. Warm resume had 0 media requests because the files were still in the HTTP cache, but the headers are `max-age=0, must-revalidate`, so a cold or evicted cache must revalidate or refetch 3.6 MB right when the user returns.

This is a direct “after idle / returning later” contributor on Explore, separate from the route-transport stall recorded in `UGC-UI-050` and the 5 November idle-recovery work.

**Recommended repair:** pause (do not release) the active cover while hidden; on return resume it in place. Stagger resume/recovery of any other covers instead of reloading them together. Keep the immutable cover cache. If memory pressure requires release, release after a delay and restore only the active cover.

### 5. Idle click recovery still ends in a 15-second wait and a full document reload

`WorkspaceNavigationFeedback` shows “Opening page…” and after 15 seconds switches from client navigation to `window.location.assign()` for Explore → workflow links. The local diagnosis work established that an in-flight Next route request can stay pending when transport stalls; the fallback is a recovery, not a fix for the stall.

The first click after idle can therefore wait 15 seconds, then reload the destination document (which must download the route JS again). A faster, bounded probe on resume — or an explicit long-idle policy that uses document navigation for the first outbound click — would remove the visible dead wait. Do not shorten the timeout blindly without measuring false positives on slow networks.

### 6. Lower-priority inefficiencies confirmed in source

- The public reference catalogue returns all 266 references and the 183 KB of generation prompts to every workflow. The gallery filters client-side by format. Format-scoped reads, or fetching prompts on selection, would cut parse/memory and payload. It is already React-Query cached for 30 minutes, so this is a first-open / expired-cache cost.
- `useCreatorAccounts` fetches creator accounts (including long prompts) on Hook/Slideshow open before a creator account is selected.
- `ExploreWorkspace` uses `useAuth()` for the Sign up button, and every `ExploreWorkflowCard` subscribes to auth through `useExploreWorkflowPreload`. Auth resolution re-renders the whole card grid and removes the Sign up button, a small layout shift and avoidable work. Isolating the auth-dependent header action is safe.
- A hidden server-rendered duplicate of the Explore page (`div#S:0`, five articles) was present in the production DOM. It appears to be Next route prefetch for the current route (the sidebar Explore link has `prefetch={true}` while active). It is not hydrated and does not decode video, but it doubles that DOM and its images. Disabling prefetch on the active sidebar item is a small, low-risk cleanup.
- The video asset picker still reads the broader video collection and filters client-side; the previously measured 1.46 s open cost was not re-measured this time.
- `FormatWorkspace` creates the wall schedule composition on every render; its parse/stringify cost is small in the microbenchmark (0.03 ms), so this is not a priority compared with text layout.

## What is already good

- Workflow entry documents are now static/cached (`HIT`, 66–80 ms warm TTFB); the 12 October “uncached workflow pages” finding is fixed.
- Explore links warm only on intent; all-card eager prefetch is not active.
- Quick-start pending feedback and the stable pending indicator are present.
- Read deadlines (20 s) cover many authenticated reads; job polling pauses when hidden and resumes once.
- Reference cards use `preload="none"` and start only on interest; the gallery renders a bounded batch.
- Covers were already compressed from ~3.89 MB to ~1.59 MB in the previous release; the remaining issue is concurrency and the 2.2 MB AI cover, not the file count.

## Proposed acceptance targets

These are proposals, not current guarantees:

1. Explore at 390 and 1440: scroll and hover stay at the display refresh rate with covers active; at most one cover playing at once; no visible restart jump after tab return.
2. First Explore load: cover video bytes deferred; initial transfer materially below 1 MB before the first cover.
3. First workflow entry: route controls usable within 1 s warm and 2 s cold on a normal connection; no inactive Demo/Schedule/text-metric chunk in the entry; no regression in mounted drafts.
4. Text editor: keystroke-to-paint within one frame for 600-char Hook text and under ~50 ms for the 6,000-char Wall limit; drag stays above 50 fps on the test machine.
5. Idle return: no 15-second dead click; one bounded probe/recovery, no duplicate jobs, drafts retained.

## Limits and open questions

- The 30 fps result is a controlled Chromium A/B on this machine (headless and offscreen headed runs agreed). A physical display with hardware decode may behave differently, but the decode/compositor work and 3.6 MB transfer remain.
- Real 5–30-minute production idle, signed-in workflow timings, and the user’s device/refresh rate were not reproduced. The route-transport stall remains the open part of `UGC-UI-050`.
- No authenticated production trace was captured for the workflow data reads; bundle and catalogue sizes are measured from the public documents and the repository.
- No change was made to cover playback, prefetch, text rendering, scheduling, prompts, models or storage. The next step needs a scoped approval for each repair because finding 1 changes a visible behavior and finding 3 touches text fidelity.

## Suggested order of work

1. One-active-cover policy + immutable cover cache + resume without restart (largest measured FPS/bandwidth win; visible behavior change, needs approval).
2. Memoize/coalesce text layout and glyph paths; native text during edit; translate during drag (largest editor win; visual comparison required).
3. Split inactive workflow step panels and font metrics from the entry bundle; measure click-to-controls.
4. Improve idle resume/click recovery and add instrumentation for route transport, token wait and data-ready time.
5. Format-scope the catalogue and move prompts to selection if the first-open payload still matters after 1–3.


## Console follow-up, 7 November 2026

The user supplied production console output. Two app-related messages were checked; one is a browser extension.

### Preloaded font warning is real, and the font is downloaded twice

Document/network evidence:

- Preload link: `/_next/static/media/27834908180db20f-s.p.woff2?dpl=dpl_6hgnHyhnUXiQrLJY5QhEg3WW54VV`
- The render-blocking CSS `af0550f5e4ba2300.css` references the same file with an older deployment query: `?dpl=dpl_G5A9YWn6fUDSX61YzhESNqkZyEvm`.
- Both URLs return the same 69,436-byte font with the same ETag, but the browser treats them as two resources: one `link` fetch and one `css` fetch, 139,472 bytes total. The preload is therefore unused, which is exactly what Chrome reports.
- The mixed deployment IDs are global, not Explore-specific: `/`, `/sign-in` and `/explore` preload `dpl_6hgn...` while their shared CSS references fonts from `dpl_G5A9...` and `dpl_5V82...`. `/pricing` has no font preload and no warning.
- This is a build/promotion asset mismatch (the CSS keeps older `next/font` deployment queries), not an Explore component defect. It wastes ~70 KiB and one request per page with the preload; it does not explain the 30 fps cover result.

Safe options, in order:

1. Resolve the deployment font-asset mismatch with a clean production build/deploy and verify the preload URL and the CSS font URL share one `?dpl` value. This keeps the intended early font fetch.
2. If a clean build keeps mixing deployment IDs, set `preload: false` on `geistSans` in `app/layout.tsx` as a measured workaround. The CSS already fetches the font, so this removes the wasted 69 KiB request and the warning; it does not remove the font or change its family. Measure the font swap on a slow connection before accepting.
3. Do not remove `next/font`, swap the typeface or add a second manual preload without verifying the actual CSS URL.

### Cross-Origin-Opener-Policy messages come from the Google sign-in popup

The stack is the Firebase Auth chunk `89e58e7d-f3d93fdbab75cb15.js`. Its popup cancellation poll reads:

```js
pollUserCancellation(){let e=()=>{if(this.authWindow?.window?.closed){...}}}
```

Google's accounts page sends a report-only COOP policy. Chrome therefore prints "Cross-Origin-Opener-Policy policy would block the window.closed call" each time Firebase polls the popup. It is a browser security warning about the popup, not an Explore rendering/performance error, and the app does not set a COOP header. It is harmless while popup sign-in completes. If sign-in ever hangs or shows "missing initial state", the reliable alternative is the existing `signInWithGoogleRedirect()` path; do not patch Firebase's poll or weaken COOP.

### Fatkun line is a browser extension

`Fatkun: Checking exclusion - hostnameToCheck: vidmake.io excludedSites: Array(0)` is injected by the Fatkun image-downloader extension. It is not app code, but extensions add listeners and can distort performance traces; disable it for clean measurements.

## Implementation update — 8 November 2026

Scope implemented locally, no deployment:

- One active Explore cover at a time. Hover/focus wins; otherwise the most-visible card keeps the media pipeline. Every other card keeps its poster and releases the decoder. Hidden tabs release the active cover; returning resumes one, not all five. Hover-only reference previews are unchanged.
- Immutable cache headers for the ten active content-hashed Explore cover/poster files (exact paths, not the legacy mutable directory).
- `geistSans` preload disabled as the measured workaround for the deployment-query mismatch. The face still loads through the existing CSS; restore the preload after a clean deployment proves one `?dpl` value is shared.
- Text layout and painted SVG paths memoized by content/style in `FormatVideoEditor`, `FormatDemoSection` and `FormatVideoTextOverlay`. Playback time updates and unrelated parent renders no longer recompute the same layout, glyph paths or clip-state callback. Dragging and typing still perform a layout when the text actually changes; the long-text drag transform/deferred-render work remains open.

### Files changed

- `components/explore/use-cover-playback.ts`
- `next.config.ts`
- `app/layout.tsx`
- `components/explore/format-video-editor.tsx` (memoization only; preserved concurrent editor edits)
- `components/explore/format-demo-section.tsx` (memoization only; preserved concurrent demo edits)
- `components/explore/format-video-text-overlay.tsx`
- Test harness updates: `scripts/explore-navigation-ui.test.mjs` (new exclusive-cover regression), `scripts/explore-format-common-editor.test.mjs`, `scripts/explore-clip-live-controls.test.mjs`.

### Local before/after

| Check | Before (production 7 Nov) | After (local 8 Nov) |
| --- | --- | --- |
| Active covers on initial desktop Explore | 5 | **1** |
| Desktop frame pacing | 30.6 fps | **60.8 fps** |
| Mobile 390×844 scroll | 30.6 fps, 3 covers playing | **60.1 fps, 1 cover playing** (60.5 fps with media blocked) |
| Cover media transfer | 3.76 MB / 10 video responses | Only the active card requests media; others show posters |
| Hover another card | All continued playing | Hovered card becomes active; previous pauses and releases |
| Hidden → return | All five restarted at 0 s | One active cover resumes |
| Cover cache header (local HEAD) | n/a | `public, max-age=31536000, immutable` |
| Font preload (local HTML) | 69,436-byte font fetched twice | No font preload; one CSS font request; `geistSans` still loaded |

Local evidence: `.tmp/explore-performance-audit/cover-fix-local.json`, `cover-fix-desktop.png`, `cover-fix-mobile.png`, `cover-fix-mobile-fps.cjs`. These are headless Chromium measurements and fake-data local screenshots, not hosted acceptance.

### Verification

- `npx tsc --noEmit --incremental false`: PASS.
- Scoped ESLint: PASS (0 warnings/errors).
- Focused 198-test Explore/editor/navigation suite: PASS.
- `npm run test:explore`: 1,426 passed / 6 failed, all failures outside the changed code or environment-bound:
  - `explore-cover-budget.test.mjs`: pre-existing AI cover is 2.2 MB vs the 1.5 MB per-file budget (the one-active policy reduces when it loads, not its byte size).
  - `explore-opening-posters.test.mjs`: RangeError / array-buffer allocation in this environment; asset decode test, no changed code path.
  - `explore-pending-schedule-service.test.mjs`: broad-run OOM; passes 9/9 when run alone.
  - `explore-slideshow-editor.test.mjs`: stale import assertion from concurrent worktree edits (file not touched).
  - `workflow-demo-audio-state.test.mjs` (2): expects the superseded "Prepare final video" copy from the concurrent Talking Head redesign (file not touched).
- No production deployment, paid generation, scheduling write, schema, prompt or model change.

### Still open

1. Production FPS, font-warning disappearance and immutable headers after deployment; not verified.
2. Re-encode the 2.2 MB / 30 s AI-character cover below the 1.5 MB budget (visible asset change; needs approval and visual review).
3. Long wall-text typing/drag still costs one layout per actual change; add deferred preview or drag-as-transform without changing saved pixels.
4. Split the inactive Demo/Schedule/font-metric code from the workflow entry bundle.
5. Real 5–30-minute idle route-transport reproduction.

## Correction — 8 November 2026: all Explore covers autoplay restored by user decision

The one-active-cover coordinator was removed at the user's explicit request. The original continuous behavior is restored: every visible Explore cover plays automatically, and hovering does not release the other covers. The hover-only reference previews are unchanged.

What was retained:
- Immutable cache headers for the ten active content-hashed cover/poster files.
- `geistSans` preload disabled as the deployment-query workaround.
- Text layout/painted glyph and clip-state memoization.

What returned:
- All five desktop covers load and play together: local measurement **30.9 fps**, five videos playing, ~3.76 MB of video transfer on first load.
- Mobile shows multiple active covers as cards enter the viewport; local measurement previously showed 30.6 fps with three active versus 60.7 fps with none.
- Hover/focus no longer changes which videos are playing; all visible covers remain active.

This is an explicit product choice: the user prefers the previous all-playing visual behavior over the one-active 60 fps behavior. Do not reintroduce the coordinator without a new explicit request. The measured framerate/bandwidth tradeoff is accepted, not "fixed". Reducing cover bytes (especially the 2.2 MB AI-character cover) or resolution remains available as a separate mitigation, but it does not guarantee 60 fps while two or more video layers decode.

Local verification: `scripts/explore-navigation-ui.test.mjs` now asserts that two visible continuous covers both keep their media pipelines and hover does not release either. 24 cover/navigation tests pass; all five desktop covers and three initial mobile covers were observed playing in the local Playwright probe; no page errors. Production not deployed, so hosted behavior remains NOT VERIFIED.

## Cover compression — 8 November 2026

All-cover autoplay is retained. The two heavy active covers were re-encoded from their 1080p sources at 768×432/30fps, silent H.264 with faststart and a quality-equivalent CRF 28. The three other covers were already 190–282 KB at 165–247 kbps; re-encoding them at the same quality either matched them or made the hook cover slightly larger, so they were left unchanged.

| Active cover | Before | After | Change |
| --- | ---: | ---: | ---: |
| AI character (30 s) | 2,205,268 B | 1,011,537 B | −54.1% |
| Slideshow (7 s) | 669,111 B | 343,399 B | −48.7% |
| Talking Head (10 s) | 269,855 B | unchanged | — |
| Hook (9 s) | 282,413 B | unchanged | — |
| Text on screen (9 s) | 190,829 B | unchanged | — |
| **All five video files** | **3,617,476 B** | **2,098,033 B** | **−42.0%** |

New content-hashed names:

- `/explore/covers/ai-character-promo-c59ea3f200cf.mp4`
- `/explore/covers/ai-character-promo-opening-a2c2586bb623.webp`
- `/explore/covers/slideshow-promo-19a41bb41632.mp4`
- `/explore/covers/slideshow-promo-opening-5fdb2507fcf3.webp`

The two posters were regenerated as lossless WebP from the exact new video first frames, so the opening-poster contract still passes (the new AI poster is 30,046 B and the slideshow poster 31,248 B; both under the 100 KB limit). The poster pair grew by 19,330 B, so the combined video+poster saving is about 1.50 MB (39.9%).

Verification:
- `scripts/explore-cover-budget.test.mjs`: PASS; all five files are content-hashed, faststart, 768×432, under 1.5 MB each and the set is under 4 MB. This also fixes the previously failing AI 2.2 MB budget.
- `scripts/explore-opening-posters.test.mjs`: PASS; all five posters match the decoded video opening pixels exactly.
- 24 cover/navigation tests PASS; `npx tsc --noEmit --incremental false` and scoped ESLint PASS.
- Local Playwright: all five desktop covers still autoplay; **30.9 fps** unchanged (compression reduces bytes, not the multi-video compositor cost). Mobile shows three covers initially and two after scrolling, as before.
- Visual spot checks at 1 s/15 s/29 s (AI) and 1 s/3.5 s/6.5 s (slideshow) showed no material difference at card size. SSIM versus the source scaled to 768×432 was 0.986 (AI) and 0.978 (slideshow).

Not deployed. Hosted playback and CDN headers remain NOT VERIFIED.
