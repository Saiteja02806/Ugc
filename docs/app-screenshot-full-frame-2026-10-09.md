# App screenshot ratios and full-frame slideshow rendering

## Previous behavior

Settings accepts JPG, PNG and WebP images up to 25 MB without requiring a portrait ratio. Upload verification reads the original dimensions and stores the original file; it does not convert screenshots to 9:16. Production currently has ready landscape and portrait app screenshots.

The inspected production deployment, commit `4adfe024e432cda25983dd44a434229464a6d378`, matches the preceding local upload, Settings and Structure 2 renderer code. A product screenshot is contained within a padded foreground over a blurred, dimmed duplicate. On a 1080 × 1350 slide:

| Source ratio | Previous sharp screenshot area |
| --- | --- |
| 16:9 | 984 × 554, centered with approximately 398px above and below |
| 4:5 | 960 × 1200, centered with 60px horizontal and 75px vertical padding |
| 9:16 | 675 × 1200, centered with approximately 203px horizontal and 75px vertical padding |

The complete screenshot is preserved, but a landscape source occupies only about 41% of the slide height. Settings thumbnails contain the entire source; the screenshot picker in Edit uses cover thumbnails. The previous changed-slide editor preview approximates the padded screenshot and blurred background.

## Owner-confirmed change

The owner chose proportional zoom to fill the slideshow slide instead of leaving most of a landscape product slide as background. Structure 2 product rendering now uses a centred `cover` crop. The live editor uses the same single full-frame source image. The preceding inset foreground, blurred duplicate and preview-only border have been removed.

| Source ratio | New behavior in a 1080 × 1350 slide |
| --- | --- |
| 16:9 | Scales to 2400 × 1350; crops 660px from each side |
| 4:5 | Fills 1080 × 1350 exactly |
| 9:16 | Scales to 1080 × 1920; crops 285px above and below |

These crop numbers describe the diagnostic source dimensions. The resulting image is proportional and fills the slide without blurred padding. Source uploads remain intact. The renderer version is `story-native-full-frame-product-inter-tight-v13`; prior saved render bytes remain immutable. Newly generated product slides and changed-slide edit renders use this composition after deployment. Upload validation, Settings source previews, source eligibility, non-product background crops, text rules, ownership and scheduling are unchanged.

## Validation and evidence

- Six new renderer pixel checks cover 16:9, 4:5 and 9:16 sources in both 4:5 and square output formats. Every case failed against the preceding blurred-background composition and passes against the proportional centre crop. Checks compare the uncovered perimeter with the expected sharp source crop.
- All 25 scoped worker renderer, text placement, render-spec, generation guard and edited-slide reuse tests pass.
- All 12 upload, Settings, editor and Structure 2 renderer contract tests pass.
- Web TypeScript, worker compilation, scoped ESLint and whitespace checks pass.
- Local renders were visually inspected. Before/after landscape proof: `.tmp/app-screenshot-ratios-20261009/landscape-before-after.png`. Three-ratio proof: `.tmp/app-screenshot-ratios-20261009/comparison-zoomed.png`. Original comparison: `.tmp/app-screenshot-ratios-20261009/comparison.png`. Numeric measurements: `.tmp/app-screenshot-ratios-20261009/measurements-zoomed.json`.

This is a local implementation. No deployment, production screenshot replacement, or authenticated production visual acceptance was performed. The examples are synthetic app screenshots passed through the actual compiled renderer.
