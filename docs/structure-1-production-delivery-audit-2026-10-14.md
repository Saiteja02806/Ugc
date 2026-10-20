# Structure 1 production delivery and usefulness audit — 14 October 2026

**Verdict: Structure 1 is configured and attempted, but it is not reaching this
account's Trending screen. Its educational purpose is therefore not being
delivered. The current implementation also does not enforce a strict ban on
product promotion.**

The supplied email was resolved through the project's Firebase account lookup
and matched account hash `658705a6`. The screenshot's exact overlay text matches
the same account's completed generation. No new generation, provider call,
schedule or publishing action was submitted for this audit. The only production
mutation was retirement of the explicitly rejected background image.

## What was actually active and delivered?

“Active” here means completed slideshows available to the user in Trending, as
requested by the owner. A selected setting or a requested batch is insufficient.

| Boundary | Production evidence | Verdict |
| --- | --- | --- |
| Configuration | `carousel_global_settings.structure_mode = rotate` | Structure 1 is enabled in configuration. |
| Today's requested structures | Ten five-candidate batches: five request Structure 1, five request Structure 2. | The allocator requests 25 of each. |
| Structure 1 planning | All five requested Structure 1 batches record two planning attempts and `planning_fallback`. | Every educational batch fails and switches structure. |
| Final completed outputs | All 50 current-day generations are `structure_2`, completed, using `llm-carousel-structure-2-writer-v24-inter-medium-typography`. | Zero completed Structure 1 outputs today. |
| Actual Trending assignments | Today's 50 carousel slots join to Structure 2 outputs: 49 ready, one decided at the audit snapshot. | Zero Structure 1 slots reach today's feed. |
| Account's saved generation history | Zero completed Structure 1 records; 363 completed Structure 2 records. Ten records remain Structure 1 and failed. | No successful Structure 1 delivery is evidenced for this account. |
| Account's feed exposure history | 358 Structure 2 assignments have `first_shown_at`; 144 have a completion action. Zero Structure 1 assignments are marked shown or acted on. | Stored delivery evidence supports the same conclusion. |

`first_shown_at` is a server feed-return marker. `buildDailyFeedResponse` marks
all ready returned assignments together; it is not per-card viewport telemetry
and does not prove a person read every slide. The screenshot and the matching
skipped decision establish stronger evidence for that particular creative.
There is no Structure 1 output or assignment to create ambiguity in today's
zero-delivery conclusion.

A follow-up production read at **13:55 IST** confirms the same pack is ready
with 34 ready and 16 decided slots, all Structure 2. Decisions advanced during
the audit; the resolved structure and zero Structure 1 delivery did not change.

The prior reservation repair did restore generation: all 50 candidates in the
recovered pack have now completed. That repair fixed the inventory shortage;
it did not repair Structure 1 writing or establish educational-copy quality.

Historically across all accounts, 638 completed records carry Structure 1
metadata, 271 were assigned/marked shown and 150 have a completion action.
The most recent completed Structure 1 was created **5 September 2026, 09:48 IST**;
the latest shown marker is **7 September, 11:12 IST**. Recent sampled outputs are
the older five-slide v36 planner. No completed Structure 1 generation exists
in the last 30 days. These older records establish historical delivery, not
current six-slide implementation health or delivery to the supplied account.

## Why rotation produces only product stories

`worker/src/lib/carousel-generate.ts` tries the Structure 1 batch planner twice.
Each call includes validation and isolated candidate repair. For plan-aware
automatic rotation, failure of both attempts invokes
`takeOverCarouselExperimentBatchWithStructure2`, changes the entire untouched
five-item batch to Structure 2 and runs the Structure 2 writer.

Today's five recorded fallback reasons include:

- Non-list bodies below the 18-word minimum, including 14-, 16- and 17-word bodies.
- A hook requiring five lines where the fixed 72px cover permits four.
- Headline word-length failures and repeated headline/body ideas.
- Grammar/spacing and multiple-idea failures.
- Generic copy, unsupported claims and hooks too similar to recent history.
- Concepts or middle slides failing the selected verified grounding check.

This is evidence from today's customer jobs, after the earlier lowercase and
list-body fixes. It is not an inference from the old isolated provider tests.
Some saved reasons are truncated at 1,000 characters, so the audit does not
claim a complete failure count for every individual draft or candidate.

The planner returns the five accepted plans only after all pending repairs
finish. A repair failure throws the batch call even when some siblings passed.
The outer fallback then changes all five candidates. This couples Structure 1
delivery to complete-batch acceptance: a single unresolved draft can prevent
otherwise valid educational siblings from reaching the user.

