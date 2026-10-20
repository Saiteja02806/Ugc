# Editorial subtitle style — reference research and isolated proof

## Recommendation

**Updated after user review:** the first editorial proof was rejected for excessive spacing and a poor match to the reference. Correct the compact composition in isolation before treating **Editorial serif** as a usable fourth preset. Keep the existing three presets. A compact modern highlight treatment is the recommended general-purpose alternative; editorial typography is an optional expressive style. Neither new treatment is a selectable preset yet.

The reference's character comes from a large, heavy italic serif keyword, smaller supporting words, asymmetric composition and a blue/teal accent. It is feasible with the existing subtitle rendering stack; changing recognition or alignment models is unnecessary.

The supplied screenshot is a still. It does not establish the exact font, animation, timing behavior, masking or editor used. The sample below is an original treatment inspired by its typography, not a claim to reproduce its unseen motion. The reference has overlapping words and a faint lower line; preserve the typographic hierarchy while improving spacing and contrast.

## Fit with this repository

`worker/src/subtitles/captions.ts` currently emits a centered Arial phrase using one size, with variants for outline, box and active-word colour. The proposed style needs a separate layout planner for keyword/support blocks. It is more than selecting a new font or changing the existing size.

ASS supports independent positioning, font/size/weight, colour, opacity, movement and animated transforms. The existing FFmpeg/libass path can implement readable multi-size text, timed reveals, active-word colour changes and a small keyword scale entrance. Use font scaling for motion rather than repeatedly changing font size. [Official Aegisub ASS tag documentation](https://aegisub.org/docs/latest/ass_tags/), [libass repository](https://github.com/libass/libass).

| Approach | Fit | Recommendation |
| --- | --- | --- |
| ASS + existing FFmpeg | Reuses current renderer, timing data, audio handling and cancellation. Covers this design's typography and simple motion. | Use first. Build one bounded template family, not an unrestricted design editor. |
| Raster text masks + FFmpeg overlay | Useful for precise gradients, custom word wipes or effects beyond ASS. Adds layer preparation, caching and compositing work. | Consider only if the first preset requires those effects after review. |
| Remotion | Strong React-based composition option, but adds another rendering runtime and its renderer has commercial license conditions. The separately licensed captions utilities are not the full renderer. | Unnecessary for one extra preset. Do not import an entire caption app or presume the renderer is unrestricted MIT. [Remotion license](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md), [pricing and eligibility](https://www.remotion.dev/docs/license/pricing). |

Playfair Display is a suitable approximate typeface, not an identification of the reference font. Its Open Font License permits bundling with the required copyright/license notice and imposes reserved-name conditions on modified fonts. [Google Fonts source and license](https://github.com/google/fonts/blob/main/ofl/playfairdisplay/OFL.txt).

## Isolated proof actually rendered

Research files are under Git-ignored `.tmp/subtitle-editorial-research/`; no production or pilot style enum, app component, package manifest or worker handler was modified.

- Input: the preserved, approved 6.016-second 720×1280 SaaS clip. Its SHA matches the originally recorded input SHA.
- Recognition/alignment: the existing hardened transcript, all 18 display words, four phrase pages. Zero provider requests and no changed acoustic timestamps.
- Emphasis: curated indices for this sample (`SaaS`, `marketing`, `time,`, `check`). This proof does **not** establish automatic semantic keyword selection for arbitrary videos.
- Typography: static weight-500 upright/italic and weight-900 italic instances derived from Playfair Display. The modified research family was renamed `UGCPilot Editorial Study`, and its OFL notice was retained. FFmpeg logs confirm selection of the intended font files.
- Rendering: a large italic keyword, smaller supporting text above/beside/below it, a restrained teal active word, off-white completed text, and a 94% → 100% scale entrance limited to 100 ms. Words reveal at their saved starts and remain as phrase context until the cue ends. No word is rewritten or omitted.
- Palette: light text for this blue-shirt footage. A dark navy/teal variant suits brighter backgrounds like the reference. Palette selection is still a product decision, not automatic scene analysis.
- Validation: 144 video frames, 720×1280 dimensions, 6.016-second container duration, identical copied AAC packet hash and unchanged preserved-source SHA. The encoded video stream reports 6.000 seconds versus the original probe's 6.016 seconds; the 16 ms mux difference is within the existing renderer tolerance. No acoustic offset was fitted or applied.
- Visual inspection: frames at active and completed phrases showed readable words below the face; the 4.5-second pause was caption-free. These frame checks do not replace a person reviewing motion and speech together.

`editorial-preview.mp4`, `captions.ass`, `render.log`, `verification.json`, extracted frames, font license/provenance and the research scripts remain in that directory. A review MP4 and representative frame were copied to the chat visualization directory. A font-tools package was installed only into this research directory, not the application or the evaluated alignment venv.

The font sources were downloaded from the official Google Fonts repository at commit `8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5`. Original font hashes:

- Italic: `a5e26dc5e2e77fb2803a0bf02fd4f81ee136ec8dea863ccdb0c59a263b21378b`
- Upright: `c40f2293766a503bc70cce9e512ef844a4ccb7cbcde792fe2ea31d191917d8d6`

The Google Fonts commit and original license hash are also recorded in `font-provenance.json`. Instancing/renaming is reproducible with the isolated fonttools 4.60.1 package. These assets are not yet included in any deployed image.

## Implementation boundaries for the preset

1. Use the same persisted timed transcript as every other style. Selecting Editorial serif must not buy another transcription, realign unchanged audio or edit recognized words. Style motion is bounded inside saved cue/word intervals; captions disappear during long pauses.
2. Make layout deterministic from phrase tokens, keyword index, frame dimensions, font metrics and placement. Use two or three bounded arrangements: lead/hero/side words, hero/support line, and short phrase. Keep normal reading order and every token.
3. Define automatic emphasis conservatively: select one eligible content word with a transparent deterministic policy and allow a later user override. It is a typography choice, not permission to rewrite speech. Long names or phrases must trigger a fitted arrangement; if none fits, show a clear fallback notice and use Clean while retaining the requested style in diagnostics.
4. Test actual painted font bounds and overlap at the render size, including italic overhang, punctuation, long words and short words. Pango measurements and ASS text sizing can differ; a passing text-width estimate alone is insufficient. Reserve margins and existing-overlay space; do not claim automatic face avoidance.
5. Keep a small light/dark palette choice and top/bottom placement. Faint secondary text must remain readable on real footage. Limit large emphasis and motion so fast speech does not flicker or cause overlapping phrase blocks. Do not copy the reference's overlap as a default.
6. Add the fourth style only to the isolated pilot first, with required font assets/notices and cache/render versioning. Regression-check that the existing three outputs and audio behavior are unchanged. SRT/VTT exports retain words/times, not this burned-in visual design.
7. Validate portrait, landscape and square footage, fast speech, long words and the supported language policy. This first proof is portrait only. The production runtime/auth/persistence gaps in [the readiness review](subtitle-integration-readiness-2026-10-01.md) remain separate requirements.

This research establishes technical feasibility and a concrete sample. It does not mark the fourth preset or production integration complete.

## Follow-up: rejected preview and new footage

The user supplied `C:/Users/chund/Downloads/Woman_talking_about_phone_app_20261001171200.mp4` and repeated the typographic reference still. The file has a 10-second, 240-frame, 720×1280 video stream and a 10.027-second container. Representative frames across the clip show no subtitle overlay. The phone raised later in the clip occupies part of the lower caption area; a lower caption can obscure the phone display. These are frame-based visual observations, not an independent speech or timing assessment.

The first preview had several concrete design problems:

- The standalone planner used Pango text dimensions to position separate ASS word events. With the same research font, size, weight and italic settings, a black-background libass probe measured `SaaS` at approximately 290 painted pixels against the planner's 409-pixel width estimate. `marketing` painted approximately 408 pixels against the 574-pixel estimate. These are ink bounds at a fixed antialias threshold, not typographic advance widths, but the discrepancy is large enough to explain the excessive reserved space.
- Supporting words were positioned independently with additional gaps. Rendering a contiguous supporting phrase lets the final renderer shape its normal spacing consistently.
- A word-at-a-time reveal left much of the asymmetric layout temporarily empty. Phrase context with word highlighting is a separate presentation choice and needs motion review before adoption.
- The first proof used different background contrast, curated emphasis and placement. Its font was an approximation; the screenshot alone still does not identify the exact original font or motion.

A second **still-only** comparison was rendered on the newly supplied footage at 2 seconds with the wording `If the first thing you do` from the image. This is a typography study, **not a transcription of that video**. The image explicitly labels this distinction. No OpenAI request or alignment run was made.

- A: compact editorial — weight-900 italic keyword, weight-500 italic lead, closely grouped side words. Uses the same Playfair-derived research family, a larger visible keyword, and light/blue text for contrast on this footage.
- B: modern highlight — static weight-800 Inter Tight instance, two compact lines, one blue keyword and a restrained outline. The existing repository font was instanced only in the scratch directory, renamed for the study, with its OFL notice copied alongside it.
- Both images were rendered by FFmpeg/libass rather than a separate mockup renderer. Visual inspection confirmed compact grouping and no word overlap on this particular six-word arrangement. The new source SHA remained `a4ca0d420d3697faac29dfba3f3b4b51c6771e9f3fc71ff36782d6a3c240b311`.

Evidence and reproducible scratch scripts: `.tmp/subtitle-style-review/{font-metrics.json,study-verification.json,design-comparison.png,probe.mjs,compare.mjs,prepare-modern.py}`. The earlier rejected preview is preserved separately. This follow-up adds no production code, model changes, dependencies in package manifests, selectable styles, or application wiring.

**Decision:** correct the editorial layout rather than infer that the overall style is unsuitable from a faulty preview. Keep modern highlight as the proposed default for varied speech and editorial as a curated optional preset. Before either is integrated, validate actual painted bounds, long phrases and keywords, cue transitions, face/product placement and full synchronized playback. A static study does not establish those properties. The production readiness gaps remain unchanged.
