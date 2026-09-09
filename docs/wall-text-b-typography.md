# Wall-of-Text B typography

The approved B treatment is Arial Bold 700 at **52px** on a 1080 × 1920
canvas, with a **4px black outline**, white fill, **57.2px line height**, normal
word and letter spacing, centered alignment, and no shadow or background box.
The previous V12 treatment used the same Arial Bold font at 44px with a 3px outline.

New layouts use `wall-text-overlay-v13` and `wall-text-final-layout-v9`.
The generator remains `business-profile-wall-text-v9` to preserve existing
generation and feed contracts. The writer prompt only updates its stale font-size
description; this change does not introduce a different writing style.

The authoritative layout engine measures and reflows copy into 5–8 lines at
52px. It rejects overflow instead of shrinking the font. Browser preview and
worker rendering consume the same stored lines and font settings. Previous
layout versions keep their own rendering rules. Existing rendered MP4s do not
change when code is deployed; applying B to those requires a new render.

## Release order

1. Push the complete validated source to Git `main`, with automatic Vercel Git
   builds temporarily skipped while database prerequisites are pending.
2. Apply `20260908172213_apply_wall_text_b_52px_typography_v13.sql`. It extends
   the existing CHECK while allowing older app instances to write V12 rows.
3. Deploy that exact app revision to the production target with domain promotion
   skipped until the worker rollout finishes. B travels to the worker unchanged: an outdated
   worker must reject an unsupported layout instead of silently rendering it as
   Arial Regular through a legacy compatibility envelope.
4. Build and deploy the same Git revision to the active GCP worker services and
   jobs. Verify the native final-layout V9 contract, then promote the staged app
   to the production domains and restore automatic Git builds.
5. On `https://www.getugcpilot.com`, generate a new B creative and compare its
   browser overlay and exported MP4 at equal displayed sizes. Check all lines,
   the outline over light backgrounds, and the actual active worker version.

## Local verification

- `npm run test:wall-text`
- `npm run test:wall-text-typography-db`
- `npm run worker:build`
- `node --test worker/dist/lib/wall-text-render-spec.test.js worker/dist/jobs/render-wall-text-video.test.js`
- `node scripts/simulate-wall-text-v10-contract.mjs`
- `npm run build`

The simulation includes the exact 33-word casserole creative from the reported
production screenshot. It fits eight lines at 52px; the glyphs and 4px outline
remain inside the protected text area. Layout may choose different word breaks
from the hand-tuned comparison while retaining the approved B typography.
