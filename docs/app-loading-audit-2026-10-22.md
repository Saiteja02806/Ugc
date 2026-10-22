# Application loading and idle-resume audit — 22 October 2026

Status: concrete frontend bottlenecks corrected locally. Production acceptance
is pending. The production domain returned **“This deployment is temporarily
paused.”** The existing deployment pause remains in effect; this audit did not
deploy, push, change production data, synchronize social providers, generate
paid media, or publish a post.

This extends [the Explore/Trending image-library audit](ui-performance-2026-10-22.md)
and [the Analytics audit](analytics-performance-audit-2026-10-22.md). Three agents
audited Content/Demo, Analytics and Scheduling independently; a final review
checked their combined changes and identified one Demo Retry race, now corrected.

## Route scope

The current sidebar's **Demo** destination is `/library?tab=posts` and renders
`LibraryWorkspace` → `UploadedPostsTab`. Historical Content/uploaded-posts
terminology and the `/demos` compatibility route use this same inventory. They
are not separate active lists. Explore's Demo chooser and editor use the saved
Demo inventory plus their own owned-source and media queries. Shared foreground
refresh also covers the saved-hook and Edit libraries and Creative Assets.

## Findings and corrections

| Area | Verified source behavior | Local correction |
| --- | --- | --- |
| Content / Demo batch uploads | A file waits for all stages of the preceding file; each completion refreshes the full inventory. | Two transfer slots shared across selections and retries, with one inventory refresh when the queue settles. Queued files can be cancelled. |
| Demo failed uploads | Authentication, reservation, completion or browser metadata can hold the queue; completion failure can delete an object that was already accepted. | Bounded waits; metadata/XHR cleanup; never delete after completion may have succeeded. Explicit completion retry reuses the same demo ID, object key and metadata without another transfer. |
| Demo retained memory | Completed queue entries retain the original File and request callbacks. | Detach XHR handlers and metadata decoders; release the original File once transfer succeeds. A failed completion retains only its small recovery receipt. Superseded/cancelled local media reads release their decoders and blob URLs. |
| Demo Retry during cleanup | Retry could appear while the failed request still owned its queue slot, so its click was ignored. | Keep the row busy through cleanup, then expose Retry. A held-cleanup regression verifies that the visible Retry starts another transfer. |
| Content / Demo deletion | Bulk deletion could remove rows locally even when HTTP deletion failed. | Limit concurrent deletion, check HTTP and JSON success, remove successful rows only, and retain failed rows, selection and error for retry. |
| Explore saved sources and jobs | Some source/job reads ignored query cancellation or left token/body waits outside a deadline. Pending job queries could inherit a long freshness policy on return. | Bound owner-scoped authentication, transport and parsing; consume query signals; allow pending job reads to revalidate on return while terminal jobs stop polling. No generation/render/schedule action is replayed. |
| Explore gallery video | Hover previews could keep a loaded video source after leaving or opening a dialog. | Reuse the sustained-interest playback lifecycle: release the source on leave, click, hidden tab, offscreen transition or unmount; respect reduced motion and touch input. |
| Analytics tab return | Mounted snapshot queries explicitly disabled stale focus revalidation. Job eligibility used the initial POST status after a poll had already completed. | Revalidate stale snapshots while keeping saved content visible. Decide job eligibility using the latest observed job, so completed/failed/cancelled/expired jobs stay stopped. Authentication, fetch and body parsing share the request deadline. |
| Scheduling return and loading | Active-work timers could continue hidden/offline; media stayed fresh for 30 minutes; account/config/media reads could wait indefinitely. | Suspend hidden/offline work, reconcile once on return, refresh stale media after one minute while retaining the cache for 30 minutes, and bound/cancel owner-scoped reads. |
| Scheduling editor opening | Independent media/account reads were sequential in New post; a warm Edit drawer waited for background catalog reads. | Start independent reads together. Retain warm media when opening; warm Edit can open while catalogs reconcile. Fresh publishing access is still checked for New post, and submit still validates the current selected accounts/media. |
| Shared Content / Demo / Assets refresh | Visibility checks did not include offline state. | Pause offline timers and resume without overlap. Existing loaded content and manual action identities remain intact. |

