# Explore: fewer clicks and clearer paths

Initial review: 24 October 2026. Updated with photo sets, automatic Hook text and caption/scheduling follow-up on 25 October 2026. Original source snapshot inspected: `22c6f60f`.

## 25 October follow-up: automatic Hook text and saved-caption scheduling

**Automatic Hook text remains a proposal.** On an eligible reference-backed Hook,
Generate should start the video and one adapted-text request using the frozen
reference and business context. Apply the initial result as an editable overlay
to that exact new clip, persist it, and show it in the main preview. The user
should not need separate Generate remix and Apply actions for this first result.
Allow an opt-out plus Edit text, Try another and Remove text after generation.

Fit measured wrapping, readable font size and safe margins; preserve existing
Hook style and timing rules (single text across the trimmed opening, multi-block
timing separately). Do not assume automatic face avoidance is already available.
Use the same saved overlay for preview and export. Never silently truncate or
shrink copy until unreadable. Keep Demo independent and publishing deliberate.

Link the accepted video and text request identities for recovery; do not trigger
from page mount or reopening a result. Preserve existing manual edits and cleared
text if an automatic response arrives late. Respect current text limits, frozen
source/business context, source-word adaptation and uncertain-request recovery.
Text failure must keep completed footage; missing reference/context should not
fabricate copy. Scratch/uploaded clips need a separately defined copy mode.

**Saved-caption layout and scheduling recovery now have local changes.** The
user's screenshots confirmed nested caption scrolling inside the form and a raw
timeout at the Schedule action. Caption selection moves to a right-side drawer;
the form retains only its current caption. Scheduling timeouts are investigated
separately from layout. See
[implementation and verification record](saved-caption-scheduling-fixes-2026-10-25.md).
The exact hosted timeout cause and production acceptance remain pending.

## Verdict and evidence limits

Selected code paths support the user's complaint: routine actions sometimes require choosing a mode, opening another control, and then performing the intended action. Slideshows also repeats work that could apply to a complete set. These are candidates for improvement, not an exhaustive interaction-by-interaction audit or measured complete-journey click counts.

Guiding rule: **each interaction should advance the work, make a necessary choice, or approve a consequential action**. Measure repeated decisions, backtracking and time to outcome alongside clicks. Preserve explicit control over paid generation, starting-frame approval and final scheduling.

This is a code-based workflow review of Hook, Slideshows, Wall of text and Talking Head + Demo, with one fresh production landing-screen capture. It is not complete production UI acceptance. An audit agent supplied the initial source-picker and save/return leads, then stopped at its usage limit. The parent independently inspected those paths and completed the remaining source review.

Production Explore loaded in an authenticated browser. Browser access was subsequently disabled in Work settings before any workflow was opened. No paid generation, Remix request, upload, save, schedule or deployment was performed. No application code changed. Other ongoing worktree changes were preserved.

## Captured steps and health

1. **Explore landing — accessible, limited visual coverage.** Production DOM exposes all four workflows and adjacent tools. The narrow screenshot shows the first card; other cards require scrolling at this size. This does not establish a laptop layout defect.
2. **Workflow source selection — source reviewed; live check blocked.** All three public video callers use the shared classic selector. The extra focused `Use video` branch is not used by those callers and is excluded from counts.
3. **References/generation — source reviewed; live check blocked.** Starting-frame approval, source-slide selection and result handoff were traced.
4. **Editing/save/return — source reviewed; live check blocked.** Both video clips, Wall simple/advanced views and slideshow tools were inspected.
5. **Scheduling/recovery — source reviewed; live check blocked.** Existing shortcuts and persistence guards were checked; final submission was not attempted.

![Fresh production Explore landing screen](../outputs/explore-friction-audit-2026-10-24/01-explore-home.png)

The exact screenshot was saved, reopened and inspected. It is an ignored local audit artifact, not a capture of an editor or a proposed design.

## Prioritized fixes

Recommendations below are not implemented product decisions. Counts cover specific code paths, excluding typing, file-picker interaction, waiting and final scheduling. They are not measured end-to-end sessions.

### P1: Recreate should load a stored reference frame instead of extracting it on demand

**User report:** clicking Recreate repeatedly takes a long time to show the starting/source frame. The user proposes extracting each reference frame once and keeping it in backend storage. This is a latency issue in addition to the click-count issues. The reported delay has not been reproduced or timed in this review.

