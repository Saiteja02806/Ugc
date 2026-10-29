# UGCPilot Nonnegotiables — Protected Product Contracts

Read before every coding task. Default protection applies until an explicit new user requirement changes the contract. Do not claim this contract is an approved final UI design; validate the actual established design in the repo and with the user when needed.

## UI behavior to preserve

**Slideshow reference gallery:** Do not display slideshow names, numbers used as names (for example Slideshow 1/2), or category-name captions (for example Fitness) beneath reference cards. Preserve reference IDs and descriptive accessible names internally, slide-count badges, preview/recreation behavior, selection feedback and source links such as Creator profile / Original post. Slideshow Recreate buttons use rounded pill corners; this rule does not restyle Hook or Wall cards.

**Hook Video > Create:** Keep Create / Demo / Schedule sections and reference-gallery tabs and their existing route semantics. A loaded starting frame has ONE preview card with a Change action, not a permanent duplicate Choose Photos card. The Change flow must support replacing the selected starting frame and supported additional image references as the product intends. Maintain preview size during restoration (skeleton/fallback). Do not reflow the page unexpectedly.

**Recreate reference selection:** Selecting a video selects the corresponding video, account and prompt inputs. Do not accidentally use stale state from a different video. The source reference, chosen frame and selected influencer must remain explicitly linked; do not swap identity sources for scene sources.

**Schedule:** Preserve a functional date picker and the established **24-hour time picker**, not just `HH:mm` manual typing. Keep the user's entered wall-clock time visible; respect the intended IANA timezone and convert exactly once for server execution. The Schedule button must reflect actual validity, and a success state requires a persisted server-side job and target records, not browser-only state.

**Visual:** Do not add permanent UI elements merely to expose a capability already available through an existing control. No unsolicited change to sizing, spacing, colors, font hierarchy, borders, modal positioning, grid, scroll, fixed CTA, skeletons, navigation, or responsive layout.

## Video-generation behavior to preserve

- Source video is the authority for environment, camera, original motion, actions, pacing, composition and overlays. Influencer reference images are authority for face/identity, not scene.
- **Current user policy, 28 October 2026: original opening only.** For every new recreation, use the source video's first decoded frame at elapsed t=0 for starting-image preparation. Do not select or attach a later clarity frame, even when the opening face is obscured. Preserve the source opening pose/occlusion and review the generated influencer image separately; an inadequate result stays unapproved rather than silently substituting a later pose. This supersedes earlier first/middle-frame fallback guidance for new work; application migration and generated-output acceptance are separate, still pending steps.
- Keep historical later-frame bindings, jobs, images and receipts immutable and truthfully timestamped. Their recovery is not permission to create new middle-frame requests or call a later image t=0.
- **Current cleanup policy, explicit user override 28 October 2026:** new original-opening image preparation removes captions, watermarks, physical logos, branding and readable text on clothing, props, screens and background surfaces. Preserve the actual objects, fabric, shape, color, scene and source illumination; reconstruct plain material rather than blurring, cropping or replacing props. New animation must not regenerate removed lettering. Earlier preserve-physical-text guidance remains historical only; do not rewrite old frozen prompts or receipts. Visual removal and identity/scene fidelity require generated-output review.
- **Source-speed initial trim:** when the source is shorter than the selected provider duration, complete its measured actions by the source endpoint, then hold. Freeze this timing in the new job and initialize only an untouched Hook editor with the reversible endpoint. Retain the full raw clip. An existing server draft, local draft, explicit empty text or pending save takes priority. Timed instructions and a trim do not prove the ending was generated before the cut.
- **Initial Hook text layout:** new automatic plans freeze layout version 1; new unstyled manual Hook Remix uses the same measured wider fit. Preserve exact words and explicit newlines; use bounded font growth within safe bounds. Missing layout versions keep historical shrink-only behavior. Never refit an existing styled overlay or apply new defaults to recovered saved edits.
- **Source lighting is part of the shot:** preserve its light direction, softness, exposure, contrast, color cast, shadows, reflections, clothing and scene geometry. Relight the influencer to that source environment while retaining their identity and natural skin detail. Do not copy identity-photo lighting, room, clothing or pose; do not promise exact untouched pixels from generative recreation. Review lighting, outfit, identity, pose and caption cleanup separately.
- **Reuse identity photos on supported video routes:** carry the same selected, owned influencer photos from image preparation into video generation when that route explicitly supports a literal first frame plus appearance references. Preserve photo order, provenance and explicit user removals/changes; never add a new chooser for the same selection. Keep role tags and payload roles explicit. Unsupported models receive only the approved first frame; do not reinterpret a portrait as a last frame or silently switch provider/mode. Extra photos may improve consistency but require visual verification; they do not guarantee it.
- Record frame source timestamp in all artifacts, prompts and generation jobs. Never call a 1.5s source frame `source t=0`.
- If a mid-video still is input as the **first** frame for image-to-video generation, it can normally represent only the source timeline FROM that timestamp onward. Recreating earlier footage requires separate pre-roll generation or backward extension **if supported by the model**, with review; text prompting alone cannot guarantee all earlier actions.
- A source clip's action, head direction, hand gestures, timing and emotions must not be collapsed into generic prose.
- Prompts and selected-frame logic must stay consistent when changes affect either stage.
- For this project's influencer clips, default video to **no generated audio** unless the specific task explicitly asks otherwise. Overlay captions/text should be rendered by the appropriate editor/compositor when exact wording/layout matters, not trusted to generative pixels.

