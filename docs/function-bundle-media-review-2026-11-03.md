# Function tracing and source-media exclusions — 3 November 2026

## Scope and cost evidence

This patch changes deployment inputs and file tracing only. No deployment,
push, Vercel setting, project connection, dependency, lockfile, schema, API,
UI, generation prompt or scheduling behavior was changed by this patch.
Other intentional work already present in the worktree was preserved.

Actual billed dollars and Build CPU Minutes saved are **UNKNOWN**. Upload
candidate bytes and logical trace bytes are not billed storage or deduplicated
Vercel function sizes. Existing Vercel projects/targets and their settings were
not changed or re-audited as part of this implementation.

## Implementation and files

- `.vercelignore`: exclude `public/explore/covers/sources/`, contact sheets and
  the local preview HTML. Measured against the saved prior ignore file:
  **79 files / 150,643,153 bytes** newly excluded from upload candidates.
  All published cover videos/posters and local authoring originals remain.
- `next.config.ts`: narrow the encrypted creator catalogue include to the exact
  MCP endpoint. Installed Next uses picomatch `contains:true` and normalizes
  `app/mcp/route` to `/app/mcp`. The rule supports both this internal path and
  the documented `/mcp` route, without matching health or discovery. Broad
  includes for other existing consumers are unchanged.
- `scripts/check-lightweight-catalogue-traces.mjs`: reject emitted health or
  discovery traces containing creator JSON catalogues; require all five in MCP.
- `scripts/check-hook-frame-bundles.mjs`: run that guard after all existing
  native executable and automation Sharp/font checks.
- `scripts/deployment-media-budget.test.mjs`: preserve published cover assets,
  check excluded URLs have no application consumers, exercise Next's actual
  route matcher/normalizer, and test trace-guard success and failure cases.
- `scripts/native-media-tracing.test.mjs`: repair the stale config VM fixture
  to supply the actual landing-preview JSON default export.
- `docs/ai-context/clear.md`: append incident `UGC-BUILD-20261103-01` and its
  verification evidence; preserve existing history.
- This review document.

## Preflight and review sources

Reviewed repository `AGENTS.md`; packaging/native-media and protected-contract
sections of `EXPLORE_CONTEXT.md`, `CAROUSEL_CONTEXT.md`,
`docs/ai-context/clear.md` and `docs/ai-context/nonnegotiables.md`; and skills
`ugc-context-memory`, `ugc-immutable-contracts`, `ugc-regression-gate` and
`vercel-cost-guardian`. This receipt does not assert a full reread of the large
historical context ledgers. The preflight tool checks readability; it does not
substitute for context review.

Read the installed Next output-tracing guide and actual collector/normalizer
implementation before choosing the rule. Reviewed existing consumers,
Remotion public-root configuration, ignore rules, tests and dirty worktree.
Vercel's [ignore documentation](https://vercel.com/docs/deployments/vercel-ignore)
describes upload exclusions; final hosted artifacts still need acceptance
after an authorized release.

## Validation

- `python tools/preflight.py --repo . --task ...`: PASS, prerequisites readable.
- Scoped ESLint for all changed JS/TS: PASS, no warnings.
- Focused packaging/native/storage suite: 16 PASS, 0 FAIL.
- Combined media/reference/encryption/promo regression suite: 66 PASS, 0 FAIL.
- Read-only cost scanner: 5,779 tracked files examined; heuristic findings
  remain hypotheses, not evidence of billable waste.
- `npm run build -- --webpack`: PASS, exit 0, including TypeScript, 372 static
  pages and every postbuild guard. Four isolated native packages resolve and
  start; lightweight endpoints omit native media; automation Sharp/fonts pass.
- Emitted trace comparison: health and discovery each go from five catalogues
  (122,009 bytes) to zero. MCP retains all five (122,009 bytes). This removes
  **244,018 logical referenced bytes**, not necessarily that much billed storage.
- `node scripts/verify-built-mcp-rejections.mjs`: PASS against compiled handlers;
  GET/POST/DELETE without credentials return 401, wrong Origin 403 and wrong
  host 421; zero account fetches and zero read-catalogue chunks loaded.

The initial build deliberately exposed the broad include with the new guard.
An attempted exclusion was ineffective on Windows. An initial exact public
route match also omitted the main catalogue because of Next's internal
`/app` prefix; the positive postbuild guard rejected it. The final matcher tests
now cover the actual installed normalizer. No failed attempt was deployed.
The first full-trace audit overlapped a subsequent build and failed with ENOENT;
that incomplete audit is not used as before/after evidence.

Evidence directory: `.tmp/bundle-cost-2026-11-03/`, including build/test/lint
logs, saved pre-change inputs, endpoint baseline traces, upload file inventory
and the read-only scanner report. Temporary artifacts are not release inputs.

## Protected behavior and acceptance boundaries

- VERIFIED by tests: published cover files remain upload candidates; authoring
  inputs remain available locally; no application code requests excluded URLs;
  encrypted catalogue readers and preview contracts pass focused regressions.
- VERIFIED in emitted build: actual MCP catalogue retention, lightweight
  endpoint exclusions, four isolated native media packages, Sharp and fonts.
- NOT TESTED: fresh Linux build, authenticated desktop/mobile flows, live
  generations, scheduling/publication and hosted integration acceptance.
  This patch has no UI or generation/scheduling edits; fixture tests are not
  proof of production acceptance. No paid generation or publication was invoked.

Status at initial review: **locally verified; hosted/Linux acceptance NOT VERIFIED**. Incident
`UGC-BUILD-20261103-01` has an appended local verification receipt. No other
incident or pre-existing worktree change is claimed resolved by this patch.

Rollback only this patch's ignore additions, narrowed MCP include and new
postbuild guard/import; retain all existing checks and unrelated work. The
saved prior config/ignore files are under the evidence directory. Do not
restore whole files over subsequent user edits.

After an authorized release, inspect hosted function contents and confirm all
published cover URLs, native media routes and authenticated MCP flows. Compare
upload sizes, per-route packaging and actual CPU/storage usage over comparable
7-day and 30-day cohorts before claiming a monetary saving. Broader API tracing,
duplicate runtime fonts and any sibling-project decision remain separate work.

## Linux follow-up

Both isolated Linux Webpack and Turbopack builds, emitted native/catalogue/font
checks and local production HTTP media checks subsequently passed. Two small
test/renderer compatibility issues were fixed and regression-tested; hosted
acceptance is still separate. Current excluded public media is79 files totaling
151,051,178 bytes after concurrent authoring updates. Broad Hook function traces
and separate Remotion authoring copies remain optimization concerns. See
[Linux verification receipt](linux-bundle-media-verification-2026-11-03.md)
for changed files, exact tests, build IDs, limitations and remaining work.