**Current source behavior:** ordinary references without a curated saved frame use a process-local cache. On a miss, the service reads/downloads the original MP4, verifies its source hash and runs FFmpeg to extract frame zero. The cache holds up to eight frames / 24 MiB, expires after five minutes and does not survive process replacement or share state across server instances. Therefore repeated extraction is possible; it does not occur on every click in every case.

Curated public references already read approved PNGs, and private creator references already read stored selected-frame PNGs. Their remaining delay needs separate measurement of authentication, interface loading, draft restoration, image transfer/verification and display. The client also caches frame results for five minutes; the API response is authenticated and `private, no-store`. Generation admission writes a durable public source snapshot, but the source-frame read service does not use that snapshot as a persistent cache before decoding.

**Recommended design:** prepare the exact selected source frame when a reference is imported/reviewed and backfill existing references. Store the canonical image in durable object storage with metadata binding reference ID, source-video hash, selected frame index/time, image hash, dimensions and extraction/version identity. Recreate should resolve and serve that stored image. It should not need to fetch/decode a video on the normal view path. Preserve approved later-frame choices and historical receipts; do not substitute an approximate poster or silently change a legacy frame.

Reuse stored assets already available for curated/private references. Keep private source frames behind the existing access checks. New or changed source versions get a new frame record; existing records remain usable by accepted older drafts. Deduplicate missing-frame preparation in background work rather than allowing several viewers to start the same extraction. A missing frame should show a bounded preparation/error state and a recoverable retry.

For faster perceived opening, load the source image independently of unrelated price/photo/history work where existing restoration rules permit, and consider bounded preloading on reference hover/focus. Retain owner-scoped client caching and clear private previews appropriately on account changes. Do not preload every full video or remove authentication to gain speed. Approval and generation must still wait for required validation.

This proposal is for the original reference frame displayed on opening Recreate. Personalized AI-generated starting images remain separately bound to the chosen person, instructions and accepted generation receipt; they cannot be reused across different inputs merely because the source reference matches.

Evidence: `lib/explore/hook-source-frame.ts:160`, `:178`, `:197`, `:205`, `:224`, `:228`, `:235`; `lib/explore/creator-accounts.ts:42`; `lib/explore/hook-source-frame-api.ts:8`; `components/explore/hook-starting-frame-workspace.tsx:141`; `components/explore/lazy-hook-starting-frame-workspace.tsx:8`; `lib/explore/hook-keyframe-generation-api.ts:129`.

**Acceptance:**

- A prepared reference still loads from stored image bytes after five minutes, on a cold server, and through a different server instance; no source-video download or FFmpeg extraction occurs for that read.
- Rapid concurrent opens do not duplicate preparation. Reopening the same frame can reuse the client result without losing ownership/version checks.
- Preview and generation resolve the same canonical frame. Changed source versions and old approved drafts select their own correct records.
- Public and private references retain their access rules. Slow or failed price/photo/history loads do not unnecessarily prevent displaying an already-verified source image.
- Measure click-to-visible-frame, API/auth time, stored-image lookup/transfer, client verification/display and cold/warm behavior separately on production. Compare ordinary, curated and private-creator references. Do not promise literal instant display: network/image decoding still take time.

Status: issue added and current source path checked; persistent-frame implementation and production latency measurement remain outstanding.

### Proposal: reusable person photo sets and a default selection (25 October)

The user proposes selecting multiple person photos once, keeping them in a small reusable package, and showing them automatically on subsequent Recreate opens. Interpret this as person/face reference photos, separate from the stored source-video frame and the generated starting-image result.

Current behavior supports restoring photos within a preparation: the browser key includes owner, draft and reference. A new draft starts with an empty photo list. Selecting a saved influencer sets one main photo and clears supporting photos from the previous person. This avoids mixed identities but does not provide a reusable named main-plus-supporting set across new references.

Recommended experience:

