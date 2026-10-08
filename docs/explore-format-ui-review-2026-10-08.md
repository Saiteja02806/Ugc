# Explore workflow UI review — 2026-10-08

Compared the actual Create, Edit and Schedule screens from the existing
talking-hook and creator-phone components with Hook video, Wall of text and
Slideshows through the development-only fixture. The public legacy routes stay
hidden. This review uses local media; it does not accept production integrations.

The resulting structure uses two framed panels, compact section tabs inside the
left panel and one shared action footer. References / Your Video or Your Slides
remain views of the right panel during Create. Generate immediately selects
results. Uploaded and owned Creative Assets footage open the same video editor.
The schedule confirmation, ownership checks and request recovery are retained.

Resolved findings, grouped by file:

## components/explore/format-workspace.tsx

- `components/explore/format-workspace.tsx:207` — page-wide step bar replaced with compact, keyboard-accessible Base UI tabs in the control card.
- `components/explore/format-workspace.tsx:224` — one shared footer; removed duplicate primary action from the uploaded-video preview.
- `components/explore/format-workspace.tsx:56` — Generate / Upload / Creative Assets choices added to both video workflows.
- `components/explore/format-workspace.tsx:232` — preview region has its own accessible label; no nested main landmark.
- Edit and Schedule now give explicit directions when there is no selected or saved media.

## components/generation/ai-studio-composer.tsx

- `components/generation/ai-studio-composer.tsx:105` — Generate remains associated with its original form when displayed in the shared footer.
- Following the user's correction, Hook and Wall reuse the older creation
  styles directly. Optional references are the same square Choose image and
  Video reference tiles, above the instructions field; the voice tile is omitted.
  The same instruction typography, expanding desktop writing area and inline
  Model / Duration / Videos / Ratio field styling are used. No separate
  style-example row is rendered; the selected poster appears in Choose image.
- Reference popovers reuse the older floating-panel styles and offer custom
  uploads, the existing creator images, previews and removal. Settings remain
  editable in read-only preview; generation remains disabled. Slideshows keep
  their existing compact settings popover.
- Generation panels keep polling across steps; only composer presentation is
  marked inactive outside Generate/Create to close reference/settings popovers.
- Labels, error/status feedback, keyboard focus and reduced-motion loading state retained.

## components/explore/format-video-editor.tsx

- Save edits and Continue to Schedule are successive primary actions in the same footer.
- Trim, manual text and audio are separate groups; the original dimensions and footage are retained.
- No subtitle controls or transcription were added. Drafts remain scoped by owner, format and source.

## components/explore/format-slideshow-editor.tsx

- The shared footer advances from Save slideshow to Continue to Schedule after saving.
- The full slide sequence and selected-slide preview remain available.

## components/explore/format-schedule-panel.tsx

- Review, Resume and Check saved schedule occupy the same action footer.
- Existing final confirmation and exact-source/account/idempotency checks are retained.

## components/explore/recreate-workspace.tsx

- Reference cards have a named, keyboard-accessible top-right Recreate icon.
  The full-width Use reference buttons are removed. Selection has a check,
  orange outline and Selected caption, with `aria-pressed` on the action.
- Preview remains a separate named media button. One gallery hint explains
  the icon; the native title identifies it on hover.
- The gallery starts with 12 references and supports Show more references.

## Validation and limits

The read-only browser checks use actual local video input files and fixture
Creative Assets. They verify all three workflows, desktop/mobile overflow,
1280×720 action visibility, shared footer placement, native Generate form
association, edit/schedule drafts, refresh, source replacement/removal and hidden
routes. All non-GET API requests are blocked. Screenshots live in
`.tmp/explore-format-split` and include the original workflow comparison screens.

The follow-up passes 31 UI/source/worker/upload/export behavioral tests and
11 mocked generation API checks. The earlier finishing UI suite passed 17
tests, including exact interrupted requests,
changed-export invalidation, lost-response recovery and scheduling safeguards.
Production build, TypeScript and scoped lint are also checked. Authenticated
production uploads, provider generation, worker exports and social scheduling
still require an authorized release and production acceptance.

## Reference and generation integration follow-up

- Browser review covers Hook, Wall and Slideshows at desktop, 1280×720 and
  mobile sizes. Image/video replacement, long-video rejection without losing
  the previous selection, removing the style example, source switching,
  edit/schedule drafts and the hidden legacy routes are exercised with all
  non-GET API calls blocked.
- Client request tests verify results are selected before authentication,
  pending uploads prevent submissions, custom images replace the poster,
  and custom videos suppress image guidance. Preview generation is locked.
- Mocked real API tests verify all three format boundaries, trusted URLs,
  exact dialogue, ratio, count, duration, credit reservation, dispatch failure
  recovery, duplicate submission identity and the retained legacy image guard.
- Mocked real video worker execution verifies Google Omni for text/image,
  Runway for video guidance, exact prompt forwarding and source-length output.
  These are integration tests with provider and storage side effects replaced;
  no paid generation or production audio was checked.

## Restoration of the older creation design

Hook and Wall now share `workflow-creation.module.css` with the actual
talking-head/demo and creator-phone components. A direct browser comparison
confirmed identical pane and reference backgrounds, 102×102px reference tiles
at the reviewed desktop width, 8px corners, and 14px/24px instruction typography.
Desktop instructions expand with the frame, as in the older workflows. The
reference cards remain in the original grid positions with only image and video;
the voice card is omitted. The selected gallery poster is represented by the
image card rather than a separate style-example box.

Creator selection and None close the picker as in the older image picker;
selected creators have check marks. Reference pickers close across section
changes without clearing media or generation state. The current working model,
duration, quantity and ratio controls use the older field styles; unsupported
preview-only quality choices from the old mock form were not added to generation.
Slideshows retain their current image-only composer and settings presentation.

24 focused generation/upload/source regressions passed, along with the full
browser flow for all three workflows, both older references, upload/Creative
Assets, edit drafts, schedule drafts and hidden routes. Final reference-picker
checks passed separately after matching close/focus behavior. TypeScript and
scoped ESLint passed. Browser tests blocked API writes and recorded no runtime
errors. The production build passed. This is local validation, not deployment or
production generation acceptance.

Final visual comparisons are in the ignored
`C:/Users/chund/OneDrive/Desktop/UGC/.tmp/explore-classic-workflows/` directory.

## Final selected-video correction

Gallery video selection now shows a playable Style video tile rather than populating Choose image with a poster. Explicit uploaded media remains separate generation input, with its owned video asset ID included in the request. Settings rows match the older workflow: Model/Duration, then Quality/Videos/Ratio. Reference popups are bounded to the available viewport and focus their container to avoid clipping the introduction on small screens. See explore-reference-verification-2026-10-08.md for the distinction between style guidance and provider input.
