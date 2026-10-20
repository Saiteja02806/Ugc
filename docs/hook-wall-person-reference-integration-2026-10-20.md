# Hook and Wall of Text: integration into the existing Recreate flow

Date: 20 October 2026. Status: implementation design based on local code, the isolated source-edit branch and read-only interaction with production. No generation submitted, provider enrollment performed, database changed or application deployed in this audit.

## User intent and current entry point

The user clarified that the existing Recreate action on a reference card is the main entry point. Selecting that action attaches the card's video as the reference; the common intent is to keep its scene/performance and replace the person’s face. The proposal must fit that page, rather than require a new face-swap page or force a new top-level journey. Users must also be able to create footage from only images and their prompt.

An earlier question about keeping a clip as inspiration was answered by asking us to inspect this real flow. That answer was not a yes/no decision about a new inspiration mode. Do not treat it as approval of a new mandatory mode selector. Broader-reference generation below is a proposed explicit opt-in, not a settled requirement.

## Production observations

Visited `https://getugcpilot.com/explore/hook-video` and `https://getugcpilot.com/explore/wall-of-text` using the existing authenticated browser environment. Followed Recreate on one card in each and opened Hook's image chooser. Never pressed Generate.

- Hook has Create / Demo / Schedule; Wall has Create / Edit / Schedule. Both have Generate / Upload / Creative Assets and References / Your videos.
- Hook Recreate attached the chosen gallery video to the left-hand inputs and set reference provenance in the page URL. It displayed a reference prompt that already states that the image supplies appearance and the video supplies performance; duration followed the reference. This is existing useful behavior, not missing work to reinvent.
- The live Hook image chooser says "Add up to 5 appearance or product images. Describe how to use each image in your instructions." It has Add images, Your images, UGC Pilot images, saved uploaded images and Load more. It does not have a named person, designated primary face, or supporting-view roles.
- Wall Recreate similarly attached its selected video and changed the helper to describe video actions/image appearance. The sampled legacy Wall reference did not display the Hook's curated reference-prompt section. The face-replacement operation therefore must not depend on every catalogue entry having a hand-authored prompt.
- No Sound switch was visible in the inspected live controls. Sound-off contract changes found in the isolated worktree are not treated as production acceptance.
- These observations establish the visible selection flow only. They do not verify the provider request, charging, output quality or deployment of all pending changes.

## Reuse map

| Existing location | What it already does | Targeted change |
| --- | --- | --- |
| `app/explore/hook-video/page.tsx`, `app/explore/wall-of-text/page.tsx` | Both mount `FormatWorkspace` | Keep the routes and workflow navigation. |
| `components/explore/format-workspace.tsx:366` | `selectReference` enters Create, attaches the gallery reference and updates provenance | Record face-replacement intent for that Recreate selection; pass the source's exact ID/revision. No automatic submission. |
| `components/explore/format-workspace.tsx:420` | Hands `styleVideo` to the shared video panel | Make the attached video's purpose explicit. Keep original reference attribution separate from generated-result metadata. |
| `components/explore/format-generation-references.tsx` | Shared upload, saved-image picker, batch upload, limits and previews | Extend in place with Person selection, primary/supporting views, optional Save person and guidance. Keep generic/product references in ordinary generation. |
| `lib/explore/format-reference-images.ts` | Reuses owned uploaded media | Reuse assets by ID. Add a separately validated person-profile resolver instead of weakening the existing upload-only filter. |
| `lib/characters/identity-service.ts` | Saved generated Character resolves to one generated image with verified provenance | Present existing Characters as one-photo starting points. Add uploaded-person profiles alongside them; do not relabel uploads as generated-character jobs. |
| `components/video/video-generation-workspace.tsx` | Shared input state, prompt, settings, job recovery and submission | Store intent, primary/supporting assets and sound explicitly. Make selected primary independent of list order. Preserve drafts when switching intent. |
| Isolated `worker/src/lib/explore-generation-contract.ts` | Version 1 operation/sound contract; source duration/model checks | Add a versioned face-replacement contract and backend acceptance policy, while retaining historical parsers. |
| Isolated `lib/ai-studio/video-generation-api.ts:228–275` | Infers operation from presence of video; checks compatibility before billing | Validate requested purpose rather than assuming all attached videos mean strict editing. Resolve owned references and select the approved replacement backend before credit reservation. |
| `worker/src/jobs/generate-hook-video.ts` and provider adapters | Queue execution, recovery, provider submission, output persistence | Consume the frozen role mapping and backend version; enforce preflight again. Preserve source timing and final silence for the replacement operation. |
| Existing Hook Demo/editor and Wall Edit/scheduling | Work with the selected output asset | Keep these downstream flows. Carry source/identity/sound metadata into the existing media asset and finishing steps. |

