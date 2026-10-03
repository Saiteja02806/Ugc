# Seven-day trial and pricing release — 3 October 2026

The user selected the planned seven-day trial for the page and production.
The database migration was applied on 3 October 2026; the matching web changes
are included in this release.

## Agreed behavior

- New trials last seven calendar days from completed onboarding and allow seven daily packs.
- Unexpired trials extend to at least seven days from their original start and seven content days.
  Usage and start times are preserved; longer custom trials are not shortened.
- Expired trials remain closed. Repeating onboarding cannot reset access.
- Twenty daily concepts and unlimited Instagram scheduling during the active trial remain unchanged.
- Paid and complimentary plans retain their existing access.
- The final reserved trial pack can finish while the trial is active; an eighth pack remains blocked.

## Implementation

The duration source is lib/billing/free-trial-policy.ts. Pricing derives its trial
labels from that policy. Settings reads the stored entitlement, and expiry
messages also work for legacy closed trials.

Migration: supabase/migrations/20261003092157_extend_trending_free_trial_to_seven_days.sql.
It updates the default, onboarding grant, active entitlements and quota message.
The existing row locks, private function permissions, RLS, paid/complimentary
bypasses, scheduling guard and usage ledgers remain in place.

The pricing page describes deployed daily content, AI Studio, character creation
and editing/scheduling. Daily concepts are separate from monthly shared AI
credits, which use the existing coin icon. Starter remains $19/month or $190/year;
Growth remains $49/month or $490/year. Annual billing saves two monthly payments.
Unsupported tier differences were removed from the comparison and FAQ.

Current paid plans can manage billing, held/failed plans can recover payment,
and complimentary/trial users can open their workspace. Pricing refreshes billing
on entry and on window focus. A failed lookup shows retry and blocks checkout.
The checkout endpoint rechecks billing strictly and sends an existing managed
subscriber to their billing portal, preventing a duplicate subscription checkout.
Sign-in now displays the same billed prices as the pricing catalog.

## Validation

- Billing, pricing and recovery tests passed, including actual React component
  rendering and checkout endpoint execution with isolated provider fixtures.
- A real PostgreSQL test through PGlite covers active-only extension, unchanged
  expired records and usage, idempotent migration/onboarding replay, seven-pack
  enforcement, expiry, scheduling, permissions and paid/complimentary access.
- The final-pack application test proves the seventh pack can finish without an eighth.
- The pricing and seven-day regressions run after npm run test:billing.
- Targeted ESLint, whitespace checks and the complete production Next.js build passed.
- Local desktop/mobile review confirmed monthly/annual pricing, sign-in intent,
  loaded coin images and no page overflow. Keyboard and badge contrast issues
  found during the accessibility scan were repaired.
- Production database verification confirmed the seven-day default and functions.
  All 34 expired trial rows, 9 subscriptions, 5 credit balances, 111 feeds and 11
  scheduling usage rows were identical before and after the migration.

No new charged purchase or authenticated daily generation was performed as part
of this page release. Production page acceptance is checked after web deployment.
