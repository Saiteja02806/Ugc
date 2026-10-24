# Hook Recreate and starting-frame audit — 23 October 2026

Verdict: the approved v4 image prompt is deployed, but the production workflow
does not yet satisfy the requested starting-frame experience end to end. Local
UI changes fix several problems, but also retain some gaps identified below.

## Evidence and limits

- Production source: merged commit `14be89fb36a796b28332f074f63a048006559266`.
  The preceding release verification bound the real production domain to this
  commit and the image worker to the reviewed v4-compatible source.
- Earlier signed-in production browser inspection in this conversation covered
  the gallery, Recreate, actual extracted source, both person selectors, owned
  photo selection, Pro default and expanded v4 prompt. It also exposed the
  legacy source-video composer behind the dialog. Those are prior observations,
  not freshly repeated browser checks in this audit.
- Fresh computer-use access timed out at the application approval step. No fresh
  screenshots, keyboard traversal or responsive visual acceptance are claimed.
- Current local checks: 82 tests pass across navigation, workspace interactions,
  request admission, draft binding, history, prompt preparation and status recovery.
  Log: `outputs/hook-recreate-audit-tests-2026-10-23.log`.
- A separate diagnostic executes the exact deployed and local navigation
  functions. It reproduces the production legacy-video URL flags and the loss of
  an existing selected frame after Recreate then Close, in both versions.
  Evidence: `outputs/hook-recreate-navigation-audit-2026-10-23.json` and `.mjs`.
- No paid image/video generation, upload, scheduling, deployment or production
  data modification was performed during this audit. Generation/approval rows
  below were checked through code and mocked service-boundary tests, not fresh
  paid end-to-end runs. These tests do not measure generated facial fidelity.

## Step-by-step trace

“Keep” means the behavior belongs in the flow. “Change” means a confirmed
functional or product mismatch. “Visual check” means source inspection is not
enough to accept the actual layout. Local fixes are not production fixes.

