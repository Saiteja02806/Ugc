# Visibility plan beyond articles — 15 October 2026

## What the current data says

The limiting factor is not a crawl or indexing failure. It is that UGC Pilot is
still at the beginning of earning discovery.

- Search Console's last complete 28-day period (15 September–12 October) shows
  12 impressions, 0 clicks, and an average position of 9.8. The prior period
  had 19 impressions and 1 click. This is too little data to interpret position
  as a ranking trend, but it does show that the site is rarely being shown.
- A live audit of the home page, pricing, guides, AI UGC video generator, and
  Instagram carousel maker found all five return HTTP 200, are indexable, have
  self-canonicals, and have no critical or high-severity issues.
- The live sitemap and robots file are in place. The latest public SEO
  regression check also passed all 22 checks across 15 public pages.
- The current public presence is mainly branded: the only query with enough
  data in the latest report is `ugc pilot`.

This means the priority is to make UGC Pilot discoverable in more places,
earn evidence that it is a real and useful product, and measure which sources
turn into signups.

## The highest-value work beyond writing articles

### 1. Make the product easy to discover in product directories

Submit the finished UGC Pilot AI-client package through the ChatGPT plugin
submission portal. An approved submission can appear in the public directory
shared by ChatGPT and Codex. The package needs a professional icon, accurate
privacy/support links, useful triggers, and a tested ZIP; this is a direct
acquisition channel rather than a Google-ranking tactic.

For Claude, publish a public GitHub-backed marketplace with an accurate
`marketplace.json`, installation instructions, screenshots, and a release
process. Claude users can then install it from the marketplace. A Claude
marketplace should describe the actual skills and avoid claiming that it
generates or publishes content without the required user review.

Before public submission, run the existing package validation and complete
real installation tests in authenticated ChatGPT and Claude sessions. Do not
use a directory listing as a substitute for product testing.

### 2. Build trustworthy mentions and backlinks

The earlier domain analysis found an authority score of 10, 60 referring
domains, and 123 backlinks. The goal is not to buy bulk links. Earn a small
number of relevant links and mentions from places a prospective customer would
actually trust:

- creator-marketing and SaaS tool directories with an editorial review process;
- genuine integration or partner pages for supported social platforms;
- founder communities where a useful workflow or demo is being shared;
- real customer or beta-user stories, with their permission.

Each mention should link to the one relevant product or guide page. Avoid paid
link schemes, mass directory submissions, or copied testimonials; those can
harm trust and do not produce sustainable visibility.

### 3. Use product demonstrations as distribution assets

Show the actual workflow in short demonstrations: add business context, create
the creative, review it, and approve a schedule. A public demo gives someone a
reason to try the product and can be reused on the website, YouTube, TikTok,
Instagram, partner pages, and directory listings.

If UGC Pilot hosts a public watch page for a real video, add a stable thumbnail
and truthful `VideoObject` structured data on that page. Google requires a
public, indexable watch page and a crawlable thumbnail for video-search
eligibility. Do not add video schema to a page that only describes the video
generator; it must match an actual video available on the page.

### 4. Improve the search-result presentation of key commercial pages

The live audit found the home page and pricing page have no structured data.
The home page can truthfully describe the company and web application using
Organization and WebApplication/SoftwareApplication markup. The pricing page
should be considered for structured data only after the visible price, trial,
currency, and availability are confirmed as accurate.

Google's SoftwareApplication documentation requires a real offer price for
eligible app rich results. The existing generator landing-page schema contains
SoftwareApplication data but no offer. We should not invent an offer just to
add markup. First choose the correct visible plan and price, then validate it
in Google's Rich Results Test.

The audit also classified 3 of 15 home-page images and 8 of 8 pricing-page
images as missing alternative text. We need to inspect those assets before
changing anything: decorative images should retain empty alt text; meaningful
images need concise descriptions.

Structured data does not guarantee a rich result or a ranking increase. It
helps search engines understand the product and makes eligible pages clearer
to display.

### 5. Expand beyond Google without duplicating work

Bing Webmaster Tools is not configured for UGC Pilot, and no IndexNow key is
set. Verify the domain in Bing Webmaster Tools, then add IndexNow for new or
materially changed public URLs. IndexNow helps participating search engines
discover updates; it does not submit pages to Google, so it should not replace
the existing Google sitemap and Search Console workflow.

### 6. Measure visits, signups, and the sources that create them

The site contains a consent-aware Google Analytics implementation, but the
connected reporting property currently has no GA4 property associated with
UGC Pilot. This means the workflow exists in code, but we cannot yet use the
connected report to compare organic, directory, social, and plugin traffic or
to confirm completed signups.

Complete the GA4 property setup, set its public measurement ID in the deployed
environment, and verify three events in the real production site: public page
view after consent, sign-in start, and successful account creation. Then use
one simple scorecard:

| Metric | What it answers |
| --- | --- |
| Search Console impressions and queries | Are more people seeing UGC Pilot in search? |
| Referral visits | Which directory, partner, or community sends visitors? |
| Signup completion rate | Which source brings likely customers rather than empty traffic? |
| Plugin installs and active use | Are ChatGPT and Claude distribution efforts useful? |

### 7. Measure real mobile speed before optimising it

No Chrome UX Report key is configured, so there is no field Core Web Vitals
history available yet. The tested pages responded in roughly 0.48–0.59 seconds
to the audit fetcher, but that is not a mobile user-experience score. Add
Chrome UX Report access or use PageSpeed Insights to collect mobile LCP, INP,
and CLS data before making broad performance changes. Optimise only the
measured bottleneck.

## Recommended sequence

1. **Measure first:** finish GA4 and validate the three production events.
2. **Make the core product pages clearer:** inspect meaningful image alt text,
   add accurate home/pricing schema, and validate it.
3. **Open additional search coverage:** verify Bing and add IndexNow.
4. **Publish the product where users already look:** complete ChatGPT and
   Claude package submission and installation testing.
5. **Earn proof:** create one real product demo and seek a few relevant,
   editorial mentions or partner listings.
6. **Review after two weeks:** use Search Console and GA4 data to keep the
   sources that produce signups and stop the work that only produces views.

## Sources consulted

- Google Search Essentials: crawlable links, people-first content, and
  structured-data guidance.
- Google SoftwareApplication and Video SEO documentation.
- UGC Pilot live Search Console and on-page audit data, complete through
  12 October 2026.
- Current OpenAI plugin-directory documentation and current Claude marketplace
  documentation, checked on 15 October 2026.
