# Slideshow reference selection

Local follow-up on `codex/slideshow-create-refinement-20261008`, after the
reference/model refinement in `99a5462`. Website and image-worker deployment is
pending; this document is not production acceptance.

Create shows all source slides beneath the preview tile. All slides includes the
whole slideshow; Selected slides allows any checked subset, including a single
slide. Thumbnails scroll horizontally, and the counter states how many will guide
each output. Empty selections disable generation. A new gallery or uploaded
slideshow starts with its first slide selected.

The previewed checked image is the first provider input. Remaining checked slides
retain source order. Output images controls how many new images are generated;
it does not select references or automatically recreate every source slide.
Only generated images enter Edit slides, as in the preceding refinement.

The browser sends `referenceImageUrls` together with the first `referenceImageUrl`.
The API validates and canonicalizes each reference for the authenticated owner
before reserving credits. Each queued output freezes the same exact reference
list. Worker fingerprints include that list, and private inputs are resolved for
the owner before submission. GPT Image 2.5 receives a file array; Nano Banana 2.1
receives multiple image parts and the unchanged instructions. Legacy single-image
jobs keep their old provider fingerprints and request shape.

Both models accept up to 14 references in this workflow. Current catalogue sets
have at most 12 slides and uploads at most 10. Downloads are limited to 25 MB per
image and 50 MB combined. Invalid references or oversized downloads cannot reach
a generation provider. Existing billing, output ownership, provider fences and
disabled SDK retries remain in effect. No schema migration is required.

Verification: 109 offline checks passed across generation UI, API, worker/provider
requests, download limits, existing video workflows, editor saves and layout.
Scoped ESLint, worker TypeScript build and the Next production build passed.
Desktop and 390 px mobile preview checks confirmed all/subset selection, thumbnail
scrolling and no horizontal document overflow. No paid generation, production
database write, publishing action or deployment was performed. Screenshots and
logs are in the ignored `.tmp/slideshow-context-20261008/` and `.tmp/slideshow-context-*.log`.

Release the updated image worker before the website, then verify the deployed
commit on the production domain. Include both this follow-up and `99a5462` in that
release so the new GPT default and multi-reference inputs have matching workers.
