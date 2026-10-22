# Explore, Trending and media-library performance — 22 October 2026

Status: implemented and verified locally. No release, production media mutation,
schema change or paid generation. Existing uncommitted starting-frame work was
preserved. The separate deployment pause remains in effect.

## Evidence and limits

The production browser reached `https://www.getugcpilot.com/explore` and received
the hosting page **“This deployment is temporarily paused.”** Authenticated
production flows, actual upload/backend latency and real 30-minute heap behaviour
could not be measured. This does not establish that every reported delay is fixed.

The account-scoped QueryClient already retains inactive metadata for one hour
and uses a 30-minute default freshness window. Image-library queries override
freshness to one minute. Increasing retention globally would not address the
verified serial operations or hidden-tab work and could retain stale media URLs.
Account changes already replace the QueryClient; this isolation remains intact.

| Path | Verified source behaviour | Local correction |
| --- | --- | --- |
| Manage library upload | Files upload serially; each also writes collection membership. | Two concurrent transfers using the existing ordered helper; one membership write for successful files. Failed files alone remain retryable. |
| Use library backgrounds / add slides | One authenticated asset GET per image, in waves of four; generated images also read their job individually. | Read-only batch endpoint: one owner-filtered media query per 20 distinct IDs, plus one batched job lookup when needed. Normal 2–10 slide choices use one HTTP request. |
| After library mutations | Manager remains busy until invalidated queries finish refetching. | Release the operation lock after mutation completion; refresh in the background. Failed refresh retains cached tiles and offers Retry. |
| Returning to an open image picker | Inherits disabled window-focus revalidation; inconsistent auth/network deadlines. | Revalidate stale image lists on return; preserve query identity/cache. Bound authentication, fetch and parsing together; cancellation prevents late network calls. |
| Hidden pending edits | Trending edit status, ordinary Explore finishing and schedule preparation can continue custom polling. | Shared scheduler pauses hidden/offline reads, resumes once, prevents overlap/catch-up and cleans up on unmount. Server jobs continue. |
| Explore Edit slides filmstrip | Small thumbnails request originals. | Existing public 256px optimizer helper, lazy loading, async decoding. Main preview, dimensions, provider inputs, saved sources and exports retain originals. Protected/signed/blob delivery is unchanged. |

## Preserved contracts

- Batch admission authenticates and rechecks owner, deletion, readiness, image
  type/dimensions, eligibility and archive state before an atomic draft change.
  Any unavailable source rejects the selection.
- Generated images retain server-derived model and Remix provenance. Browser
  metadata cannot supply a source identity. Collection order, text styling,
  dirty state and Save-before-scheduling remain authoritative.
- Upload originals are not re-encoded here. Existing manual Explore 4:5
  preparation and uncertain upload-completion recovery remain unchanged.
- Polling/return recovery only reads existing receipts. It never dispatches a
  new generation, render or schedule. Revisions/request identities are preserved.

## Verification

- **164 focused checks pass**: new performance regressions, image-library API,
  installed thumbnail optimizer, ordered upload helper, Explore references,
  slideshow editor, finishing recovery and schedule preparation.
- **39 of 40 additional Trending/upload checks pass.** The existing
  `trending-feed-polling-contract.test.ts` source assertion expects
  `getTrendingPreparationCopy(useContext(TrendingPreparationContext))`; neither
  original HEAD nor this worktree contains that exact expression. This is a
  verified baseline assertion failure, not a new runtime failure.
- Full application TypeScript and scoped ESLint pass.
- Scheduler tests advance a fake clock 30 minutes while hidden: zero reads,
  one resume read, offline suspension, error recovery, no overlap, and cleanup
  with an outstanding read. This is not a real browser memory soak.
- **Actual-component browser suite passes** at desktop and 390px/320px mobile:
  collection management, two concurrent transfers with deliberately reversed
  completion order, one ordered membership write, failed-file-only retry,
  Explore/Trending background application, atomic failed recheck, retained text,
  cancellation, 32-image collection bounds, music reuse, no page errors or paid/
  publishing calls. A timestamp aged by 30 minutes triggers one list refresh;
  a failed refresh retains the tiles, and Retry recovers them.
- Local receipts: `.tmp/ui-performance-tests.log`,
  `.tmp/ui-performance-trending-tests.log`, `.tmp/ui-performance-types.log`,
  `.tmp/ui-performance-lint.log`, `.tmp/ui-performance-browser.log`.
  Browser images: `.tmp/media-library-browser/`.

## Production acceptance and further measurements

1. When the user resumes deployment, release the website correction and verify
   its deployed commit. No worker or migration is required by these changes.
2. In authenticated production, time local preparation/authentication, upload
   admission, storage PUT, completion verification and list refresh separately.
   Network transfer, database work and UI locking must be measured separately.
3. Capture editing traces and decoded-image memory. Synchronous SVG/text
   measurement and draft serialization remain candidates, not measured root
   causes. Apply deferral/memoization where a trace establishes material cost.
4. Run a real 30-minute idle/resume scenario with unfinished edits. Check heap/
   DOM growth, renewed media URLs, retained text, one recovery cycle and no
   duplicate submissions. These changes do not prove no separate memory leak.
5. If backend time dominates, measure authenticated API latency, render queue/
   worker time and database pool waits before changing capacity, indexes or
   hosting plans. Historical latency documents are not current measurements.

The batch route reuses the existing owner-filtered `.in()` lookup; the current
[Supabase reference](https://supabase.com/docs/reference/javascript/in) was checked.
The changelog markdown index was unavailable here. No Supabase API/schema feature
or dependency was changed.
