# Starting-image variations and simplified popup

Local implementation only. Deployment remains paused. No paid inference or
production database change was performed.

## Subsequent four approved UI refinements

The generated image now precedes variation thumbnails and then the approval
button. Source and result previews have explicit Enlarge buttons opening a
read-only, aspect-preserving dialog with keyboard access and focus restoration.
Opening an enlarged preview neither selects/approves an image nor starts work.
The comparison columns have a smaller gap and the dialog's desktop width is
reduced to 800 pixels; these latest dimensions still need visual acceptance.

Face reference replaces Your person. Its compact main/support strip shows every
selected photo in order, with Change photos opening the existing person-photo
editor. Other workflows keep their previous reference tile. Photo IDs, order,
provider requests, credits, result verification and saved recovery are unchanged.

60 focused checks, application types and scoped lint pass for this refinement.
The browser-control runtime currently fails before any page action with
“failed to write kernel assets”, even after resetting it. Therefore the older
screenshots below establish only the previous layout, not visual acceptance of
these refinements. The local server is available at
`http://127.0.0.1:8190/e2e/hook-keyframe-preview`; fresh desktop/mobile, enlarged
preview focus/close and person-strip browser acceptance remain pending.

## User-facing behavior

- Create your starting frame contains image controls only. Video duration,
  sound and motion editing remain in the existing video composer after approval.
- Use as starting frame is a compact text-width button (129 × 30 CSS pixels in
  the tested laptop viewport). The model selector is about 129 × 30 pixels.
- Choose 1–4 images and see the combined credit estimate before generating.
  Each request uses the same frozen scene, ordered person photos, model and
  image instructions. These are independent generations, not a quality guarantee.
- Review accepted results through a thumbnail strip and approve exactly one.
  The account-owned completed job and exact input receipt are still verified.
- Up to 12 recent choices remain in this browser. Only old terminal choices may
  leave the chooser; pending requests and the selected result are protected.
  Generated assets remain in the owned image inventory.

## Submission and recovery

Reuse the existing single-image admission API and billing contract. Give each
variation a separate persisted idempotency key and submit sequentially under a
Web Lock. Validate the saved revision to reject competing tabs' stale actions.
Authentication completes before marking any request submitted. Closing the
popup prevents remaining requests from starting, including during sign-in.

Stop on rejected or uncertain admission. Preserve accepted requests. Do not
submit remaining plans on reload, polling, recovery or an automatic retry.
Recovery reads the existing job only. Verified terminal reads settle the local
record. Legacy single-image checkpoints import without changing their input
fingerprints or existing provider operations.

## Validation and limits

- 33 focused client, UI and variation-recovery checks pass. They cover four
  separate submissions, exact selected-asset handoff, photo/model binding,
  partial rejection, uncertain submission, reopening without POST, cross-tab
  revision conflict, authentication failure and closing during authentication.
- TypeScript and scoped lint pass; logs are in ignored `outputs/`.
- Actual components checked at 1020 × 594 and 390 × 844. The mobile dialog has
  client width = scroll width = 354 pixels. Four thumbnails fit in its result
  column. Image controls remain reachable through the dialog's vertical scroll.
- Reload recovered all four sample results and the third selected result.
  Use as starting frame passed that image to the existing composer with the
  source-bound eight-second motion directions and sound OFF. Generate video is
  disabled in the development fixture.
- A transient local development-bundle loading error occurred during editing;
  restarting the same local server restored hydration and reload verification.
  This was not a production check or a reason to resume deployment.
- Fixture portraits deliberately stand in for outputs; they do not demonstrate
  scene preservation, facial fidelity or paid model quality. No new full
  production build or hosted acceptance is claimed for this UI iteration.

Screenshots (ignored local artifacts):

- `outputs/hook-layout-correction-2026-10-22/07-final-image-only-variations.png`
- `outputs/hook-layout-correction-2026-10-22/06-image-only-mobile.png`
