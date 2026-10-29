# Analytics account audit — 2026-10-29

Scope: read-only investigation for the user-specified account vtu19403@veltech.edu.in before continuing the main UGC deployment. No analytics refresh, provider publication, generation, production mutation or deployment was submitted.

## Confirmed production database evidence

Checked at 2026-10-29 16:32 UTC (22:02 IST). Firebase owner lookup succeeded using the signed-in cloud account and the required quota header; no credentials were printed.

- Latest Instagram content sync began at 16:22:33 UTC and completed at 16:22:44 UTC. The 30-day snapshots contain 35 posts across four usable accounts (2 iamsolen_, 2 kaia_0209, 23 mira_handles, 8 juliarose.daily).
- Posts 18117089639043231 (kaia_0209, Oct 28) and 18131627938827042 (iamsolen_, Oct 28) have real numeric zero views in those snapshots. Zero views did not prevent importing them.
- Today’s posts 18221594635349301 and 18340343410278791 are present with 24 and 1 views respectively at this audit. These are saved observations, not immutable current provider counts.
- With all accounts selected, the production snapshot ordered by the application's default view-count sort puts those newer posts at positions 25 and 30 (page 3), and the two zero-view posts at positions 31 and 32 (page 4). Different account/range/filter choices change these positions.
- teja_chundu's latest Instagram refresh reports that reconnection is required. Its last successful content snapshot is Oct 14. A stored connection status of connected does not establish that credentials still allow a successful analytics fetch.
- Three older posts on mira_handles and juliarose.daily retain per-post refresh errors asking for content-performance access. These do not remove successfully imported posts from other accounts. Saved user-facing errors do not establish the precise underlying provider rejection; fresh raw provider diagnostics were not requested.
- Latest TikTok analytics sync began at 03:23:51 UTC (08:53 IST), over 13 hours before this inspection. All four snapshots were ready then. They include zero-view public videos. Multiple publishing records from 13:11–14:06 UTC are newer than that snapshot.
- Recent TikTok target records are marked published and public, but several contain provider publishing-operation identifiers and no final post URL. Those identifiers cannot be directly compared to public video IDs as proof that TikTok lost a post. A fresh public-feed read and publication-status reconciliation are still needed.

## Code findings

- Actual `/analytics` route renders `InstagramAnalyticsWorkspace`, with TikTok in its beta panel; the old analytics dashboard is not the route's principal implementation.
- `filterAndSortInstagramContent` retains numeric zero and null metrics, filters only by content type, and sorts descending by selected metric. `ContentPerformanceSection` defaults to views and paginates ten rows. It does not offer a newest-first sort.
- Instagram and TikTok saved-data queries are selected-platform resources. Opening Instagram does not establish that TikTok refreshed. No analytics-sync dispatch was found in the inspected publishing paths; analytics admission runs through the analytics request path.
- Selected-platform saved reads have a one-minute stale check; provider admission uses 15-minute Instagram and 5-minute TikTok windows. These are admission intervals, not a guarantee of continuous server-side synchronization when nobody opens the selected platform.
- Existing freshness fixes are already ancestors of the currently inspected deployed baseline commit ecba34d05f34d27389475ad0738724870f893880. Do not explain this incident by claiming those fixes are merely unpublished drafts.
- TikTok currently requests one public-video page (`max_count: 20`) without pagination. Two account snapshots have exactly 20 videos; this confirms a completeness limitation, but not that it caused these particular newest posts to be missing.
- Missing/unavailable metrics must remain unknown, not be invented as zero. A post's presence and its metrics are separate acceptance checks.

## Recommended follow-up

1. Add Published/newest sorting to Instagram and use it as the initial content order, retaining performance sorts. Reset pagination when sorting/filtering changes. This addresses the confirmed visibility problem without changing metrics.
2. Show last successful sync and stale/reconnect state clearly for the selected account/platform.
3. Trace one authenticated TikTok Refresh from browser request through job completion to authoritative snapshot GET. Reconcile recent known publishing records with public-feed IDs before claiming provider delay or success.
4. Keep known published content visible separately when metrics are pending, with an honest pending/unavailable label. This is a product change to existing provider-only performance rows and should preserve that distinction.
5. Add bounded TikTok pagination if complete history is required. Preserve provider limits and owner isolation.

No application fix was made in this audit. Deployment remains paused for the investigation requested by the user.

## Verification and limits

- Read-only Firebase owner lookup and account-scoped production SQL: VERIFIED.
- Zero-view retention, ranking/pagination behavior and stale TikTok snapshots: VERIFIED by code and stored production data.
- Local checks: 26/26 PASS in instagram-content-insights, instagram-freshness, tiktok-private-publishing and use-analytics-wake. Initial command omitted the module-mocking flag; rerun with the required flag passed.
- Main UGC webpack production build including postbuild native route checks: PASS. This is not authenticated UI acceptance.
- Authenticated production screen/filter selection, a fresh provider sync, and exact reason no later TikTok request occurred: NOT VERIFIED.
- Saved edits, video duration, scheduling records and deployment settings: untouched by this audit.
- Context used: relevant analytics entries of EXPLORE_CONTEXT.md and docs/ai-context/clear.md; existing analytics freshness receipts; context-memory procedure; Supabase skill; source and tests named above. Earlier release preflight remains separate from this read-only investigation.
