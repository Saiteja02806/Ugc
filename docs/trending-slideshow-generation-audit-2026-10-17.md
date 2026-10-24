# Trending slideshow production audit — 17 October 2026

Trending automatically prepares Carousel slideshows, separate from Explore's
manual image-generation/composer workflow. The current runtime format policy
enables slideshows only, with separate Helpful Tips and Product Stories styles.
This was a read-only investigation: no new paid generation, retries, configuration
changes or deployment were performed.

## Production outcome

For the previously investigated account, `vtu19403@veltech.edu.in`, the 17 October
Trending pack has 50 reserved positions: 42 ready, 6 already decided and 2 failed.
The 48 delivered slideshows comprise 25 Helpful Tips and 23 Product Stories.
Positions 49 and 50 are failed without assignments. Automatic replacement has
stopped; the durable recovery message says to restart the missing pieces.

All 48 assigned generations are completed and have all six ready slide records.
All 288 rendered URLs returned successful image responses. Two selected completed
decks were decoded: all 12 sample images are 1080 × 1350. Their contact sheets are
in `.tmp/trending-slideshow-audit-20261017/` as `helpful-tips-sample.png` and
`product-story-sample.png`.

Six other current-day packs each have 20 ready slots out of 20. Across the rolling
24-hour generation window, 212 generation rows completed (114 Helpful Tips and
98 Product Stories), 103 failed and 2 older rows remain processing. These are
candidate attempts, including replacements, not independent user pack outcomes.
A failed five-candidate background job can still retain completed siblings.

The Cloud Run Carousel worker is ready and serves 100% traffic from revision
`ugc-carousel-worker-complete-24a6faa4`, with configured source commit
`6ecae38d1d47e05da9ac4f68f64577b760da36da`. The `ugc-carousel` queue is running
with maximum concurrency 2. Database health advisories returned no findings.

## Confirmed issues

1. **Product Story planning can exhaust repair and leave missing cards.**
   Stored validation diagnostics and live worker logs show heading fit, 14–30
   body-word count and first-person perspective failures. In the last replacement
   batch, two candidates failed the perspective rule on slide 4 and another
   failed the heading rule on slide 2. Successful siblings were preserved.
   Example job: `dff458b3-912a-482f-bf53-1db9f35556e4`. This is a content-plan
   admission failure, not evidence of a storage/rendering outage.

2. **Helpful Tips batch responses sometimes have duplicate/invalid slot indexes.**
   Cloud logs and persisted failures show the parser rejecting them before it
   can map five candidates safely. The worker allows bounded planning attempts;
   it does not guarantee that every generated batch is valid. Many other Helpful
   Tips failures are persisted only as the aggregate message “One or more
   Carousels failed in the batch,” so their exact individual cause cannot be
   recovered from those generation rows alone.

3. **The daily recovery budget can end before the full pack is available.**
   Bounded replacements prevent endless generation. They have successfully
   retained/delivered 48 of this account's 50 cards but have stopped on the final
   two Product Story slots. A top-level database feed status of `ready` alone
   does not prove complete delivery: inspect individual slots. The public feed
   readiness code does account for failed slots while exposing valid items.

4. **Rendered text contrast needs improvement on some background images.**
   The two sampled decks have no obvious clipping, missing slides or stretched
   output. Some white body text lies on bright/busy photography, making it
   harder to read. This is a visual quality observation from two examples, not
   an assertion that all 48 decks have been visually reviewed.

## Verification limits and next work

56 focused current feed/allocation/readiness/replacement/partial-settlement tests
passed. Another 34 existing compiled worker planner/render-spec tests passed;
synthetic tests do not establish future model-output reliability. A broader
format-policy test failed because its old source assertion expects the Adjust
dialog to disable editing in slideshow-only mode, while the current product
allows changing the slideshow-style mix. That assertion failure is separate
from the observed production planning failures.

Prioritize repairing the observed Product Story output fields without changing
valid siblings, making five-item writer output map deterministically to owned
positions, and retaining individual failure diagnostics for Helpful Tips. Then
recover only missing slots under the existing explicit retry/credit rules.
Review contrast against actual backgrounds without silently changing the
established native slideshow visual policy. Confirm final acceptance in the
authenticated production Trending UI; this audit inspected production database,
Cloud Run/queue/log state, hosted images and local tests, and did not run a fresh
paid pack or an authenticated browser session.
