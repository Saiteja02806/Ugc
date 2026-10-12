# Carousel typography — 11 October 2026

The supplied brief replaces the heavy Inter Tight hook treatment with Inter
Medium. It applies to both Trending Carousel structures and their edit preview.
The brief's vertical-canvas examples inform typography at 1080px width; existing
square and 4:5 outputs retain their dimensions.

| Element | Size | Weight | Treatment |
| --- | --- | --- | --- |
| Hook | 72px | 500, hard maximum 600 | Centered, one block, 1.08 line height, white with thin black outline |
| Actual heading | 50px | 600 | Black on fitted white rounded pill |
| Body under a heading | 48px | 400 | White, distinct thought blocks |
| Short statement without a heading | 48px | 500 | White outlined text, no manufactured pill |

Body thoughts retain their 32px vertical separation. The single-hook and measured
overflow gates still reject extra paragraphs, overflowing text and orphan lines.
No new slide roles, asset sources, ratio, schema or paid generation call is added.

The browser and worker use identical bundled Inter variable font bytes. The
worker image installs that font and startup diagnostics request Inter Medium.
Structure 1 renderer v27 / planner v51 and Structure 2 renderer v14 / planner v24
identify this contract. Intentional edits adopt it; untouched saved outputs keep
their existing bytes. Versioned edit fingerprints invalidate older edited renders.

Deployment is pending. The website, generation worker and dedicated edit worker
must all be released before this can be described as active for users. Existing
saved carousels will not automatically acquire the new font.

Validation completed locally:

- Worker build and application TypeScript check passed; scoped ESLint had no
  errors or warnings.
- 88 renderer, copy-fit, planner and edit-job tests plus two renderer contract
  checks passed. Overflow fixtures were updated to exercise real Inter metrics;
  they still verify repair before acceptance when estimated width misses overflow.
- 36 isolated browser containment scenarios passed without console errors,
  including pointer edges, keyboard movement, resizing and long-copy rejection.
- Twelve actual raster exports (two structures, two ratios and three text roles)
  were generated and visually inspected. Heading pills, individual thought blocks,
  line spacing and white text contrast were clear over the bright test backdrop.
  These use synthetic backgrounds, not the reference photographs mentioned in
  the pasted brief. Artifacts are in `.tmp/carousel-inter-typography/`.
- The worker Inter asset SHA-256 matches the existing approved browser font:
  `4989b125924991b90d05b2d16e0e388c48f7d5bb8b30539bbf9c755278d0ccaf`.

Reproduce after `npm run worker:build` from the repository root:

```powershell
$env:FONTCONFIG_FILE = Join-Path (Get-Location) 'fontconfig/fonts.conf'
node scripts/check-carousel-inter-typography.mjs
```

The production worker image has not been rebuilt for this typography change;
font diagnostics and authenticated generation/edit acceptance remain rollout
checks. Other in-progress changes in this shared checkout were preserved.
