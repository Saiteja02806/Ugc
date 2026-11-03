# OAuth reliability local fix — 3 November 2026

Status: PARTIALLY VERIFIED. Local fixes and controlled regressions pass; no deployment, push, account reconnection, manual post retry or publishing performed.

## Scope and files

- `components/social/use-social-oauth-popup.ts`: bound initial Firebase token + start POST + body parsing to 20 seconds; pass cancellation signal to fetch; monitor closure before token acquisition; cancel on explicit close/unmount; ignore stale attempts; bound close reconciliation and recover rejected callbacks. The provider consent window is not limited to the 20-second startup deadline. No automatic POST retry.
- `lib/social/oauth.ts`: both Instagram short-token and long-token exchanges use a shared internal 15-second deadline covering headers and body. Failures produce a safe provider_exchange_failed error; no consumed-code retry or credential logging.
- `components/social/instagram-professional-account-guide.tsx`, `components/settings/instagram-account-manager.tsx`, `lib/social/oauth-callback.ts`: explain Creator OR Business professional accounts. Existing controls, classes and account eligibility remain.
- `components/social/use-social-oauth-popup.test.mjs` (new): actual hook with controlled React/browser transport harness, not a real browser.
- `lib/social/oauth-token-deadline.test.mjs` (new): executes the actual internal helper using test-only loader export, not a production API export.
- `lib/social/instagram-professional-account.test.ts`: update copy assertions to both supported account types.
- `docs/ai-context/clear.md`: append UGC-SCH-019 and local verification of UGC-SCH-018/019; preserve all history.
- `EXPLORE_CONTEXT.md`: append scoped OAuth recovery outcome.
- `docs/scheduling-error-recovery-evidence-2026-11-03.json` (new): redacted read-only production log correlation.
- This report (new).

Rollback boundary: only this task's incremental changes to the listed files. Do not reset the worktree; extensive unrelated uncommitted changes, assets and prior auth fixes existed before this patch and were preserved.

## Evidence for the production errors

Read-only gcloud queries: project ugcsaas, active Cloud Run service ugc-social-publish-worker, last eight days / limit1500; then a precise October27 12:20–12:24 UTC window. Identifiers were used only in memory to correlate; saved evidence omits job/user/account/publish IDs, request bodies, tokens and content.

For the SAME job: worker started12:21:17.717644Z; TikTok internal error scheduled retry12:21:22.664980Z, nextAttempt12:21:52.279Z; an early delivery12:21:33.157977Z saw queued/not yet claimable; retry started12:21:53.954548Z; social publication completion12:22:08.349589Z; worker completion12:22:08.565337Z.

HTTP503 requests at12:21:17.524204Z (5.174s) and12:21:32.735351Z (0.489s) are on the same worker instance and align with the failure/early-redelivery events. A subsequent request12:21:53.437564Z returned200 (15.178s). Worker index.ts intentionally returns503 when a durable job is not ready to execute, preserving queue redelivery. Request logs do not contain job IDs/trace correlation on application entries: matching these request rows is a timing+instance inference, not a direct trace-ID join.

Same-instance TikTok polling reports PROCESSING_DOWNLOAD12:21:57.576074Z then PUBLISH_COMPLETE12:22:07.912468Z. Job-correlated completion is VERIFIED from logs. Provider status is observed in the same execution window, but an independent stored provider-ID/public-post check is NOT VERIFIED. Current source emits social publication completion after marking operation and target published. No evidence justifies changing retry/503 semantics for this recovered incident.

## Preflight actually performed

Read mandatory context-memory, immutable-contracts, scheduling, UI-clarity and regression-gate SKILL.md files, scheduling-contract.md, nonnegotiables.md, relevant Next use-client documentation, actual hook/callback/exchange/guide/tests/callers, and existing scheduling audit/evidence. Repository AGENTS instructions supplied in the chat were applied. EXPLORE_CONTEXT.md and clear.md relevant scheduling/auth/OAuth historical sections were reviewed; full historical ledgers were not manually reread in this continuation. `python tools/preflight.py --repo . --task "Fix confirmed OAuth unbounded waits and professional account wording locally; trace production TikTok and 503 recovery without deployment"` passed prerequisite discovery. Git status and scoped diffs inspected before edits; six existing application/test files in this patch were clean before edits; ledger/context edits are append-only.

Protected scope: no callback/domain/environment/scopes changes, account-ID mapping changes, schema, scheduler/worker changes, packages, global styling or new controls. Existing uncommitted auth and other work retained.

## Verification

- PASS38/38: `node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test components/social/use-social-oauth-popup.test.mjs lib/social/oauth-token-deadline.test.mjs lib/social/instagram-professional-account.test.ts lib/social/instagram-oauth-config.test.ts lib/social/oauth-reconnect-policy.test.ts lib/social/tiktok-oauth-config.test.ts lib/social/youtube-oauth-config.test.ts`.
- Tests cover stalled token/headers/body, no automatic retries, late token fencing, stale cancelled attempt, normal consent startup, callback rejection, unmount, popup blocked, failed response, server safe error sanitization, supported account types, ownership/reconnect and provider scope contracts.
- PASS full TypeScript: `npx tsc --noEmit --incremental false`.
- PASS scoped ESLint for all eight application/test files above. Initial test harness naming lint error corrected; final rerun passes.
- PASS scoped `git diff --check`.
- No full build was necessary for this scoped source patch. No new worker execution or publishing test performed; worker unchanged.

| Protected behavior | Result |
| --- | --- |
| Startup timeout, cancellation, stale response fencing | VERIFIED locally with actual hook/helper under controlled transport |
| Ownership, reconnect account identity, supported account types, scopes | VERIFIED focused tests |
| Existing callback URLs, scheduling/timezone/target/job/idempotency logic | VERIFIED unchanged by scoped source diff; fresh end-to-end runtime NOT TESTED |
| Actual live Instagram consent/callback + Meta allowlist | NOT TESTED / NOT VERIFIED |
| Desktop/mobile text wrapping, keyboard and authenticated cross-feature navigation | NOT TESTED; no approved screenshots captured; classes/controls unchanged |
| Historical TikTok job retry and completion | VERIFIED read-only worker logs |
| Independent production DB/provider post receipt | NOT VERIFIED |

UGC-SCH-018 and019 are LOCALLY VERIFIED, with hosted acceptance still open. A build or these mocked transport tests do not establish live OAuth or future publication success. No deployment performed.