The broader account history corroborates the pattern: 60 requested Structure 1
batches changed to Structure 2, containing 300 candidates; 174 of those candidates
completed and have shown markers as **Structure 2**. Two requested Structure 1
batches remained failed; 13 remained reserved without a resolved output.
Requested-structure statistics therefore substantially overstate actual
educational delivery unless resolved structure and feed exposure are measured.

This is not evidence that the frontend hides valid completed Structure 1 decks:
there are no such completed decks in this account. The failure is upstream of
rendering and feed selection.

## Is Structure 1 doing its core educational job?

The owner clarified the intended acceptance rule: **Structure 1 must deliver
useful, self-contained information without promoting the product.**

The source contains fifteen educational formats: list, mistakes, how-to,
comparison, swap, myth/fact, cheat sheet, checklist, framework, breakdown,
problem/solution, beginner roadmap, resources, examples and before/after.
These prescribe lists, decisions, concrete steps and useful takeaways. The
writer says to prioritize useful content over promotion and avoid advertisements.
That intent is present.

However, three gaps prevent calling the core job successful:

1. **It does not reach the user.** Today 25 requested educational candidates became
   product-story candidates. Configuration and attempts are not educational value.
2. **No-promotion is not a hard contract.** The writer and format rules permit an
   optional final-slide CTA. Supported product/brand names are allowed, and there
   is no dedicated rule rejecting supported-product sales language. The current
   tests explicitly accept an optional final CTA. “Prioritize useful content”
   is weaker than the owner's no-product-promotion requirement.
3. **Passing technical checks does not prove a useful lesson.** Grounding validation
   requires an anchor and checks token overlap with the concept and combined
   middle-slide text. It does not semantically establish that the slides teach
   the anchor correctly. Word count, fit, prohibited phrases and duplicate checks
   are valuable, but do not prove the reader received a concrete next step or
   useful decision. Conversely, a short valid tip can fail a hard body-word floor.

I reviewed the twelve most recent historical Structure 1 decks with shown
markers across accounts (60 persisted slide text records). Their five-slide
v36 output is older than the current production failure and is a small,
recency-selected sample, not a representative quality score.

Some provide useful actions: set work hours and communicate them to family,
use reminders, designate a quiet work space, or use a shared calendar rather
than a manually maintained one. The normalized list payloads were also checked
for the sampled checklist/cheat-sheet decks: they contain practical suggestions
such as setting deadlines, reviewing progress and writing down three things
achieved that day. Null body fields in these list slides do not imply missing
educational content. Other outputs are weaker: a myth/fact deck
lists myths without supplying corresponding facts, and several closing slides
offer general encouragement instead of another practical step. Three of these
twelve decks contain Todaywise promotion in the final headline, even though
their separate CTA fields are null. Historical delivery was therefore not
uniformly non-promotional either.

## What is the user receiving instead?

The audit read every cover, product-turn slide and final slide in today's
50 completed decks (150 saved slides), plus all six slides of the screenshot's
matching deck. All 50 name UGCPilot on both slide 4 and slide 6. Every final
slide contains the pattern **“Let UGCPilot…”** in its body. The final `cta_text`
field is null for all 50; a CTA-field-only audit would miss those promotions.

In the screenshot's exact deck, slide 3 says:

> I realized I didn't have to do it all alone.
> Delegating marketing tasks could relieve my stress.

Slide 4 introduces UGCPilot as the solution. Slide 6 ends:

> Don't try to manage everything alone in your business.
> Let UGCPilot take care of your marketing needs.

This is Structure 2 (`3857e2ad-e970-45a0-b99b-1a5b0a83e1b7`), not Structure 1.
Its saved assignment is skipped and its 14 October feed slot is decided. The
screenshot's text and background therefore establish an exact source match.

Across today's final slides there are only 46 distinct bodies: one closing
body occurs three times, two other closing bodies occur twice. All 50 endings
share the lesson-plus-product-pitch pattern. Editorially, phrases such as
“Understand your audience's needs” or “Prioritize quality” need an actual method,
example or decision to become useful teaching. These observations explain why
the current feed can feel promotional and repetitive. They are not measured
audience-response or retention results, and do not claim every slide in every
deck lacks value.

## Requested background removal

The source was identified by the exact overlay text, verified against the local
original visually, and matched by SHA-256. It is the collage with **BOSS** and
**I am worthy of** text behind the generated copy.

