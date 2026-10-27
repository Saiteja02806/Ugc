---
name: ugc-scheduling
description: UGCPilot Schedule tab and publishing reliability skill. Use for 24-hour date/time selector changes, timezone display, Instagram/TikTok/YouTube account targeting, backend scheduler persistence, worker delivery, retries or duplicate prevention. Trace frontend-to-published lifecycle and preserve old picker UI unless explicitly changed.
---

# UGCPilot Scheduling — UI + Backend Contract

## Scope

This skill is for BOTH user-facing scheduling UX and actual backend execution. A successful click, local browser state or a new form field is never enough.

## Preflight

Read the real explore context, `clear.md` (UGC-SCH-001/002), `nonnegotiables.md` and `scheduling-contract.md`. Trace actual app code paths before assuming a scheduler architecture or table names. Inspect current working UI and recent picker implementation. Distinguish known bugs from screenshot-only hypotheses.

## UX repair requirements

- Preserve/reuse an interactive date selector and a **24-hour time selector** consistent with the product design. Do not silently replace with plain `HH:mm` textbox.
- `00:00` through `23:59` is supported, with `09:30` and `21:30` displayed exactly in a 24-hour interface.
- Display timezone explicitly; keep selected local time unchanged across tab changes, form re-renders and reloads.
- Disable Schedule when a required account, ready media, valid date/time or other necessary parameter is missing. The screenshot's disabled button with empty inputs is not itself a bug.
- Show clear pending/saved/failed feedback; do not call a post 'published' before provider evidence is returned.

## Trace schedule pipeline in code

Draw a trace with actual named functions and files:

`UI form → selection state → request payload → authenticated API → schedule record + target records → server scheduler / queue / outbox → worker claim → platform API → status & provider post ID → frontend refresh`.

For every arrow: include code location, expected payload/IDs, persistence or side effect, error path and logging. If any edge is missing, report a BLOCKER, not success.

## Execution correctness

- Validate ownership of accounts, tokens/permissions, media readiness, caption and target requirements.
- Create durable schedule AND selected targets atomically where possible. Never silently create a schedule with zero destinations.
- Convert local date/time + IANA timezone to UTC exactly once. Store enough information to restore the user's intended wall-clock display accurately.
- Schedule via server-side event, queue, scheduler, or outbox independent of the browser; handle delayed/duplicate delivery defensively.
- Use atomic target claims and idempotency keys to reduce duplicate posts; handle reentrancy, 429 errors, timeouts, token expiry and partial success.
- Ensure retries do not blindly publish twice after an ambiguous provider response. Reconcile when possible.
- Treat successful scheduling as acceptance of a persisted job, NOT proof that future publication happened.

## Test matrix

1. Missing account/date/time → button disabled with a clear explanation.
2. Select two accounts → exactly two persisted publication targets, not zero.
3. Select 21:30 in Asia/Kolkata → persisted `16:00Z` for the same calendar date; UI still 21:30 on reload.
4. Validate midnight, end of day, past date, invalid/ambiguous timezone cases.
5. Schedule then close browser: worker still fires at intended instant.
6. Duplicate scheduler event: no duplicate provider post where provider semantics allow.
7. Retryable failure -> retries correctly; permanent failure -> clear state.
8. Partial success: separate status for each selected account.
9. Provider auth expired and queue backlog: alert/observable failure; no silent success.
10. Existing Create and Demo tabs unchanged after Schedule repair.

## Reporting

Produce an evidence-based audit table: step, existing implementation, issue, file/function, test/evidence, status. Distinguish NOT TESTED, WORKING, FAILED, and BLOCKED. Don't reveal sensitive tokens in logs or report. A work plan can be produced without actual provider credentials; production success cannot be claimed without controlled end-to-end test evidence.