| Step | What happens | Decision and validation |
|---|---|---|
| 1 | User opens Explore → Hook video. Auth and entitlement determine access. | Keep. Private requests must remain owner scoped; do not bypass production sign-in. |
| 2 | References load into the gallery; loading, error, empty and load-more states exist. | Keep. The reference must remain distinguishable from an owned generated result. |
| 3 | Clicking the video preview opens playback, while Recreate is a separate action. | Keep. Preview must not select, generate or spend credits. |
| 4 | Recreate checks that conflicting generation/upload work is not busy. | Keep. Avoid changing source during an accepted submission. |
| 5 | It selects the Hook, clears the currently selected starting frame and updates the selected gallery card. | Change. Immediate clearing loses the previous approved choice even if the user cancels; reproduced in production and local functions. Stage a replacement until Use this. |
| 6 | A preparation identity is reused for the same Hook or created for a different one; the URL records it. | Keep. This identity supports draft and accepted-job recovery. |
| 7 | Production also adds `sourceUrl`, `refType` and `exploreRecreate=1`; mobile targets the underlying controls. | Change. Those flags initialize a second, legacy video-edit flow behind the starting-image dialog. Local code removes these flags and targets preparation. |
| 8 | A focused Create your starting frame dialog opens over the existing screen. | Keep. It matches the requested overlay, without a permanent right-side Starting frame tab. Local recreation presentation implements inputs above results. |
| 9 | The selected canonical video is fetched, hash checked and decoded at frame zero. | Keep. The source is the real frame, not an arbitrary gallery poster or identity photo. Failure must block generation and offer recovery. |
| 10 | The source frame appears before generation, including any source captions. | Keep. This is the input preview, not an output. Label it clearly. Captions are removed by image generation, not by pretending the preview is already generated. |
| 11 | Clicking the source frame enlarges it. | Keep. Zoom must not approve or generate anything; locally covered by interaction tests. |
| 12 | Saved preparation and selected photo IDs restore for this owner, Hook, draft and exact source. | Keep. Changed/unavailable source or photos must show an error rather than overwrite the saved preparation silently. |
| 13 | Production offers Choose saved influencer and Choose photos as separate launchers. | Change. Both supply the same person's image inputs. Use the single familiar Choose image box requested by the user. Local unified chooser is pending release. |
| 14 | Production saved-influencer selection opens the generation-history drawer with long old prompts. | Change. This task needs a photo chooser, not a prompt-history reading step. Show photos and clear selection state inside the chooser. |
| 15 | The photo picker shows Your images and UGC Pilot images, plus upload/refresh. | Keep the library sources. Put influencer images here so the user has one entry point. Loading/error/empty states need a clear next action. |
| 16 | First selected photo becomes Main; additional photos support that same identity. | Keep. Make the main photo explicit. Do not require extra views. |
| 17 | Selecting a different saved influencer clears the previous person's support images. | Keep. Locally tested; prevents mixed identities. Reselecting the same main photo preserves its support images. |
| 18 | Upload/lookup failures show errors; successfully accepted photos remain usable. | Keep. Locally tested. Do not discard good photos because another file failed. |
| 19 | Photo preview opens without selecting an output or making a paid request. | Keep. Face-reference thumbnails are inputs and must not be labeled generated starting frames. |
| 20 | Create a new influencer opens a separate builder tab. | Keep as a secondary link. It must preserve this preparation and not become a mandatory detour. |
| 21 | Adjust image instructions is collapsed by default; expanded text customizes only the still-image stage. | Keep as optional. No required prompt-writing step for the ordinary flow. |
| 22 | View image instructions exposes the compiled v4 prompt after a person is chosen. | Keep inside optional details. Prior production inspection confirmed subject-first wording. No raw prompt should dominate the main form. |
| 23 | Pro is the default image model; Flash can be chosen. | Keep. Model changes preserve photos but invalidate the old image approval and enforce that model's photo limit. Those guards are tested. Flash quality is not qualified by the single Pro sample. |
| 24 | Production uses native model/count selects and calls the quantity Images. | Change. Local code uses the rounded app setting selector and Variations wording. Quantity must mean separate image outputs, not number of reference photos. |
| 25 | Price is fetched for the selected model and multiplied by variation count. | Keep. Unknown price blocks submission. Show total before Generate; a selection or model switch must not charge. |
| 26 | Choices autosave to browser storage; production also offers Save preparation. | Simplify. A second manual save step is redundant when autosave works. Local recreation mode removes the button; storage failures remain actionable. Browser-local saving must not imply account-wide/cloud saving. |
| 27 | Some catalog entries require a decision about motion, crop, reveals or props. | Change before payment. Ten of 98 reviewed entries have `requiresDecision`. Image readiness currently ignores that state, while Use this later blocks it. Explain the exact issue and resolve it or clearly offer a still-only result before generating. |
| 28 | Generate checks source/photo readiness, count limits, price and saved-request state. | Keep. Recreate itself must never submit generation. Local tests verify zero submissions on opening. |
| 29 | Browser Web Locks and saved revision checks guard cross-tab submissions. | Keep internally. If unavailable, show an actionable browser requirement; no silent duplicate fallback. |
| 30 | Each variation gets its own persisted request UUID before POST; inputs/model/order are frozen. | Keep. Four variations are four independently tracked image requests, not an implicit unlimited retry loop. |
| 31 | Server checks authentication, entitlement, owned ready assets, sizes, source hashes and prompt binding before reserving credits. | Keep. The client preview is not sufficient proof of ownership or provenance. Admission/replay tests pass. |
| 32 | Worker verifies scene bytes and sends source/main/support photos with matching versioned labels and v4 prompt. | Keep. This is the approved image technique. Do not silently revert to exact face-swap or original-hairstyle preservation wording. |
| 33 | The UI shows submitting/generating states and checks each accepted job independently. | Keep. Distinguish submission uncertainty from slow rendering. Never claim failure merely because one status read fails. |
| 34 | A transient status read fails or the tab is hidden/offline. | Local recovery fix passes tests: normal 3s checks, recoverable-error backoff to 15s, foreground/reconnect recovery, terminal stop. It remains unreleased. Do not present this behavior as verified live. |
| 35 | A variation is rejected, the response is uncertain, or the dialog closes during a batch. | Keep current safety rule: preserve accepted/uncertain identities, stop unsent plans, recover by reads only. Tests cover second-variation rejection/uncertainty, closing during auth and cross-tab changes. |
| 36 | Completed images arrive. Production shows one selected large result with small variation thumbnails. | Change. User requested all generated results together, each with Use this. Local recreation gallery implements that. Show only requested/submitted variations; failures must stay distinct. |
| 37 | User enlarges a completed result and checks likeness, expression, hands/objects, scene and caption removal. | Keep. Completion is not quality approval. Source and result need clear labels and accessible enlargement. |
| 38 | Changing image inputs makes old outputs ineligible for the new preparation. | Keep the binding. Explain that the old result still exists, but does not include the new settings. Consider locking inputs during generation or offering an explicit new preparation to reduce confusion. |
| 39 | Use this verifies the exact completed owned result and binds approval to its preparation. | Keep. This must be the only explicit handoff point. It must not automatically generate a video. Owner/source/model/job/output mismatch tests reject. |
| 40 | The dialog closes and the approved image becomes the Create starting-frame reference with motion suggestions and sound preference. | Keep. Only the approved image goes to animation; original source video and face photos must not be appended as animation inputs. |
| 41 | Production places the portrait in a fixed square with a badge and Remove action. | Change. A 9:16 image in a 160×160 contain box is only 90px wide, creating side gaps. Local aspect-ratio container and Change action are pending. Full image must remain visible without crop. |
| 42 | Production switches the animation model to Seedance and disables alternatives. | Change. This is an explicit production lock, not a broken dropdown. Local supported-model routing removes it; availability/ratio/duration rules still apply. It needs separate release and hosted validation. |
| 43 | User wants to change the approved frame. | Production gap: no Starting frames picker tab/Change route. Local chooser has this tab and re-verifies owned results without generation. |
| 44 | Local Starting frames history loads recent eligible results. | Keep, but label scope honestly: server scans up to 48 completed jobs and returns up to 24 usable frames. This is recent history, not every generated frame forever; older-history access needs a product decision/pagination. |
| 45 | A history frame is reused. | Local source restores suggested motion and Sound off, not the user's earlier custom motion/audio. Make that behavior visible or preserve the chosen settings deliberately; do not imply the complete previous setup was restored. |
| 46 | User closes preparation without Use this. | Change. Production leaves the legacy source-video flags; local removes them. Neither version restores the previously selected approved frame after a cancelled replacement. No paid requests should be cancelled/resubmitted automatically. |
| 47 | User refreshes after selecting a frame in Create. | Change. Composer starting-frame selection is initialized with `useState(null)` and has no restore setter. Preparation/approval and jobs survive separately, but the chosen composer reference does not automatically return. Revalidate and restore that selection. |
| 48 | User explicitly generates a video. | Keep as a separate paid action, after approved-frame/motion/model/ratio/duration validation. Do not start it from Use this or from reopening the screen. No fresh paid animation was tested here. |