1. Let users save their current selection as a named **Photo set**, optionally linked to an existing influencer: one main photo and ordered supporting views of that same person. Save references to existing owned assets rather than requiring uploads again.
2. Offer **Use by default for new recreations** when saving/choosing a set. Store the set and default with the account; scope to the active business if the product supports that association. A recently used set may be suggested, but should not silently replace an explicitly chosen default.
3. On a new Recreate, show the stored source frame and the chosen set's name/thumbnails immediately when available. Keep the picker closed. A compact **Change** opens alternatives; choosing another set replaces the entire person selection together.
4. Keep Generate, its cost, and result approval explicit. Opening Recreate should not start a paid job. The screen can become a compact ready-to-generate view; it still provides the source/person review, optional instructions and generated result. Remove repeated selection work before deciding to remove the screen itself.
5. Make saving a set optional and available directly from the existing picker. Do not introduce a mandatory package-management journey before users can create their first video.

Existing draft selections, including an intentionally cleared selection, take precedence over defaults. Apply a default only when initializing a genuinely new preparation. Changing a global set must not rewrite an accepted request or an existing draft: freeze its ordered asset IDs/version at use. Missing assets should identify the affected photo and offer replacement; do not silently select another person. Preserve per-model photo limits without silently dropping supporting photos. A set organizes inputs; it is not a trained model or a guarantee of facial fidelity.

Proposed interaction improvement: after one-time setup, **Recreate → review preselected person → Generate**, with zero repeated photo-selection actions when the default is correct. Choosing a different set still requires a deliberate selection. Exact current click savings depend on the existing picker path and have not been measured live.

Evidence: `lib/explore/hook-keyframe-draft.ts:68` and `:72`; `components/explore/hook-starting-frame-workspace.tsx:253`, `:307`, `:310`. Existing saved-influencer and photo-library entry points should be reused; do not add a competing general asset inventory.

Acceptance: new references receive the explicitly configured default; switching sets never mixes two people's photos; restored/cleared drafts remain intact; account/business changes do not leak selections; deleted photos and model limits are actionable; opening/switching never charges credits; saving a set is optional. This is a design proposal only, with no schema/UI implementation or production verification.

### P1: Select a complete slideshow in one action

Selecting a reference resets generation selection to its first slide. The source strip offers individual toggles without Select all. An eight-slide reference therefore needs seven further selections to recreate the whole set.

Add **Select all / Clear selection**, or explicit **Recreate whole slideshow**, with editable selection and the full credit estimate. Seven additional selection clicks become one in this example. Do not silently default to more paid outputs. The Add slides dialog already has Select all remaining for importing originals; that does not solve generation selection.

Evidence: `components/explore/format-workspace.tsx:301` and `:405`; `components/explore/slideshow-reference-picker.tsx:78`.

Acceptance: select all, deselect one, retain source order, show selected slides × versions and cost, enforce the ten-slide limit before submission.

### P1: Make video-source buttons open the picker

With no selected video, Hook, Wall and Talking Head use **Creative Assets → Choose from Creative Assets → choose video**. Upload uses **Upload → Upload video → file picker**. The first action merely switches mode.

Use **Choose video → choose video**, and **Upload video → file picker**. This removes one app click from each initial source choice. Existing overview actions already open source choices more directly; reuse that behavior.

Evidence: `components/explore/workflow-video-source-section.tsx:18`, `:32`, `:35`; callers at `format-workspace.tsx:562` and `hook-workflow-preview.tsx:321` in the same directory.

Acceptance: one action opens the correct picker; cancellation/failure preserves accepted footage and edits; demo selection continues to use Saved demos rather than the opening-video inventory.

### P1: Upload slideshow images directly from the sequence

Current route: **Add slides → Upload images → Choose images → file picker**. Upload images only changes the dialog body.

Offer a direct **Upload slides** action on the sequence. Keep Add slides for browsing generated/reference/library images. At minimum, the dialog's Upload images action should open the picker immediately. Three app clicks to open the file picker can become one, or two with the smaller dialog-only change.

Evidence: `components/explore/format-slideshow-editor.tsx:604`; `components/explore/slideshow-add-slides.tsx:67` and `:69`.

Acceptance: multi-file upload inserts into the current sequence; cancelled/failed uploads preserve existing order/text/images; 4:5 fitting remains unchanged.

### P1: Save and advance when that is the user's intent

Hook and Talking Head clip editors save without leaving the editor. A common segment is **Save edits → Back to videos → Schedule video**. Hook demo editing has the same split. Wall has Save edits then Schedule video. Slideshows changes its primary action from Save slideshow to Schedule slideshow after saving.

