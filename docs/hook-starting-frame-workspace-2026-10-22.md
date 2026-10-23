> Latest revision: one square Choose image tile replaces both influencer/photo
> launchers. Its chooser includes saved influencer images, uploads and UGC Pilot
> images. Model selection uses the shared rounded popover; the count label is
> Variations. The Create picker retains Starting frames for recent owned outputs.
> 72 focused checks, application types and scoped lint pass. The server is running
> on port 8190; fresh visual review is blocked by browser security. No screenshot
> below proves this latest revision. Deployment remains paused.
>
> Superseded layout notice: the user subsequently requested a focused Recreate
> overlay. That flow is implemented locally: source/person controls above a grid
> of generated frames, one Use this per image, and a Starting frames source in the
> existing Create image picker. The right-side Starting frame tab is removed.
> 166 focused checks, application types and scoped lint pass. Fresh visual review
> remains pending browser access; older screenshots below describe earlier layouts.
> Deployment is paused. See EXPLORE_CONTEXT.md for the latest decision record.

# Hook starting-frame workspace — local validation, 22 October 2026

Status: local implementation; not committed, pushed or deployed by this work.
The earlier PR #81 deployment does not contain these subsequent changes.

## Latest sizing review — supersedes screenshots 01–16

The user rejected the complete composition after the compact picker change.
This revision adjusts the screen rather than treating zero horizontal overflow
as sufficient visual acceptance. Browser security currently blocks access to the
local preview; fresh screenshots and visual acceptance have not been obtained.
The preview server has been restarted at port 8190 and a user-facing app-panel
open was queued. No alternate browser/DOM access was used around the rejection.

| Element | Current placement and purpose |
| --- | --- |
| Heading and Back | One compact desktop header row; References remains the parent view. |
| Source frame | Left comparison card; bounded height, full original proportions, enlarge action. |
| Generated image | Beside the source; matching preview-height limit, original proportions retained. |
| Variations and approval | Choices directly under the generated preview, then Use as starting frame. |
| Selected face | Larger 96×120px preview with optional supporting photos and Change photos. |
| Influencer library | One Choose influencer control; photos appear only inside its chooser. |
| Optional image changes | Collapsed disclosure near the face inputs. |
| Model/count/price/Generate | One bottom image-action bar with inline request errors. |
| Save preparation | Omitted from focused workspace because the draft already auto-saves; legacy dialog remains compatible. |
| Video settings | Remain in the video composer after approved-image handoff. |

Automatic review scrolling now leaves an already visible result in place and
accounts for the action bar. Keyboard scrolling reserves room below targets.
Coarse-pointer variation and approval targets retain 44px minimum hit sizes.
The small native model/count selectors use the application's theme and explicit
accessible names; they do not expose extra per-image forms.

Latest local checks: 147 focused tests pass, full application types pass and
scoped lint passes. These checks cover selection, upload state, model changes,
variation recovery, approval/handoff and navigation. They do not verify the new
pixel layout; that acceptance is explicitly pending restored browser access.

## Result

Hook Recreate opens a focused Starting frame view beside References and Your
videos. The composer stays mounted, preserving drafts and portal targets, while
the preparation uses the available width. Back retains the preparation and
returns focus to the repeatable Recreate action. Its icon remains a rotate arrow.

Saved influencers are reached through one compact Choose influencer box, opening
a paginated photo grid instead of the builder's prompt-heavy history. User
explicitly rejected showing the library's recent thumbnails on this screen;
only selected main/supporting photos remain visible here. An owned,
ready image becomes the main face reference; supports from another identity are
cleared. Failed selection retains the current photos. Reselecting the current
main photo retains its supporting views.

Only approved images reach the video composer. Until approval, a gallery Hook
offers Create starting frame/Clear reference and blocks new video submissions.
It does not send the old source video or legacy reference prompt. Accepted jobs
still recover with their frozen requests. Independent prompt-only generation and
deliberate uploaded-video editing retain their existing behavior.

Both previews enlarge for inspection. Variation choices precede the compact Use
as starting frame button. Image model, count and cost remain image-stage controls;
video duration/audio belong to the subsequent video form.

## Causes repaired

- A narrow modal competed with the existing two-pane layout.
- Saved-face selection reused a history drawer intended for inspecting generation
  prompts rather than choosing photos.
- A selected Hook reused toggle/check semantics for a repeatable Recreate action.
- URL/gallery bindings could expose source-video editing after abandoning image
  preparation. A separate preparation prerequisite now fences new video requests.
- Shared responsive styles could restore the two-column grid or mobile minimum
  pane height. The focused override owns its grid row, pane height and scrolling.
- Unpositioned screen-reader helper text could extend the page outside the scroll
  area. The stage now establishes its positioning context.

## Checks

- 140 focused checks pass across saved-photo selection, navigation, starting-image
  recovery/variations, composer input contracts and existing navigation behavior.
- Full application TypeScript check passes. Scoped lint has zero errors and one
  existing VideoPanel image warning. Whitespace validation passes.
- Cua browser checks use `/e2e/hook-keyframe-preview`, actual components and shared
  production CSS classes. The development-only adapter returns sample images and
  never calls paid generation. The preview route is unavailable in production.
- Tested 1366×768, 1280×720, 1020×594 and 390×844 layouts, inline saved-photo
  selection, the six-photo grid, main-photo changes, four mock variations with
  earlier choices retained, enlargement, Back/Recreate, selection persistence and
  image-only handoff with sound off. The fixture's Generate video remains disabled.

Fresh screenshots are in ignored local folder
`outputs/hook-workspace-refinement-20261022/`. Sample result portraits deliberately
test layout, not image-editing quality or scene/identity fidelity. Earlier images
01–05 precede the final shared-shell refinements; use the latest screenshots for
the current layout.

Final shared-shell browser measurements: document height equals viewport height
at 1366×768, 1280×720, 1020×594 and 390×844; no horizontal overflow. The mobile
stage has 606 pixels of visible height and scrolls through 1420 pixels of content.
The 1020×594 stage remains 380 pixels tall with its image actions reachable.
Screenshots 09–14 show the final mobile/laptop workspace, image controls, approval
and photo grid. Images 12 and 13 are the main laptop review screenshots.

The subsequent compact-chooser revision supersedes the inline gallery visible in
screenshots 09–14. Use screenshot 15 (laptop) and 16 (mobile) for the current
launcher. Its measured laptop dimensions are 194×42 pixels. Browser checks at
1366×768 and 390×844 confirm zero library thumbnails outside the dialog, working
selected-photo reuse and viewport-bounded scrolling. Updated selector/UI tests
pass 31/31 and the changed component passes lint.

## Acceptance limits

No paid image/video request, production database operation, commit, push or
deployment was performed. Authenticated history loading and hosted media access
still need production acceptance after an approved release. Concurrent slideshow
and Wall changes in this checkout have been preserved and are outside this UI
receipt; this is not a combined-release approval.
