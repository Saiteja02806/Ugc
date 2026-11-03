# Release gate follow-up — 3 November 2026

Status: the requested local test/build and CORS-policy gates PASS. This is not full hosted production acceptance. No application/worker deployment, push, traffic switch or Vercel setting change in this pass. The separately approved production media-bucket CORS update was applied.

## Scope and preservation boundary

Reconcile the 23 remaining composer/recovery/source-contract failures against current code and protected contracts; apply the exact reviewed CORS addition; test the current combined Linux runtime snapshot. Preserve all existing worktree changes, starting-frame ownership/source roles and timing, recovery without paid resubmission, background/foreground job isolation, scheduling persistence/time semantics, auth/social behavior, and rollout order. Runtime application code is outside this patch. Rollback for test repairs is limited to the listed assertions/commands; CORS rollback is the captured previous policy.

This pass changes `scripts/explore-format-generation-ui.test.mjs`, `scripts/explore-workflow-job-recovery.test.mjs`, `lib/viral/viral-isolation-contract.test.ts`, `lib/trending/wall-text-pending-scheduling-contract.test.ts`, and test commands in `package.json`. Documentation files changed are `docs/release-gates-2026-11-03.md`, `docs/release-readiness-2026-11-03.md`, `docs/release-readiness-inventory-2026-11-03.json`, and append-only `docs/ai-context/clear.md`. Other intentional release changes remain preserved in the inventory; these files are not the entire combined release.

The refreshed combined inventory contains487intentional worktree paths, with no visible status path excluded. Existing ignored secrets, local environment, dependencies, build output and temporary artifacts remain outside release inputs. After acceptance and the clean integrity check, the temporary source tar and both disposable disk images were removed; logs, manifests, package snapshot, trace inventories and verification receipts remain available locally. No original project media was deleted.

## Test repairs

- Composer fixtures use current supported durations (Omni 4/6/8/10; Seedance minimum 4), valid Seedance audio input, and a first-frame-only payload. Full-source duration coverage checks the shortest supported output at least as long as the source across all three models. Unsupported extra identity photos must never enter the submitted animation payload.
- The clarification test renders the real shared notice and checks its question/instructions and absence of extra forms.
- Account-discovered video jobs remain tracked without locking a new composer. Completed background results remain recoverable through History, including slow/failed history reads. An explicitly URL-selected job retains foreground progress without history skeletons. Account isolation, storage failure and no mutation during recovery remain tested. Slideshow recovery retains its existing behavior.
- Source contracts retain client/server image requirements and pending-request recovery, and inspect the shared bounded schedule refresh policy rather than a removed inline flag. The current display label is Text on screen; stable internal identifiers remain unchanged.
- `npm test` initially failed resolving the billing pretest's Next alias. Reuse the existing test loader in billing and the main test command, with module mocks enabled for the latter. Bound Wall test-file concurrency to two after a Windows native child exited with status3221226356 and empty stderr; this is a test scheduling mitigation, not a proven native renderer fix.

## CORS — VERIFIED policy and HTTP preflight

Explicit user approval authorized adding only `https://vidmake.io` and `https://www.vidmake.io` to `gs://ugcsaas-media`. The operation reread and compared the live rule before writing. Readback exactly matches the reviewed additive policy; every previous rule, origin, method, response header and max-age remains preserved.

Real GCS OPTIONS requests returned HTTP200 with the exact requesting origin, PUT and Content-Type allowed for both Vidmake hosts and the legacy GetUGCPilot host. An unrelated origin received no allow-origin header. No object was written. Evidence: `.tmp/release-gates-2026-11-03/cors-before.json`, `cors-reviewed.json`, `cors-after.json`, `cors-verification.json`. A signed-in browser upload remains NOT VERIFIED; preflight is not a full upload/authentication acceptance test.

## Verification evidence

Evidence directory: `.tmp/release-gates-2026-11-03/` (local ignored logs; retain until rollout acceptance).

