# Predeployment review — 6 November 2026

**Recommendation: HOLD. This review did not build, push, deploy, promote workers, execute scheduled jobs or run new paid generations.**

## Release scope and production baseline

Remote main was checked read-only and is `79ce78697ac216c4cd080d1fea8ab8c8faf142cb`, equal to local HEAD. Nothing is staged. The final inspected application snapshot contains261 changed/untracked paths:141 tracked modifications and120 untracked files, approximately82MB total. This includes intentional authoring media as well as source/tests/docs. Do not omit small changes or untracked runtime modules from a future release.

The complete file list, sizes and SHA256s are in [the candidate inventory](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/predeploy-20261105/inventory-current.json). Scope includes starting-frame prompt/version and face-crop/direct-stage changes; master appearance selection; uploaded starting frames; owned video references; durable Slideshow identity execution and planner handoff; character pending recovery/thumbnails; feedback/navigation; Hook/Talking Head source derivatives/reclassification; local-only worker routing/scheduling; Demo/editor changes; and Remotion/published promo assets. The inventory was unchanged between its first and final readback; subsequent source edits require revalidation. This report and its append-only incident updates are additional documentation paths.

No manifest, dependency lockfile, Next/Vercel config, migration or CI workflow delta was found against HEAD at the final check. The committed-only Vercel PR scanner reports zero changed commits because HEAD equals main; it does not cover this uncommitted candidate. The worktree was reviewed separately. The19.9MB public promo is intentional output; authoring assets and worker build inputs require the established upload/trace exclusions. No suspicious secret filenames were found in the inventory; that is not a comprehensive content-secret audit.

Fresh Vercel read-only evidence: `ugc` production deployment `dpl_5yM9dxLKqjrBa1ypGZxqviVocYjC` is READY at79ce7869. Fresh Cloud Run readback: all six production worker services still send100% traffic to `r-ddbe2fdd`. Newest-ready revisions are not proof of active traffic. Historical `r-51a86601` candidates have no production traffic. No traffic or settings were changed. Current MCP/job definitions were not freshly revalidated in this audit; earlier receipts are historical evidence only.

## Findings

### P1 — historical appearance-role replay changes saved stage inputs

**CODE/LOCAL REPLAY VERIFIED; OPEN.** `worker/src/lib/starting-frame-reference-options.ts` changes shared outfit/full-appearance wording. It is also called again by the legacy pipeline in `worker/src/lib/openrouter-gemini-image.ts` on already-frozen prompts. Replaying a historical3-role `outfit=photo` or full-photo prompt now appends a second role block and changes its hash. All-source and old2-role examples remain identical, which explains why the existing narrow compatibility tests pass.

[Exact replay evidence](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/predeploy-20261105/legacy-role-replay.log). For the outfit-photo example, historical hash930b80db… becomes e33d906f…; full-photo3cb25778… becomes16f5f9ab…. `createDurableImageStageRunner` fingerprints stage input and `SupabaseJobStore.reserveGenerationProviderOperation` rejects a mismatch with the saved operation. Thus an older accepted affected job can lose recovery under the candidate. Actual affected production job count is UNKNOWN; no production jobs were mutated to test this.

Required correction: version the appearance formatter/new pipeline behavior and preserve old accepted stage-input assembly, not just old base-prompt text. Assert byte equality for all old role combinations and replay a saved operation with the real new worker path. Newly introduced direct/cropped stage2 behavior must also be durably distinguished from any accepted earlier version8 job; changing execution solely by interpreting the same promptVersion8 differently is not immutable recovery.

### P1 — complete release checks are not green

**VERIFIED; OPEN.** The broad changed-test run has5failures. Two `lib/explore/hook-user-decisions.test.ts` assertions expect superseded wording (`first decoded frame at elapsed t=0`, `original-opening`) rather than the new default wording. Two scheduling scenarios in `scripts/workflow-sections.test.mjs` fail at the VM harness boundary with `Unexpected import react-dom`; those scenarios have not reached their intended assertions. One real-media test reports EBUSY while unlinking `format-font.ttf`, a local Windows cleanup failure rather than proof of wrong video output.

Separate release guards report1failure: `scripts/check-hook-public-traces.test.mjs:43` requires an exact old tracing array, while committed Next config already includes an additional cover exclusion. This is reproducible source-assertion drift in the existing baseline, not evidence that the candidate added a tracing leak. Reconcile tests against protected behavior without weakening checks. Keep the file-lock failure distinct from application failures and rerun in isolation. Logs remain intact.

