# Workflow edit font/reference audit

Incident UGC-UI-051-FONT-MATCH remains OPEN for exact source identification and hosted acceptance. Audit only: no application typography, saved draft, layout, provider or deployment changed.

## Verdict

**The selected bundled fonts render correctly in the isolated current editor and native exporter. An exact match to the supplied reference lettering has not been established.** These are separate conclusions. The heavier, rounded appearance of the first supplied crop differs visually from the cleaner-looking reference captions, but that crop does not reveal its saved font, weight, size, outline, output scale or render provenance. Do not assign it a font or root cause from appearance alone.

The current new-video-overlay default is Proxima Nova A Semibold, real weight600, white, black outline8 on the1080px coordinate scale. This superseded an earlier Poppins700 default in October27 context. Old saved Poppins/Arial/custom overlays deliberately keep their own styles; opening a historic edit does not convert it to Proxima. The prior addition was therefore implemented, but it is not a universal replacement of existing text.

## Scope reviewed

- Hook/Wall/Talking Head/demo share the video editor text types and preview component. `components/explore/format-text-overlays-editor.tsx` creates new overlays from `DEFAULT_FORMAT_TEXT_STYLE`; `worker/src/lib/explore-format-edit.ts` defines it. Preview is `components/explore/format-video-text-overlay.tsx`; export uses `worker/src/lib/explore-format-render.ts` and `explore-text-outlines.ts`.
- `explore-text-fonts.css` points Proxima600 to its WOFF2 and native export reads its TTF; both asset hashes are tracked in the font manifest. No synthetic Regular/Bold Proxima faces are offered.
- The separate slideshow editor uses `lib/explore/slideshow-text.ts` with Arial/Georgia/Courier choices and its own heading/body weights. The recent Proxima default was specifically a video-overlay change, not shared across every slideshow/Carousel text system. No slideshow/Carousel behavior changed in this audit.
- Source history: `docs/workflow-proxima-font-2026-10-27.md`, `docs/poppins-font-correction-2026-10-24.md`, Explore October24/27 typography entries, EX-50 and UGC-TEST-001. Context-memory, immutable-contracts and UI-clarity skills were read. Existing worktree changes, including concurrent renderer/layout work, were inspected and preserved.

## Evidence

1. `node scripts/explore-text-fonts.browser.cjs` PASS in an isolated headless disposable profile, outside the Windows sandbox. It executes actual editor/preview components, loads19real packaged font faces, explicitly verifies Proxima600 loading on1366/390 widths, and checks save/reopen. Also passes Poppins/TikTok, preset changes, mouse/keyboard/touch text positioning, emoji retention, saved styles and Wall advanced controls. This is not the user's personal browser or deployed Next/auth session.
2. `npm run worker:build` PASS, followed by `node --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --test scripts/explore-text-fonts.test.mjs`: **11/11 PASS** against the rebuilt current worker. Tests cover bundled hashes, distinct font rasterization, saved/legacy retention, real timed MP4 glyph/outline rendering, missing font rejection and source preservation.
3. `.tmp/font-match-audit/render.mjs` imports current worker source directly. It renders the exact reference wording “Computer Science students!! / This website is EVERYTHING” using Proxima600 (outline8, outline4 and round-join experiment), Poppins700 and explicit Arial Bold at the same size. Labels and gray comparison background are diagnostic artifacts; originals were not edited. It also renders “Only the first100...” and the job/book caption with packaged emoji. Actual current native format renderer produces a360x640 MP4 with decoded frame; inspected for intact glyphs and outline. Initial frame-extraction helper used an invalid `.5` FFmpeg argument; correcting it to `0.5` fixed the helper, not application code.

Comparison: `.tmp/font-match-audit/comparison.png`; decoded actual native output: `native-video-frame.png`; source metrics and manifest: `evidence.json`; current output path: `native-result.json`; logs: `browser.log`, `worker-build.log`, `font-tests-current.log`, `native.log`. Editor screenshots: `.tmp/explore-text-fonts-browser/proxima-preview-{1366,390}.png`.

## Visual interpretation and unresolved details

- At354px display width, outline8 scales to about2.62px total SVG stroke width; it is not8screen pixels. Font64 scales to about20.98px. Font size, cropping and final video compression matter when comparing apparent weight. The sample rows intentionally hold size constant; they are not fitted or distorted to claim a match.
- Poppins700 looks visibly heavier/wider in the controlled comparison than Proxima600. This supports the need to inspect a saved draft's actual style before declaring that the new default was used. It does not establish that the user's first crop is Poppins.
- Preview and native SVG leave line joins unspecified (SVG miter default). Rounded joins were tested as a diagnostic variant, but the circled letter defect was **not reproduced or attributed**. There is no evidence yet to justify changing every saved overlay's joins.
- The native sample and browser samples demonstrate usable selected-font rendering, not pixel-identical preview/export antialiasing or exact screenshot-font identification. No font metadata or original source-video caption configuration was supplied for the three references. Their exact family remains UNKNOWN. Production font responses, the particular saved edit behind image1 and its hosted render are NOT VERIFIED.

## Change receipt

Changed by this audit: this report and an append-only UGC-UI-051-FONT-MATCH entry/follow-up in `docs/ai-context/clear.md`; generated ignored artifacts under `.tmp/font-match-audit/` and refreshed existing font fixture artifacts. No application code edits, font/default substitutions, paid generation, uploads, production writes or deployment. Protected saved-font preservation is VERIFIED in tests; existing layout is untouched by source changes; exact reference match and production acceptance remain NOT VERIFIED.