Original files, provider inputs, saved text/trim, accepted receipts, cache owner
boundaries, and scheduling submission rules are preserved. The website changes
in this performance audit require no schema or worker change. Separate existing
starting-frame work in the checkout has its own website/worker release scope.

## Verification

- All **195 tests** in the expanded Content/Demo/Scheduling/source-request group passed. It
  covers parallel transfer bounds, cancellation, receipt-only recovery, partial
  deletion, hung authentication/network/body reads, calendar deduplication,
  timezone/TikTok rules, saved selections and draft preservation.
- All **100 Analytics tests** passed. The actual-workspace browser fixture also
  passed stale 31-minute snapshot recovery, fresh-focus deduplication, independent
  account display, deferred platforms, stopped terminal jobs, cache/range/
  authorization isolation, refresh failure recovery and owner switching.
- **93 additional Explore and lifecycle checks** passed: 39 read/job recovery,
  47 navigation/Recreate and 7 refresh-queue/visibility checks. The gallery
  lifecycle test also passed again after its DOM listener typing correction.
- The actual Scheduling workspace passed desktop and 390px mobile fixtures:
  warm calendar, entry/focus deduplication, zero hidden/offline reads during a
  simulated 30-minute idle, one online schedule recovery, stale media recovery,
  retained rows after HTTP failure, Retry, and owner isolation.
- The Demo editor browser suite passed 1280px/1536px desktop and narrow mobile
  checks: editing before upload completion, preserved trim/text after completion,
  compact reachable controls, no horizontal overflow, repeated trim expansion,
  restored edits, and no page errors. Demo screenshots were visually inspected.
- Full application TypeScript, scoped ESLint and whitespace checks **passed**
  after the final queue/retry changes. See the local verification logs below.

The earlier Explore/Trending audit also passed its 164 focused checks and
image-library browser suite. Its broader Trending group still has one verified
baseline source-assertion failure: `trending-feed-polling-contract.test.ts`
expects an expression absent from both HEAD and the current worktree. See the
linked earlier audit; no blanket full-suite pass is claimed.

The Analytics and Scheduling fixtures use minimal styles to test data and
lifecycle behavior. They are not visual acceptance of the deployed design.
The Demo fixture builds the actual editor styles. Browser HTTP/auth/provider
boundaries are isolated fixtures, not live production measurements.

Local evidence (temporary, not release source):

- `.tmp/expanded-content-scheduling-tests.log`
- `.tmp/expanded-final-regressions.log`
- `.tmp/expanded-analytics-tests.log`
- `.tmp/expanded-explore-read-tests.log`
- `.tmp/expanded-explore-navigation-tests.log`
- `.tmp/expanded-visible-refresh-tests.log`
- `.tmp/expanded-scheduling-browser.log`
- `.tmp/expanded-demo-browser.log`
- `.tmp/analytics-loading-browser/results.json`
- `.tmp/expanded-performance-types.log`
- `.tmp/expanded-performance-lint.log`
- `.tmp/explore-demo-loading-browser/` screenshots

## What remains unproven

These fixes remove verified serial work, stale-return behavior, retained media
resources and indefinite waits. They do **not** establish that all reported lag
is gone or quantify a production speedup.

After the intended release is deployed, acceptance must use authenticated
`https://www.getugcpilot.com`:

1. Measure upload preparation, authentication, reservation, storage PUT,
   completion verification and list reconciliation separately. Two transfers
   help independent files; they do not increase the connection's total bandwidth.
2. Measure cold and warm API timings for Explore, Demo, Analytics and Scheduling
   against the same account/data. Trace backend/database/provider wait separately
   from browser work before changing infrastructure or indexes.
3. Leave a real browser idle for at least 30 minutes with saved and unsaved edits,
   then return. Capture heap/DOM/decoded-media growth, stale URL renewal, request
   counts and interaction timing. Fake-clock checks verify scheduling logic,
   not a real memory soak or absence of every memory leak.
4. Verify uploads, completion recovery, partial failure and editing against real
   hosted storage/auth. A lost reservation acknowledgement can still leave an
   unknown server reservation; no blind automatic replay was introduced.
5. Check real scheduling drafts and analytics snapshots without submitting paid
   generation, provider synchronization or publishing unless explicitly intended.

Long-list rendering, text measurement/draft serialization and backend capacity
remain profiling candidates. No performance cause or percentage improvement is
claimed for those paths without a trace.
