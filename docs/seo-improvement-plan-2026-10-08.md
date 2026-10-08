# UGC Pilot SEO improvement plan — 8 October 2026

The independent SEO agent found that the deployed public pages pass crawl-readiness checks. Actual Google indexing, search traffic, rankings, and organic signup performance remain unverified. This plan prioritizes measurement, public-page performance, and useful product examples over adding more generic pages.

Post-release verification on 8 October also passed: 20 production crawl checks, including all 13 sitemap pages, canonical redirects, unique metadata, one H1, parseable guide structured data, private-beta noindex, and the actual missing-page 404. See [saved regression evidence](seo-release-regression-2026-10-08.json). Run `node scripts/check-public-seo.mjs --output .tmp/seo-production-check.json` to repeat these bounded checks. This release did not implement the acquisition or content improvements below.

**Production evidence**

Checks used the real website, beginning at `https://www.getugcpilot.com`. Its 308 redirect to `https://getugcpilot.com` agrees with the canonical URLs in metadata and the sitemap. HTTP also redirects to HTTPS.

| Check | Result |
| --- | --- |
| robots.txt and sitemap.xml | HTTP 200, consistent canonical domain |
| All 13 sitemap URLs | HTTP 200, one H1, unique descriptive title and description, self-canonical, no noindex |
| Googlebot user-agent assertions | Passed for all 13 URLs; this simulates requests and does not prove Google indexed them |
| Six guides | Parseable Article, BreadcrumbList, and FAQ JSON-LD |
| Distinct internal anchor destinations | 23 checked, all HTTP 200 |
| Guide sharing image | HTTP 200, image/png |
| Sample private routes | X-Robots-Tag: noindex |
| Unknown URL | Actual HTTP 404 with noindex |

The sitemap contains the homepage, `/pricing`, `/instagram-carousel-maker`, `/ai-ugc-video-generator`, `/social-media-marketing-for-startups`, `/ai-social-media-manager`, `/guides`, and six guides: `saas-marketing`, `saas-content-marketing`, `mobile-app-marketing`, `marketing-for-startups`, `how-to-market-a-website`, and `social-media-marketing-for-saas`.

The independent agent ran the crawl and font probes as inline commands. Its tool outputs retain the evidence; it did not save separate crawl files or modify the repository. No paid SEO report or keyword credit was consumed.

**Priority 1: establish the baseline**

Verify ownership of the canonical domain in Search Console, submit the existing sitemap, and inspect the homepage, four product pages, and six guides. Record index status and Google-selected canonicals. A successful HTTP response and a sitemap entry alone do not establish index inclusion.

Measure organic landing-page visits, guide-to-product clicks, signup starts, completed signups, and activated accounts. No Google Analytics/GTM acquisition tags were visible in inspected public HTML or the source search. This does not exclude an external analytics system; confirm the intended system before adding instrumentation.

Ubersuggest authentication succeeds, but its tracked-project list is empty. The accessible Treg account-tool inventory is also empty. Search Console and Google Analytics data were therefore unavailable for this audit. Keyword demand, search difficulty, competitor traffic, and rankings were not estimated. Earlier figures in `docs/founder-seo-growth-plan.md` are historical evidence, not fresh results.

Capture a reproducible mobile performance baseline on production. Use field Core Web Vitals when available and separate them from lab measurements. No Core Web Vitals pass/fail verdict was established in this audit.

**Priority 2: reduce unnecessary public-page font loading**

The live SaaS marketing guide preloads eight fonts totaling **2,583,724 decoded asset bytes**. This is asset payload evidence, not measured browser transfer size or proof of a Core Web Vitals failure.

| Font | Decoded bytes |
| --- | ---: |
| Geist Mono variable | 71,004 |
| Geist italic | 73,028 |
| Geist semibold | 46,620 |
| Geist variable | 69,436 |
| Arial bold | 989,780 |
| Arial regular | 1,045,720 |
| Avenir Next demi bold | 264,472 |
| Inter regular | 23,664 |

`app/layout.tsx:44–89` declares editor/overlay fonts in the root layout. Disable preload for noncritical editor faces or scope them to workspace routes. Keep marketing typography stable and verify editor preview/render metrics after the change. Read `CAROUSEL_CONTEXT.md` before implementation because font changes can affect creative presentation.

Acceptance: retain the same public crawl results, reduce unnecessary font preloads, verify workspace text rendering, and compare production mobile measurements with the baseline.

**Priority 3: give readers complete product examples**

The six guides contain roughly 419–508 words in their main article sections, four broad instructional sections each, and no article images. Their main opportunity is a worked example someone can follow.

Start with one real SaaS explainer carousel, one mobile-app launch sequence, and one website-to-content brief. Include actual screenshots, inputs, editable templates, finished outputs, and truthful limitations. Connect each example to the relevant product page and a tracked signup path. Avoid invented outcomes or artificial word-count targets. This follows [Google's guidance on useful, original content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).

**Priority 4: finish discovery and search presentation**

- Add a Guides link to appropriate public navigation. `components/marketing/landing-header.tsx:16` currently exposes Pricing; the older growth plan's claim that Guides is already in primary navigation should be corrected.
- Add relevant sharing images to the four product pages.
- Add truthful author URLs, publication/update dates, and relevant images to guide Article markup, reflecting them visibly in the articles. These are enhancements, not current crawl blockers. [Google Article guidance](https://developers.google.com/search/docs/appearance/structured-data/article)
- The SoftwareApplication markup in `components/marketing/seo-landing-page.tsx:407` lacks the price and authentic rating/review information needed for Google's software rich-result eligibility. Use accurate supported information; never manufacture ratings. Generic schema validity is a separate question. [Google software markup requirements](https://developers.google.com/search/docs/appearance/structured-data/software-app)
- Keep useful FAQ content, but do not claim its markup earns Google FAQ rich results: Google stopped displaying those results on May 7, 2026. [Google search updates](https://developers.google.com/search/updates)

**30-day execution plan**

| Window | Work | Acceptance evidence |
| --- | --- | --- |
| Days 1–7 | Search Console ownership/index inspection, sitemap submission, acquisition events, mobile baseline | Recorded indexing/canonical status, working events, reproducible performance results |
| Days 8–14 | Font preload scoping, sharing images, guide navigation, truthful article details, documentation correction | Production crawl regression still passes; reduced preloads; image URLs return 200 |
| Days 15–21 | Upgrade the SaaS guide and carousel page with a complete product walkthrough and usable templates | A reader can reproduce an output; relevant product/signup links are measured |
| Days 22–30 | Review queries, impressions, clicks, and signups; improve pages attracting relevant demand; share original examples through existing founder channels | A recorded baseline and next experiment selected from actual observations |

Do not add more broad landing pages until the baseline shows where relevant visitors arrive and which pages convert. The current public SEO foundation is working; the next objective is measurable acquisition.
