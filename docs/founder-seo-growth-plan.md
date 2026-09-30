# Founder SEO growth plan

## Objective

Grow qualified organic discovery for founders who have built a SaaS product,
website, or mobile app and need help marketing it. The site should help them
clarify the product message, create useful content, and turn that work into a
repeatable publishing workflow in UGCPilot.

The intended journey is:

```text
Founder searches for a marketing problem
  -> founder guide solves the immediate problem
  -> related product workflow shows how to apply the method
  -> trial or sign-in CTA begins product evaluation
```

## Research source and demand signals

Keyword demand was sampled on 29 September 2026 using Serpstat's regional
Google keyword database. The rows below are monthly regional searches, not a
traffic forecast or ranking guarantee.

| Keyword | United States | India | United Kingdom | Intent | Decision |
| --- | ---: | ---: | ---: | --- | --- |
| SaaS marketing | 880 | 480 | 260 | Informational | Pillar guide |
| SaaS content marketing | 720 | 110 | 50 | Informational | Pillar guide |
| Website marketing | 1,300 | 880 | 320 | Commercial / navigational | Address through a focused how-to guide |
| App marketing | 390 | 390 | 110 | Informational | Covered by the mobile-app guide |
| Mobile app marketing | 320 | 210 | 50 | Informational | Pillar guide |
| Marketing for startups | 390 | 170 | 210 | Informational | Pillar guide |
| Social media marketing for startups | 210 | 90 | 40 | Informational | Existing product-led page |
| Social media marketing for SaaS | 70 | 30 | 10 | Informational | Focused guide |
| How to market a website | 210 | 20 | 20 | Informational | Focused guide |
| App launch marketing | 10 | 10 | 10 | Informational | Covered within the mobile-app guide to avoid overlap |

Regional data for continental Europe should be researched per country and
language before local pages are published. The United Kingdom is an English
European market signal; it is not evidence for a single Europe-wide page.

## Published content architecture

| URL | Primary query | Founder need | Product connection |
| --- | --- | --- | --- |
| `/guides` | Founder marketing guides | Choose the relevant problem | All workflows |
| `/guides/saas-marketing` | SaaS marketing | Build a repeatable growth system | AI social media manager |
| `/guides/saas-content-marketing` | SaaS content marketing | Turn product knowledge into a content pipeline | Instagram carousel maker |
| `/guides/mobile-app-marketing` | Mobile app marketing | Build launch and post-launch attention | AI UGC video generator |
| `/guides/marketing-for-startups` | Marketing for startups | Focus a lean team around one message | Founder social workflow |
| `/guides/how-to-market-a-website` | How to market a website | Convert product value into qualified attention | Instagram carousel maker |
| `/guides/social-media-marketing-for-saas` | Social media marketing for SaaS | Educate buyers and create demand consistently | AI social media manager |
| `/instagram-carousel-maker` | Instagram carousel maker | Create a product explainer | Carousel workflow |
| `/ai-ugc-video-generator` | AI UGC video generator | Create an app or product launch video | AI Studio |
| `/ai-social-media-manager` | AI social media manager | Manage the creation and review workflow | Core product |

Each guide links to a related product workflow, three related guides, the
guides hub, and the trial path. The guides hub is linked from the primary
navigation, homepage, and footer. Every guide is included in the sitemap.

## Publishing rules

- Publish one page only when it answers a distinct founder question.
- Use product screenshots, real founder examples, or original templates before
  expanding a topic. Do not create country, platform, or keyword-variation
  pages that repeat the same article.
- Keep claims grounded in what UGCPilot currently supports.
- Update an existing guide when the product or customer language changes.
- Add a contextual link to the relevant product workflow only when it helps the
  reader apply the guide.

## Next content releases

Prioritize evidence-rich additions rather than more generic keyword pages:

1. A launch-content template for mobile-app founders, linked from the mobile
   app marketing guide.
2. A SaaS product-explainer carousel example, linked from the SaaS content
   marketing guide.
3. A website-founder content brief template, linked from the website marketing
   guide.
4. Founder case studies once customer permission and outcomes are available.
5. Country-and-language research for Germany, France, and other target markets
   before publishing localized content.

## Measurement plan

Connect Google Search Console before judging performance. Track each guide as
a landing-page cohort and separate branded from non-branded queries where the
data permits.

| Funnel layer | Primary signal | Review cadence | Decision |
| --- | --- | --- | --- |
| Crawl / indexability | Sitemap fetch, indexability reports, canonical status | After deployment and monthly | Fix technical blockers first |
| Search visibility | Non-branded impressions by guide and query | Monthly | Expand topics earning relevant impressions |
| Search appeal | CTR by query and landing page | Monthly | Test title and description when impressions exist but CTR is weak |
| Engagement | Engaged organic sessions and guide-to-product clicks | Monthly | Improve article usefulness and internal calls to action |
| Product evaluation | Organic sign-ups or trial starts by landing page | Monthly | Prioritize the guides that bring qualified founders |

Define a new content experiment with its hypothesis, pages, primary metric,
guardrail metric, and observation window. Do not attribute growth to a single
change without a comparison period and enough search data.

## Deployment and verification checklist

1. Run lint and a production build.
2. Confirm each guide returns `200`, renders a single H1, uses a self-canonical
   URL, and exposes its Article, BreadcrumbList, and FAQ structured data.
3. Confirm `robots.txt`, sitemap, and internal links list the same canonical
   public URLs.
4. Deploy only after the complete worktree has been reviewed for unrelated
   changes.
5. Verify the deployed URLs on `https://www.getugcpilot.com`.
6. Submit the sitemap in Search Console and begin the monthly measurement loop.
