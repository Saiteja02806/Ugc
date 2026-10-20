# Trending partial content-plan reservation reuse — 14 October 2026

## Problem and change

Production Trending's 14 October daily pack had 50 failed slideshow slots.
`/api/trending/feed` logged `carousel_content_plan_insufficient_items`.
The current 150-idea plan contained 40 available ideas, three consumed ideas
whose current reservation was completed, and 107 consumed ideas whose current
reservation was `released_partial`. All 110 consumed ideas referenced completed
generations. The allocator excluded `released_partial`, leaving only 43 eligible
ideas. Preparation reserves every five-item partition before creating writers;
eight partitions reserved 40 ideas, the ninth failed, and cleanup released all
eight. No generation records or jobs existed for that daily generation batch.

The forward migration changes only the allocator's two terminal-reservation
predicates to include `released_partial`. It uses the installed function
definition, checks that exactly two old predicates exist, and replaces only
those predicates. An already patched definition is accepted; an unexpected
definition fails closed. It performs no data backfill or permission changes.
The original locking, ownership, profile-version/current-period checks, unused
then least-recently-used selection, original request replay and historical use
records remain. A partially successful original request still cannot be reopened
under its old key: reuse happens through a new reservation.

Migration applied at approximately **09:17 IST**:
`20261014034706_reuse_released_partial_carousel_content_plan_items`.
The local filename matches the actual hosted migration ledger version.
Production function body MD5 changed from
`bbe07de2e5d04d11d22573faf4f0a979` to
`e0b3fa4b8ad8ab71b50c023acc554015`; direct body comparison confirms exactly
the two expected replacements. Security invoker, empty search path and
`postgres`/`service_role` execution permissions are unchanged. Security advisors
before and after show the same existing informational RLS-without-policy notice
for 145 service-owned tables. No new security advisory was introduced.

## Validation

`node --test scripts/carousel-partial-plan-reuse-db.test.mjs` passes ten tests
against the repository's full migrated schema in isolated PGlite PostgreSQL:

- Exact 43-of-50 failure reproduces on the old allocator and reserves 50 on the fix.
- Ten five-item writer partitions are disjoint and retain identical items on replay.
- Original partial request keys remain immutable; new keys can reuse successful ideas.
- Consumed items in still-active reservations remain unavailable.
- Unused ideas precede least-recently-used successful ideas.
- Expired partial reservations retain release/reuse behavior.
- Completed request replays retain their original historical items after rotation.
- Owner, profile-version, plan-period and insufficient-inventory checks remain.
- Migration is repeatable, changes exactly two predicates and retains permissions.
- An unexpected function definition aborts rather than being overwritten.

The empty-database fixture installs all repository migrations and then matches
the inspected production allocator ACL explicitly before permission assertions.
The original `generation_source` and provenance constraints are exercised by real
consumption calls; no lifecycle constraints are disabled.

Another 49 existing tests pass across content-plan schema/lifecycle, content-plan
projection, daily replenishment logic/contracts and writer-job ownership.
No web or worker source changed, so rebuilding or releasing unrelated worktree
changes is unnecessary for this database-only fix.

A production SQL verification uses the affected plan's actual owner, profile
and profile version, reserves 50 ideas as ten partitions, confirms each exact
request replay and disjointness, and intentionally rolls back the nested
transaction. Item, reservation and use snapshots before/after are identical.
No test reservations or generated media are persisted by that verification.

## Production recovery

The production `/dashboard` Trending page displayed **More content is still due**.
Its existing **Try again** control was used once after the migration. The same
14 October pack changed from failed to preparing, recovery count reset from
three to zero, and the same daily generation batch acquired 50 candidate records
starting at **09:20 IST**. This is recovery of the requested daily allocation,
not an additional feed or an allowance increase. The existing writer queue,
image allocation, text validation, rendering and reconciliation paths are used.

At approximately **09:23 IST**, the first two writer jobs have completed, one is
processing and seven are queued, with no failed writer jobs. Ten slideshows have
completed; each has all six expected persisted ready slide URLs (60 slides).
The production browser renders slideshow cards and their slide navigation again.
The saved screenshot is
`outputs/trending-partial-plan-reuse-recovered-2026-10-14.png`.

This establishes recovery through reservation, queue dispatch, generation,
rendering, persistence, feed reconciliation and the production UI. A subsequent
production delivery audit confirms all 50 candidates completed and the pack is
ready with 50 assignments. All resolved to Structure 2 after the requested
Structure 1 batches failed their writer planning; see
`docs/structure-1-production-delivery-audit-2026-10-14.md` for that separate issue.
No schedule, publishing operation, application push or unrelated deployment
was performed by this fix. Existing unrelated worktree changes are preserved.
