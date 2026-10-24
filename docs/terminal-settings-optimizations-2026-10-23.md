# Completed-job refresh and Settings bundles

Local implementation and verification. No deployment, provider generation,
account changes, database changes or worker changes are authorized in this batch.
Earlier intentional changes in the working copy remain in place.

## Scope and safeguards

Review rapid remount/reconnect reads for completed media jobs, then measure and
defer Settings panels that are not selected. Keep failed-job retries, incomplete
output recovery, account isolation, explicit status refresh, section navigation
and billing actions intact. Use the installed Next.js 16.3.8 lazy-loading guide.

Three agents implement the independent areas and review the resulting changes;
the parent reviews integration and runs the combined checks.

## Hosted acceptance after an authorized release

This checklist is pending. Local compilation, fixtures and simulated mobile
viewports do not verify production authentication or hosted integrations.

- On the real production domain, open a completed media generation, return to it
  quickly, then return after the finite freshness window. Confirm the same output
  and selected asset survive; compare detail GET counts under identical steps.
- Explicit Check status must reach the server. Check a failed job retried in
  another tab, a delayed output receipt and reconnect during generation. Do not
  purchase or repeat generation merely to verify read behavior.
- Cold-load Settings Account on desktop and a mobile device. Record transferred
  JavaScript, cached versus uncached requests and panel loading latency. Open
  Business Context, Media library, App screenshots, Connected accounts,
  Preferences and support panels. Confirm navigation and loading states.
- Open section hash links directly, use browser back/forward, and switch away
  while a section is loading. Check normal access gates and sign-out/account
  switching without sharing the previous account's private state.
- Verify existing save, upload, billing and account-connection controls with
  separately authorized actions where needed. Reading Settings alone must not
  trigger these actions.
- Attribute requests/bytes and Vercel usage over comparable traffic and release
  activity. Local bundle bytes and request counts do not establish invoice savings.

## Local results

Completed media receipts receive 30 seconds of freshness only when the query
succeeded without read failures and the receipt has a parseable completion time,
no error and an output media asset UUID. Single- and multi-job hooks share this
policy. Failed/cancelled jobs, missing or malformed outputs, text/onboarding jobs
and read errors retain zero freshness. Active-list discovery is unchanged.
Explicit status checks and invalidation still refresh immediately. This adds no
30-second polling timer: an expired receipt refreshes on a later lifecycle event.

Settings defers eight existing section components through module-level named
`next/dynamic` imports with an in-panel loading status. Existing conditional
mounts, form reset behavior, hash/back navigation and social access gates remain
in place. Account, billing, theme and close controls remain available in the
initial shell. An initial Account visit requests no deferred section chunks in
the isolated browser fixture.

- 281 combined regression tests pass, including 27 new actual-hook/QueryObserver
  lifecycle tests and 29 Settings-related contract checks.
- Scoped ESLint, application TypeScript, the final production webpack build and
  postbuild Hook decoder bundle verification pass. Default Turbopack is not
  qualified by this build.
- Actual Settings shell and `next/dynamic` browser checks pass at desktop
  1440x1000 and touch/mobile viewport 390x844, with zero page errors. Checks cover
  selection-only loads, direct hashes, back, provider gates, existing form reset,
  owner changes, theme/close/sign-out and resolution of a chunk after switching
  away. Account/router/services and section bodies are stubs. These checks do not
  establish real panel API or physical mobile-device acceptance.
- Parent inspected both Account screenshots; no overflow or visible layout
  regression was found in the fixture.
- Before build: `odjlIyqraUYrTEcjCwAro`; after build:
  `mRAPSqZmXHhIQRvV-FFBw`. Both measurements use the same helper and preserve
  the baseline captured before rebuilding. All eight deferred entries have
  incremental JavaScript outside the initial HTML script set.

| Measured JavaScript asset set | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Full Settings HTML external scripts, raw bytes | 1,107,608 | 923,932 | 183,676 (16.6%) |
| Same files, per-file gzip estimate | 343,901 | 288,760 | 55,141 (16.0%) |
| Settings client-reference/runtime subset, raw bytes | 885,920 | 702,244 | 183,676 (20.7%) |
| Same subset, per-file gzip estimate | 268,279 | 213,138 | 55,141 (20.6%) |

For an uncached visit, panel-specific code is now downloaded when that panel is
selected. This trades a small first-open loading state for less initial code;
module caching avoids downloading the same chunk again during ordinary reuse.

Local logs: `.tmp/next-priorities-2026-10-23/regression.log`, `lint.log`,
`build.log`; bundle data: `.tmp/settings-lazy/before.json` and `after.json`;
browser receipt/screenshots: `.tmp/settings-lazy/browser/`.

The bundle script reports the full emitted HTML external-script set separately
from the smaller Settings client-reference/runtime subset. These are local
emitted file sizes and compression estimates, not measured production transfer
bytes or hosting savings. CSS, fonts, later section loads and browser caching
must be considered separately. The HTML set includes nomodule/polyfill files
when present, even if a modern browser would not download them. Incremental
deferred sizes are relative to the initial set per section; do not sum overlapping
shared dependencies across sections.

No unresolved correctness blocker was found in the scoped parent and independent
reviews. Further work is production acceptance and request/byte attribution after
an authorized release, then measured build/deployment-storage and MCP CPU review
if cost data still supports those targets. No production saving is claimed here.

## Follow-up verification

Subsequent default Turbopack build qualification and native packaging fixes are
recorded in `docs/build-storage-mcp-audit-2026-10-23.md`; the earlier "unqualified"
statement describes this Settings batch's original webpack-only evidence.

Re-read the implementation and reran 126 focused tests covering completed-job
freshness, active-list coverage, inactive panels, workflow/read recovery and
Settings contracts: all passed. Reran the Settings desktop/mobile viewport
browser fixture: both passed with zero page errors. Scoped ESLint and diff
whitespace checks passed. Re-measuring the existing production build reproduced
923,932 raw initial HTML script bytes, 288,760 per-file gzip estimate bytes and
eight deferred section entries, each with incremental JavaScript.

No application code change was needed. The reviewed application files were
unchanged since the successful webpack build recorded above; that build was
not repeated. These fresh checks retain the same stubbed-services and hosted
acceptance limits described above. Logs: `.tmp/terminal-settings-reverify/`.