## Safe engineering behavior

**AI influencer prompt Skills (27 October 2026):** Explicitly selected config presets may append instructions once to the user's prompt. No selection retains the existing prompt behavior. Keep the textarea, result preview and History display limited to authored text with separate skill names; Copy uses the frozen complete model prompt. Persist the raw/merged distinction in the owned job snapshot, preserve uncertain-request IDs and validate the combined prompt length before spending credits. Never infer selected skills by stripping matching text from a legacy prompt.

- No unrequested dependencies, data schema migrations, IAM/config changes, new permanent UI, refactors or architecture rewrites.
- No deletion/replacement of working functionality because it is difficult to test.
- No silent formatting across unrelated files, no `git reset --hard`, no deleting uncommitted user changes.
- No merging a frontend-only schedule if actual backend scheduling is part of the task. No fake success messaging.
- No passing end-to-end tests by mocking away the important API boundary without additional integration verification.
- Do not mark issue FIXED without proper evidence. Do not assert tests were run if they were not.

## Exception/approval process

If a user explicitly requests a change that contradicts a protected contract: cite the specific contract, explain the conflict and downstream effects, obtain a clear decision when needed, then update the contract and add regression tests with the implementation. Protected means **no accidental change**, not an inability to evolve the product.

**Full source duration for new Hook recreations (29 October 2026):** choose a supported generation duration that covers the measured source. A4-second or5-second source must not be shortened to a provider's default minimum. Reject a shorter new request before reserving credits; use a final hold only for generated excess and initialize trim to the source endpoint. Existing jobs/receipts and user-saved trims remain immutable. This extends the source-speed initial-trim rule; Wall full-duration policy remains separate.

**Talking Head voice-reference exception (29 October 2026, explicit user approval):** with an approved t=0-prepared image plus selected voice reference and Sound on, WAN/Seedance may use image_voice_reference mode. The prepared image is a general visual reference, not a guaranteed literal first frame; keep its owned image/job/source receipt in the durable job. Audio guides voice/delivery and must not silently become background music or overwrite the user's script. Without voice audio retain literal-first-frame behavior. Public Hook/Wall, historical jobs and user-saved edits do not inherit this exception. Verify provider mode, ownership, sizes/durations and recovery before billing; no silent model switch or dropped references.