- Backend asset: `64d03b1d-e596-4110-abb6-1afc584c3541`.
- Source path: `productivity-human/Pinterest_2026-08-16 (76)/pinterest_019.jpg`.
- SHA-256: `11287eed773aa99be929566759cf3d29bbc1635d1fc6912775557e81b9c0ca8f`.
- Exactly one canonical backend row matches; no other exact backend copy was found.

At **11:58 IST**, the guarded transaction archived/deactivated that source with
`runtime_exclusion_reason = user_requested_retirement` and the existing explicit
historical-render preservation marker. A locked identity check and live-job
preflight preceded the mutation. No affected generation was active. A full
pre-change source record is saved in
`outputs/boss-collage-retirement-before-2026-10-14.json`.

Verification confirms **zero eligible sources** for this hash. The installed
allocator also has both existing-reservation retirement replay guards, so a
failed old generation cannot bypass retirement by replaying its original image
selection. The local import/reconciliation denylist now rejects both the exact
path and any identical file under another path; neighbouring images stay allowed.

Physical deletion would disrupt the preserved source references and existing
edit backgrounds. The established safe-removal path removes it from new use
and retains bytes only for historical outputs. Five completed decks retain all
their expected ready rendered slides (29 total). The application's actual
Carousel status mapper was run against production and confirms 5/5, 6/6, 6/6,
6/6 and 6/6 visible slides. Source storage URLs, usage history and original
metadata remain unchanged. Existing rendered slides can still show this old
background; they were not rewritten by this removal.

Twenty-two checks passed for source/hash rejection, stale-manifest handling,
reconciliation preservation, both allocator replay branches and historical
read safety. No website or worker deployment was needed for the production
source-state change. The reimport policy and its new regression are saved locally.

## Changes needed before claiming Structure 1 is healthy

- Measure requested structure, resolved structure, completed outputs and actual
  feed delivery separately. Alert on sustained zero Structure 1 delivery.
- Repair Structure 1's prompt/validation conflicts and repair reliability with
  production-shaped five-item batches across all fifteen formats; retain
  readability, ownership, provenance and factual grounding constraints.
- Preserve educational semantics when repairing a batch. Do not count a
  Structure 2 fallback as a successful Structure 1 output. Any change to the
  current whole-batch fallback/partial-result policy needs an explicit design
  and regression coverage before rollout.
- Enforce no supported-product promotion in Structure 1's visible headlines,
  bodies, list items and CTA fields. Null CTA metadata alone is insufficient.
  Use a practical closing action rather than a sales invitation.
- Evaluate usefulness with a concrete action, explained decision, example or
  checklist, followed by real production delivery acceptance. Technical JSON
  acceptance alone is insufficient.

These are recommendations for the next implementation, not changes made by
this analysis. Structure settings, planners, copy validators, worker routing
and already-rendered copy remain unchanged. No new paid copy experiments were
submitted for this audit.

## Owner's preferred Adjust mixer

The follow-up direction is a percentage mixer rather than an exclusive style
choice. Use **Helpful tips** for useful educational slideshows without product
promotion, and **Product stories + CTA** for product-oriented stories with a
call to action. Start at **50% / 50%**. In a 50-slideshow pack that means 25 of
each; the product should display these concrete counts alongside percentages.
Do not expose internal Structure 1/2 names in the interface.

This is a slideshow-style preference, distinct from the existing content-format
mix. `components/trending/trending-content-mix-dialog.tsx` and
`app/api/trending/content-mix/route.ts` currently manage Slideshows versus video
formats. In slideshow-only mode they expose a fixed 100% Slideshow allocation.
The preference table has no educational/product-story percentage columns, and
`reserve_carousel_experiment_batches` reads a global structure setting and
alternates five-candidate batches. A UI slider alone cannot control this path.

A future implementation needs owner-scoped server persistence, a preference
snapshot for each new pack, and allocation passed through to the structure
allocator and worker. Saving should take effect for future packs and preserve
today's already-created cards. Whole-output rounding must be explicit, including
small daily allowances; fixed five-candidate batches require a deliberate
strategy for percentages that do not produce multiples of five.

Most importantly, an educational slot must not silently become a product-story
slot during recovery. Fix the confirmed planning/repair failures, preserve
accepted educational siblings safely, and keep factual and readability checks.
If bounded educational recovery cannot finish, report that shortfall accurately.
Measure completed and feed-delivered styles against the saved mix separately
from requested styles. The current 25/25 request becoming 0/50 delivery is the
regression this design must prevent. This mixer is not yet implemented or live.

Raw sampled production evidence is saved in
`outputs/structure1-production-audit-2026-10-14.json`. Counts are snapshots from
14 October; the generation and delivery queries are owner-scoped where indicated.
