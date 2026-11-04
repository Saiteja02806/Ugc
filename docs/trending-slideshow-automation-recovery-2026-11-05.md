# Trending slideshow automation recovery — local verification

Status: PARTIALLY VERIFIED. Local fixes and non-build checks pass. No build,
deployment, push, production retry, activation, schedule mutation or provider call.

## Evidence and scope

Read-only production queries against the UGC project on 4 November 2026 found one
active automation: three daily slots at 09:00/13:30/18:00 Asia/Calcutta, one
Educational Tips and two Product Stories, two TikTok destinations. There were
19 missed slots (29 October–4 November), four preparing, no linked Library items
or schedules and no `auto-slot:` schedule receipts.

Three pending sources were completed, current-profile/version, with all six
slides ready. They ranked 53, 54 and 57 by `updated_at`, outside the service's
latest-50 inventory query. Exact pinned-source matching therefore kept waiting.
The fourth source ranked first and recorded the Sharp linux-x64 load error.

Existing local `.next/server/chunks/57171.js` contains bundled worker Sharp ESM
with `createRequire` anchored to an absolute checkout URL. This proves a local
relocation hazard, not the exact missing file in the hosted Linux bundle. The
production domain's deployment metadata identified commit c6d474d3; runtime-log
search for Sharp in the inspected two-hour window returned no matching entries.

The patch reloads future preparing slots' pinned sources by ID and applies all
existing readiness/profile/format/date exclusions plus explicit ownership checks.
It does not broaden inventory recency globally, substitute sources or replay
missed slots. Automation passes application-native Sharp to the shared renderer;
ordinary workers retain lazy default Sharp loading. The existing Linux gate now
tests resolution and SVG/WebP processing using only a route's traced dependencies
copied into an isolated temporary package outside the checkout ancestry.

## Files changed by this task

- `lib/trending/slideshow-automation-service.ts`: direct pinned-source recovery.
- `lib/trending/slideshow-automation-render.ts`: application Sharp injection.
- `worker/src/lib/carousel-manual-render.ts`: optional processor and lazy fallback.
- `lib/trending/slideshow-automation-service.test.mjs`: recovery/failure/ownership
  regressions, actual source renderer and injection checks.
- `worker/src/lib/carousel-manual-render.native.test.mjs`: real pixels with worker
  Sharp unavailable and application Sharp supplied.
- `scripts/check-automation-sharp-traces.mjs`: isolated native trace validation.
- `scripts/check-automation-sharp-traces.test.mjs`: real dependency trace succeeds;
  removing native dependencies fails despite their presence in the checkout.
- `CAROUSEL_CONTEXT.md`: appended recovery decision and local evidence.
- `docs/ai-context/clear.md`: appended UGC-SCH-020 and verification linked to
  UGC-SCH-015/011. Existing user edits preserved.
- This receipt.

Unrelated existing and concurrent Explore/Talking Head edits were left intact.
No package manifest, lockfile, schema, migration, UI or Next configuration changed.

## Preflight sources consulted

`AGENTS.md`, the user-provided global no-build instruction, `EXPLORE_CONTEXT.md`,
`CAROUSEL_CONTEXT.md`, `docs/ai-context/clear.md`, `nonnegotiables.md`,
`scheduling-contract.md`; relevant automation/Sharp/history sections inspected.
Skills read: `ugc-context-memory`, `ugc-immutable-contracts`, `ugc-scheduling`,
`ugc-regression-gate`, `vercel-cost-guardian` (PR guard and audit rubric), and the
installed Supabase skill. Installed Next documentation read:
`serverExternalPackages.md` and `output.md`. Read-only preflight script PASS.

## Checks run

No npm build/test umbrella scripts were used: some include worker builds.
Node test options below were supplied directly:
`--import ./scripts/next-server-only-test-loader.mjs
--experimental-test-module-mocks --experimental-transform-types
--disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test`.

- Automation service test: **45 PASS**, including real selected-background/text
  pixels, Sharp failure followed by recovery outside latest50, exactly-once retry,
  wrong owner/profile/format/date/incomplete/used-source rejection, pause,
  cancellation, lost acknowledgements and concurrent sweep safeguards.
- Automation contract/database/schema/generation-mix plus worker native injection:
  **14 PASS**. Local PGlite executes actual Library/schema/cancellation SQL.
- `scripts/direct-schedule-atomic-db.test.mjs`,
  `scripts/direct-schedule-service.test.mjs`,
  `scripts/check-automation-sharp-traces.test.mjs`: **21 PASS**. Actual local SQL
  verifies schedule/target/job atomicity, duplicate replay, pause/lease/cancel
  fences and transaction rollback; service boundaries use fixtures.
- Shared worker `carousel-manual-text.test.ts` and `svg-glyph-path.test.ts`:
  **37 PASS**, executed from source using temporary
  `.tmp/worker-source-test-loader.mjs` mapping relative worker `.js` imports to
  `.ts`. The initial invocation without this source resolver failed at import;
  the corrected invocation passed. No worker compilation occurred.
- Total relevant successful tests: **117**.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: PASS.
- `node node_modules/typescript/bin/tsc --project worker/tsconfig.json --noEmit
  --incremental false`: PASS.
- Direct ESLint on seven changed implementation/test scripts: PASS.
- `git diff --check`: PASS after removing one trailing test-file blank line.
- Read-only cost PR guard `--base origin/main --head HEAD` completed; this reports
  committed changes only. The actual task diff was reviewed separately: no new
  install/build/deploy triggers or dependency changes; isolated validation adds
  five bounded postbuild probes on Linux. Build CPU/dollar impact UNKNOWN and not
  measured; no build was run to measure it.

Rendered fixtures: `.tmp/automation-render-qa/slide-1.webp` through `slide-4.webp`.
Cover inspected visually; pixel assertions verify original selected colors,
heading/body text ink and 1080x1350 output. These are local fixtures, not production
creative acceptance. No user-facing UI changed; desktop/mobile screenshots and
navigation acceptance NOT TESTED in this task.

## Protected contracts and limits

VERIFIED locally: exact original pinned source, owner/current profile/version,
requested structure/date, ready slides, selected background and typography,
separate derived Library identity, duplicate prevention, durable SQL targets/jobs,
pause/revision/lease/cancellation guards, missed-window refusal and timezone
contract tests. Original creatives and scheduling target/time implementation were
not changed. Automatic generation hold was not lifted.

NOT VERIFIED: new Linux route artifact, deployed Sharp resolution, real storage
uploads, authenticated production flow, browser-independent hosted execution,
TikTok account eligibility/tokens and provider publication receipts. No claim of
production recovery. UGC-SCH-020/015 remain OPEN for hosted acceptance.

Future authorized validation must build the Linux artifact and pass its isolated
trace gate, deploy the intended app/worker scope, then inspect the next future
automation slot's Library item, schedule, targets, jobs and eventual provider
receipts. Past missed slots must not be silently replayed.

Rollback boundary: revert only this task's seven implementation/test files and
appended context/receipt additions. Preserve unrelated working-tree edits and
historical ledger entries. No production state was altered by this task.
