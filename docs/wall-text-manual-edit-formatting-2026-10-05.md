# Trending Wall manual copy formatting

Implemented locally on 5 October 2026. Deployment and authenticated production
verification are pending.

## Root cause

Typing invalidated `finalLayout`; the editor then displayed `fullText` inside a
`whitespace-normal` paragraph. HTML collapsed every authored newline. The draft
helper also grouped lines into two or three semantic segments and normalized
`fullText` to a single paragraph.

Save converted every manual edit to generated plain-text content. Its layout
engine stripped newlines and balanced the whole paragraph into 5–8 lines. The
same generated-copy validator required terminal punctuation, rejected CTA and
promotional wording, and enforced the writer's word budget. A valid user list
ending with “Sentry - finding what breaks” therefore failed the punctuation
heuristic with “Wall-of-text copy must end as a complete sentence.” That check
tested punctuation, not grammatical completeness.

The export job parser and SVG layout independently required one generated text
block. Preserving only the browser whitespace would still fail at save/export.

The three-row heading also came from a fixed 780/1080 reading column: a larger
preview scaled both font and column together, so it retained the same wrap.
Placement validation and worker checks capped the text box at that width.

## Behavior

Manual edits preserve explicit lines and paragraph separators. Each authored
line wraps at measured Arial Bold width only when necessary. No words move
between separate authored lines to balance a paragraph. Blank lines retain
compact spacing (18 source pixels each), including multiple blank lines.

Manual layouts retain the current V13/V9 typography and carry `textMode: manual`
and per-block `gapAfterPx`. These fields survive worker parsing. The editor,
saved feed overlay, optional shared PNG preview, SVG, and raster export use the
same spacing. Manual browser typography scales with the preview frame and its
wrapping reserves outline/raster width. Generated review cards keep the existing
font cap and saved layout.

Manual text must be nonempty, at most 600 characters, match its authoritative
layout, and fit the publishing safe area at the fixed font size. If necessary,
its text box expands vertically around the old center, with 12 source pixels
of padding at each vertical edge, clamped to the existing safe area. It never
shrinks the font or clips content. Excessive copy or an indivisible oversized
word gets a clear fit error.

Changing only color or position preserves the existing saved rows and typography.
The editor save and shared PNG draft route use the same helper to distinguish
these changes from new copy, avoiding a reflow when text was not edited.

The editor now shows left and right resize handles and a percentage width slider.
Width can range from 40% to 94% of the video. The horizontal manual-edit safe area
leaves at least 3% padding on each side; vertical publishing margins are retained.
Dragging a side holds the opposite edge fixed; the slider resizes around the
center and clamps to those margins. Dragging the text still moves it. Keyboard
arrows adjust width or position, Shift uses larger steps, Home/End set handle
or slider limits, and Escape cancels an active pointer gesture.

Width edits discard old measured rows and reflow at the same fixed font size,
preserving every authored line and paragraph. The new width persists in the
existing creative edit JSON and goes through shared PNG and video rendering.
Pending copy/width edits use browser wrapping immediately, including when the
shared PNG flag is enabled; measured saved content can use the PNG preview.
The worker's line-width validator now receives the payload safe area rather
than silently reinstating the old horizontal margin.

Manual lists and phrases do not need terminal punctuation or meet AI-only
writing restrictions. Automated generation still requires its existing word
range, balanced rows, complete-sentence punctuation, and copy policy.

## Validation

- `npm run test:trending-edit`: 37 passed.
- `npm run test:wall-text:manual`: ten integration checks cover the supplied
  five-tool list through measured layout, validation, actual worker payload
  parsing, and transparent raster export; short phrases/lists/CTA; long-line
  wrapping; CRLF and multiple gaps; fit failures; unchanged AI sentence rules;
  preserved measured layouts on color/position-only edits; two-row heading at
  94% and raster export at both 40% and 94%; anchored resizing and movement;
  worker rejection outside the supported manual widths/margins.
- Worker renderer, render-job, and shared-overlay tests: 30 passed.
- Existing text logic, transport, attribution, and preview-scale tests: 20 passed.
- `npm run test:wall-text:behavior`: 11 passed, including actual writer/layout
  validation and generation persistence.
- TypeScript check and worker build pass. Scoped ESLint has zero errors and
  existing unused-variable warnings in previously modified renderer/text logic.
- Headless Edge rendered the actual editor overlay function at 196px, 277px,
  and 391px frame widths using the packaged Arial Bold font. At each size the
  introduction occupied three rows and all five short tool entries occupied
  one row each, with six separate paragraphs and no page errors. This was an
  isolated layout check, without production authentication or hosted save calls.
  Screenshot: `artifacts/wall-text-manual-edit/editor-preview.png`.
- A second headless Edge check used the actual new width controls, draft update
  helper, and editor text overlay with compiled Tailwind styles and packaged
  Arial Bold. At all three frame sizes the heading changed from three rows to
  two at 94%, with each of the five tool entries still on one row. Native slider
  limits, pointer resizing from both edges, anchored keyboard resizing, text
  movement, touch resizing, and Escape cancellation were checked with no browser errors.
  Screenshot: `artifacts/wall-text-width-edit/editor-wide.png`.

The new integration check runs as part of `npm run test:wall-text` via its
posttest hook and builds the render worker before loading its actual parser.

## Release

Release both application and supporting render worker. Older workers reject
multi-block manual payloads, so deploying only the frontend does not complete
the fix. No database migration is required: edited content is stored in the
existing owner-scoped creative edit JSON, while generated creatives retain their
existing database content constraint.

After release, verify on `https://www.getugcpilot.com` with a signed-in account:
open a Wall in Trending, paste the supplied list, save, reopen, then use the
existing Library/schedule render flow and inspect the finished video. Confirm
the exact entries/gaps, only the long introduction wrapping, and no sentence
ending error. Resize to 94%, save/reopen, and confirm that width, margins, and
two-row heading also match the exported video. Local checks are not
authenticated production acceptance.