The primary worktree contains many unrelated intentional changes. The source-edit/sound work is in `C:/Users/chund/.codex/worktrees/hook-seedance-trending-release/UGC`. Integration must reconcile the relevant changes deliberately; neither a bulk overwrite nor deploying the primary dirty worktree is part of this plan.

## User flow with the smallest visible change

1. The user clicks the existing Recreate action. Keep the attached-video preview, original catalogue identity and measured source duration. The source card becomes clearly labelled as the video being recreated.
2. In Create, show an inline purpose summary: **Keep this video's scene and movement; use your selected person's face.** This describes intended processing; eligibility/acceptance must be established before enabling the paid action.
3. The existing Choose image tile opens a person-aware view for this operation. The user can choose saved uploaded images, use an existing saved Character, select a saved person, or batch-upload photos. They mark one Main photo and label optional Supporting views. Product/scene images must not be silently assigned as identity evidence.
4. Offer **Save person for next time** with a name. Saving is optional: one-off use remains possible. The same profile is available in Hook and Wall. No generation or training is triggered by saving.
5. Keep **Your instructions**, with face-only defaults and optional additional directions. In the face-only operation the user does not need to paste a long face-swap prompt. Explicit requests to change the room, clothing or camera require a visible switch to a broader edit/generation operation; do not silently obey one promise while displaying the other. Do not rely on a fragile keyword detector to understand every conflict. An optional intent control/help action can make this choice explicit without replacing Recreate.
6. Keep the existing **Generate video** button. It submits the selected operation; a new mandatory "Replace face" page/button is unnecessary. Show sound off and the exact cost before submission. If no backend is approved for that clip, keep the paid replacement action unavailable with a useful explanation.
7. The output enters Your videos and the existing editing sequence: Hook can attach a Demo, Wall adds its text in Edit. Do not render new wall text through the face-replacement model.

## Input scenarios and transitions

| Scenario | Intended behavior |
| --- | --- |
| Recreate gallery clip + person | Face replacement using that exact reference and identity; keep source timeline. |
| User-attached reference clip + person | Same replacement operation once explicitly selected; same rules as gallery source. |
| Images + prompt with no clip | Normal new generation; images may be person/product/style references with explicit roles. Do not require a source video. |
| Prompt only | Preserve existing text-to-video support for compatible models. No arbitrary face-photo requirement. |
| Clip + requested broader scene changes | Proposed opt-in broader editing/reference generation, labelled without an exact-source promise. User has not yet chosen the detailed UI for this case. |
| Existing Upload / Creative Assets editing tabs | Continue to take footage directly to trim/text/demo/editing. Do not reinterpret every imported clip as an AI face-swap request. A separate explicit "Use as generation reference" action can be added later if needed. |
| No visible face or several people in the clip | Do not guess a face or claim suitability. Require a supported target selection or direct the user to normal generation/editing. |
| User removes the reference clip | Show that source preservation no longer applies. Preserve person/photos/prompt; use new-generation rules after an explicit user action, without submitting anything. |
| User changes the gallery reference | Replace the active source, clear stale source-specific timing and helper prompt, preserve selected person, recalculate eligibility/cost and do not select an old generated result as the new output. |

