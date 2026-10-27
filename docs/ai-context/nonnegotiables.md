# UGCPilot Nonnegotiables — Protected Product Contracts

Read before every coding task. Default protection applies until an explicit new user requirement changes the contract. Do not claim this contract is an approved final UI design; validate the actual established design in the repo and with the user when needed.

## UI behavior to preserve

**Hook Video > Create:** Keep Create / Demo / Schedule sections and reference-gallery tabs and their existing route semantics. A loaded starting frame has ONE preview card with a Change action, not a permanent duplicate Choose Photos card. The Change flow must support replacing the selected starting frame and supported additional image references as the product intends. Maintain preview size during restoration (skeleton/fallback). Do not reflow the page unexpectedly.

**Recreate reference selection:** Selecting a video selects the corresponding video, account and prompt inputs. Do not accidentally use stale state from a different video. The source reference, chosen frame and selected influencer must remain explicitly linked; do not swap identity sources for scene sources.

**Schedule:** Preserve a functional date picker and the established **24-hour time picker**, not just `HH:mm` manual typing. Keep the user's entered wall-clock time visible; respect the intended IANA timezone and convert exactly once for server execution. The Schedule button must reflect actual validity, and a success state requires a persisted server-side job and target records, not browser-only state.

**Visual:** Do not add permanent UI elements merely to expose a capability already available through an existing control. No unsolicited change to sizing, spacing, colors, font hierarchy, borders, modal positioning, grid, scroll, fixed CTA, skeletons, navigation, or responsive layout.

## Video-generation behavior to preserve

- Source video is the authority for environment, camera, original motion, actions, pacing, composition and overlays. Influencer reference images are authority for face/identity, not scene.
- Prefer a sufficiently clear first SOURCE frame. If insufficient for facial identity, choose a clearer source timestamp, including middle frames, only after a visibility/continuity review. Separately validate whether the GENERATED influencer frame is clear and identity-accurate; if source is fine but output is not, debug generation rather than automatically choosing a middle frame.
- For a full viral-video recreation, a clear later source frame is an **identity/clarity anchor**, not automatically the animation's first frame. Reconstruct a distinct influencer opening image that matches the source video's real t=0 pose/occlusion and pass that opening image to first-frame animation, or use a separately verified reference-video/multisegment route. Keep both roles and receipts explicit.
- Record frame source timestamp in all artifacts, prompts and generation jobs. Never call a 1.5s source frame `source t=0`.
- If a mid-video still is input as the **first** frame for image-to-video generation, it can normally represent only the source timeline FROM that timestamp onward. Recreating earlier footage requires separate pre-roll generation or backward extension **if supported by the model**, with review; text prompting alone cannot guarantee all earlier actions.
- A source clip's action, head direction, hand gestures, timing and emotions must not be collapsed into generic prose.
- Prompts and selected-frame logic must stay consistent when changes affect either stage.
- For this project's influencer clips, default video to **no generated audio** unless the specific task explicitly asks otherwise. Overlay captions/text should be rendered by the appropriate editor/compositor when exact wording/layout matters, not trusted to generative pixels.

## Safe engineering behavior

- No unrequested dependencies, data schema migrations, IAM/config changes, new permanent UI, refactors or architecture rewrites.
- No deletion/replacement of working functionality because it is difficult to test.
- No silent formatting across unrelated files, no `git reset --hard`, no deleting uncommitted user changes.
- No merging a frontend-only schedule if actual backend scheduling is part of the task. No fake success messaging.
- No passing end-to-end tests by mocking away the important API boundary without additional integration verification.
- Do not mark issue FIXED without proper evidence. Do not assert tests were run if they were not.

## Exception/approval process

If a user explicitly requests a change that contradicts a protected contract: cite the specific contract, explain the conflict and downstream effects, obtain a clear decision when needed, then update the contract and add regression tests with the implementation. Protected means **no accidental change**, not an inability to evolve the product.
