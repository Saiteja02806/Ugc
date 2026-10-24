# Hook starting-frame preparation: local UI and contract review

The earlier code-only review is superseded by the local browser walkthrough
below. Browser access became available on 21 October. These are actual product
components in a development-only fixture, not production acceptance or a paid
generation. The fixture substitutes a clearly labelled public sample portrait
for a completed image job and disables video submission.

## Reviewed steps

1. Recreate and actual first-frame extraction: gated preparation path preserves
   the canonical reference/draft scope; the normal workflow stays separate.
2. Person selection: reuse the existing owned-influencer history and person-photo
   chooser. Main/support order remains explicit. Accepted batch results survive
   partial upload failures; a warning does not block saving valid photos.
3. Image directions: scene and person roles remain separate from animation.
   Source/photo/image edits invalidate prior still-image approval bindings.
4. Motion directions: Hook 15 now previews eight seconds, preserving its two
   takes and deliberate cut. Other previews remain four seconds. Sound starts
   OFF. Editing motion or sound does not invalidate a valid still image.
5. Save and close: pending uploads still block saving, but dismissal works and
   invalidates late callbacks. The saved preparation remains browser-scoped.
6. Create image and handoff are now connected: the dedicated owned job displays
   its result, and Use as starting frame stores approval and returns that image
   to the existing video form. That form says Starting frame, selects Seedance
   2.5, retains the motion directions, duration and explicit sound choice, and
   requires a separate Generate video action. ReAPI receives the first_frame
   role, not a generic appearance reference. No source clip or portraits are
   attached to animation. Server admission checks ownership and completed-job
   provenance before credits.

## Browser walkthrough

Checked desktop 1280×720 and phone 390×844 with the real components. Captures
are saved under `outputs/hook-starting-frame-ui-2026-10-21/`:

- `01-recreate.jpg`: reference card and Recreate entry (fixture surrounding page).
- `02-starting-frame-screen.jpg`: actual opening frame and main person photo.
- `03-review-starting-image.jpg`: result review; prominent Use as starting frame.
- `04-starting-frame-in-video-form.jpg`: existing video form, explicit starting
  frame badge, Hook 15 eight seconds, Seedance 2.5, Sound off and locked demo
  Generate video button.
- `05-mobile-starting-frame.jpg`, `06-mobile-review.jpg`: responsive dialog.
- `07-person-photo-chooser.jpg`, `08-photo-guidance.jpg`: existing main/support
  picker and separate guide popup; guide photos never become identity inputs.

Fixed issues found in the walkthrough: the source object URL now renders
declaratively so rerenders/reopening cannot clear its image; focus begins at the
dialog heading; result navigation scrolls only the body; the outer popup uses
overflow clipping so mobile focus/scroll cannot hide the header and footer;
mobile reading order is source, person, result, motion; the completed-image
primary action is Use as starting frame rather than another paid image request.

No new application error appeared after a clean reload. A dev-only Next CSS
hot-reload removeChild error appeared during stylesheet edits; it did not recur
on the clean walkthrough. This is distinct from provider or production testing.

## Evidence and limits

- Targeted component/contract suite passed 257 checks before the final two
  video-handoff cases were added; the updated video UI suite passed all 81,
  including both new cases. The starting-image UI suite passed all 12.
- Backend agents passed 84 video admission/worker/provider checks, 21 image
  API/result checks and 34 image worker/receipt/legacy checks. These counts
  overlap the combined suite; do not add them as independent totals.
- All 98 canonical source videos rehashed by the review builder.
- Hook 15: all 258 decoded frames inspected; source duration 8.634 seconds,
  clean cut at frame 170. Preview duration is eight seconds, not a promise of
  frame-exact replay. Generated face consistency remains untested.
- The shipped guide image is `public/explore/guidance/person-views.webp`.
  It shows one fictional person's front and two supporting views. It is a guide,
  never a selected identity reference or a current UI screenshot.
- Source frames and prompts can be reviewed in the read-only local page at
  `http://127.0.0.1:8188/`. The page contains reference footage, not new results.
- Production Supabase remains unchanged. No paid inference was submitted.

The production webpack build passed, including application TypeScript and all
170 static pages. The worker TypeScript build and final scoped UI lint passed.
Deployment approval is recorded. The new entry is still behind its server
release gate; matching website/worker deployment checks remain required before
claiming production acceptance. Facial fidelity
of an actual generated starting image or video has not been qualified.
