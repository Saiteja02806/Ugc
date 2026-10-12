# Trending publishing defaults — local implementation

The repeated publishing questions are removed from Trending's shared
Carousel/Reaction/Text Reel dialog and Hook video drawer. AI disclosure comes
from Settings > Preferences and defaults to on. New TikTok targets use saved
visibility (initially Everyone) and Allow comments (on). New YouTube targets use saved
visibility (initially Public), made-for-kids (off) and subscriber notifications
(off). A small "Change default settings" link opens `/settings#preferences`
separately so the current post stays available. Returning refreshes saved
defaults without losing the caption or selected destinations.

TikTok visibility and comments are edited only in Settings for new Trending
posts, following the user's explicit request. This differs from TikTok's
published requirement for manual per-post visibility without a preset and
interactions off until manually enabled. It carries app-review risk; no
provider approval or compliance exemption is claimed. See the
[official Direct Post UX requirements](https://developers.tiktok.com/docs/en/content-sharing-guidelines).
The implementation preserves creator capability checks, disabled interactions,
audit restrictions, photo/video publication contracts and final consent.
Unsupported saved visibility blocks publication until the default is changed;
no silent audience substitution is performed. Creator-disabled comments,
Duet and Stitch are forced off for the target without changing account defaults.

This integration does not expose a writable age-restriction setting. It does
not request an age restriction, and it cannot promise that a platform will not
apply its own moderation. Made-for-kids is a separate YouTube audience setting.
Comment moderation and age restrictions remain available on the destination
platform; no ineffective setting or unsupported outbound field was added.

## Persistence and compatibility

- Local migration `20261011131530_expanded_account_publishing_defaults.sql` adds
  five non-null, validated TikTok/YouTube preference columns. Existing disclosure
  values, RLS and service-only permissions are preserved.
- Authentication derives ownership from Firebase on every read and write.
  Client-supplied user IDs and unsupported preference fields are rejected.
- Partial updates write only supplied columns. An older AI-only save cannot
  overwrite visibility, audience or notifications.
- Updated clients request `schema=2`. Unversioned clients retain the original
  one-field response, including already-open pages with strict parsers.
- Trending confirmation blocks on failed or pending preference reads and offers
  a retry. Late responses from closed sessions or other accounts are ignored.
  Capability reads do not write preference overrides or reset saved visibility.
  Instagram-only posts do not depend on the preference service.
- Existing schedule targets, stored visibility and historical output are not
  rewritten. Generic schedule editing and Explore retain their existing saved
  target settings and per-post controls. Publishing workers are unchanged.

## Verification

- 64 focused component, API, scheduling, visibility and PostgreSQL checks pass.
  These include migration defaults, preserving existing rows, partial updates,
  invalid visibility, account isolation, direct browser permission denial and
  preservation of existing schedule settings.
- The real Settings and Trending components pass 18 local browser scenarios:
  saved preference reload; both publishing surfaces on desktop/mobile; delayed
  defaults; YouTube without repeated questions; Settings-link navigation and
  returning with the caption intact; reopening; creator-disabled comments;
  unsupported/unaudited visibility blocking; failed creator-info retry; and
  failed-default retry. Trending posts do not write back account preferences.
- Five Explore/generic scheduler browser scenarios pass, covering exact owned
  output, saved disclosure, explicit interactions, ordinary composition and
  mobile/error behavior after the shared Settings/API change.
- Workspace TypeScript and scoped ESLint pass. Desktop and mobile screenshots
  were inspected. These fixtures use local HTTP services and fake identities;
  they cannot publish real posts or write production data.

## Release requirement

This change and its migration remain local. Apply the additive preference
migration before releasing the website. Existing worker code consumes the same
stored target settings contract and does not need a change for this feature.
Authenticated acceptance on `https://www.getugcpilot.com` is pending the user's
later deployment. No GitHub push, production migration, website deployment or
social publishing was performed for this implementation.
