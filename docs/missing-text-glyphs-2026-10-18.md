# Missing text glyphs in Trending slideshow edits

The matching saved headline contains the complete text:
`5 websites I wish I knew before launching my SaaS`.
Its saved style is Montserrat Bold, size 40, wrap width 431, color #ffea00,
centered text, no background, with fractional on-slide coordinates.

## Confirmed cause

The text is not lost from the saved content. Reproducing those settings with
the actual worker damages `s`, `a` and `u`. The installed OpenType.js 2.0.0 path
serializer uses exponent strings to round the fractional part of coordinates.
A near-integer float such as 83.00000000000001 has a fractional part expressed
in scientific notation; concatenating another exponent produces NaN. The
generated SVG then contains invalid curve/line coordinates. An SVG renderer
can partially draw or discard affected contours, so letters appear incomplete.

The browser's native font preview draws the text correctly, but immutable saved
renders are also shown within Edit until a field changes. That explains the
same defect being visible in Edit and in the saved Trending card. The initial
generic Inter reproduction did not reproduce this; the exact saved Montserrat
settings did. The cursor hypothesis was rejected after the user's clarification.

## Correction

`worker/src/lib/svg-glyph-path.ts` serializes the existing M/L/Q/C/Z commands
with bounded decimal formatting, preserves closed contours, and rejects invalid
coordinates. Both consumers use it: Carousel manual text and Explore font
outlines. No dependency upgrade or typography/layout change is required.

The Carousel manual renderer version changes so a new save cannot reuse an old
damaged render fingerprint. Existing media, schedules and immutable finishing
receipts are retained. After rollout the affected Carousel edit needs another
explicit save; this investigation did not mutate production data.

## Evidence

- Read-only matching production row confirms complete input text and style.
- Exact old worker reproduction contains NaN path tokens and missing letter
  segments. Corrected SVG contains only finite coordinates; the local image
  using the same source background preserves the complete text.
- 60 worker/renderer tests pass, including per-character ink for alphabet,
  numbers, punctuation and accents in 12 faces, exact-cover regression, 48
  font/weight/size combinations, and validation of every supported command.
- 9 existing font/export/persistence tests pass, including actual video render,
  fallback characters and save/reopen behavior.
- Worker build, application TypeScript and scoped lint pass. Actual editor
  browser tests pass for preview, save/reopen, valid exported paths, style and
  mouse/touch/keyboard controls at laptop/mobile sizes.
- The standalone browser fixture initially failed on an undefined `process`
  introduced by unrelated Next Link usage; adding Next-style public client
  environment substitution to the fixture resolved startup. No app code was
  changed to mask this fixture issue.

No deployment was performed. Authenticated production browser inspection was
unavailable because local browser use is disabled in Work settings. Local
rendering and production read-only evidence do not constitute live acceptance.
