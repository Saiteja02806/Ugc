# Connected social account photos — 2026-10-22

## Report and findings

TikTok and Instagram account photos fall back to platform icons in Analytics and
Settings. Both surfaces already had avatar components, but loaded provider image
URLs directly. TikTok persisted `avatarUrl` only at OAuth connection time: only
Instagram participated in background profile renewal. Background renewal also
did not update the already displayed account object in Settings.

These are code findings, not a diagnosis of the user's individual production
connection records. No production tokens or connection records were inspected.

## Fix

- Renew TikTok profiles as well as Instagram through the existing owned profile
  job. Record TikTok profile synchronization time and apply a six-hour freshness
  interval. Preserve Instagram's 24-hour interval and 15-minute failure backoff.
- Both avatar components share an authenticated image query. An owned image
  endpoint resolves current profile details independently of the account list,
  so existing Settings state need not change for a repaired photo to appear.
- If a CDN image fails, attempt profile renewal once and download a changed URL.
  Failures retain the platform icon. Provider lookup backoff applies to forced
  renewal too. TikTok access renewal uses the existing token lease and identity
  check; profile updates preserve authorization revisions. Conditional metadata
  writes stop a late failed lookup from replacing a concurrently repaired photo.
- Only HTTPS URLs on supported provider CDN domains are fetched. Check every
  redirect, accept raster types only, cap bodies at 1 MiB, and bound image/profile
  reads. Image downloads receive no application or provider authorization header.
  The endpoint derives ownership from Firebase and returns private, no-store
  responses without exposing provider error details.
- Duplicate avatars share a five-minute owner/connection/authorization/source
  query. Small image data URLs avoid retained object URLs. Missing photos and
  errors keep a fallback without retry loops. Account lists remain independent
  of photo requests. Existing YouTube image behavior is unchanged.

## Local validation

- 67 focused tests pass, including profile renewal, concurrent profile writes,
  expired TikTok access via
  the existing token lease, provider backoff, foreign/revoked connections,
  redirect/size/type restrictions, authentication, OAuth and shared avatar use.
- Application TypeScript and scoped ESLint checks pass.
- `node scripts/social-account-photos.browser.cjs` passes with the real shared
  avatar components and synthetic image responses: both variants, missing/old
  sources, decoding, nonblocking display, request deduplication, remount failure
  handling and owner isolation. PNG fixture pixels are synthetic, not real
  production profile photos.
- `node scripts/analytics-loading.browser.cjs` passes the existing account,
  snapshot, polling, refresh, idle return and owner-isolation checks.
- Edge could not launch inside the Windows sandbox; both browser scripts passed
  when launched with approved execution outside that sandbox.

## Production acceptance

The production Analytics URL currently resolves to the sign-in page in the
available browser. No signed-in acceptance was possible. This change is local,
uncommitted and undeployed; it does not establish that the user's live photos
have recovered. After deployment, check the actual connected TikTok and
Instagram accounts in Analytics and Settings, including a browser reload and
an account with an older stored image URL.