Offer **Save & return** for clip editing and **Save & review post** for Wall/Slideshow. Keep save-only available for continued editing. The first segment becomes two actions instead of three; save-to-review becomes one instead of two. Final Schedule post stays explicit in review.

Evidence: `components/explore/format-video-editor.tsx:310`; `format-demo-section.tsx:522`; `talking-head-clip-editing.tsx:121`; `format-slideshow-editor.tsx:549` and `:566` in the same directory.

Acceptance: advance only after successful persistence; remain in place with recoverable edits on error; retain revision-conflict and request-identity checks. Mounting or returning must never submit generation or publication. This is a proposed behavior change, not a label-only edit.

### P1: Separate reference uploads from finished slides

**Upload slides** in Create creates a slideshow reference. It does not populate the editable sequence. The similarly named action inside Add slides adds images to that sequence. Users bringing finished slides can choose the wrong path and need another import step.

Rename the Create action **Upload reference slides** and offer **Use my finished slides** directly into editing, with no generation prerequisite. Make the distinction before file selection.

Evidence: `components/explore/slideshow-reference-picker.tsx:29` and `:67`; `format-workspace.tsx:405` and `:512`; `format-slideshow-editor.tsx:574`.

Acceptance: reference uploads become generation inputs; finished-slide uploads populate the editor; both preserve order. Never treat a reference upload as permission to generate.

### P2: Apply appearance to multiple slides

Appearance changes update only the selected slide, requiring repeated font/size/alignment/background choices across a set. Add **Apply style to selected slides / all slides** with Undo. Copy appearance, not each slide's words or image; retain individual overrides.

Evidence: `components/explore/format-slideshow-text-tools.tsx:17` and `:28`; `components/explore/format-slideshow-editor.tsx:558`. This affects editable overlays, not text baked into images.

Acceptance: no text/image replacement; Undo restores every affected style; covers can retain distinct formatting.

### P2: Recreate a slide without leaving the editor

Recreate slide currently changes from Edit slides to Create/results. Replace selected slide returns to editing. Identity is retained in code, but correcting one image requires changing workspaces.

Use a compact recreation panel beside the selected slide, retaining the sequence, current image and text. Keep paid-generation cost/submission and result approval explicit.

Evidence: `components/explore/format-slideshow-editor.tsx:583`; `components/explore/format-workspace.tsx:507`, `:535`, `:536`.

Acceptance: replacements remain bound to the correct slide even while browsing others; failure keeps the original; Restore previous image remains available.

### P2: Expose Continue working on Explore

Explore is a format launcher without a recent-work section. Recovery exists elsewhere: Talking Head has explicit draft URLs and a browser-local list; Slideshows has Earlier drafts on this device and Saved slideshows; generated media and starting frames have separate histories.

Add a small **Continue working** area with thumbnail, workflow, last stage and Resume. Use actual recoverable drafts; do not present a generated file as a complete composition or promise cross-device draft recovery.

Evidence: `components/explore/explore-workspace.tsx:18`; `workflow-draft-entry.tsx:16`; `format-slideshow-editor.tsx:578`; `format-workspace.tsx:548`.

Acceptance: one Resume restores the correct content/stage; missing assets offer recovery; device-local drafts are labelled honestly.

### P2: Make empty media pickers actionable

The empty video picker directs users to upload in Create, or says Upload one here without providing an upload control. Users must close it and find another entry.

Add **Upload video / Upload demo** inside the empty state, respecting inventory ownership. Consider search/filtering for large inventories after observing actual usage.

Evidence: `components/explore/workflow-video-asset-picker.tsx:39`.

Acceptance: one action starts upload; success selects the item; failure preserves the surrounding workflow.

## Review of each workflow

