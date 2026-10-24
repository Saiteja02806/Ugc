# Search Console actions — 22 October 2026

Property: `https://getugcpilot.com/`. Inspected the owner's existing signed-in browser session. No Google account permissions or settings changed.

## Completed

- Inspected `/guides/product-demo-to-short-video`: index report initially said URL unknown to Google, not indexed.
- Ran a fresh live test: URL available to Google; page can be indexed; video detected; one valid Breadcrumbs item.
- Clicked Request indexing once. Verified the **Indexing requested** dialog: accepted into Google's priority crawl queue. This does not establish indexing or ranking.
- Confirmed existing `/sitemap.xml` submission: **Success**, 15 discovered pages, zero discovered videos; submitted 14 October, last read 20 October. Did not resubmit a successful sitemap. Sitemap video count and live page video detection measure different things.

Proof screenshots: `.tmp/seo-guide-indexing-requested-2026-10-22.png`, `.tmp/seo-sitemap-success-2026-10-22.png`.

## Baseline read from Performance

Web search, 28-day selector: 23 September–20 October 2026. Last update shown as four hours ago.

| Metric | Value |
| --- | --- |
| Clicks | 1 |
| Impressions | 88 |
| CTR | 1.1% |
| Average position | 65.6 |

Visible query rows included `ai ugc video generator` (17 impressions), `ugc video generator` (10), `ugc video ai generator` (7) and `ugc pilot` (2), each with zero clicks in those reported rows. Query rows may omit anonymized data and do not sum to totals.

Visible page rows: homepage 1 click/12 impressions; AI UGC video generator 0/65; guide hub 0/6; mobile-app guide 0/5; pricing 0/4; carousel maker 0/4. Page impressions can overlap, so do not sum them as unique searches. This is a small baseline, not evidence of a trend or campaign uplift. No country targeting, search-volume estimate or organic signup attribution was established.

## Next evaluation

Review the guide's indexed status and discovery after Google processes the request; do not repeatedly submit it. Compare the same reporting period and search type in the next manual review. Prioritize a useful example on the AI UGC generator page, which currently receives most visible commercial-page impressions, and develop distinct, sourced competitor comparisons. No automated reminder was created.

Related work: `seo-competitor-priorities-2026-10-22.md` and `seo-manual-distribution-pack-2026-10-22.md`.
