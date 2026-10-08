# Serif black box subtitles — October 8, 2026

The shared Talking Head + Demo subtitle option is `serif-box` / **Serif black box**, renderer version `serif-box-v2`. The user confirmed that workflow page availability should stay unchanged. This implementation is local and has not been pushed or deployed.

## Reference observations and correction

The supplied 29.09-second video was inspected across the clip, then frame by frame at its native 30 fps around “And if you use this.” The full phrase appears in dark grey. Each whole word smoothly brightens to white in spoken order; completed words remain white and future words remain grey. The phrase and black box stay fixed until the next phrase replaces them. This is a word fade, without a left-to-right fill, moving letters, or word scaling. The separate blue “Comment DORK” callout is outside this style.

The initial static Libre Caslon approximation did not match that behavior or the narrower letter shapes. Instrument Serif fits the reference proportions much more closely. At a reference canvas of 720×1280, the reference phrase measures about 292×45 ink pixels; Instrument Serif regular at libass size 61 measures 291×45 before weight adjustment. Its unadjusted strokes look thinner than the reference. The corrected renderer uses a 0.3-pixel same-colour stroke at that size, scaled with the font. Both fill and stroke fade together, retaining the serif's shapes and contrast. This is a visual match inferred from rendered frames, not proof of the original editor's font or weight setting.

The unmodified [Instrument Serif regular font](https://github.com/google/fonts/tree/0b58fb370093f9a9f4ff785d94405710b79de67c/ofl/instrumentserif), OFL license and source/hash provenance are bundled under `worker/src/assets/fonts/subtitle-serif-box`. Existing worker Docker asset copying includes this directory. Font selection and unsupported-glyph failures are checked before accepting a measured render.

## Rendering

`worker/src/subtitles/serif-box.ts` measures actual libass ink, including the stroke. It uses sentence case, single-line phrases, a solid black rectangle, and mildly rounded corners. At 720×1280 the box has approximately 15-pixel horizontal padding, 86-pixel height, and an 11-pixel corner radius. A shared baseline and fixed line height avoid vertical shifts when a phrase has no descenders. Bottom places the box center at 75% of frame height, matching the observed reference; Middle and Top use the existing position controls.

Reference phrases often contain five or six words. Grouping now allows up to six words and 2.8 seconds, constrained by measured width, punctuation, and real pauses. It preserves every word and provider interval. It does not hard-code the reference script's phrase boundaries. Very long individual words fail the safe-area check.

ASS transforms fade each entire word from `#555555` to white within its supplied start/end interval, capped at 240 ms, with an eased ramp. These parameters approximate the observed fade; they are not recovered original settings. Completed words hold white through short speech gaps; long gaps split phrases. The black box stays opaque and fixed. Standalone generation and Explore finishing use the same renderer.

The shared registry validates this style across the picker, saved drafts, worker and recovery. Additive migration `20261007193641_explore_serif_box_subtitles.sql` extends the subtitle CHECK constraint. A future authorized release must apply it alongside matching app and worker changes.

## Previews and validation

The corrected eight-second example and poster are `public/subtitle-previews/v2/serif-box.mp4` and `.jpg`. Its versioned URL avoids reusing the first approximation. The seven other styles retain their existing v1 media and hashes. The central v1 manifest records the new serif example's source, transcript, ASS and video hashes, renderer version, and v2 media URLs. All eight reuse the frozen source/transcript and preserve identical AAC packets.

To generate an approved replacement into a fresh version directory and update the existing manifest:

```powershell
npm run worker:build
node scripts/build-subtitle-previews.mjs public/subtitle-previews/v2 .tmp/serif-box-preview-v2 serif-box public/subtitle-previews/v1/manifest.json
npm run subtitles:test
```

Use a fresh work directory and destination media paths. The builder refuses to overwrite videos or posters and writes the manifest last.

Verification covers actual rendered pixels, whole-word brightness changes, grey future words, completed-word persistence, speech gaps, fixed box geometry, rounded corners, safe areas, all placements, both opening/demo segments, shared preview audio, picker validation, SQL acceptance, and finishing/recovery regression checks. A local comparison artifact in `.tmp/serif-box-correction/reference-vs-corrected.mp4` shows the supplied reference above the production renderer; observed fade windows in that comparison are a fixture only. Production uses transcript-provider word timings.

Production acceptance remains pending an authorized deployment at `https://www.getugcpilot.com`.

October 8 correction validation: worker compilation and scoped ESLint passed. All **189** offline caption/finishing regression checks passed, including the updated preview pixels. The complete `npm run subtitles:test` entry point stops at app type checking because `components/explore/format-workspace.tsx:194` passes a direct mode setter to a source selector expecting React's state-setter signature. That separate workflow file was not changed for this correction. The worker and the same regression test list were therefore run independently, with their result retained in `.tmp/serif-box-correction/regressions.log`.