- Focused composer/recovery:125PASS/0FAIL; Viral source contracts:7PASS/0FAIL.
- Changed-file sweep:50files/654PASS/0FAIL.
- Base application script with explicit loader/module-mock flags:663PASS/0FAIL.
- Thirteen expanded pretest commands with explicit loader/transform/module-mock flags:PASS. Final standard `npm test`:PASS, including its entire pretest lifecycle and663-test main suite, after the command repairs; no environment-variable workaround required. See `npm-test-final.log`.
- Scheduling contracts plus real refresh/status helper tests:21PASS/0FAIL.
- Non-incremental TypeScript:PASS. Scoped test lint and whitespace checks:PASS. Fresh worker TypeScript build:PASS;97selected compiled worker tests and49image-job tests:PASS.
- Fresh Linux x64 Node24.22.2/glibc2.36 source/native/tracing regressions:105PASS/0FAIL/3private-fixtureSKIP. The private-fixture skips are not production acceptance.
- Fresh Webpack build `aLL9lxtS011-TXTaOJ5QH`:PASS. Fresh Turbopack build `WjIQKvgsXGpsgLt2MUFnD`:PASS. Both include compilation, TypeScript, static generation and all postbuild guards.
- For each mode:all checked traced paths exist across11routes; all4native route packages resolve and start in isolation; lightweight MCP endpoints omit native packages/catalogues; the consuming MCP route retains5catalogues/122009bytes; all19expected Explore font files remain in automation traces. Direct compiled MCP rejection tests pass (not hosted middleware acceptance).
- Each local production HTTP server verifies all65published cover videos/posters, exact lengths/types,206video byte ranges, matching poster bytes including the cache-busted URL, and404for3excluded authoring samples.79newly excluded source/review files total150928569bytes; originals remain in the worktree.
- The first disposable Linux disk was found corrupt:catalogue text occupied a dependency declaration and e2fsck reported inconsistent/multiply claimed files. Its failed build is explicitly invalidated. Recreated the disk, reinstalled locked dependencies, and ran install/tests/both builds in one continuous session with explicit sync/unmount. Dependency SHA256 `a2c3f313abdccfec504f64dcc24109f5b7621d222615b41b094b4dc03799ad27` matches the known-good declaration. Final read-only filesystem check exits0. Logs:`fresh-linux.log`, `declaration-inspection.log`, `clean-acceptance.log`, `final-filesystem-check.log`. The underlying host/WSL write-loss cause is not proven.
- The final snapshot includes the repaired test commands and current auth/social/media source. `snapshot-comparison.json` confirms no runtime drift; documentation may differ. No immutable Git release commit or worker image has been created.

Largest emitted logical Hook keyframe trace:Webpack288199521bytes; actual Vercel packaged function size remains NOT VERIFIED. Trace-byte totals can double count shared files and do not establish billed storage, CPU or dollars. Preserve this as a packaging acceptance boundary before production promotion.

## Preflight and cost guard

Continued the existing task's preflight: `AGENTS.md`, `EXPLORE_CONTEXT.md`, `CAROUSEL_CONTEXT.md`, `docs/ai-context/clear.md`, `nonnegotiables.md`, and the scheduling contract. Skills consulted: context-memory, immutable-contracts, regression-gate, vercel-cost-guardian, and scheduling; earlier generation/UI skill routing remains applicable to the original patch. Relevant context/ledger sections were revisited in this continuation; no new full-file reread of the two large historical ledgers is claimed. The preflight script receipt is in the evidence directory.

Read the installed Next output-tracing guide before evaluating build packaging. The cost guardian PR guard review includes the actual uncommitted manifest/config/lockfile changes, not just committed revisions. The changes made here affect test commands only; build/prebuild/postbuild/install scripts, dependency versions/lockfiles and deployment triggers are unchanged by this pass. The earlier Auth override and Node engine changes remain in the combined release. Static repository audit reports hypotheses about worker build validation and a custom install command; it does not establish waste or billed savings. Actual Vercel CPU minutes, packaged function sizes and dollar savings remain UNKNOWN. No required check or preview QA path was removed.

## Protected acceptance and rollout boundary

VERIFIED by source comparison: no application runtime changes in this patch, including starting-frame preview controls and scheduling controls. VERIFIED by isolated tests: request ownership and role separation, full-source timing choices, saved request recovery without paid resubmission, background/foreground distinction, owner isolation, bounded schedule refresh/status behavior, and bucket CORS preflight.

NOT TESTED / NOT VERIFIED: desktop/mobile authenticated hosted navigation and upload, live Firebase session continuity, real provider generation/visual output, browser-independent publication/provider evidence, worker Docker Node22 image/startup/commit identity, hosted schema history, actual Vercel packaged limits and billing. A successful build does not close these checks. No new UI or prompt was implemented, so no new visual/model-output acceptance is claimed.

Keep the established rollout order in `docs/release-readiness-2026-11-03.md`: prerequisites and exact release freeze; compatible immutable workers and affected jobs first; website/API/MCP after worker acceptance; then hosted acceptance and monitoring. Never execute uncertain paid jobs or publication jobs merely to validate a deployment. Keep rollback images/metadata and restore website admission first if compatibility fails. Sibling Vercel project settings remain unchanged.

Incident receipt: `UGC-TEST-20261103-RELEASE` assertion/command failures are locally verified repaired. `UGC-BUILD-20261103-05` is mitigated for this acceptance run by replacement scratch storage and a clean final integrity check; no machine-wide filesystem repair is claimed. The Windows native-child crash has not recurred in the bounded final run, but its underlying cause remains unknown. Auth incident `UGC-AUTH-001` remains open for real hosted-session evidence.
