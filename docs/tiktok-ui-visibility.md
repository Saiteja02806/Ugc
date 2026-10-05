# Temporary TikTok UI visibility

Implemented locally on 2026-10-03 while TikTok content-posting API approval is
pending. This is a presentation rollout, not a provider shutdown.

## Restore visibility

Set `socialPlatformVisibility.tiktok` to `true` in
`lib/social/platform-visibility.ts`, then rebuild and deploy the frontend.
Verified-user access remains required. The source platform definitions, icons,
OAuth, publish settings, analytics panel, and account manager are retained.

## Covered surfaces

- Homepage badge, hero description, workflow, publishing preview, footer, and
  page/global metadata derive their platform names from the visibility switch.
  The publishing preview has two destination rows and two connector arrows.
- Trending's hook drawer and shared Reel/Carousel account modal hide TikTok
  accounts, connection actions, settings, and submission selections. YouTube
  remains available for supported videos; Carousel format rules are unchanged.
- Explore scheduling choices and post preview hide TikTok. An existing browser
  draft is retained without selecting another platform automatically.
- Settings, Connected accounts, Analytics, and Scheduling hide TikTok controls
  and provider details. Two-platform selection layouts fill the available space.
- The camera-style label becomes "Casual UGC" with its existing `tiktok_ugc`
  value retained. The vertical aspect-ratio hint uses generic format names.

## Preservation and verification

Provider enums, access policies used by API routes, tokens, connections, workers,
and database records are unchanged. Existing scheduled posts remain in state;
their TikTok rows are filtered only while rendering. Existing schedule edits
preserve dormant saved targets and their settings instead of silently deleting
them. Historical status and backend processing semantics remain unchanged.
Privacy/terms disclosures continue to cover retained provider data.

Regression checks render the real marketing, Explore, analytics, and Trending
components with verified-user/connected-account fixtures; verify restoration
with the single switch; and check dormant saved-target preservation. Local
browser verification checks desktop/mobile landing layout and the existing
Explore development preview. This document does not assert deployment or
authenticated production acceptance.
