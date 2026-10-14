# UGC Pilot website measurement — 14 October 2026

## Verified destination

Existing GA4 property `ugcsaas`, account `371176872`, property `543494283`, web stream `15161423223`, measurement ID `G-PEWJZ44H9Q`. This property is linked to Firebase project `ugcsaas`, matching the application. Its stream URL was blank and the UI reported no data received in 48 hours. The stream URL is now `https://getugcpilot.com`; enhanced measurement remains disabled to prevent automatic history/form events and duplicate page views.

Analytics ownership under the Google account ending `49@gmail.com` is independent of the application's `vtu19403@veltech.edu.in` login and deployment account. No application login or permissions changed.

## Implementation

- `NEXT_PUBLIC_GA_MEASUREMENT_ID` is a public Config value on the existing `ugcpilot/ugc` production project. An absent/invalid ID or a non-production hostname disables the tag, including previews and localhost.
- Google Analytics is not downloaded or initialized before a visitor allows analytics. Public pages offer equally styled Allow and Reject buttons and a persistent Analytics preferences control. Rejection disables measurement and removes only `_ga` cookies, preserving authentication and other preferences. Storage denial fails closed. Changes in another tab update the current tab's consent.
- Page views are manual, once per visited public pathname. Public inventory is reused from `lib/marketing/public-page-paths.json`, with the public connection, legal and sign-in pages added. Queries, fragments and actual document titles are never used. Referrers contain only an HTTP(S) origin. Private, OAuth, verification and unknown routes use fixed `/account` metadata and do not generate manual page views. The fixed safe metadata also applies globally to Google's automatic engagement events.
- `sign_up` means a Firebase account was created, not a signup-button click, ordinary sign-in, credential linking, verified-email activation, trial or purchase. Google popup/redirect events require Firebase `isNewUser`; email records successful account creation even if the subsequent verification email cannot be delivered. Only the method and safe page metadata are transmitted. Account ID is used only in browser memory for deduplication and is never sent to Google.
- Advertising consent, Google Signals and ad personalization are disabled. Analytics failures do not interrupt successful authentication. Cookie and privacy pages explain the implemented choices.

## Validation before release

46 Analytics/authentication tests passed, covering consent, revocation, cross-tab consent, previews, sanitization, deduplication, Google popup/redirect, existing login, email linking and delivery failure, email security/rate limits, and workspace account isolation. Scoped ESLint and the full Next.js production Webpack build passed (162 static pages). The initial build caught a TypeScript window-extension issue; it was fixed before the passing build.

The release is isolated from the original checkout's ongoing Explore, scheduling, carousel, subtitle and worker work. Those changes are outside this Analytics release; no database/worker migration is needed. No credentials or local environment files are committed.

## Acceptance still to record

After deployment: verify the production source/commit, consent UI, tag absence before consent, tag presence after allowing, rejection and preferences, public navigation, existing authenticated workspace access, and Google Analytics Realtime receipt. A genuine new-account creation conversion is not yet tested against production; automated tests cover its wiring without creating disposable production accounts. Social distribution remains pending selection of the business social profile and finished share assets.

## Operating checks

Use Search Console for search impressions, clicks and indexing. Use GA4 for consenting public visitors and new-account events. Counts exclude visitors who reject analytics or block Google, and must not be interpreted as complete signup totals. There is no pre-installation website traffic history from this tag. Compare organic landing pages and account creation after enough new data accumulates; do not infer an SEO ranking lift from the installation alone.

Rollback: restore the prior website deployment or remove the public measurement ID and rebuild. Authentication does not depend on Analytics. Keep enhanced measurement disabled unless automatic event privacy and duplicate prevention are reviewed first.

References: https://developers.google.com/analytics/devguides/collection/ga4/views and https://developers.google.com/tag-platform/gtagjs/reference.