## Photo guidance

Product proposal, not a claim that these inputs guarantee accuracy:

- **To start a person profile:** one clear front-facing photo with the whole face visible. The actual generation minimum is the approved backend's documented/validated requirement; profile creation alone must not imply a backend is ready.
- **Recommended coverage:** front, left three-quarter and right three-quarter. Show simple examples of these angles beside the upload slots. Explain left/right from the subject's perspective or show diagrams to remove ambiguity.
- Use sharp, naturally lit photos of one person with unobstructed eyes, nose, mouth, cheeks and jaw. Avoid a hand pressing the cheek, strong beauty filters and heavy shadows when possible.
- Do not demand 9:16 or 4:5. The face's useful pixel detail and view coverage matter more than canvas ratio. Do not stretch face geometry to force an aspect ratio.
- Exact duplicates count once. Detect same asset IDs immediately and identical uploaded content through a hash; renamed copies should not satisfy extra-view guidance. Similar front-facing photos get a coverage suggestion, not a claim of guaranteed automatic angle recognition.
- Three repeated frontal pictures are not equivalent to three distinct views. Add more only for useful missing views and only within supported backend limits. If a backend consumes one photo, show that it uses the selected main photo; do not pretend the remaining photos are passed or fused.
- A low-quality or unsupported reference should be identified before charging. Quality screening is not a promise of exact facial proportions.

## Saving people without duplicating media or breaking Characters

Use a typed, owner-scoped **person profile** that references existing media records. Suggested information: profile ID, name, version, primary image asset ID, ordered supporting image asset IDs, user-labelled view roles, creation/update time and status. Optional provider enrollment handles belong to a separate provider/version binding and exist only after an actual approved training/enrollment operation.

The existing media library handles file storage and thumbnails. Saving a profile groups references rather than uploading copies, copying signed URLs into a permanent record or moving an uploaded image into the generated-character collection. Existing saved Characters can be used as one-image profiles through an adapter. Generic Creative Asset groups are not proof that their members depict one person; do not automatically convert all groups into identities.

Use a dedicated profile record rather than placing mutable global identity meaning on one image's metadata. An image may belong to more than one user-created set. Before implementing a migration, inspect current database schema/migration state and apply local validation first. The repository uses verified Firebase owner IDs with server-side storage access; preserve that authorization pattern rather than adding mismatched UUID `auth.uid()` rules by assumption. No schema change occurred in this audit.

The API must validate ownership, image readiness and missing/deleted assets. Updating a saved person creates a new profile version; already-submitted jobs retain their prior version and resolved inputs. Removing a profile should not automatically delete the photos or completed videos. Normal media-deletion rules still apply to referenced files. Load cover thumbnails and reference counts for the chooser; fetch full details when selected so this feature does not recreate the slow image-picker problem.

## Backend admission and request contract

"One approved backend" means the service and configuration actually doing the replacement. It is an internal selection made by UGC Pilot after testing; it is not an additional step for the user and not a claim that a backend has already passed. Existing Seedance access on ReAPI does not by itself qualify it. Keep that integration; no silent provider migration.

Keep the current source-edit version 1 parser for historical jobs. Proposed version 2 fields include:

- format and intent (`replace_face`, `generate`, or separately supported broader edit),
- source kind/asset or catalogue reference ID and immutable revision,
- person profile ID/version or explicit one-off primary/supporting owned asset IDs,
- separate non-identity references only for applicable operations,
- source-caption removal setting and sound choice,
- backend/profile version resolved by the server, plus a sanitized audit receipt.

The backend resolver validates source length, resolution, source face/occlusion support, photo count, actual multi-view capability, sound support and acceptance status. The approved-backend list for strict replacement is currently empty. A source-compatible video generator does not become face-qualified by passing a file-format test.

