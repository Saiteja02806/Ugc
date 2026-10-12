# Carousel structures and view-based allocation audit

Audit date: 2026-10-11. Production database observations were read around
05:36–05:41 UTC (11:06–11:11 IST). Counts are a snapshot, not a live dashboard.

## Conclusion

Carousel and slideshow refer to the same output product here. Structure 1 and
Structure 2 are separate content-generation engines within that product. They
share visual conventions, image infrastructure, six-slide outputs, and editor
and publishing infrastructure, so they can look similar.

Production is configured to rotate between the structures, but Structure 1
planning failures frequently transfer its entire batch to Structure 2. This
recovery behavior is a substantial reason that recent output is effectively
Structure 2 only. It is not a decision based on views.

View-based selection exists for formats inside each structure. No business
currently has enough eligible evidence to activate it. It does not adjust the
Structure 1/2 split or the daily allocation between carousel and video formats.

## How the structures differ

| Property | Structure 1 | Structure 2 |
| --- | --- | --- |
| Content purpose | Educational, practical value | First-person narrative and reframing |
| Format library | 15 formats | 8 story formats |
| Slide count | 6 | 6 |
| Slide 1 | Cover hook, selected with a compatible hook family | Recognition hook appropriate to the story format |
| Slides 2–4 | Format-specific value: steps, mistakes, comparisons, list items, etc. | Failure scene, reframe, then product turning point |
| Slide 5 | Practical extension with fresh application value | Grounded proof or reflection |
| Slide 6 | Useful takeaway, optional CTA | Useful takeaway, optional CTA |
| Product placement | No mandatory product turning point | Product belongs naturally in slide 4; a supplied app screenshot can be used on slide 6 |
| Learning | Content format and, with additional evidence, hook family | Story format; no separate hook-family experiment |
| Implementation | Dedicated selector, batch writer, validation and renderer | Separate selector, story writer, validation and renderer |

Structure 1 formats are list/roundup, mistakes, how-to, comparison, swap,
myth/fact, cheat sheet, checklist, framework, breakdown, problem/solution,
beginner roadmap, resources, examples, and before/after.

For example, a how-to carousel follows:
hook → step 1 → step 2 → step 3 → practical extension → takeaway.

Structure 2 formats are Wrong Belief, Perfect Plan Breaks, I Stopped, I Was
Terrible At, Result Without Sacrifice, Identity Transformation, New Rule,
and Wrong Villain / Turns Out. They change the framing while retaining the
same six-slide narrative arc:
recognition → failure → reframe → product turning point → reflection → takeaway.

The internal historical role name `proof_reflection_cta` on Structure 2 slide 5
does not mean that slide should contain a CTA. The current story contract puts
an optional CTA on slide 6. Raw format source examples also retain older
five-slide definitions; the runtime normalizers expand both structures to six.

Automatic generation uses 4:5 slides, 1080×1350. Both renderers also support
1:1, 1080×1080. Image sourcing shares the six-slot hook/human/nonhuman roles;
Structure 2 additionally supports its supplied app screenshot in the closing
slot. Rendering and persistence are separate implementations, despite shared
text styling and infrastructure.

## Routing and generation flow

The production global setting is `rotate` (configuration version 2). Its
sequence alternates entire five-carousel batches between Structure 1 and
Structure 2. It does not alternate individual slides or choose a structure
from its view count. Explicit single-structure overrides are also supported.

For each batch, the system reserves business-scoped assignments and creative
briefs, chooses formats, writes the slide plans, validates/repairs the plans,
reserves images, renders the six slides, uploads them, and persists the
result for the feed/editor. Assignments are durable across retries. New
performance evidence affects future reservations, not already frozen batches.

When automatic, plan-aware rotation selects Structure 1 and both planning
attempts fail, an atomic takeover can change the entire batch to Structure 2.
The original requested structure and effective structure are recorded
separately. An explicit Structure 1 override does not take this fallback.

## Production findings

1. **Structure 1 is not producing recent completed outputs.** In the last
   30 days, 75 of 90 batches initially requesting Structure 1 transferred to
   Structure 2. The remaining 15 were 13 reserved and 2 failed. There were
   zero completed generations retaining Structure 1 in that period. Its last
   completed generation was created on September 5. Historical Structure 1
   output exists, so this is a current reliability issue, not an absent engine.

2. **Fallback does not guarantee success.** Of those 75 transfers, 30 batches
   completed, 28 were partial, and 17 failed. Partial batches retain accepted
   candidates; these counts should not be interpreted as all five candidates
   failing. The latest successful fallback was October 10 at 19:20 UTC.
   Its Structure 1 planning errors included body/headline limits and grounding.
   Other recent examples included generic or duplicate copy. This audit did
   not isolate whether those failures arise from prompt design, validation,
   provider output, or a combination.

3. **Recent completed outputs have the expected stored slides.** All 83
   completed generations created in the last seven days were Structure 2.
   Each had exactly six stored slides and a nonempty rendered URL for every
   slide. This verifies database completeness, not visual quality, URL
   availability for every asset, or every authenticated editor interaction.

4. **The analytics pipeline is running.** In the inspected last-seven-day
   jobs, Instagram insights had 13 completed jobs, content had 18, and
   attribution had 18; none in those groups was failed. Nevertheless, nine
   performance observations missed their permitted evaluation window.
   Completed jobs do not prove that every post was captured at the required
   age. Reliable capture near day seven needs investigation.

