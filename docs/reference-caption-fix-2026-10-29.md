# Reference caption font and outline correction

Status: implemented and locally verified for workflow video text; UGC-UI-051-FONT-MATCH remains OPEN for user visual/hosted acceptance. No push or deployment. Exact original font identity is UNKNOWN; this is the closest measured bundled-font treatment, not a promise of screenshot-identical lettering.

## Result

The existing Text preset selector now offers:

- **Reference · Social caption:** TikTok Sans Bold700, white, black outline6 at1080px, round joins, line height1.2. Closest tested bundled candidate for the Computer Science reference. New manually added video text and unstyled generic Remix use it.
- **Reference · Classic caption:** DM Sans Bold700 with the same outline/spacing; closest tested bundled candidate for Part time job / Coloring Books.

The new presets retain exact authored words, timing, position, font size and width when explicitly selected. Existing size/position/outline controls remain editable. They do not move text to a guessed screenshot location or force identical sizing across different source aspect ratios. Existing saved font/style choices stay authoritative. Existing Bold white and Snapchat Classic remain available. New automatic Hook plans freeze `textStyleVersion:1`; old plans lacking it keep their historical Proxima styling. Source-specific Wall layouts remain authoritative; applying the new preset in Edit is explicit. Slideshow/Carousel typography is not replaced.

The preview now draws the same packaged ASCII glyph paths as the native exporter for these two reference treatments at700. It no longer relies on browser font rasterization for that supported lettering. Glyph data is generated from the already packaged licensed faces, includes their SHA256 bindings, and is185002bytes before compression. Other fonts, weights and non-ASCII runs retain their established font-rendering paths. Emoji codepoints and existing bundled artwork are retained; emoji artwork is not an exact copy of the screenshots' platform artwork.

## Evidence and limits

Compared all19 bundled faces/weights plus explicit Arial against cropped white glyph masks from supplied screenshots. The first Computer Science line favors TikTok700 (normalized binary IoU0.572 versus Proxima6000.188); Part time job favors DM Sans700 (0.681). These are candidate-ranking heuristics after glyph bounding-box normalization, not font identification or whole-image accuracy scores. Other cropped lines are less decisive: the AI-caption crop ranks Inter7000.280 and TikTok7000.270; second Computer Science line ranks Roboto Condensed7000.263 and TikTok7000.253. Thus the evidence does not establish one exact original font across all references. We chose coherent closest treatments rather than claiming all three screenshots have one proven font.

After initially changing only font/outline, actual preview-versus-export checks exposed a real difference: browser text rasterization versus worker glyph paths gave white glyph IoU0.790–0.864; strict dark-outline coverage within1pixel was0.325–0.613. Shared glyph geometry corrected that discrepancy rather than relaxing the final checks.

Final real360x640 browser/native MP4 comparison:

| Caption | Raw white glyph IoU | White coverage within1px | Black outline coverage within1px |
|---|---:|---:|---:|
| Computer Science |0.9646|1.0000|0.9723|
| Part time job / books |0.9522|1.0000|0.9701|
| AI edit videos |0.9519|1.0000|0.9888|

Final test asserts raw white IoU>.94, bidirectional1px white coverage>.98 and black outline coverage>.96. These measure native compressed video versus actual preview at equal dimensions; no screenshot resizing/stretching is used in the parity test. Subpixel antialiasing and MP4 compression still prevent byte-identical pixels. Native and browser comparison frames visually inspected.

Artifacts: `.tmp/reference-caption-parity/reference-vs-updated.png` (supplied cropped screenshot left / new native caption right), `{social,classic,ai}-preview-vs-export.png` (preview left / decoded MP4 right), `results.json`, and real MP4 paths recorded there. Supplied images were used as read-only reference evidence; no source reference video was regenerated. Emoji differences remain visible in the comparison.

## Scope contract and sources

