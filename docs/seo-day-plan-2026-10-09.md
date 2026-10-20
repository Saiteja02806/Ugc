# SEO work plan for 9 October 2026

Working budget: about six focused hours. Execution status is recorded in
[the delivery record](seo-day-delivery-2026-10-09.md). The priority is
one useful educational guide, a measurable starting point, and reliable public
access. Search visibility develops over time; today's deliverables are the
work we can complete and verify.

## Today's outcome

- Improve the existing `/guides/saas-content-marketing` guide around one problem:
  "How do I turn customer questions into useful organic content for the week?"
- Establish a Search Console baseline where access exists, and verify what
  analytics actually measures. Record unavailable data explicitly.
- Check the deployed guide's technical readiness and mobile reading experience.
- Publish the guide when the content and deployment checks are complete, or
  keep a fully reviewed draft with the exact remaining dependencies listed.
- Prepare a useful organic distribution post and identify the next two topics.

The article must help a reader act with their existing tools. Hook video,
Wall of text, and Slideshows are optional practical examples where they help
explain the method. Education and workflow examples both belong in the program.

## Follow these work blocks in order

| Block | Budget | Work | Evidence or deliverable |
| --- | --- | --- | --- |
| 1. Measure the starting point | 45 min | Verify Search Console property access, sitemap status, selected guide indexing, and available acquisition analytics | Baseline record or exact access/instrumentation gaps |
| 2. Check technical readiness | 45 min | Run the public SEO check; inspect the guide's mobile experience and a PageSpeed report | Confirmed blockers, available performance evidence, and one prioritized improvement if needed |
| 3. Confirm reader intent | 45 min | Select a target market and inspect about five relevant search-result pages plus available customer questions | A final reader problem, article outline, and useful original example |
| 4. Draft and review one guide | 120 min | Expand the existing guide using the agreed brief; review with the Agentic article workflow when available and verify its findings | A complete educational draft, copyable template, and accurate metadata |
| 5. Add evidence and prepare publication | 45 min | Add real images where useful, verify product claims, review links and authorship, and complete the relevant release checks | A publishable guide, or a reviewed draft with specific remaining dependencies |
| 6. Publish, verify, and distribute | 45 min | Publish the intended change, check the production URL, inspect it in Search Console, and share one helpful organic summary on an owned channel | A verified release and useful distribution asset, or a prepared asset awaiting publication |
| 7. Record the next experiment | 15 min | Record changes, remaining gaps, and the next two education topics | A change log and focused follow-up backlog |

Budgets are timeboxes, not promises that account verification, instrumentation,
or deployment will finish within them. Continue research and drafting while
access or screenshots are pending. Fix a confirmed indexing blocker before
trying to evaluate a content update through search traffic.

## Block 1: establish measurement

You or the account owner supplies access to Search Console and analytics,
and completes domain ownership verification when required. The developer
checks the event implementation; a signup button click is not an account signup.

1. Open the `getugcpilot.com` Search Console property. Verify ownership if needed.
2. Check whether `https://getugcpilot.com/sitemap.xml` is already submitted and
   accepted; submit it if missing or resolve its reported error.
3. Inspect the canonical guide URL and record its index status, Google-selected
   canonical, and available last-crawl information. Public HTTP access alone
   does not establish Google indexing.
4. Export the last 28 completed days of available Performance data, filtered to
   the guide. Record clicks, impressions, CTR, average position, query, device,
   and country. Separate branded/non-branded queries where practical. Preserve
   the filters and dates; missing reports are not zero results.
5. Check whether GA4 or another analytics tool records organic landing visits
   and completed new-user signups. Verify a signup event occurs once for an
   actual new account and remains distinct from returning login. Preserve
   acquisition attribution across redirects and email verification where applicable.
6. If the event is absent, create a clearly scoped instrumentation task and
   estimate implementation separately. A newly created property cannot provide
   a historical baseline that was never collected.

Keep Organic Search acquisition distinct from Organic Social distribution.
Record an article's educational purpose alongside business metrics so that
signup is not its sole definition of value.