## Priorities and source locations

These refer to the named functions in the deployed commit and current local
checkout; line numbers can move while other work continues.

1. **High — competing workflow behind the overlay.**
   `components/explore/format-workspace.tsx:selectReference`,
   `closeHookPreparation`, `recreateView.styleVideo`. Production creates both
   starting-image and legacy source-video intent. Local separation is prepared.
2. **High — cancel destroys the previous selection.** Same file,
   `selectReference` calls `setStartingFrame(null)` before approval; close never
   restores it. Executed diagnostic reproduces this in production and local.
3. **High — paid still before an unresolved handoff gate.**
   `components/explore/hook-starting-frame-workspace.tsx:ready`,
   `generateStartingImage`, `selectStartingFrame`;
   `lib/explore/hook-keyframe-prompt-preview.ts:requiresDecision`.
   No in-flow decision resolution is supplied for the ten blocked catalog cases.
4. **High — refresh drops the selected composer frame.**
   `components/explore/format-workspace.tsx:startingFrame` initialization/setters.
   Restore and revalidate approval separately from reopening preparation.
5. **Medium — unnecessary selectors, history drawer and saving step.**
   Production `hook-starting-frame-workspace.tsx:historyOpen`,
   `selectInfluencer`, `savePreparation`; local unified chooser is pending.
6. **Medium — output review, aspect-ratio tile and Change/history missing live.**
   Production `components/video/video-generation-workspace.tsx:referenceControls`;
   local `components/explore/format-generation-references.tsx:Starting frames`.
7. **Medium — model lock.** Production
   `components/video/video-generation-workspace.tsx:startingFrameError`, model
   setting and startingFrame effect; local model/API/worker fixes are pending.
8. **Medium — limited history and reset settings.** Local
   `lib/explore/hook-starting-frame-history.ts:listRecentHookStartingFrames`,
   `resolveRecentHookStartingFrame`. Recent cap 24; motion is regenerated from
   suggestions and audio resets to false.
9. **Visual acceptance still required.** Test the real app at 1366×768,
   1440×900, 1536×864 and mobile, including 125% zoom. Physical laptop diagonal
   is not the layout input: viewport, OS scaling and browser zoom determine
   available space. Check full-image visibility, readable controls, footer not
   covering content, focus trapping/return, Escape and nested dialog behavior.
   Current local result previews still have a 240px height cap; verify whether
   that is large enough for ordinary review before accepting this layout.

## Intended flow

Preview reference → Recreate overlay → see source frame → Choose image → choose
the influencer/main/support photos → model + Variations + visible cost → Generate
→ all results with enlargement → explicit Use this → approved full-image tile in
Create → Change opens Starting frames → review motion/model/duration/sound →
explicit Generate video.

Close/back preserves the existing composer selection. Refresh restores the same
verified selection. Uploading/choosing images, inspecting prompts, browsing
history and checking job status never generate or charge. Unresolved motion
decisions are disclosed before paying for an unusable continuation.

Review checklist source:
[Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).
Product judgments above prioritize the user's explicit flow and existing design
system. No application behavior was changed or deployed by this audit.
