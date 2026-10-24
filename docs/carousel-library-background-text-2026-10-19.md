# Body copy lost after replacing library backgrounds

Implemented and verified locally on 19 October 2026. The dedicated production
worker was repaired and the affected edit verified on 20 October 2026; see the
recurrence follow-up below. Historical local-only notes describe the earlier gate.

## 20 October recurrence: deployment-target omission repaired

The fresh edit `b464c4e1-dc75-456d-93b0-c28af2fa0994`, saved at 05:05 UTC,
retained all six texts and new backgrounds but still used
`social-single-statement-hook-inter-medium-v27-normalized-edit-v3`.
Its completed job was `12792926-3f2e-417b-9e06-c472ed49564d` on `carousel-edit`.

The prior PR #75 release deployed the fix to video-render targets, but the
application routes this job to `GCP_CAROUSEL_EDIT_TASK_URL`. The actual dedicated
service `ugc-carousel-edit-worker` remained on `release-771878a1` with image
`sha256:3721ecb87b941637970cb4cae1f800df6662dd470a9d03d2a83fd0cd8bd3806a`.
This is the confirmed reason the same bug recurred after the previous release.

The dedicated service now uses tested source `fac61da3` and immutable image
`sha256:96afdde1f42c980281c3b68182ad91874c41c997d9d20219bd472f8d0f15a36d`.
Revision `ugc-carousel-edit-worker-bodycopy-fac61da3` is READY and receives 100%
traffic. Runtime configuration, private ingress, scaling and job/queue scope were
preserved. A staged revision with zero traffic reports Retired/Ready until it is
activated; the release verified the actual promoted revision and traffic.

The signed-in production editor reproduced the blank slide with its nonempty
copy field. Saving that same unchanged edit produced revision 2, completed job
`ed04de7b-f9ea-4e8c-80e2-1d7c6fe49d6e`, and renderer
`social-single-statement-hook-inter-medium-v27-normalized-edit-v4-body-copy`.
Slides 2 and 3 were visually checked in Trending. All six actual output images
were downloaded, checked as 1080×1350, hashed and visually reviewed with visible
text. Browser access was then disabled; remaining slides were checked from these
production bytes. No AI model generation, quota decision or scheduling occurred.

Future release checks must follow the implementation job's queue to its actual
service and verify that service's deployed SHA/image/traffic. A video-render
deployment is insufficient for Carousel edit acceptance. Always read the fresh
job's output renderer version and inspect its saved slides before declaring fixed.

Receipt: `outputs/carousel-edit-worker-repair-2026-10-20.json`.
Screenshots and montage: `outputs/carousel-body-copy-before-2026-10-20.png`,
`outputs/carousel-body-copy-after-2026-10-20.png`,
`outputs/carousel-repair-all-six-2026-10-20.png`.


## Confirmed cause

The affected owned edit `d41581a9-a0e2-42f6-8058-fa96eaf179ef` has six changed
backgrounds and nonempty copy on every slide. Its Structure 1 normalized plan
stores slides 2–5 as `body_only` and slide 6 as `cta_takeaway`, with the copy in
`body`/`subtext` and no semantic heading. The saved slide/editor transport stores
that same body copy in the legacy `headline` field, with empty `subtext`.

`applyEditToPlannedSlide` compared submitted `subtext` against the normalized
plan's body. An empty transport field differed from the nonempty plan, so the
worker incorrectly treated it as deleted body copy and set body and headline to
null. The hook has a separate mapping, which explains why only its text survived.
The library picker and save payload retained the text; changing backgrounds
exposed a worker mapping bug by forcing a new render.

## Correction

- Resolve body-only copy from current nonempty `subtext`, then `headline`, as
  the editor preview does. Preserve changes to either representation and CTA.
- Advance the Structure 1 edit renderer fingerprint to
  `normalized-edit-v4-body-copy`, preventing reuse of the previous blank output
  when the edit is rendered again. Ordinary unchanged original renders and
  Structure 2/manual typography keep their existing behavior.
- No schema, credit, generation, image ownership, slide order or library UI change.

## Verification

- Worker TypeScript build passes.
- All 16 render-edit worker tests pass, including all six background replacements
  against a realistic normalized body-only plan and single-slide replacement.
- A six-slide regression executes the real image renderer and checks visible
  text pixels in every saved output. It also checks modified legacy/canonical
  body copy and the final CTA. Restoring the old mapping makes this test fail;
  the compiled corrected worker was restored after that controlled check.
- All 14 image upload/save/ownership checks pass.
- The actual editor browser suite passes: six fresh Structure 1 slides without
  manual text styles, All slides, six selected library images, all six texts in
  the library preview and after Use, and Cancel without changing saved content.
  Existing Save/reopen, styling, custom overrides and corner placement also pass.
- Scoped lint has no errors; one existing unused `_fingerprint` warning remains.

Evidence: `.tmp/carousel-background-text-worker.log`,
`.tmp/carousel-background-text-before-fix.log`,
`.tmp/carousel-background-text-browser.log`, and
`.tmp/trending-carousel-text/six-library-backgrounds-body-copy.png`.

## Rollout boundary

Deploy the compatible render worker before describing this fix as live. A
website deployment alone cannot correct this mapping. Existing saved image
bytes are immutable: reopen/save the affected edit after rollout to render its
retained copy with the new fingerprint, then verify on the production domain.
Do not silently replace already scheduled snapshots or rewrite source copy.