References: [Search Console URL Inspection](https://support.google.com/webmasters/answer/9012289?hl=en),
[Search Performance](https://support.google.com/webmasters/answer/7576553?hl=en),
and [GA4 recommended events](https://support.google.com/analytics/answer/9267735?hl=en).

## Block 2: check public access and mobile experience

Run the existing read-only check from the repository:

```powershell
node scripts/check-public-seo.mjs --output <absolute-evidence-path.json>
```

Choose a real writable evidence path when executing the command. The script
checks canonical redirects, sitemap/robots access, public page status,
metadata, canonical tags, H1s, structured data, and selected private/error
pages. Its current public inventory expects 13 URLs; adding an intentional
public page requires reviewing that expectation. A simulated Googlebot header
does not establish real Google indexing or rich-result eligibility.

On the guide, confirm that the important content is publicly readable, that
the title and description describe its actual educational outcome, and that
useful internal links connect it to the guide hub and related explanations.
Keep one clear primary heading and truthful structured data matching the page.

Check the guide and homepage on a phone-sized viewport. Use PageSpeed Insights
to inspect mobile lab results and any available real-user data. Record them
separately: field data reflects a rolling 28-day period and may be unavailable
for a low-traffic URL. Investigate a confirmed problem before selecting a fix.
Do not target a perfect lab score at the expense of readable, useful content.

Verified on 9 October: the production check passed 20 checks across 13 public
pages with no failures after network access was enabled. The earlier sandbox
fetch errors were a runtime access limit, not evidence of a website defect.
Successful evidence is saved at
`C:/Users/chund/.codex/visualizations/2026/10/09/01a11f6d-9044-7da3-a15e-180ef523ef1c/seo-public-check-2026-10-09.json`.
This validates the existing production pages; the new article is still a local draft.

The approved Ubersuggest mobile audit returned an 11.1-second lab LCP and no
field-data report. Investigate the actual LCP element and request timing before
choosing a change. Do not treat this lab result as a real-user measurement.

Reference: [what PageSpeed Insights measures](https://developers.google.com/speed/docs/insights/v5/about).

## Blocks 3 and 4: research and write the first guide

Use [the existing brief](seo-article-brief-saas-weekly-content.md). Working title:
**SaaS Content Marketing: Turn Customer Questions into a Week of Useful Posts**.
Preserve the existing URL and useful coverage of the broader topic.

Research the target market's results for the broad topic and specific content
planning questions. Select one primary market for this experiment; the prior
US keyword sample does not validate every country or this exact title. Record
common questions, format expectations, missing explanations, and what our
first-hand example can add. Combine this with actual customer questions when
available; clearly label an illustrative question if it is not a real one.

The draft should answer:

1. Where do useful customer questions come from?
2. How do we choose one that helps the intended audience?
3. What should the reader understand or be able to do after each post?
4. How can one answer become a demonstration, a text-led explanation, and a
   step-by-step slide story without repeating the same message?
5. How do we review accuracy, mobile readability, and pacing?
6. How do responses and follow-up questions inform the next week's content?

Include a filled planning example, a copyable blank template, common mistakes,
and a realistic cadence. Teach the method before showing editor steps.
Product links should help the task. There is no fixed word count, keyword
density target, or requirement to mention the product in every section.

Use Agentic SEO Skill for editorial structure and review when available;
independently verify extraction findings and product claims. Codex SEO can
inform technical audits, but its installed runtime license remains unresolved.
The existing public checks and a manual review allow today's work to proceed.

Reference: [Google's helpful-content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).

## Blocks 5 and 6: evidence, publication, and organic distribution

You provide actual product screenshots or a suitable demonstration recording.
Use them where they explain a decision or prove the worked example. An
editor-independent educational guide can be completed without a product
walkthrough when that walkthrough is not essential to answering the question.

Check the new workflows on the production domain before writing availability
claims. Local source and preview behavior do not establish deployed acceptance.
Use a verified example or omit the unverified walkthrough; do not invent media,
customer outcomes, automatic features, or measured improvements.

Before a code change, read the relevant bundled Next.js guide required by
AGENTS.md. Review the intended release scope and run validation appropriate
to that change. Deploy the reviewed change, then check its real production
response, content, metadata, images, internal links, and mobile readability.

Use Search Console's URL Inspection after publication. Request indexing for
the substantially updated eligible guide if appropriate; the request does
not guarantee indexing or ranking. Keep the sitemap accurate without adding
a duplicate URL for the revised title.

Prepare one organic post that teaches a useful part of the article and links
to the full guide where helpful. A text explanation or slide outline is enough
if media is not ready. Share through an owned channel or an appropriate
community only when authorized and permitted. Record distribution separately
from search acquisition; a social share is not evidence of improved rankings.

## End-of-day record and follow-up

Today is complete when the baseline status and gaps are recorded, the guide is
fully reviewed, and publication readiness is clear. If it is published, record
the production verification and change date. If it is not, list the exact
remaining access, evidence, technical, or deployment dependency.

Record these fields:

| Field | Value to record |
| --- | --- |
| Updated URL and reader outcome | Canonical guide URL and the task it teaches |
| Baseline | Report dates, filters, available metrics, and missing data |
| Content changes | Added explanation, template, example, and evidence |
| Release status | Published and verified, or reviewed draft with dependencies |
| Distribution | Channel, post URL when published, and separate social attribution |
| Next education topics | Two specific reader questions worth researching |

Suggested next topics are **How to Find Organic Content Ideas in Customer
Questions** and **How to Make On-Screen Text Readable on Mobile**. First check
whether they belong as substantial sections of an existing guide. Do not
create thin duplicate pages merely to increase page count.

Check indexing and technical errors after roughly a week, sooner if a known
blocker or release issue exists. Review available search trends after about
four weeks using the same filters and comparable periods, extending the window
when data is sparse. Decide from evidence whether to improve the same guide
or develop the next distinct question. These are proposed review intervals;
no reminder or automation has been created.

Google explains that search changes can take hours to months, and generally
recommends waiting a few weeks to assess effects. Today's success is useful,
verifiable work with a starting point for measurement.
[SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide).
