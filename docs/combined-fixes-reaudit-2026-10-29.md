# Combined local fixes: independent recheck, 29 October 2026

Result: recent fixes are verified locally with the qualifications below. This is not production acceptance. No application code changed during this recheck; no deployment, generation, publication, real schedule submission or MCP build occurred. Existing worktree preserved; HEAD remains ecba34d0.

## Scope and outcome

| Reported issue/change | Recheck result |
|---|---|
| Change opens an intermediate popup and a second image picker | VERIFIED locally: one direct large centered dialog, mobile bounds, Done/reopen/Escape |
| Starting image fills the Create panel / duplicate chooser | VERIFIED locally: compact single frame retained; frame and identity selection are separate |
| Raw influencer photo preselection, adding/removing photos | VERIFIED locally: original selection, multiple photos, removal and frame retention; supported appearance roles in provider contract tests |
| Source/identity labels for two or five photos | VERIFIED by current prompt contract/provider role tests and previous exact v7 label assertions; source first, identity then ordered supports. Nano routes still cap photos at four |
| Profile icons absent beside account names | VERIFIED locally: actual authenticated picture hook with fixture API, account/photo binding, fallback and independent selection at desktop/mobile; hosted account photos not checked |
| Scheduled status/link too low | VERIFIED locally: small inline Scheduling link next to confirmed status, no false link for unconfirmed requests |
| Another running Hook tab blocks a fresh composer | VERIFIED for ordinary active jobs and separate frame/photo recovery; uncertain submission locks intentionally remain shared to prevent duplicate billing |
| Nano Banana 2.1 starting-image option | VERIFIED UI/API/worker/provider ID binding in tests; actual provider availability and image quality NOT TESTED |
| Four/five-second Hook source shortened to minimum | VERIFIED local source-duration defaults and server pre-credit validation; source-end initial trim and saved/historical trims retained. Generated ending completion NOT TESTED |
| Instagram post followed by TikTok appears already scheduled | VERIFIED: new valid destinations use distinct explicit request, old receipt archived; unresolved requests keep original frozen targets |
| Platform selected without an account | VERIFIED: names the platform and asks to select its account or deselect it; no silent target removal |
| Saved-edit loading repeats or times out without nearby recovery | VERIFIED local callback stability, canceled stale reads, Schedule read-only retry, preserved typing and safe timing headers; exact production latency cause remains UNKNOWN |
| Faded Hook controls while saving | VERIFIED actual-component tests: trim/text remain usable; frozen save and duplicate-save guards protect newer dirty edits |
| Demo text-fit warning blocks draft saving | VERIFIED browser: exact unfinished text saves and reopens while export warning remains active |
| Saved edits and full Wall duration | VERIFIED local persistence/component contracts; no data/default/layout migration in this recheck |

## Fresh checks run

- 479/479 application tests PASS, combined under Node module-mock/type-transform test runner. Includes generation UI/reference upload, starting-frame selection, frame history/API, tab selection, account photo/parser, editor, demo, draft PGlite persistence/recovery, scheduling UI and account selection. `.tmp/combined-fix-reaudit.log`.
- 90/90 worker/contract tests PASS: current image dispatch, verified source/identity inputs, Nano routing, original-opening timeline and historical receipt contracts. `.tmp/reaudit-worker-contracts.log`.
- `npx tsc --noEmit` PASS: `.tmp/combined-fix-types.log`.
- ESLint on every modified non-test components/lib TypeScript file PASS: `.tmp/reaudit-app-lint.log`.
- `git diff --check` PASS; line-ending notices only.
- Actual local browser fixtures rerun successfully: `starting-frame-compact.browser.cjs`, `connected-account-avatars.browser.cjs`, `hook-tab-recovery.browser.cjs`, `explore-demo-loading.browser.cjs`, `schedule-confirmation.browser.cjs`. Logs `.tmp/reaudit-{picker,avatars,tabs,editor,confirmation}-browser.log`. They exercise real components/hooks with fixture authentication, owned media, provider and persistence boundaries; they do not establish live end-to-end acceptance.

## Remaining test mismatch

Separate legacy suite `lib/social/scheduling-account-ui-contract.test.ts`: 6/7 PASS, one FAIL. It requires the literal `schedule-caption-heading` in `components/trending/hook-video-schedule-drawer.tsx`. The current drawer renders shared `PostCaptionField` at line 552; that component renders an accessible Post caption section and a label associated with its textarea using useId. The field has not disappeared. This is a source-shape assertion that no longer matches the shared component. Neither test nor application was modified to hide this failure. It must be reconciled before claiming an entirely green broader suite. Log `.tmp/reaudit-known-contract.log`.

## Still open

1. Exact cause of intermittent live loading/save delay: no correlated hosted timing trace captured. New timing instrumentation is not deployed.
2. Real parallel paid submissions under account limits and ambiguous network outcomes: no generation authorized. Shared uncertain-request recovery is retained.
3. Actual generated identity, lighting, caption/logo removal and final gesture before trim: model-contract correctness does not prove generated pixels.
4. Durable live schedule/target/worker/publication proof: no real schedule submitted during audit.
5. Full production build and authenticated deployed acceptance: not performed; user requested no deployment.

References: `docs/editor-schedule-recovery-2026-10-29.md`, `docs/starting-frame-direct-dialog-2026-10-29.md`, `docs/connected-account-avatars-2026-10-29.md`, `docs/schedule-confirmation-and-tab-isolation-2026-10-29.md`, `docs/nano-source-duration-tabs-2026-10-29.md`. Those receipts enumerate implementation files, preflight sources, incidents and earlier visual evidence. Rechecked current git diffs, those receipts, shared caption source/label linkage and the regression-gate procedure. No new defect was inferred from historical notes alone.