| Workflow / step | Current assessment and next change |
| --- | --- |
| Hook 1: choose reference or owned clip | Friction: direct picker opportunity. Preserve independent Preview/Recreate actions. |
| Hook 2: prepare/review starting frame | Necessary decision: preview readiness and current-input checks must remain. Preserve approved-frame reuse. |
| Hook 3: generate/select video | Live check needed: References, generated results and Your videos handoff. |
| Hook 4: edit opening/demo | Friction: Save & return on both clips; preserve edit scope. |
| Hook 5: review/schedule | Existing shortcut: Your videos already has Schedule video, including opening-only use. Do not make Demo compulsory. |
| Slideshows 1: choose reference | Friction: bulk source selection and reference/finished-upload distinction. |
| Slideshows 2: generate/select set | Partly streamlined: complete sets can populate the slideshow and whole-set selection exists. Do not assume all outputs require individual insertion. |
| Slideshows 3: assemble/edit | Friction: direct upload, bulk appearance, in-place image recreation. |
| Slideshows 4: save | Friction: save-and-review, retaining interrupted-save recovery and save-only. |
| Slideshows 5: review/schedule | Existing shortcut: overview already exposes Save/Schedule without requiring Edit slides. |
| Wall 1: choose background | Friction: same indirect video selector. |
| Wall 2: edit text | Appropriate structure in code: simple text/Remix view with optional advanced tools. Visually unverified. |
| Wall 3: advanced tools | Clarity opportunity: Edit inside Edit is vague; use Video settings or Advanced tools. Keep controls optional. |
| Wall 4: save/review | Friction: combine save with review when requested. Separate Prepare final video may duplicate a scheduling path that already starts preparation; verify both feature-flag paths first. |
| Wall 5: schedule | Live check needed for final preview parity. Preserve a single-video workflow with no Demo. |
| Talking Head 1: choose/generate | Friction: shared picker. Continue opens Demo, but overview can also expose direct editing; Continue is not always unavoidable. |
| Talking Head 2: optional demo/audio | Appropriate separation in code: preserve speech, demo sound and whole-video music scopes. Visually unverified. |
| Talking Head 3: edit clips | Friction: save/return repetition on opening and demo. |
| Talking Head 4: reference text | Functional gap: caller passes neither remixReference nor remixReferences into the editor, leaving its catalogue resolver empty even with reference metadata. Test a real generated owned asset before declaring source-text parity. |
| Talking Head 5: schedule/resume | Live check needed for both background scheduling and legacy preparation. Surface existing draft recovery. |

Talking Head source-resolution evidence: `components/explore/talking-head-clip-editing.tsx:121`, `components/explore/format-video-editor.tsx:142`, `lib/explore/remix-source.ts:35`. Uploaded-reference automatic OCR/transcription is also a documented open gap; its service behavior was not executed in this pass.

## Preserve existing improvements

- Workflow names: Hook/Talking Head Create → Demo → Schedule; Wall Create → Edit → Schedule; Slideshow Create → Edit slides → Schedule.
- Direct per-clip edit/change, optional Demo, and distinct audio scopes.
- Wall's simple/advanced views sharing one draft and player.
- Slideshow set assembly, drag/keyboard reorder, overview saving and Library reopening.
- Single eligible account auto-selection after platform choice (`workflow-connected-accounts.tsx:40`); account choice is not always manual.
- Source provenance, draft isolation, idempotency, readiness checks and explicit final scheduling.

## Implementation and verification plan

**First pass:** the six P1 changes, including stored Recreate source frames. They address waiting, repeated setup and navigation without replacing the workflows. **Second pass:** bulk appearance, in-place recreation, Continue working, empty-picker recovery and Talking Head reference-text parity.

Test matching tasks before/after on the real production domain at 1366×768 and 1536×864, a zoomed laptop view and a narrow viewport. Cover reference-backed and uploaded/saved content, new/empty, populated, cancellation/failure, reload/resume and prepared-output → edit-again. Check keyboard focus, dialog dismissal, screen-reader action names, save/error visibility and controls obscured by previews/footers. No accessibility-compliance claim follows from this limited screenshot.

Measure app interactions, modal/screen transitions, repeated selections, backtracking, active editing time and completion rate. Separate generation/render waiting. Reuse existing content at paid/publishing boundaries unless a specific live test is authorized.

| Task segment | Current source path | Proposed target |
| --- | --- | --- |
| Open video picker from initial Create | 2 app clicks before asset selection | 1 |
| Open slideshow file picker from sequence | 3 app clicks | 1 |
| Select all 8 generation source slides after reference choice | 7 extra clicks | 1 |
| Save changed clip, return, open review | 3 actions | 2 |
| Save Wall/slideshow changes, open review | 2 actions | 1 |
| Resume known draft from Explore home | No direct home action | 1 Resume |

Do not add these reductions into one promised total: they apply to different branches and have not been timed in production. Next slice: implement the first-pass changes, then obtain signed-in production evidence for each affected workflow.
