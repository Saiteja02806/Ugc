# Analytics newest posts and TikTok refresh fix

## Scope and behavior

Instagram and TikTok content lists now initially show newest posts first, including zero-view posts and posts whose metrics are unavailable. Instagram adds Newest first to the existing sort dropdown; all previous performance sorts, type filters and pagination remain. Changing sort/filter resets the page as before. No CSS, layout or stored user edits change.

The Analytics workspace opts its existing account request into `?analytics=1`. For an authenticated owner with connected TikTok accounts, that route uses Next's existing after-response mechanism to check `refreshAnalyticsSnapshot` with `force:false`. This prevents an Instagram-first Analytics visit from leaving TikTok snapshots untouched all day. It preserves five-minute server admission, active-job reuse and authorization revisions. Ordinary account pickers do not opt in. No new polling timer, cron, schema, package, IAM or production-setting change was made. Foreground platform reads retain visibility/offline guards.

This deliberately extends the earlier selected-platform-only synchronization policy for TikTok admission during an Analytics visit. It does not refresh accounts continuously while the application is closed and cannot guarantee immediate provider metric availability. Existing manual Refresh remains.

## Real backend evidence

Account: the owner of the user-specified vtu19403@veltech.edu.in. Initial stored TikTok snapshots dated 03:23Z, whereas a fresh application provider read at16:48Z returned today's posts, including zero-view videos. The provider was therefore able to return newer data.

One analytics-only test job `f2e6d717-6939-4580-8b0d-bcc3acaea734` was created through the existing application refresh service. Initial local attempts failed because the local environment lacked the worker URL and local service credentials lacked Cloud Tasks create permission. Neither is evidence of a production configuration error. The same job was recovered with the existing signed-in cloud account, standard task payload and verified Cloud Run worker address; no production secrets were downloaded and no IAM changed. It completed on the real hosted worker at16:51:35Z, saving ready TikTok snapshots for all four accounts. iamsolen_3 now has two returned public videos instead of one, and both Clara accounts include today's posts. Recorded the exact Cloud Task delivery identifier on that same job. No generation or publication was submitted.

Automatic approval review rejected a full production-environment download as unnecessarily broad secret access. The download did not occur. Existing local credentials and cloud-owner authorization were sufficient for the narrower test.

## Verification

- Analytics suite:109/109 PASS, including real ordering behavior for zero/null views, non-mutating sort, retained performance sorts, authenticated-owner background admission, no admission from ordinary pickers/revoked accounts, and safe background failure.
- Existing actual-workspace browser fixture: PASS. Added12-post Instagram ordering/pagination checks, metric-sort switching and stale TikTok POST/completed-job/GET reconciliation showing a new zero-view post. Existing loading, range/authorization/owner isolation, hidden/offline behavior, failed-read recovery and manual-event tests remain PASS.
- Browser screenshots: `.tmp/analytics-loading-browser/analytics-newest-desktop.png`, `analytics-newest-mobile.png`, `analytics-tiktok-refreshed.png`. Fixture uses minimal styles: behavioral evidence, not production styling acceptance.
- Application TypeScript: PASS. Scoped ESLint: zero errors; one existing no-img-element warning in TikTok thumbnail code.
- Combined release checks from the preceding work remain645application tests and118worker tests PASS; full main-project webpack build is rerun for this final change.
- Production browser still redirects to sign-in. User explicitly chose to continue without signing in. Authenticated live UI and the newly deployed after-response route remain NOT VERIFIED until release and a signed-in visit.
- Known remaining limit: TikTok public-video retrieval is still the existing newest20 per account. This does not prevent the observed newest posts from being returned. Full-history pagination is outside this newest-post fix.

## Files and contracts

Application/test files: `app/api/social/connections/route.ts`, `components/analytics/instagram-analytics-workspace.tsx`, `components/analytics/tiktok-beta-analytics-panel.tsx`, `lib/analytics/instagram-content-insights.ts`, `lib/analytics/instagram-content-insights.test.ts`, `lib/analytics/routes.test.mjs`, `scripts/analytics-loading.browser.cjs`. Documentation: this receipt, EXPLORE_CONTEXT.md and append-only clear.md incident UGC-UI-067-ANALYTICS-ZERO. The earlier read-only audit remains historical evidence.

Preflight: AGENTS.md, full nonnegotiables.md, relevant Explore/history sections under the user's existing scoped-context authorization, four ugc context/contracts/UI/regression skills, Supabase skill from the audit, Vercel deployment/env and cost procedures, installed Next use-client guide. `python tools/preflight.py` PASS. No use of the missing scheduling-contract document was needed: this patch does not change publishing behavior.

Protected: saved edits and full video duration untouched; no scheduled-post/target changes; no media generation/charges; no migrations/dependencies; owner isolation and cooldowns tested. Rollback is the seven application/test files, retaining the incident history. Main UGC release only; no MCP release.
