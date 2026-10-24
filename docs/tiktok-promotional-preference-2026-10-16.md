# TikTok promotional-content preference — 16 October 2026

Implemented locally; not deployed or applied to production.

Settings → Preferences → Publishing defaults → TikTok defaults now contains
**Label posts as promotional content**. It defaults off for accounts without a
preference row and existing rows after migration. Its description explains that
enabling it declares promotion of the creator's own brand, product or business
and makes TikTok display “Promotional content”. AI disclosure and paid
partnerships remain separate choices.

New Trending slideshow, Reaction, Text and Hook targets, Explore workflow
schedules and ordinary scheduler targets use this account preference. Changing
it does not rewrite already scheduled target settings or published posts. Saved
per-target settings take precedence when an existing schedule is edited.

The web API uses `schema=3`; earlier one-field and six-field responses remain
compatible with already-open clients. Partial website/MCP saves preserve omitted
preferences. The MCP account-settings functions include the new preference in
current reads/writes without rewriting accepted historical receipts.

## Verification

- App tests cover defaults off, explicit opt-in/out, malformed input, account
  isolation, older clients, saved target preservation, preference refresh and
  propagation through Trending, Explore and the scheduler.
- PGlite executes the actual migration against existing rows. It verifies
  false defaults, independent AI/commercial choices, immutable receipts,
  owner revision checks and service-only access.
- The real-component Settings/Trending browser fixture verifies saving on/off,
  reload, mobile layout and that returning from Settings updates both Trending
  scheduling surfaces without losing the caption.
- The scheduler browser fixture verifies default-off and saved-on payloads
  alongside the existing media, time, upload and mobile checks.
- Worker publisher tests verify false promotional and paid-partnership flags
  in the actual TikTok photo request; explicit own-brand opt-in still sends true.
- TypeScript, worker build and targeted ESLint checks pass. Local fixtures do
  not publish posts or spend credits.

## Release

Apply `supabase/migrations/20261015190906_tiktok_promotional_content_preference.sql`
before deploying the website. The additive migration adds
`tiktok_brand_organic boolean not null default false` and updates the service-only
account-settings functions. No worker implementation changed; its existing
TikTok flag mapping is reused.

After release, use the real production domain, `https://www.getugcpilot.com`, to
verify authenticated Settings persistence and new-target behavior. Production
acceptance and changes to existing published/queued posts are outside these
local checks. Older open tabs should reload to receive the corrected defaults.
