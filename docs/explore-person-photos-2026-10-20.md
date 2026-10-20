# Hook and Wall person-photo inputs

Status: implemented and checked locally on 20 October 2026. Not pushed or
deployed. No paid video generation was performed.

## Result

The existing Choose image popover now distinguishes Person photos from Other
images. Person photos use one explicit Main photo followed by Supporting views.
The user can promote another photo without removing and uploading it again.
The Create panel previews the main photo and supporting count. Removing the main
photo promotes the next remaining selection. Batch uploads and model-specific
capacity limits remain in place.

The server validates the purpose with the existing trusted-reference and count
checks, before reserving credits. Person requests carry the ordered main and
supporting URLs in `personReference` metadata and explicit image-role instructions
in the actual provider prompt. Both ordinary dispatch and atomic batch admission
freeze the same roles. The worker's direct-prompt path preserves these
instructions. Other images and older requests retain their general-reference
behavior. Prompt-only and image+prompt requests remain valid without a video.

This does not introduce a trained identity, landmark/shape constraint, replacement
backend, or face-quality guarantee. It does not change the provider integration.
The separate unpublished source-edit/sound work must be reconciled before a
combined release. Saved person profiles are not implemented in this patch.

## Photo guidance

One clear, unobstructed front view is a usable starting point. Recommend three
useful views where the chosen endpoint supports them: front, slight left and
slight right, all of the same person. Three repeated front views do not provide
the same coverage. This recommendation is not a proven sufficiency threshold.

The image aspect ratio is not a photo-count requirement: no quota for 9:16 or
4:5. Face size, sharpness, lighting and unobstructed views matter to the proposed
input workflow. A waist-up photo is optional for body/clothing guidance when
creating a new scene. For changing a face in source footage, that footage already
supplies the body and clothing. Do not generate invented identity views and
describe them as additional evidence of the person's real facial proportions.

The collapsible guide is inside Choose image, above the selected-photo strip.
It uses a small local WebP loaded only when expanded. The generated examples
are marked as examples and cannot be selected or sent as user references.

## Library scope

The shared Explore reference list now positively filters `project_id` to
`explore-reference`, along with the existing ready/upload/image constraints.
The API applies that filter inside the authenticated owner's database query;
single-image reuse validates the same origin. Existing broad media lists remain
unchanged when no project filter is supplied.

Images from Studio, Characters, Carousel, slideshow backgrounds, and unclassified
legacy imports do not enter this reference picker. They are not deleted or
relabeled. Older files without reliable Explore-reference provenance remain in
Creative Assets; users can upload a desired reference through Explore.
Cache keys use `explore-only-v2` to avoid reusing a previously broad cached list.

## Validation

- TypeScript: `npx tsc --noEmit --incremental false --pretty false` passed.
- Scoped ESLint passed for the changed picker, guide, video workspace, API,
  role/prompt helpers, and media filtering files.
- The seven-file focused suite ran 198 tests: 197 passed; one was interrupted
  by a Windows `EPERM` file-read error, with no assertion failure.
  Re-running that affected UI file passed all 76 tests.
- After adding a database-filter regression test, the final reference-library
  and picker batch passed all 31 tests.
- Tests cover primary promotion and removal, disabled states, batch upload
  ordering and partial failure, Hook/Wall request roles with and without video,
  both queue paths, invalid purpose and prompt limits before billing, and
  preserving the owner filter and unrelated broad media-library queries.
- Local browser previews verified Hook and Wall Recreate, selected source
  video retention, the supplied three-photo multi-selection, main-photo
  promotion, guidance, and disabled generation in preview mode.

Logs: `outputs/person-reference-tests.log`,
`outputs/person-reference-ui-recheck.log`,
`outputs/person-reference-final-tests.log`.
Screenshots: `outputs/person-photo-ui/`.
These checks do not constitute authenticated production acceptance or a paid
facial-fidelity benchmark.

## Generated guidance asset

Built-in `image_gen` was used once for an illustrative fictional adult.
No user portrait was supplied as an image-generation reference.

App asset: `public/explore/guidance/person-views.webp`, 900 × 300, 20,686 bytes.
The 2.15 MB original is retained outside the public bundle at
`outputs/person-photo-ui/person-views-original.png`.

Generation specification:

> Use case: photorealistic-natural. Create an instructional triptych, 3:1 overall,
> with three equal square panels showing the same fictional adult woman around
> 30. Brown eyes, dark brown tied-back hair, dark gray crewneck, natural skin.
> Show front, approximately 35 degrees camera-left, and approximately 35 degrees
> camera-right. Head-and-shoulders framing, unobstructed face, soft even light,
> neutral pale gray background. No text, logos, watermarks, hands or accessories
> obscuring the face.

The final asset was resized/compressed for app delivery; no extra identity
images or test videos were generated.
