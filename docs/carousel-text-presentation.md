# Existing slideshow formats: text presentation

Owner-confirmed scope, 2026-09-30; social hook refinement, 2026-10-09. This is a text-only update to Structure 1
and Structure 2, not a new Carousel architecture.

## What stays fixed

Structure 1 keeps `list`, `mistakes`, `how_to`, `comparison`, `swap`, `myth_fact`,
`cheat_sheet`, `checklist`, `framework`, `breakdown`, `problem_solution`,
`beginner_roadmap`, `resources`, `examples`, and `before_after`.

Structure 2 keeps `wrong_belief`, `perfect_plan_breaks`, `stopped_behavior`,
`terrible_at`, `result_without_sacrifice`, `identity_transformation`, `new_rule`,
and `wrong_villain` (`turns_out` remains its alias).

The selectors, format IDs, configured roles, exact six-slide ordering,
five-candidate batch, image reservation and screenshot selection are unchanged.
Canvas sizes remain 1080 x 1080 (1:1) and 1080 x 1350 (4:5). No 9:16 size,
replacement architecture or collage layout is introduced. A ready approved
uploaded app screenshot keeps its existing eligibility and final-slide slot;
the established contained screenshot composition is preserved.

## Text hierarchy

| Content | Treatment | Fixed size | Line budget |
| --- | --- | ---: | --- |
| Opening hook | One statement, clean white, no pill or supporting layer | 84px Bold | 4 |
| Optional heading | Dark text on a fitted white SVG pill | 50px SemiBold | 2 |
| Each body thought | White, no background, existing outline | 48px SemiBold | 3 |
| Optional final CTA | White, no background, existing outline | 48px SemiBold | 3 |

Inter Tight remains the export font; the editor loads that same packaged face.
A hook normally uses 6-14 words. The publisher permits 5-14 words for compact
legacy-compatible hooks and still checks real fixed-size fit. A content heading
normally uses 4-10 words, is optional, and must say something distinct from its
body. A heading is not inferred from an asset role or the name of a saved field.

The cover communicates one main idea in one text block, usually two to four
lines. It creates curiosity through a concrete problem, changed belief, tension,
or honest promise. First-person hooks are welcome: `i kept running out of things
to post` and `i thought every workout had to feel hard to count` leave the
explanation for Slide 2 onward. A list promise is appropriate only when the
following slides actually deliver that list; do not force one into a product
story. Avoid motivational ad copy and message-plus-explanation covers.

Both generation validators reject multiple sentences or separate cover
paragraphs as `hook_structure`, even when the text meets the word budget.
Intentional single line breaks, common abbreviations, domains, and decimal
numbers do not create additional statements. Curiosity and one-idea quality
remain writing guidance; the validator does not claim to prove engagement or
ban particular first-person phrases. Structure 2 can repair the hook alone
while preserving all valid body slides. Fixed fit remains authoritative:
overflow requires shorter copy, never smaller type or truncated text.

Normal slides contain one or two separate thoughts, not a single long
paragraph. Prefer two short blocks of 7-16 words each, within the unchanged
total body budgets: Structure 1 18-30, Structure 2 14-30. Separate blocks with
one blank line; use single newlines for deliberate semantic line breaks.
The renderer adds 32px between text groups. Do not put BODY A/B labels into
visible copy. List modes retain their configured counts and two-line item /
eight-line total budget; each item is rendered as its own group.

Example authored fields:

```json
{
  "headline": "i stopped waiting for motivation",
  "body": "i used to wait until i felt ready\n\nnow i show up for ten minutes every morning",
  "ctaText": null
}
```

Structure 2 uses `storyText` instead of `body`. It now has a distinct nullable
`headline`, rather than treating the full story as a heading. Set the heading
to null when ordinary body copy is sufficient. Covers still have one hook only.

Default to conversational lowercase, while preserving proper product names,
qualifications and factual meaning. Each block communicates a different thought
(old behavior / consequence, belief / realization, mechanism / result). Follow
the reserved format's actual role, not a new transformation/listicle template.

## Heading SVG and CTA

The existing SVG path follows actual measured line widths and rounded shoulders;
it is not a fixed-width card or decorative SVG file. Only the semantic heading
has a white background. Body blocks, lists, hooks and CTA never gain that box.

An optional CTA may accompany useful final-slide value. New generation allows
it on Slide 6 only, not as a replacement for a promised tip. Explicit edits
preserve an existing authored CTA on its slide. It does not change screenshot
selection, add a slide, or create a fake UI button. Null CTA renders nothing.

## Compatibility and verification

The new Structure 2 transport remains backward-readable: a missing semantic
heading means a legacy plain story, not a pill. New content uses existing
headline/subtext columns (empty headline for body-only content); legacy rows
remain untouched. No schema migration is required.

Saved renders are immutable. Unchanged editor slides reuse the saved image;
only intentionally changed slides are rendered under new versioned keys.
Live editor dragging and arrow keys use the measured full text group inside
the existing safe margins. Bounds refresh on resize, copy edits and font load;
preview corrections alone never rewrite saved content. Oversized groups show
a shorten-to-fit warning, while exports retain their authoritative fit checks.
The worker measures the actual font and rejects overflow, excessive body groups,
or orphan lines (`for`, `and`, `to`, `the`, `of`, `but`). It never shrinks or
truncates. Writers and bounded repair prompts receive the same constraints.

Offline checks:

```powershell
npm run worker:build
node --test worker/dist/lib/carousel-text-presentation.test.js
node scripts/check-carousel-text-presentation.mjs
node --experimental-strip-types --test lib/carousel/editor-text-containment.test.ts
node scripts/check-carousel-editor-containment.mjs
```

The visual canary writes only generated previews under `.tmp`; it makes no
model requests, uploads, database changes or image-selection calls. Coordinated
web/worker deployment and authenticated production acceptance are separate.
The editor check uses installed Playwright (or `CAROUSEL_BROWSER_DEPENDENCIES`
pointing to a bundled node_modules directory) and a headless browser. It tests
the actual isolated React control, without opening authenticated app routes.
