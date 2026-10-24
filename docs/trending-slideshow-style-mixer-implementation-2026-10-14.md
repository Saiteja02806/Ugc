# Trending slideshow style mixer implementation — 14 October 2026

Trending's Adjust dialog now lets an account set the mix of **Helpful tips**
and **Product stories + CTA**. It defaults to 50/50 and keeps the existing
slideshow-only format policy. The planner converts percentages into whole
five-candidate writer batches, using a stable date-based tie break. A 50-card
pack therefore plans 25 candidates per style; a 20-card pack plans ten per
style. The Adjust counts reflect the visible result of five-candidate batches,
including mixes whose percentages cannot map to exact whole batches. For
example, 53/47 on a 50-card pack displays the achievable 25/25 split generated
by five batches of each style.

The preference is owner-scoped. Each new daily feed stores an immutable copy,
so editing Adjust cannot silently change a pack already being generated. The
refill path filters candidate inventory to the feed's own reserved slots and
passes the requested structure through batch reservation. Requested Helpful
tips use `account_preference` routing; generic rotation fallback cannot silently
turn those slots into Product stories. Existing packs keep their original
routing and assignments.

Helpful-tip content must be educational and not promote the account's business.
Publishing validation rejects non-null CTA text, the exact business name and
common acquisition phrases. A failed educational plan remains an incomplete
Helpful tips allocation instead of being counted as successful delivery. This
stricter publishing contract may expose upstream planning failures that were
previously hidden by a product-story fallback.

The additive migration is
`supabase/migrations/20261014113000_add_trending_slideshow_style_mixer.sql`.
Apply it before releasing the updated website because the new API reads and
writes its preference and pack snapshot columns. Existing packs migrate with
the mixer disabled.

Local validation passed: 50/50 and 20/20 allocation tests, preference
validation, existing style-routing and content-mix contracts, the worker build,
the application TypeScript check, and PGlite tests for preference persistence,
immutable snapshots, requested-structure reservation and exact replay safety.
The migration has not been applied to production and the website has not been
deployed, so this change has not yet altered what the production account sees.
