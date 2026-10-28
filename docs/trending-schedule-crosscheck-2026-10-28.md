# Trending Schedule cross-check — 28 October 2026

Status: local checks PASS; deployed Schedule visibility remains NOT VERIFIED. This follows UGC-SCH-012 and the prior `docs/trending-schedule-visibility-2026-10-28.md`.

The three failing contract tests expected superseded UI behavior: separate Post Right away/Schedule for later cards, native time input step attributes, and forced24-hour helper text. The user's later approved contract uses one Post now action, interactive locale-aware time pickers, canonical HH:mm and all minute values. Tests now check those actual requirements and retain the five-minute lead/explicit submission and picker checks. No runtime UI was changed to satisfy tests.

The pagination test now identifies the last of203 records as a Trending library carousel, checks its scheduled TikTok target, source metadata and library ID, verifies owner isolation and both status/date filters, and checks later-page errors. This is a mocked database-client fixture, not a production PostgREST test. The existing actual Schedule component fixture displays a scheduled library carousel at desktop and mobile sizes, tests refresh and preserves owner isolation; its authentication and HTTP are fixture substitutes. It does not exercise pagination and UI as one live end-to-end workflow.

Production read-only SQL: two recent Trending TikTok targets now report `published`, associated jobs `completed`, and non-null provider post IDs. At the preceding investigation they had been beyond the200-row list limit. The patched page retrieval remains local; no deployment, production write, new scheduling or publishing action was performed. One cannot assert the live Schedule screen displays the fix before rollout.

Changes this turn: `lib/scheduling/scheduling-database-contract.test.ts`, `lib/scheduling/schedule-list-pagination.test.mjs`, append-only `docs/ai-context/clear.md`, this receipt. Existing pagination fix remains in `lib/scheduling/db.ts` from the preceding turn.

Checks:

- 69/69 scheduling contract, pagination, atomic SQL and direct scheduling service tests PASS: `.tmp/trending-backend/schedule-recheck-final.log`.
- 32/32 time conversion/display, workspace status, media availability and quick-time tests PASS: `.tmp/trending-backend/schedule-recheck-time.log`.
- Actual Schedule component browser fixture PASS desktop/mobile, cached/refreshed carousel, failure/retry, hidden/offline behavior and account isolation: `.tmp/trending-backend/schedule-recheck-browser.log`.
- TypeScript `--noEmit --incremental false`, scoped ESLint and scoped diff whitespace check PASS. No UI code changed; no new baseline screenshot comparison was required for a test-only correction.

Preflight actually consulted: repository skill files `ugc-context-memory`, `ugc-immutable-contracts`, `ugc-scheduling`, `ugc-regression-gate`, `ugc-ui-clarity`; nonnegotiables, scheduling contract, prior receipt and relevant incident sections, current component and tests; preflight script reports readable prerequisites. Large Explore/Carousel and incident histories were consulted via relevant sections and prior-turn context, not reread in full. Existing worktree changes preserved.

Protected contracts: local date/time and locale behavior VERIFIED by32 tests; saved target/job and duplicate prevention VERIFIED by local atomic tests; desktop/mobile carousel rendering VERIFIED in isolated browser fixture; both recent provider receipts VERIFIED via hosted readback. Full authenticated production display, browser-independent delivery of a newly created test post, pagination under concurrent data movement and very large-account latency are NOT TESTED. Offset pagination can shift under concurrent inserts/deletions; that pre-existing limitation of the local pagination approach remains documented.