User explicitly authorized replacing the recent initial treatment with a closer reference match, overriding the October27 Proxima initial-style choice for new text. Edit boundary is video-caption typography, native glyph geometry and focused verification. Preserve saved edits, original words/timing/audio/position, source/identity binding, existing layout/controls, server ownership and publishing. No migration, new dependency, configuration or provider change. Website and worker must be released together because older renderers do not understand the new explicit preset values.

Consulted root AGENTS instructions, nonnegotiables, relevant Explore typography/idle/context entries, UGC-UI-051/UGC-TEST-001/EX-50 history, prior font audit and Proxima/Poppins receipts, current UI/worker callers, schema/parser and tests. Read context-memory, immutable-contracts, UI-clarity and regression-gate skills, installed Next font guide and React best-practices checklist. Preflight script passed. Large historical context reads in the earlier audit were truncated; targeted typography sections were read separately, not represented as a fresh full audit of unrelated history.

## Files changed in this implementation

- `components/explore/format-text-overlays-editor.tsx`: existing preset options and new overlay initial treatment.
- `components/explore/format-video-text-overlay.tsx`: shared outline join and reference glyph preview, preserving legacy text placement/rendering.
- `worker/src/lib/explore-format-edit.ts`: validated preset variants, explicit reference style, shared layout outline join; original legacy style retained.
- `worker/src/lib/explore-text-outlines.ts`: same reference paths/outline joins in native PNG/video export.
- `worker/src/lib/reference-caption-paths.ts`, `reference-caption-glyphs.json`: new packaged shared path data and renderer.
- `worker/src/lib/automatic-hook-text.ts`: versioned new Hook initial treatment; historical plans unchanged.
- `lib/explore/automatic-hook-text-plan.ts`: freeze style version on new Hook jobs without changing existing recovered plans, prompt or model configuration.
- `lib/explore/remix-text-edit.ts`: new generic unstyled captions use the reference style; existing overlays and source-specific Wall layouts retain precedence.
- `scripts/prepare-reference-caption-glyphs.mjs`: reproducible local font-path asset builder.
- `scripts/reference-caption-style.test.mjs`, `reference-caption-parity.browser.cjs`: new saved-style/hash/geometry and real export parity tests.
- `scripts/explore-text-fonts.test.mjs`, `explore-text-fonts.browser.cjs`, `hook-remix-emoji-render.test.mjs`, `lib/explore/remix-text.test.ts`, `automatic-hook-text-plan.test.mjs`: update new-default expectations and freeze/recovery assertions; old explicit-font checks retained.
- This receipt and append-only `docs/ai-context/clear.md` / `EXPLORE_CONTEXT.md` entries.

Some listed shared files already contained unrelated worktree changes (Wall regions, text fixes, prompt work); only the described font hunks belong to this task. Those changes were preserved. Rollback only this task's font/preset/version/path hunks plus its new files; do not revert entire shared files. Newly saved reference presets require continuing renderer support.

## Verification

- `npm run worker:build` PASS after shared path addition.
- Combined font/editor/draft/native-export/reference/automatic-plan/Remix/emoji clip+composition suite: **63/63 PASS** (`.tmp/font-match-audit/completed-tests.log`).
- `node --test worker/dist/lib/automatic-hook-text.test.js worker/dist/lib/svg-glyph-path.test.js`:26/26PASS.
- `node scripts/explore-text-fonts.browser.cjs`: PASS actual editor save/reopen, new defaults, both reference presets, old Proxima/Poppins/other faces, desktop/mobile controls and pointer/keyboard/touch movement. Uses local disposable headless browser, not the user's browser/session.
- `node scripts/reference-caption-parity.browser.cjs`: PASS actual React preview, real native MP4 export/decoding, emoji and strict pixel/outline tolerances across all3samples. This is isolated render acceptance, not hosted auth/provider acceptance.
- Scoped ESLint and diff checks pass. Full application TypeScript check is **FAILED outside these caption files**: `lib/explore/starting-frame-reference-source.ts` lines23/24 and its test line27 report possibly undefined videoFile. Those files are independently modified in the shared worktree. No unrelated fix or config suppression was introduced.
- No full production-build pass claimed; full app typecheck currently blocks combined acceptance. Worker build and actual component bundles completed. No paid generation, production mutation, personal-browser control or deployment.

