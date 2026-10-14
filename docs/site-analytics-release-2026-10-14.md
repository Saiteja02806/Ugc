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

## Production acceptance recorded

PR https://github.com/Saiteja02806/Ugc/pull/60 merged normally on 14 October 2026. Remote `main` is `51d369f304a490a81f6e8abec0a6eb5e173af359`, preserving the latest workflow release `a870105b`. Comparing all eleven intended Analytics source/test/documentation paths against the final tested branch head `281faca1015f5750dc9e55ce1b21a79a21fd6517` returned no differences. The active UGC Vercel check passed. An unrelated temporary-project check failed; no administrator override or protection change was used.

Production deployment `dpl_AxosHHVojJN44beDomuzWVP4CxDm` reached READY for that exact merge commit and owns `getugcpilot.com` and `www.getugcpilot.com`. The existing 22 HTTP SEO regression checks passed against production, including all fifteen public pages, sitemap, metadata, canonicals, robots and private/unknown-page behavior. Evidence: `.tmp/analytics-release-public-seo-2026-10-14.json`.

Live browser checks passed: no Google tag before consent or after initial rejection; the mobile consent controls fit a 390-pixel test viewport; acceptance loads exactly one tag for `G-PEWJZ44H9Q`; internal public-guide navigation preserves the single tag; the authenticated Explore workspace renders with no consent overlay; withdrawal persists after reload and the Google tag is absent. Evidence: `.tmp/ga-production-browser-checks-2026-10-14.json` and `.tmp/ga-mobile-consent-2026-10-14.png`.

Google Analytics Realtime received the two distinct tutorial paths. After an explicit return navigation it showed one test visitor and three page views (two demo-guide views and one readability-guide view). Its received `page_location` parameter values were inspected: both were clean canonical public URLs, excluding the synthetic test email, token and hash originally placed in the readability URL. No private workspace page view or signup conversion appeared during this existing-account test. Evidence: `.tmp/ga-received-safe-urls-2026-10-14.png` and `.tmp/ga-realtime-production-2026-10-14.png`. These are agent-generated test visits, not evidence of organic acquisition or SEO growth.

The browser tool does not expose `document.cookie`; targeted cookie deletion is covered by automated tests, while the live check verifies persisted withdrawal and tag absence. A genuine production new-account conversion has not been created; its Google popup/redirect and email wiring is covered by the automated suite. Test-browser consent was left rejected after verification. The user's UGC Pilot login and Instagram name were not changed.

These post-deployment receipts are appended locally; the merged application source and the committed release-preparation report remain unchanged. TikTok guide assets are prepared separately under `outputs/seo-tiktok-20261014`; they are not part of the application deployment and have not yet been published.
