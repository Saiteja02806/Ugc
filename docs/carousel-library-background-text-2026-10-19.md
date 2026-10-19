# Body copy lost after replacing library backgrounds

Implemented and verified locally on 19 October 2026. Worker rollout and signed-in
production acceptance remain pending; no saved production edit was changed.

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
