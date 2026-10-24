# Hook brand substitution and reference font

Font estimate superseded: the user rejects the TikTok Sans preview. See
`docs/poppins-font-correction-2026-10-24.md` for the Poppins/outline correction.
The Hook Remix diagnosis and implementation below remain applicable.

Implementation and local verification: 24 October 2026. Website/worker deployment
and hosted acceptance are pending for this follow-up.

## Reported Remix cause

Read-only production inspection found the exact completed request
`32c168f2-30df-491a-a712-8a88cff56eef`, created at
`2026-10-24 07:49:35.971903+00`, using Hook prompt v7. Its saved server input
contains `businessName: UGCPilot` and a marketing-content product summary. The
source is:

```text
POV: you finally understand
how to use Claude
for marketing
```

The saved result replaced Claude with “a marketing app”. Business context was
not absent. The prompt discouraged extra brand insertion without explicitly
distinguishing replacement of an existing named tool. This explains why a vague
category could satisfy its minimal-edit rules. The provider's internal reasoning
is unavailable; this is a diagnosis from saved input/output and prompt rules.

New Hook requests use v8, derived from the retained v7 prompt, with an explicit
named-tool rule: use the supplied exact business name when it truthfully fits
the source task; retain the surrounding sentence. Explicit no-brand instructions,
human-role preservation, minimal changes and protection against unsupported
claims remain. Wall/slideshow prompts and model/provider settings are unchanged.

The intended edit for this example is:

```text
POV: you finally understand
how to use UGCPilot
for marketing
```

This example is a regression expectation, not a newly generated live AI result.
API tests mock the provider and verify the v8 rule and correct context are sent.
Existing saved receipts are immutable and recover unchanged, including the
reported v7 copy. Recovery does not silently regenerate or consume another call.

## Font interpretation and implementation

The user explicitly wants the pictured font identified and added, not a helper
sentence or identification button. TikTok Sans Bold is the closest visual match
to the small white, black-outlined screenshot. The 194×79 raster crop is too
limited to certify the original family. TikTok identifies TikTok Sans as its
caption family, including Classic/Bold styles, and publishes it under OFL 1.1:
[official announcement](https://developers.tiktok.com/blog/tiktok-sans-open-source),
[official font repository](https://github.com/tiktok/TikTokSans).

- Actual TikTok Sans Regular/Medium/Bold (400/500/700) now appears in the shared
  font selector. Choose Bold with the existing white/outline text style to
  approximate the supplied reference.
- Source is pinned to Google Fonts revision
  `1d0e46c7933245c8180fe83e47917961c913bbdb`, file
  `ofl/tiktoksans/TikTokSans[opsz,slnt,wdth,wght].ttf`, source SHA-256
  `0e7f0a3e924c9a86478fc6fc2946de2e4ab8fc704ed72ee40434ade94bb9b0c6`.
- Browser WOFF2 and worker TTF faces are instantiated from that source with the
  requested weight and default optical-size/slant/width axes. Unique internal
  names prevent host-font substitution. Shared advances drive preview wrapping;
  exports use actual glyph outlines, independent of installed OS fonts. Font
  preparation is offline at runtime, with licenses included in both asset sets.
- The preparation script accepts `--only tiktoksans`. Existing font metrics and
  manifest entries were compared to HEAD and are identical. Existing user styles,
  legacy Arial fallback and new-text Inter Bold defaults remain unchanged.
- Shared manual Trending slideshow controls inherit this family. Automated
  slideshow generation typography does not use this list. Worker Docker packaging
  copies the full font asset tree; the website serves bundled public WOFF2 files.

## Local verification

- Worker TypeScript build and application `tsc --noEmit --incremental false` pass.
- Scoped ESLint passes, including the font browser/render tests and v8 API code.
- 25 Hook prompt/API/source tests pass. They verify the exact reported example's
  context/version selection, human-role/factual constraints, and historical receipt
  recovery without a second provider call. These are mocked-provider tests.
- 29 font/manual-slide render tests pass: eight Explore font tests plus 21 manual
  slideshow tests. All fifteen family/weight combinations have distinct rendered
  outputs and match the preparation hash manifest. Missing fonts fail explicitly.
- 35 additional editor/emoji/draft regressions pass, including final composition,
  trim/live controls, saved blank drafts and the reported emoji caption export.
- A real FFmpeg video export uses the example's three lines in TikTok Sans Bold
  after draft serialization/reopening. More than 95% of fully opaque white pixels
  in the expected outlined glyphs match the exported frame. Frames outside the
  saved caption timing contain no caption pixels. Other tests cover source-byte
  preservation, positions, mixed font timing and Unicode fallback.
- The real text editor/preview components pass local Edge browser fixtures at
  1366×768, 1536×864 and 390×844. Checks include actual bundled font-face loading,
  selection/weight preservation, Save/reload, multiline copy, presets, drag/touch
  positioning, Unicode artwork, Wall advanced controls and no horizontal overflow.
- TikTok Sans Bold screenshots were visually inspected. Evidence is in ignored
  `.tmp/explore-text-fonts-browser/tiktok-sans-1366.png`,
  `tiktok-sans-390.png` and `tiktok-sans-preview-1366.png`.

Representative commands:

```powershell
npm --prefix worker run build
npx tsc --noEmit --incremental false
node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/explore/hook-remix-brand-prompt.test.ts lib/explore/remix-text-api.test.mjs lib/explore/remix-text.test.ts
node --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --test --test-concurrency=1 scripts/explore-text-fonts.test.mjs worker/dist/lib/carousel-manual-text.test.js
node scripts/explore-text-fonts.browser.cjs
```

These are local checks, not authenticated production acceptance. Deployment must
include website/public WOFF2 files and workers/TTF files before live users select
the added family. No production records or credits were changed by this follow-up.