Intermediate test failures were corrected rather than counted as passes: an outdated font/outline expected value after the default change; a too-broad nested-SVG locator; a fixture selector expecting only one nested g after path markup was added; and the pre-path preview/export overlap failure described above. No incident was marked globally fixed from those attempts.

## Protected behavior status

VERIFIED locally: words/explicit newlines, saved styles/blank drafts, legacy automatic-plan recovery, new version freeze, text timing and position, native clip/composition text output, packaged font hashes, mobile/desktop edit controls and glyph parity within stated tolerances. No changes to video source, identity roles, schedule payloads or provider execution by this patch.

NOT VERIFIED: exact original screenshot font, whole-image match including platform-specific emoji, user visual acceptance, production font/worker rollout, authenticated hosted save/export. Existing saved styles change only when the user chooses a reference preset. UGC-UI-051 remains OPEN for those acceptance items; no exact-match claim is justified by a screenshot alone.

## Typecheck and final render verification follow-up — 29 October 2026

The three earlier TypeScript errors are resolved in the current shared worktree: the source registry and its test now check `typeof videoFile === "string"` before regex/slice access. Those guards were already present when this follow-up began; this task verified them rather than reapplying or claiming authorship of another working-tree change. Fresh full-application `tsc --noEmit --pretty false` PASS. No application-code edits were needed in this follow-up.

Rebuilt worker PASS; four actual source-registry tests PASS (published Wall imports resolve correctly, retired IDs stay unavailable, Talking Head first-frame hashes match, no unnecessary MP4 decode during prepared-frame lookup). Combined caption/font/editor/Remix/native export suite63/63PASS. Scoped source/font lint PASS. Both isolated headless editor and fresh native MP4 comparison fixtures PASS again. Save/reopen, existing fonts, positioning, exact words and both presets retained on desktop/mobile.

Final fresh render measurements reproduce the previous result: Computer Science white glyph IoU0.9646 / black-outline1pxcoverage0.9723; job/book0.9522/0.9701; AI-caption0.9519/0.9888. White glyph bidirectional1pxcoverage1.0000 for all three. These are **preview-versus-export** metrics, not reference-match percentages. Reference-versus-updated comparison regenerated from the supplied images and current native renderer; original glyph identity and platform-specific emoji remain unconfirmed/different. Reviewed actual desktop/mobile editor screenshots and all three fresh preview/export pairs. No exact screenshot-match claim, hosted acceptance, personal-browser control or deployment.

Follow-up files changed: this receipt and appended entries in `docs/ai-context/clear.md` and `EXPLORE_CONTEXT.md`; ignored local artifacts refreshed. Logs: `.tmp/font-final-verification/{typecheck.log,typecheck-clean.log,worker-build.log,source-registry-tests.log,font-tests.log,editor-browser.log,export-parity.log,lint.log,preflight.log}`. New fresh MP4 paths and metrics are in `.tmp/reference-caption-parity/results.json`; reference comparison is `reference-vs-updated.png`; editor screenshots in `.tmp/explore-text-fonts-browser/reference-{social,classic}-{1366,390}.png`. Protected saved-font/source/timing contracts VERIFIED locally; hosted acceptance and exact original-font identity remain NOT VERIFIED. No full production build was run in this follow-up.

The standard full-project typecheck completed with exit0. The additional `--incremental false` run also returned exit0 with an empty diagnostics log in the final session result. It took longer and remained silent while running; an interruption was attempted at the final poll, but the tool's completed result was exit0. Both compiler commands and all stated render checks completed successfully.
