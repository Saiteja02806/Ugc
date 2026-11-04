# Combined release — 5 November 2026

## Authorization and scope contract

The user requested review and deployment of all intentional current changes and separately authorized production builds and deployment. This includes the committed `7131ad1c` changes over `origin/main` and the complete intentional worktree inventory captured in `.tmp/release-20261105/initial-inventory.json` (78 paths before this receipt). No production setting, secret, IAM, DNS, billing, dependency, database-schema or deployment-trigger change is authorized by this release.

Release scope: Talking Head hook-only script review, one-action business-personalized prompt export, transcripts and source deduplication, generated-result review, shared floating feedback with a close mark, Kling 4 prompt policy, audio selection, draft hydration, slideshow automation recovery/native rendering, and standalone launch-video authoring sources. Standalone authoring scripts are inspected but are not executed as deployment steps.

The edit boundary for release preparation is test expectations that demonstrably conflict with approved current behavior, concrete release blockers, and this evidence receipt. Preserve ReAPI video routing, Terra medium script Remix, exact owned job/result IDs, complete reviewed hook dialogue, source/identity separation, starting-frame state and selected raw photos, pending-request duplicate-spend protection, neighboring workflow controls, and durable scheduling semantics. Do not repair unrelated historical UI assertions by changing working product behavior.

Acceptance: changed-file lint and app types; worker compilation; combined changed/neighbor tests; isolated production build and bundle gates; Linux native renderer/Sharp proof in the deployed build; exact source-commit/image mapping; readiness and health checks; real production read-only/UI acceptance where authenticated access exists. Paid video generation and live publishing are separate from read-only release checks and are not implicitly executed.

Rollback boundary: retain current web deployment and worker revisions/image digest before mutation; deploy compatible worker code before admitting longer prompts in the web release. Roll back web admission before rolling workers back. Preserve all environment bindings, identity, scaling, queues, schedules and traffic settings except the explicit release revision transition.

## Preflight receipt

Read applicable engineering rules in `AGENTS.md`; mandatory context-memory, immutable-contracts, regression-gate, UI-clarity, scheduling and Vercel cost-guardian skills; complete protected contracts and relevant Explore, Carousel, mistake-memory and scheduling sections under the user's explicit large-history reading exception. Reviewed feature receipts for Talking Head, floating feedback, Kling, audio and slideshow automation. Ran repository preflight and PR cost guard against `origin/main`, then inspected dirty changes separately. No package, lockfile, Next/Vercel configuration or CI trigger changes were found.

## Verification and deployment evidence

In progress. Local fixture results and mocked tests are not production acceptance. Final release status, exact tests, paths, exclusions, deployment IDs, worker digests and unverified limitations will be appended after checks complete.

### Local release gate

- Changed-file ESLint: no errors, two pre-existing unused-variable warnings (audio choices and standalone Remotion source). Application nonincremental TypeScript check: exit 0. Worker compilation: exit 0.
- Combined current/neighbor suite: **858/858 PASS**, zero skipped (`.tmp/release-20261105/tests.json`, `tests.log`). Initial loader failures and five exact stale expectations are retained in `tests-initial.log`; tests were reconciled without changing application styling/copy. Separate automation/database/atomic scheduling/shared glyph group: **69/69 PASS** (`tests-automation.log`).
- Actual-component browser review: **128 assertions PASS**, no page errors, widths1440/900/390/320 (`result-review-browser.log`). These are isolated visual fixtures, not provider or authenticated production acceptance.
- Full pending inventory:79 intentional paths at audit freeze; no suspicious local/secret path. Only the release receipt is new since initial audit; changed-during-audit paths are this ledger and the two reconciled test files. No intentional source is deferred. Ignored `.tmp/`, `.tools/`, `.next/`, dependency/cache trees, local environment/certificate material and generated review/build artifacts are excluded from Git and upload. Private reference-authoring material and high-resolution cover originals remain in Git where already tracked but retain the established `.vercelignore` upload exclusions.
- ReAPI/Terra medium remain selected. Full source transcript stays separate from reviewed spoken hook. Raw-photo selections are retained; unsupported literal-first-frame plus identity-reference combinations still block before spending. ASR is a reviewed draft, not certified verbatim; provider video identity/lip-sync, actual heavy-prompt acceptance and live social publication are **NOT VERIFIED** by this release suite. No paid generation or publishing probe is performed.
- Isolated web production compilation, hosted Linux native gate and deployments are pending. Prior web rollback is `dpl_5V82CG82ghtbajsB26nQcuiAjD6W`; MCP rollback `dpl_GGBmsahV8ashaw7wzEAe8DGGU73X`. Worker rollback is each service's `r-c6d474d3` revision and image `sha256:e5503ebe69647a83bd082acdef3dd9892f3efb7ebe74b0adc4a71c90c9c49470`. Six production services and two production jobs share that release image. Release image/runtime Git metadata must move together; all other production bindings/configuration remain unchanged. Canary and Tinder services are outside this release.
