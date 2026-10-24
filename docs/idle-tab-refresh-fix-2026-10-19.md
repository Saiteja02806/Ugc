# Idle-tab refresh fix — 19 October 2026

Implemented locally after the idle-tab audit and cross-check. Returning to Demos,
Creative Assets, saved Hook content or Edit must reconcile current status without
duplicating automatic reads, overlapping polls or replacing existing cards.

## Behavior

`lib/http/refresh-queue.ts` provides one cancellation lifetime per mounted
account/resource. Automatic resume and poll reads share the pending operation.
Successful reads suppress adjacent automatic reads for one second. Failed reads
back off for 5, 10, 20, 40 and at most 60 seconds. Manual retries and reads after
mutations bypass these windows and cancel an earlier read, preventing reuse of a
snapshot started before an upload, delete or other completed action.

`components/hooks/use-refresh-queue.ts` activates/disposes that queue with the
mounted account/resource and handles development Strict Mode effect replay.
`use-visible-refresh.ts` consolidates focus, visibility and online callbacks with
sequential timers. Hidden tabs stop starting these status reads. On return they
check once and resume polling only after the read settles. A finite poll budget
can reset on active-job changes; Demos keeps its existing 120-attempt policy.

The four loaders bound authentication, fetch and response parsing through the
existing `withReadDeadline` helper (20 seconds). They pass cancellation into the
fetch and guard UI writes when obsolete. Equal JSON snapshots reuse existing
state through the installed query library's structural-sharing helper.

- Demos: replaces duplicate event callbacks and interval reads; preserves its
  uploaded-posts presentation, mutations and owner-matched memory cache.
- Creative Assets: applies this to edit-project status, which previously had
  duplicate return callbacks and four-second unguarded polls. Initial asset/group
  listing and unrelated uploads are outside this specific refresh operation.
- Saved Hook library: background polls no longer toggle the loading indicator or
  erase existing cards when a status GET fails. Parent count callbacks run when
  the loaded count/loading state changes, rather than on every status poll.
- Edit library: removes the same duplicate refresh and overlapping poll pattern.
- Workflow finishing: upload memo uses `WeakMap<File, string>` rather than Map.
  Still-current file objects reuse their completed upload ID; obsolete files are
  no longer held alive solely by the memo. This is not a measured heap reduction.

The generation access and billing focus policies remain intact because they
serve separate entitlement/freshness requirements and already share query reads.
The global query focus default remains false. This change does not relax server
authorization or modify paid generation, render, schedule or publish operations.
It does not extend signed media lifetimes. Private-URL renewal is not part of this
fix because the audit did not establish private-media use in the reported screen.

## Validation

- Five queue behavior tests: slow-read deduplication and adjacent event freshness;
  post-mutation replacement; failure backoff/manual retry; cancellation and Strict
  Mode reactivation; stalled token/body deadline and subsequent retry.
- 73 existing account-isolation, scheduling-refresh and workflow-finishing/store
  regressions passed.
- 45 existing media-library, saved-hook rendering, demo/edit-display and deadline
  regressions passed.
- Actual React components in a local Edge fixture passed four scenarios: Demos,
  Creative Assets, saved Hooks and Edit. Each advances a simulated 30-minute
  hidden interval, dispatches focus + visibility + online, holds a response
  pending across poll intervals, releases it, fails a subsequent read, retries
  manually, then unmounts during another pending read. Same card DOM nodes
  survive resume and failures. Pending reads abort on unmount. No page errors.
- Scoped ESLint and full-project TypeScript checking passed; final validation
  also covers the finite-budget reset dependency.

Commands:

```powershell
node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/http/refresh-queue.test.ts
node --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/workflow-finishing-ui.test.mjs scripts/workflow-finishing-store.test.mjs lib/auth/account-isolation-contract.test.ts lib/scheduling/schedule-refresh-policy.test.ts
node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/media/saved-creative-assets-ui-contract.test.ts lib/media/creative-asset-groups-ui-contract.test.ts lib/trending/hook-video-library-render-contract.test.ts lib/demo/demo-display.test.ts lib/edit/creative-asset-display.test.ts lib/http/read-deadline.test.ts
node scripts/idle-resume.browser.cjs
node node_modules/typescript/bin/tsc --noEmit --pretty false
```

The browser script bundles current components with fixture auth and API data; it
does not sign into customer accounts or start generation/publishing. Test outputs
are ignored under `.tmp/idle-resume-browser/`. The initial sandbox Edge launch
failed; the fixture ran successfully outside the Windows sandbox. Early fixture
iterations corrected clock installation, response-settling waits, the installed
clock API and a queued-hook selector. Those were test-harness changes, not
evidence of production failures or a performance measurement.

## Remaining acceptance

No commit, push or deployment is performed by this task. Existing unrelated
worktree changes are retained. The earlier audit is historical evidence of the
pre-fix paths, not a current assertion that the corrected paths still duplicate.

This fixes the verified request-duplication and overlap mechanisms on the four
covered surfaces. It does not prove every application-wide stall is resolved.
Final acceptance requires the same authenticated production screen, 20–40 real
minutes idle, followed by request counts/timings, input/long-task measurements
and document lifecycle/discard checks. If lag remains despite coalesced reads,
profile response rendering and media decoding instead of disabling required
refreshes globally. Local simulated time is not production acceptance.
