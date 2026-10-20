# Hook and Wall of Text extraction/display audit — 2026-10-13

The current catalogue contains extracted captions for every published Hook and
Wall of Text reference. The renewed structural audit and actual-component
render check found no missing entries, wrong source associations, truncated
display values or identical duplicate active blocks. Fresh visual spot checks
found no missing words or incorrect numbers/emojis in the 15 inspected sources.

This was a read-only audit. The caption catalogue, extraction statuses, provider
settings and application source were not changed. No AI generation, media save,
database write, publishing or deployment was performed.

## Coverage

| Video workflow | Current references | Saved text entries | Ready | Missing / needs review | Active caption blocks |
| --- | ---: | ---: | ---: | ---: | ---: |
| Hook | 30 | 30 | 30 | 0 / 0 | 31 |
| Wall of Text | 97 | 97 | 97 | 0 / 0 | 125 |
| Total | 127 | 127 | 127 | 0 / 0 | 156 |

The all-format consistency check also passed: 185 references, 453 source units,
441 ready entries, 12 deliberately excluded/no-text slideshow entries, zero
missing units and zero structural errors. Slideshow exclusions were not changed.

## Extraction and source evidence

`scripts/audit-explore-reference-text.mjs` was rerun against the current catalogue
and cached original media. It checks the exact reference ID, format, source
SHA-256, actual original file bytes, raw OCR fingerprints, lossless retained
transcripts and caption intervals bounded by the video's duration. Every video
passed. The video evidence retains 3,649 sampled observations. All 156 active
video blocks are nonempty, have no identical duplicate blocks within their
source, and have no overlapping intervals.

Fresh frames were decoded directly from 15 original MP4 files at the midpoint
of each selected active caption block: 35 frames in total. These include:

- Hook 01, Hook 04, the “Broke people” hook, the “$100/mo” hook and the paired
  hook that adds “Ok...let me show you how” after its opening.
- All nine video entries from the previous ten priority cases: the numeric
  choice list, investment paragraph, eldest-daughter paragraph, trauma-response
  list, research-topic list, BARE MINIMUM list, startup-demo caption, Cantina
  tutorial and PC-gaming tutorial.
- The longest stored Wall of Text, the 755-character “7 things the gym taught
  me” paragraph. Its final sentence is retained.

The inspected words, numbers, emojis and paragraph content match the source
captions. Typographic quote/bullet variants are normalized in some stored text;
this is a copy transcription, not a reproduction of every source glyph or font.
The startup/tutorial examples exclude app buttons, screenshot copy and generated
app-demo speech captions, retaining the creator's added caption track. In the
paired hook, the opening sentence occurs in both timed blocks because it remains
visible when a second sentence appears; that is intentional source behavior.

The previously completed audit visually reviewed all video sources. This renewal
rechecked all sources structurally and visually spot-checked 15; it did not
rewatch all 127 videos frame by frame. Caption boundaries remain subject to the
sampling/frame precision documented in the original audit. Source factual claims
and promised outcomes were not fact-checked.

Raw OCR heuristics still report 105 possible duplicate-fragment and 18 capacity
flags among videos. They describe historical OCR/proposal evidence, not approved
active copy. They do not mean that the curated display has 105 duplicate captions
or 18 truncated references. No active duplicate or overlap was found.

## Display and association evidence

The actual `RemixTextSection` component was rendered with each of the 127 real
catalogue video sources. Its `Reference text` textarea value was compared with
every complete stored block joined in source order. All 127 matched exactly.
The field accepts up to 6,000 characters; no catalogue video exceeds that limit.

CUA also exercised the current local workflow UI with generation/saving disabled:

- Hook 01 automatically loaded its full 94-character caption, preserving line
  breaks, in the Hook text section after opening Edit.
- The longest Wall of Text loaded all 755 characters, including the last line
  “refuses to quit.” The small textarea scrolls; its 82px visible height and
  664px content height do not truncate its value.
- The Cantina tutorial loaded all 12 paragraphs in source order, totaling 368
  characters. App-interface text was absent.

Current code retrieves captions using the linked reference ID and validates the
returned source identity/format. Owned generated media restores the original job
reference; it cannot substitute an unrelated newly selected gallery post. A
saved user-edited starting-text draft can intentionally override the original
caption for that exact account/output/reference. Uploaded or legacy unlinked
clips may show an empty field for manual details; that is an association/data
availability case, not proof that catalogue extraction is missing.

Seventeen catalogue/source/ownership/API tests passed. Fifty-four current common
editor and Demo regression tests passed using the repository's worker-source
test loader. An initial run without that loader could not resolve the worker's
NodeNext `.js` source imports; the configured run passed.

## Production limitation

The production Hook and Wall of Text workflow pages were opened read-only. The
Hook gallery reports 30 references and Wall of Text reports 97. This browser session's Your videos view had
no existing generated clip, so the authenticated original-job → API → Remix
display path on an owned production output was not accepted end to end in this
audit. No paid generation was started to create a test clip. The local display
and catalogue checks do not substitute for that remaining hosted acceptance.

## Evidence artifacts

- Current all-source audit: `.tmp/remix-text-audit/audit.json`.
- Fresh sample decisions: `.tmp/remix-video-audit-2026-10-13/samples.json`.
- Fresh frame manifest and sequences:
  `.tmp/remix-video-audit-2026-10-13/frame-manifest.json` and neighboring JPEGs.
- Exact component display comparisons:
  `.tmp/remix-video-audit-2026-10-13/display-audit.json` (127 checked, zero mismatches).
- Local screenshots: `hook-display.jpg`, `wall-display.jpg` and
  `wall-display-end.jpg` in that same audit folder.
- Current editor test receipt: `editor-tests.log` in that audit folder.

There is no new ambiguous extraction requiring user wording review from the
fresh sample. The remaining acceptance item is verifying a reference-linked
owned clip's Remix field on the production site. Long captions require scrolling
in the intentionally compact field.