The initial app typecheck failed because the uploaded-frame union reached an old preview callback type. That file was corrected by concurrent work, not by this audit; a fresh full-app noEmit check passes. Do not continue reporting that preliminary error as an unresolved blocker. Remotion errors from earlier receipts also did not recur in the final typecheck.

### P2 — crop improvement has bounded evidence, not general identity acceptance

New face-cropped/direct-stage test artifacts exist and were visually inspected. Both retain the source hand side, room, tilted shot and caption removal more faithfully than the previous failed full-reference result. They do not establish100% scene preservation or exact facial identity for arbitrary uploads. The stored diagnostic scripts call the image adapter with hand-assembled prompts; they do not prove the entire current frontend→API→durable job→worker path.

The production candidate crops fixed22%/14%/56%/41% rectangles without detecting whether the face is there. Decode/crop failure returns the original full reference, silently reintroducing the leakage risk. General uploaded/tightly-cropped/off-center/full-body references and fallback behavior need acceptance or a constrained admission contract. Exact current integrated path and selected photo appearance overrides remain NOT OUTPUT VERIFIED. No new paid probe is authorized or performed by this precheck.

### Operational gate — worker must precede new website admission

Starting-frame prompt8, combined Slideshow identity work and owned-video references cross producer/consumer boundaries. New web admission must not target incompatible old workers. Preserve historical receipts and pending-operation semantics. Prepare compatible worker artifacts/revisions first, verify their exact contracts, then enable new producer code. Roll back new admission before rolling back compatible consumers. Do not promote the older51a86601 candidates as though they contain today's uncommitted source.

## Checks actually run

| Check | Result |
| --- | --- |
| First focused app/API/character batch |267/267 PASS |
| First focused UI/recovery batch |280/280 PASS |
| First focused worker/provider batch |128/128 PASS |
| All60changed/new test files |958PASS,5FAIL,0skip;963total |
| Separate deployment/media/composer guards |18PASS,1FAIL,0skip;19total |
| Fresh app noEmit/nonincremental types |PASS after preview callback correction |
| Fresh worker noEmit/nonincremental types |PASS |
| Initial candidate scoped ESLint |0errors,13warnings; later scope expanded, not a final whole-snapshot lint claim |
| Full worktree diff check |PASS at final inventory snapshot |
| Remote main, Vercel production and active worker traffic |Read-only VERIFIED |
| Current-candidate production browser, queue, publishing and actual model quality |NOT TESTED/OPEN |
| Build, deployment, new external generation |NOT RUN |

The test groups overlap; their counts must not be added as a unique-test total. Exact commands were direct Node source tests with the existing server-only/worker-source loaders, module mocks and transform-types; no npm scripts that invoke builds were used. Logs, exit codes, changed-test file list, inventories and replay proof are under `.tmp/predeploy-20261105/`. Production billing usage/CPU minutes and dollar impact are UNKNOWN. No changes to Vercel project topology, build triggers, IAM, secrets or scheduler settings are proposed or made.

## Scope of this audit and next gate

No application/test/asset fixes were made by this audit. Only this report, append-only incident records and ignored diagnostic artifacts were written. All other uncommitted work is preserved. Preflight read the actual AGENTS/global memory, relevant Explore/clear history, protected nonnegotiables and feature sources; context-memory, immutable-contracts, regression-gate, Vercel-cost-guardian, verify-feature-wiring, starting-frame, video-prompt, UI-clarity and scheduling procedures were consulted. Large history outputs were partly truncated; no fresh exhaustive history read or fresh whole-product visual audit is claimed.

Before release: correct historical replay compatibility; reconcile/isolate the failing tests; validate crop/fallback behavior and current integrated photo roles; freeze the complete intended candidate; rerun matching combined checks including final scope lint. Preserve the production rollback IDs above and capture MCP/job-definition state before an authorized rollout. Hosted Linux/native compilation and signed-in production acceptance remain future gates. The user's explicit no-build rule still requires separate build authorization before any build-triggering push or deployment. This request authorizes preparation and reporting, not those operations.


### Isolation follow-up
The isolated serial rerun of real-media finishing plus Schedule UI tests completed18tests:16PASS/2FAIL. The media test passed; its earlier EBUSY was not reproduced. Both Schedule scenarios still fail at the VM react-dom import boundary. No assertions were removed or application behavior changed. Four deterministic failures remain in the963-test changed-file run (two prompt assertions and two harness imports), plus the separate tracing-array guard; the broader run is still recorded as958/963 rather than silently rewritten. Evidence: .tmp/predeploy-20261105/failure-isolation.log. Exactly60changed/new test files were included. Incidents and the reusable versioned-stage replay lesson were appended to the project/global ledgers.
