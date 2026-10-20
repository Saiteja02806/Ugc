# Next SEO implementation plan — 14 October 2026

One manual page request was only the first step. The submitted sitemap already lists 13 public URLs, so there is no need to submit a separate sitemap for each page. The site needs multiple useful pages answering different tasks, with clear links between them; there is no required page count that guarantees visibility.

## Current evidence

- Inspected all 13 sitemap URLs through Google Search Console. The homepage is submitted/indexed; the other 12 are reported as URL unknown to Google. This is a point-in-time Google record, not proof of a permanent block.
- The sitemap submission is recorded and still pending processing. No warning/error has been reported yet; a pending record is not successful processing.
- Live audits of the homepage, guides hub and three priority product pages returned HTTP 200, indexable content, a self-canonical and one H1. The preceding live check confirms the revised weekly SaaS-content guide is published and indexable too. These findings do not guarantee Google will index the content.
- The 13 September–10 October page-level search report contains the homepage, sign-in and policy pages; no guides or product landing pages appear. Page-level and property-level impression totals have different aggregation, so they must not be added to or substituted for one another.
- Source review confirms homepage links to the guides and priority product pages. The current header has only Pricing in its public nav list. The new Guides navigation link would improve discovery and usability; the absence of that header link is not an established cause of non-indexing.

Evidence: `seo-public-pages-indexing-2026-10-14.json` and `seo-search-console-baseline-2026-10-14.json`.

## Implementation sequence

| Order | Work | Acceptance |
| --- | --- | --- |
| 1. Existing-page discovery | Wait for the submitted sitemap to be fetched; inspect any fetch/parse errors. In Search Console, run a live test and request indexing once for the guides hub, AI UGC video page and Instagram carousel page. Do not repeatedly request the weekly guide already submitted. | Recorded sitemap status and the actual request receipts; later indexing verified through URL Inspection. |
| 2. Site navigation | Add Guides to shared desktop/mobile public navigation. Preserve existing homepage/footer links and add relevant guide-to-product and product-to-guide links where they help a reader. | Real links resolve on production, clear mobile navigation, no overflow or unrelated product changes. |
| 3. Improve three product pages | Prioritize AI UGC video generation, Instagram carousel creation and social-media content planning. Review search intent; explain the actual workflow with real examples, inputs, outputs and limitations. Match titles/descriptions to the page. Reuse existing URLs. | Useful, distinct content and verified product claims; accurate metadata/canonicals, mobile preview and deployed checks pass. |
| 4. Improve two supporting guides | Build a product-demo-to-short-video example and an on-screen-text readability example. First check overlap with current guides and actual search/customer demand. Expand an existing guide if it already addresses the task; create a new URL only for a distinct task. | Owned screenshots/clips or clearly labeled examples, reproducible steps, contextual internal links, new canonical URL added to sitemap only when a new page is justified. |
| 5. Technical refinements | Investigate mobile loading and font preloads from measured production evidence. Validate automated Article/date/image and image-alt findings before changing code; use truthful dates and real assets, and preserve decorative alt treatment where appropriate. | Measured improvement, production crawl checks pass, editor typography/rendering stays correct. Read CAROUSEL_CONTEXT before any font change affecting creative rendering and Next's local docs before code changes. |
| 6. Distribution and measurement | Prepare one useful owned-channel summary per substantial example; publish only when authorized and the destination is live. Obtain the intended GA4 property and verify completed signup measurement separately. | Real published URLs and first-party search/acquisition baseline; Organic Social remains distinct from Organic Search. |

Suggested pace: finish discovery and navigation first; work through the three product pages during the first week; add the two example guides during the second week if the examples and search intent justify them. This is an execution proposal, not a promise of indexing or ranking within that time.

Recheck sitemap/index state around a week after submission, and assess relevant impressions/clicks across a longer comparison window as data develops. Today’s tiny search sample cannot establish a growth trend. No monitoring automation has been created.

The user's immediate manual step is the three priority indexing requests, because the connected Google consent is read-only. Code/content implementation can proceed independently; this planning turn did not deploy changes or mutate Google settings. Publication must validate the intended release and preserve unrelated worktree changes under the repository's release instructions.

Primary guidance: [Google sitemap documentation](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [Google recrawl requests](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl), and [crawlable internal links](https://developers.google.com/search/docs/crawling-indexing/links-crawlable).