Check unsupported inputs before billing and verify again in the worker. Retain existing idempotency/recovery and freeze the role mapping, source hash, profile version, model/provider configuration and billing basis at submission. Never silently truncate supporting images, reorder the main photo, pad a short source or choose a different provider after a failure. Prepaid quoted work must not turn into multiple unapproved paid retries.

Reference performance text is useful context, but not the authority for identity roles or sound. The live Hook example includes repeated instructions requiring silence; structured audio/identity settings need canonical precedence and conflict reporting. Keep the user's prompt intact, separate role instructions from catalogue performance notes, and avoid appending contradictory default text when sound is explicitly enabled. A face-only backend may not support arbitrary prompts; make unsupported changes visible instead of accepting and ignoring them.

## Sound and finishing

Keep the user's accepted sound-off default. It must be enforced in the finished generated clip, not only by muting its preview or adding prompt words. A selected reference's paired music must not override it, and rejected Hook soundtracks 3/13/59 must remain disabled.

If the user turns sound on, show what will be used. For face replacement, retaining source audio or attaching a chosen soundtrack is different from generating speech. Do not invent dialogue or alter lip movements as a side effect. For new generation, generated sound is available only where the backend supports it. Existing explicit Demo or later editor audio choices must remain visible and obey their chosen scope; do not silently mute or add sound to unrelated clips.

## Verification required before release

1. Recreate from Hook and Wall selects the exact catalogue revision and correct intent; no generation starts on selection.
2. A one-off primary photo and a saved person's primary resolve identically. Reordering supporting photos never changes primary.
3. Same-name/different-person profiles remain distinct; cross-account/stale/deleted references are rejected.
4. Batch upload preserves selected order and partial successes; duplicate files cannot inflate view coverage. Picker remains responsive with many saved images and profiles.
5. Image+prompt and prompt-only requests work without a video; product references are not treated as face views.
6. Removing/changing a reference cannot resurrect a stale clip, prompt, cost or previous result. Switching purpose preserves editable draft content and clearly displays active inputs.
7. Unsupported source/model/count and an unapproved replacement backend produce no credit reservation and no provider POST. Test using mocks.
8. Pending requests, refresh, retries and profile edits preserve the originally submitted asset/profile/backend snapshot and do not double charge.
9. Old jobs/media/drafts remain readable and are not automatically upgraded into a paid strict replacement. Extend every generation/finishing/silence reader consistently for the new contract version.
10. Sound off yields no output audio and no automatic paired-music attachment; sound on has a clear source. Existing disabled tracks remain disabled.
11. Face replacement preserves source duration/framing and sends the result through Hook's Demo and Wall's Edit/overlay path without flattening the two workflows.
12. Free contract tests cannot establish facial fidelity. A separately approved visual benchmark must cover facial proportions, expressions, hand occlusion, temporal drift, source preservation, caption removal and silence. Then broaden to representative eligible clips before a product-wide claim.
13. After deployment is separately authorized, perform final authenticated acceptance on the real production domain. Local fixtures/build success do not count as live acceptance.

## Implementation sequence

1. Add the shared typed input state, person-profile resolver/storage, role-aware picker guidance and request contract behind a disabled replacement feature. Reuse existing uploads/library/selection/recovery rather than create a parallel video workflow. Verify with mocked providers and local preview.
2. Qualify a commercially usable dedicated replacement backend against the agreed assets and supported range; ask before any paid call. Determine exact photo minimum/capacity from that chosen backend, not a generic image-count promise.
3. Wire the approved adapter into the existing queued job/result path; inspect the full output and finishing behavior. Activate the user-facing replacement action only when the engine passes and release authorization is given.

This plan fits the existing Recreate interaction. The user is being asked to choose footage and a person; UGC Pilot owns the backend choice and does not expose a claim of facial accuracy until it is supported by evidence.