## What view-based learning does

- It uses published Instagram carousel `metrics.views`, attributed back to
  the owned generated carousel, business profile, effective structure, and
  format. It does not use feed-card views, likes, saves or review actions.
- Results are evaluated around seven days after publication. The database
  permits nearby snapshots within approximately 24 hours of that target and
  freezes the evaluated snapshot. A late lifetime count is not substituted
  for a missing comparable seven-day observation.
- Each business needs at least two formats with at least four evaluated
  posts each within the same structure, with a positive comparison baseline.
  Evidence from different businesses or structures is not pooled to satisfy
  that threshold.
- The aggregate considers the latest 20 evaluated posts per format in the
  last 180 days. Median views, confidence and consistency yield gentle
  selection multipliers, bounded at 0.85–1.25 for formats. A single viral
  result does not automatically dominate future content.
- Once eligible, four of a five-carousel batch's format assignments use
  weighted selection; one remains controlled exploration. Higher-performing
  formats become more likely over future batches. This is not a fixed
  percentage allocation or an instruction to repeat one format in all slots.
- Structure 1 hook-family learning requires further comparable evidence
  inside the same format, with multipliers bounded at 0.90–1.20. Structure 2
  does not use that separate hook-family layer.
- Attribution currently excludes deleted library items, legacy generations
  without experiment metadata, and any library item carrying
  `trendingCreativeEdit` metadata, including image-only edits.
- Carousel learning is Instagram-specific in this implementation. TikTok
  analytics jobs do not feed this carousel learning path.

The production snapshot contained 18 observations with views: 8 evaluated,
9 past the evaluation window without a qualifying snapshot, and 1 still
younger than seven days. Structure 1 had 2 evaluated observations; Structure 2
had 6. No business-format pair reached four evaluated posts (the largest was
three). Therefore no business qualified for learned format selection.

All stored experiment assignments used `controlled_rotation`: 135 for
Structure 1 and 1,185 for Structure 2. None recorded `performance_weighted`
or `performance_exploration`. This confirms that deployed learning is not
currently influencing recorded selection.

Of 29 published Instagram library carousels inspected, 18 had performance
observations, 2 were excluded as edited items, and 9 were legacy generations
without the required learning metadata. These exclusions explain their lack
of attribution; they are separate from the nine observed posts whose
evaluation windows were missed.

## What view-based learning does not do

The daily feed uses the user's saved content-mix preference and plan
entitlement. The default mix is carousel 20%, hook video 30%, wall text 30%,
reaction 20%. This allocation does not consult carousel performance signals.
There is no active view-based reallocation from video to carousel, or from
Structure 1 to Structure 2. Only the formats inside an already selected
structure can receive learned selection weights.

## Deployment and verification scope

The live `www.getugcpilot.com` deployment was READY at commit
`4ab55bbee69b637930931ebfde01ea6cba568a5a`. The inspected structure routing,
format selectors, performance logic and analytics attribution files matched
that deployed commit. Live database settings, functions, assignments,
generation outcomes and observations were queried read-only against the
production UGC Supabase project.

The previously implemented 72px Inter Medium typography change remains local
and is not part of that deployed website commit. It requires a separate
website and worker rollout, as documented in the typography report.

Eight existing focused test files ran: **39 passed, zero failed**. These
cover both selectors, performance thresholds, structure isolation, routing,
and takeover contracts. No new customer generation, paid provider request,
database mutation, deployment, or runtime code change was performed for this
audit. Historical runtime errors remain unresolved by passing unit tests.

## Source references

- [Structure routing](C:/Users/chund/OneDrive/Desktop/UGC/worker/src/lib/carousel-structure.ts:82)
- [Structure 1 fallback](C:/Users/chund/OneDrive/Desktop/UGC/worker/src/lib/carousel-generate.ts:174)
- [Structure 1 grammar](C:/Users/chund/OneDrive/Desktop/UGC/worker/src/lib/carousel-content-grammar.ts:103)
- [Structure 2 formats](C:/Users/chund/OneDrive/Desktop/UGC/worker/src/lib/carousel-structure-2-formats.ts:17)
- [Batch preparation](C:/Users/chund/OneDrive/Desktop/UGC/lib/carousel/prepare-business-profile.ts:305)
- [Performance rules](C:/Users/chund/OneDrive/Desktop/UGC/lib/carousel/performance-logic.ts:9)
- [Structure 1 format selection](C:/Users/chund/OneDrive/Desktop/UGC/lib/carousel/content-selector.ts:326)
- [Structure 2 format selection](C:/Users/chund/OneDrive/Desktop/UGC/lib/carousel/structure-2-selector.ts:54)
- [Analytics attribution](C:/Users/chund/OneDrive/Desktop/UGC/app/api/internal/jobs/sync-analytics/route.ts:139)
- [Daily content mix](C:/Users/chund/OneDrive/Desktop/UGC/lib/trending/content-mix.ts:3)
- [Daily format planning](C:/Users/chund/OneDrive/Desktop/UGC/lib/trending/unified-daily-feed.ts:140)

The next corrective priorities are Structure 1 planning reliability and timely
performance-snapshot capture. A separate product decision would be needed to
make views alter structure allocation or the overall daily content mix.
