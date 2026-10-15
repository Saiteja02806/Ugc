# Explore context and UI decision record

### Finishing worker idle-cost policy — 16 October 2026

- The authenticated interactive finishing HTTP service remains enabled with
  the same image, environment, ownership rules, task URL, request timeout and
  one-request concurrency. It can now scale to zero when idle; enabling
  interactive finishing no longer forces a warm instance. Accept the first
  request's startup delay. Heavy rendering retains its existing Cloud Run Job
  launcher, slots and execution lifecycle. No editor, save or schedule flow
  changes accompany this infrastructure-only change.
- Old unused tagged revisions were detached after endpoint checks. Startup and
  authenticated no-work task delivery passed, and 51 related regressions passed.
  This does not constitute a newly rendered customer video or measured cold
  start from zero. Detailed evidence: `docs/worker-idle-cost-rollout-2026-10-16.md`.

Last reconciled: **15 October 2026**.

### Influencer workspace references and downloads — 16 October 2026, local implementation

- Build AI influencer results support independent multi-selection. Selected images
  become numbered reference thumbnails beside the composer; My influencers also
  supports selecting up to ten saved images and applying them together with
  **Use images as references**. Each reference can be removed individually or
  cleared together. A selected reference stays attached when its result card is
  dismissed from the workspace. Uploading a reference retains the existing
  uploaded-image mode and replaces the saved-image selection.
- The × on a completed result only dismisses that card from the current visit.
  It never deletes media, removes a saved influencer, or discards job recovery or
  History. Opening an image explicitly from History can show it again.
- Result cards and My influencers provide authenticated image downloads with
  short-lived attachment URLs. Ownership and ready media are verified by the
  server using the saved asset ID; browser-supplied storage URLs/keys are ignored.
- Multi-image requests carry ordered owned influencer IDs through admission,
  durable retries and every supported worker/provider adapter. The user's prompt
  stays unchanged. Reference order participates in idempotency. Partial reference
  restoration blocks generation instead of silently dropping context.
- These changes require both web and worker deployment. Local fixture/API checks
  do not constitute authenticated acceptance on `https://www.getugcpilot.com`.
  See `docs/influencer-image-actions-2026-10-16.md` for verification details.

### Reference performance prompts — 15 October 2026, local pilot

- The user selected the original detailed approach: a short replacement
  instruction, one clip-specific action/expression paragraph and preservation
  priorities. The later numbered five-part template is not the default.
- Selecting a reviewed video exposes an editable **Reference prompt** block
  beside the user's instructions. Remove prompt keeps the video attached;
  Restore prompt restores the approved suggestion. An info disclosure explains
  its purpose. Switching reference replaces its suggestion without overwriting
  the user's separate instructions. The submitted prompt joins exactly those
  visible fields; the server must not secretly append removed suggestions.
- Each suggestion contains overlay text/caption/emoji removal and no-new-text
  instructions. Physical signs/packaging text are preserved. Do not hardcode
  the test influencer's hair, clothing or image into library entries. Identity
  replacement is conditional on an attached influencer image. User instructions
  follow the suggestion and may request deliberate changes.
- Thirty-six active Hook references have reviewed entries in
  `lib/explore/reference-video-prompts.ts`. The first three were initially sampled;
  all reviewed entries have been inspected through every decoded frame. Hooks 01–09 have
  92, 92, 110, 94, 96, 112, 78, 79 and 85 inspected frames respectively.
  Review method is `all_decoded_frames`, not a claim of real-time playback,
  audio review or generation-quality acceptance. Hooks 01–03 and 06 have
  single-frame screen-view tails; Hook 07 also has a single-frame laptop/pen tail.
  Hook 04 has a brief caption/browser tail; Hooks 05, 08 and 09 stay in their
  original scene. Keep source tails brief; do not extend them or
  silently trim the original. Version 2 paragraphs record the precise gestures.
  Scope clarified by the user: only Hook video workflow references for now.
  Its active catalog contains 98 videos: 36 reviewed prompts and 62 remaining.
  The earlier 195/192 totals incorrectly included 97 Wall videos. Wall of Text
  and slideshows are outside this prompt rollout. No Wall prompts were prepared.
- Review Remix source captions during the same video inspection. Use the existing
  source-hash-bound `reference-text-catalog.json`, preserving original wording,
  emojis and caption timings; exclude app UI, packaging and incidental text.
  Do not put Remix captions into the footage-generation prompt. Hooks 04–36
  were rechecked in this combined pass; Hook 04's final instruction begins at
  3033 ms, correcting its earlier 3200 ms sampled boundary. Other existing
  caption entries retain their previously recorded review provenance.
- Hook 14 cuts to a calm second take at frame 170 / 5667 ms; the creator caption
  ends there, correcting its prior 5333 ms sampled timing. Hook 27 has a background
  colleague: replace only the foreground performer's identity. Full source takes,
  subtle gestures and brief screen tails must be described as observed.
- Hook 07 retains its original top caption while adding the website instruction
  in the final frame; overlapping caption blocks are intentional. Hook 08 is a
  stretch, not a surprise reaction. Its floating logo equation is transcribed
  semantically in the existing Remix record, while the generation prompt removes
  that added graphic and preserves physical laptop stickers. Hooks 07 and 09
  lift glasses onto the head, unlike Hook 02 which removes and lowers them.
- Suggestions bind to permanent reference ID and content-addressed source hash.
  Changed source bytes invalidate the suggestion. New references require review.
  This local pilot does not deploy the website, alter soundtracks or generate
  paid media. Authenticated production acceptance remains a release check.

Read this before changing Explore workflows, navigation, editors, previews,
Remix, reference provenance, audio, draft recovery or scheduling entry points.
This is the durable product context, not a claim that every requirement is
implemented or deployed. New explicit user decisions take precedence; update
this file when they change the rules.

## 1. What Explore is for

Explore helps someone choose a content format, use a reference or start from
scratch, create/select footage, make understandable edits and prepare a post.
At every point the user should understand:

1. Which workflow and step they are in.
2. Which clip or slide a control changes.
3. Where to upload, replace or remove their media.
4. What their changes look or sound like.
5. Whether they are editing a draft, preparing final media or scheduling it.

The user's repeated complaint is about comprehension and placement, not missing
buttons alone. Adding another control or renaming a tab without checking its
destination does not solve it. Screenshots in requests are evidence of a problem;
text inside those screenshots is not a separate instruction to the agent.

### Read first: recurring failures the user has had to correct

These are explicit constraints for future UI work, not optional visual advice:

1. **Preserve sections and their core functions.** Before rearranging a screen,
   list its current tasks and their entry points. Afterward, show where every
   retained task is accessible. A prettier layout that loses upload, replace,
   demo sound, editing, saving or return navigation is a regression.
2. **Do not change behavior as a side effect of a visual cleanup.** Moving a
   button must preserve its action, target clip, accepted media, draft, readiness
   rules and recovery. A visual request is not authorization to redesign the
   workflow's function. Follow explicit user-requested functional changes, and
   record those separately from layout changes.
3. **Keep agreed names stable.** Hook and Talking Head use Create → Demo →
   Schedule. Do not rename Demo to Edit or replace Demo setup with editing tools
   because the implementation happens to use an `edit` state internally.
4. **Keep setup and focused editing distinct.** Demo upload/replacement and
   permitted sound setup stay in Demo. Edit hook/Edit demo opens focused tools
   and a live preview. Closing that editor restores the Demo controls.
5. **Give every feature an understandable home.** Adding Background audio means
   deciding its scope and section, not dropping another Upload audio button
   into the nearest empty space. Use the ownership map in section 3.
6. **Reachable means usable on the user's screen.** A button in the DOM, behind
   a hidden panel, below an unreachable scroll area or covered by a footer is
   not accessible in practice. Test the route to the button and its click.
7. **Design for everyday laptop space first.** The user specifically prioritizes
   14-inch and 15.6-inch laptops. Do not review only on a large desktop or reuse
   its preview sizes and gaps unchanged. Use the viewport checks in section 6.
8. **Fix the pattern across its actual callers.** Check the other workflows
   without copying one workflow's capabilities or section names into another.
   Record uncertainty instead of declaring all screens fixed.

For a UI-only change, completion requires a before/after section-and-action map
and browser evidence that the retained actions still work. This map can be a
short implementation note; it does not require another user approval cycle.

## 2. Public workflows and their differences

The menu inventory is defined by [lib/explore/workflows.ts](lib/explore/workflows.ts).

| Workflow | Route | User-visible steps | Content being edited |
| --- | --- | --- | --- |
| Talking Head + Demo | `/explore/create-hook` | Create → **Demo** → Schedule | Talking-head opening, optional demo, final composition |
| Hook video | `/explore/hook-video` | Create → **Demo** → Schedule | Hook opening, optional demo, one shared background track |
| Wall of text | `/explore/wall-of-text` | Create → Edit → Schedule | One background video with full-duration wall text; optional advanced video controls; no demo composition |
| Slideshows | `/explore/slideshows` | Create → Edit slides → Schedule | Ordered images with text and appearance per slide |

**Do not mechanically rename every second tab to Demo.** That decision applies
to Hook and Talking Head, which have a demo step. Wall edits one video;
Slideshows edits slides. Extending either with a demo is a separate product change.

Creator Shows App on Phone remains hidden, even though retained components share
some code. Recreate redirects into current workflows; it is not a fifth public
workflow. AI influencer creation, AI Studio and Audio generation are adjacent
tools, not covered end to end by a video-editor check. Explore Slideshows and
the separate Carousel system must not be conflated; Carousel changes also require
reading `CAROUSEL_CONTEXT.md`.

### Naming traps in the implementation

- Talking Head uses `HookWorkflowPreview` and internal section value `edit` for
  the user-visible **Demo** step. A label change need not change saved URL values.
- Hook video uses `FormatWorkspace` with `format="hook"`; its overview uses
  internal step `demo`. A focused clip editor is additional state, not another
  top-level workflow tab.
- Wall uses `format="wall_text"`; Slideshows uses `format="slideshow"`.
- `FormatVideoEditor format="hook"` is also used by Talking Head. This does
  **not** give those products identical reference or audio capabilities.

Preserve existing deep-link/restoration behavior when changing visible labels.

## 3. Screen responsibilities and navigation

### Feature ownership: where controls belong

Choose the user's task and scope before choosing a position. Do not split one
feature across unrelated sections merely to fill space. Related controls should
have one named group with the entry, current selection, replacement/removal and
relevant feedback together.

| Task / feature | Home and grouping | Placement to avoid |
| --- | --- | --- |
| Generation source, references and instructions | Create; group source choices with their accepted selection and status | Putting generation inputs inside a focused clip editor |
| Demo upload, replacement and removal | Demo overview in Hook/Talking Head; selected filename and Replace/Remove next to its source controls; card Change may lead to that same group | Hiding the entire group once a preview exists; replacing it with trim/text tools |
| Edit hook / Edit demo | Compact action attached to the matching preview card; opens that clip's focused editor | Unlabeled Edit far from its clip, or a top-level Demo tab repurposed as editing tools |
| Workflow background audio/music | One clearly named composition group in Demo for Hook/Talking Head, showing the track's whole-video scope; any Create entry must reflect the same choice | Separate competing hook/demo background selections, duplicate Upload audio groups with unclear scope |
| Talking Head Demo sound | Distinct optional group beside Demo setup; clearly says it affects the demo only | Treating it as the whole-video background track or removing it during layout cleanup |
| Hook demo's original volume | Compact original-sound control in Demo setup; preserves the existing footage sound | Sound panels or separate demo-audio upload/library groups in focused editing |
| Text, Remix and appearance | Focused editor; reference Remix prominent, style controls beside the text where width permits | Duplicate Remix on overview; style sliders in a distant unrelated panel |
| Clip Save and return | Stable editor footer with distinct primary/secondary emphasis | Schedule occupying Save's role or a footer covering controls |
| Final preparation and scheduling | Composition overview/preparation status and Schedule review respectively | Repeated preparation/refresh controls overwhelming the clip editor |

For example, “add background audio” must answer: does it span the whole video,
which existing group owns it, how is the current track shown, and where can it
be changed? For Hook, it is one choice spanning opening and demo; Talking Head's
allowed Demo sound remains a separate, explicitly scoped capability. The music
prototype described in section 4 does not create an exception to this rule.

### Create

Keep generation, upload and Creative Assets entry points understandable. A
reference is optional where supported. Generation instructions belong here;
Remix instructions belong with text editing. Keep generation progress and ready
results reachable after selecting a clip.

Talking Head's Create action reads **Continue** and opens Demo. Hook's next-step
action must also lead to its Demo overview, with labels matching the destination.
Do not add a second overview Remix form to make text editing discoverable.

### Demo overview: Hook and Talking Head

- Show separately named opening and optional Demo video previews.
- An absent demo has upload/selection actions; an existing demo has visible
  replacement/removal actions and **Edit demo video**.
- Show **Edit hook video** for the opening. These compact actions edit the
  named clip; replacement selects different footage.
- Keep Demo upload/replacement controls accessible alongside the preview cards.
  Showing cards must never hide every way to replace their media.
- Change/Replace must open the picker or visibly reveal and focus its source
  choices. On mobile, reveal the correct panel before focusing the control.
- Current Hook demo-card **Change** calls `chooseDemoInDemo`: reveal Demo
  controls, scroll to and focus Replace demo. It does not itself open the native
  file picker. Replace demo opens that picker; Creative Assets opens saved
  choices. Failed replacement retains the accepted demo and edits. Describe
  this two-step path accurately; do not claim a one-click picker from the card.
- Final composition settings belong here. Apply the workflow's audio rules below.
- Returning from Schedule must retain both clip edit entry points, even when a
  final video has already been prepared.
- Empty Hook/Demo slots use portrait **9:16 upload areas**, with source selection
  centered inside each slot. Center the pair within the available preview panel;
  do not leave two shallow cards anchored at its upper-left with a large unused
  area to the right. Scale placeholders with usable viewport height and wrap when
  two no longer fit. This shape is for empty slots only: selected footage keeps
  its actual ratio and its existing edit/replace actions.
- Apply the same empty-demo canvas treatment in Talking Head's overview without
  transferring its separate demo-audio capability into Hook. The public second
  step remains **Demo**; opening a focused editor does not rename that stage.

### Focused clip editors

Edit hook video, Edit demo video and Wall's advanced editor show the selected clip's tools
and live preview. Hide Create/Demo/Schedule tabs and unrelated upload/composition
settings while focused editing is active. Returning restores the overview and
its controls without clearing the draft.

Use a compact draggable trim timeline, text/Remix controls and a narrower
appearance inspector. Hook and Talking Head's focused clip editors do not need
a Sound panel: audio setup belongs in Demo. Hook's demo editor also has no
Crop & zoom tools; their presence was unnecessary and lengthened the inspector.
Wall remains a single-video workflow, so its one audio group stays in advanced Edit.
On desktop, use the available width deliberately;
on narrow screens keep the preview usable while tools scroll. Do not restore
full-width style selects, two enormous trim sliders or a long unstructured form.

### Wall of text: simple text editing, optional advanced controls

Wall's Edit step first shows the live preview, **Remix text** and **Your wall of
text**. Reference-backed clips keep the reference Remix expanded; scratch/upload
clips retain the nearby optional Remix entry without fabricated reference text.
Keep the text column compact and use its width; do not leave a blank inspector
column beside simple text editing. One compact **Edit** action below the text
opens the full advanced tools (trim, text style and the single video audio group).
**Back to text** returns to the simple view. These views share one mounted editor,
draft and player; opening/closing advanced tools must not clear text, style,
audio or trim, submit generation, save implicitly or restart the preview.
Leaving and re-entering Edit starts with the simple text view and keeps the draft.

Wall overlays cover **0 through the end of the selected trimmed clip**. Do not
show Show from / Until, per-block timing badges or instructions about individual
block timing in Wall, even inside advanced tools. Normalize recovered legacy
Wall text and newly applied Remix/manual text to the whole selection. Shortening
or lengthening trim updates the end of every Wall block. Preserve all existing
blocks and their separate styles/positions; do not drop blocks as a shortcut.
Hook and demo timed blocks retain their existing timing behavior.

### Slideshows: reference, generation and slide editing

Catalogue cards use topic names such as **Fitness**, **Goal Tracker** and
**Interview App**, without import sequence suffixes such as 01. Apply this at
the catalogue-to-reference boundary so gallery cards, selection and dialogs agree.
Keep original catalogue metadata, reference/slide IDs, media URLs and ordering
unchanged. Do not remove slide-position numbers from editing/navigation, rename
user uploads or apply this rule to Hook/Wall reference names.

Create selects catalogue/uploaded reference images and accepts instructions.
**Selected slides × Versions determines output count.** Five selected reference
slides and two versions produce ten independent image jobs, grouped as two
ordered five-slide versions. Each output uses the corresponding reference slide
as its primary layout, the other selected slides as context, and the same frozen
business context/instructions. Quantity is versions, not total images. Show the
total credit estimate before submission. Selecting more than ten source slides
blocks submission rather than clipping the selection. Recreating one existing
slide still produces versions of that single slide. Legacy requests without a
slide count keep their original one-image-per-quantity behavior for recovery.

Business context is loaded server-side from the authenticated owner's applied
Settings profile, whitelisted and frozen into every new slideshow job. Missing or
unavailable context blocks admission before billing; do not silently generate
without it or trust a browser-supplied business profile. The worker builds the
provider prompt from that snapshot; the visible user prompt stays clean. Flare
is the default slideshow image model, with Sunburst and Nano Banana also offered.
The existing `gpt_image_2_5` ID continues to mean Sunburst for saved jobs.

Edit slides supports selecting, reordering, removing, uploading/replacing and
recreating a slide, plus manual/Remix text and appearance with a live preview.
Replacement retains that slide's identity, text and neighbors. Text baked into
image pixels requires Recreate/Replace; added text is directly editable. Save
prepares edited images and stores the exact sequence in Library. Interrupted
saves retain their request identity; editing invalidates the prior schedule output.
Schedule uses the saved image sequence, without a video/demo/audio stage.

The first complete generated version can populate an **empty** editor. Never
replace a user's current draft when another version finishes. **Edit version**
opens all of that version's owned images in source order. The account-owned
**History** entry remains visible even when the current session is empty; new
batch metadata reopens a whole version. Older ungrouped generations remain
individual reusable images, not invented slideshow sets.

Changing versions archives the current editable draft, with an **Earlier drafts
on this device** selector (up to twenty). The active draft also restores on this
browser. **Saved slideshows** opens Creative Assets → Saved, where Explore items
have **Edit slides**. New saves store validated editable source IDs and text in
Library metadata alongside rendered outputs; reopening makes a new editable draft
and never mutates the existing Library item. Original images are rechecked for
ownership/readiness. Legacy saves can reopen their retained owned rendered-image
IDs, but text baked into those images cannot become separate editable text.

Current restriction: the slideshow composer requires a catalogue reference, an
attached instruction image or a regeneration image. Plain prompt-only scratch
generation is blocked. Users can upload their own output slides without a
catalogue. Do not claim prompt-only scratch creation is supported. Saving still
supports **2–10 slides per version**, not all versions combined. Production
saving requires its rollout flag and access. Local tests are not proof of
provider quality, visual acceptance or production execution.

Hook and Wall now also expose their existing account-owned generation History
in Create, without requiring current-session results. Talking Head + Demo retains
its separate Saved drafts entry (`/explore/create-hook?drafts=1`) and Creative
Assets reuse; it does not yet have the same in-workflow generation-history drawer.
Media history, browser-local editable drafts and server-saved outputs are different
recovery capabilities. Never describe one as proof of all three.

Returning to earlier work must be explained per workflow:

| Workflow | Where users resume | Limit to state honestly |
| --- | --- | --- |
| Slideshows | Create → History for generated versions; earlier editable drafts in the editor; Library → Edit slides for saved Explore sets | Older Library images can contain baked-in text; that text cannot become an editable overlay automatically. Device-local drafts are not cross-device history. |
| Hook video | Create → History or Creative Assets to select earlier footage, then Demo → Edit hook video / Edit demo video | Clip edits are scoped to the owned source and editor scope. Generation History is not a gallery of every previous two-clip composition. |
| Wall of text | Create → History or Creative Assets, then Edit for text and optional advanced controls | Reopening the same owned source can restore its saved clip draft. A final rendered MP4 alone does not reconstruct all editable text. |
| Talking Head + Demo | Saved drafts from the workflow / `/explore/create-hook?drafts=1`, or Creative Assets for existing media | Its saved workflow session is different from the Hook/Wall generation-history drawer. Do not claim an equivalent drawer exists. |

### Save, return, final preparation and Schedule

| Action | Meaning and placement |
| --- | --- |
| Save edits | Primary editor action; saves the selected clip draft, not an implicit paid regeneration or final render |
| Back to videos | Secondary editor return to the opening/demo overview; retains draft state |
| Back to Create | Wall/slideshow return where that is the actual destination; never label it Back to previews if it opens Create |
| Prepare final video | Combines the current composition when required; does not replace clip editing |
| Schedule video | Proceeds to review/scheduling under the existing readiness rules; must not obscure or substitute for Save edits |

Keep primary and return actions in a consistent, visible footer. Final-render
status should not flood the clip editor with preparation/refresh buttons. Source
replacement and edits invalidate stale final output as appropriate. Schedule
must use the current confirmed composition, not an older prepared file.

Wall without a selected clip should expose Create's source controls and gallery,
not an isolated full-screen empty editor with all navigation hidden. A saved
`editVideoId` still requires restoration/loading/error handling; do not discard
it just because the asynchronous asset has not arrived yet.

## 4. Audio rules — keep the products distinct

| Workflow | Background music | Demo-specific added audio | Original footage sound |
| --- | --- | --- | --- |
| Hook video | **One track across hook and demo**; reference audio is not a second simultaneous background track | **No separate demo-audio picker**, in overview or focused demo editor | Original footage may have sound; any retained original-volume setup belongs in Demo, not a second editor Sound panel |
| Talking Head + Demo | One optional background-music track across opening and demo | Optional separate **Demo audio** track plays **only during the demo** | Talking-head footage already contains the influencer's speech; no default extra talking-head audio upload is required |
| Wall of text | **One complete background track** for its single video | Not applicable | Single clip's original sound is distinct from its background music |
| Slideshows | Do not infer video/demo music support from shared UI | Not applicable | Not applicable to still-image footage |

### Talking Head: name the three audio layers by scope

The user's latest clarification distinguishes these layers. Avoid using
“Demo sound” to mean both a demo-only track and whole-video music:

1. **Talking-head speech (in the video):** the influencer is already speaking
   in the generated/selected footage. Keep that speech. Do not make an extra
   talking-head audio upload the default or require one to continue.
2. **Demo audio — demo only:** optional user-added audio for the demo segment.
   It starts with the demo, stops with the demo, and is not played over the
   talking-head opening. The current UI's Demo sound control represents this
   capability. Its content may be music or another user-supplied recording;
   the defining rule is its demo-only timing.
3. **Background music — entire video:** optional music underneath the complete
   talking-head-plus-demo sequence. “Background sound” means music in this
   requirement. It is one composition track, not the demo-only attachment.

An optional audio reference in Create, where supported, guides generation; it
is not a required post-generation speech upload or another background track.

Example: with a 3-second opening and an 8-second demo, the opening's speech is
heard from its footage; demo-only audio plays during the 8-second demo; the
whole-video music can span all 11 seconds. Removing demo-only audio must not
remove the whole-video music, and changing the whole-video music must not
replace speech or the demo attachment.

For Hook, the same 3+8-second sequence has one background track spanning the
11 seconds and **no second demo-only added track**. Wall has one background
track spanning its single video's selected duration. Do not infer new soundtrack
capabilities from a shared component or from the ambiguous word “sound.”

### Control location and removal rules

Audio selection/setup belongs in the Demo overview for composition workflows.
Focused Hook/Talking Head editors retain trim, text, Remix, appearance, live
preview, Save and return. They do not duplicate Sound/upload/library panels.
Hook's focused demo editor also excludes Crop & zoom. Removing those panels
must not silently reset existing saved volume/audio/framing data. Legacy Hook
demo framing may be retained and explicitly reset from Demo when necessary;
this recovery action is not a new crop/zoom editor.

This clarification defines product behavior; it does not establish that every
audio combination has been validated in production. Speech preservation and
the separate mix/timing layers require preview/export checks as well as UI checks.

The latest user correction removed Hook's separate demo sound upload/library
controls. `FormatDemoSection` defaults `allowDemoAudio` to false and excludes
legacy demo-only audio when restoring its local/server clip draft. Do not
re-enable that capability simply because generic component tests support it.
Talking Head's separate demo audio is handled through its own composition path.

Music must agree across preview, final preparation, Schedule and reload. Failed
or cancelled replacement must retain the prior accepted choice. Changing music
must not regenerate the video or silently mute speech. Avoid doubled tracks.

Talking Head's Demo overview now offers **Upload music** and the existing
**Audio Library** under Background music, explicitly scoped to the entire video.
The accepted owned track has preview, repeat/play-once and removal controls.
New videos start with music **Off**. Uploading or choosing a track retains the
current On/Off setting; the user turns music on explicitly. Turning it off retains
the choice, while Remove
music clears it and turns music off. The no-custom-track On state uses approved
default music. Demo sound stays independent and demo-only. This is a local
implementation; production acceptance is still required.

**Planned, not fully implemented:** the compact Create music row with reference,
custom and none choices is documented in
[the Hook music plan](docs/hook-background-music-ui-plan-2026-10-15.md). Its
development prototype is not proof that production track replacement/removal
works. Older mixed footage may lack a clean source; changing a button cannot
make baked-in music removable. Preserve reference provenance independently from
the selected playback track.

## 5. Remix: purpose, placement and source identity

Remix adapts a reference's **text**, using the user's business context, to make
a relevant new version. Supplying reference video pixels alone does not fulfill
this purpose. It is not the same operation as video generation or manually
adding an overlay.

| Starting material | Expected editor behavior |
| --- | --- |
| Video linked to prepared reference text | Show the complete expanded Remix box prominently, populated from that video's original reference; keep manual text editing available |
| Scratch generation, ordinary upload or asset with no linked text | Manual editing comes first; keep one compact Remix entry for the user's own text/idea; do not invent reference copy |
| Demo | Independent text/draft/target; never copy the opening's reference or remix into it automatically |
| Slideshow | Resolve original reference and stable slide ID; reordering must not change which source text belongs to a slide |
| Reference explicitly marked as having no text | Request user input rather than fabricate source text |

Rules the user has explicitly established:

- Only one Remix form/entry per focused clip or selected slide. No duplicate
  form on the workflow overview and no second Remix button beside an already
  visible expanded Remix box.
- One **Text to remix** box accepts source copy and any guidance. No separate
  Additional information/Additional instructions disclosure.
- No orange glow or heavy decorative highlight. Emphasize reference Remix by
  position and expansion, not visual noise.
- Keep Generate remix compact and adjacent to the relevant context/input.
- Generate produces a reviewable draft; Apply is explicit before changing the
  video's text. Do not overwrite manual copy just by opening Remix.
- Business context comes from the authenticated owner's settings/server path.
  Missing, loading, signed-out or unavailable context must not say Saved.
- Bind text to the source used to generate that asset. Selecting another gallery
  reference later must not silently change an existing clip's Remix source.
- Preserve trim, timing and style when applying copy; isolate targets and owners.
  Recover accepted requests without duplicating uncertain paid generation.

Known gaps are listed in section 8. Do not describe prepared catalogue text as
automatic transcription of every uploaded video.

## 6. Preview and layout quality floor

- Trim edits immediately seek to the changed boundary and pause; playback
  respects the selected duration. Text edits show their active timing, style
  and position without requiring Save or Prepare final video first.
- Style and supported volume changes update locally. Preserve framing and the
  actual footage aspect ratio; do not stretch or arbitrarily crop the preview.
- Distinguish an editing preview from the final exported mix/subtitles. If an
  effect requires preparation, state that accurately; never promise exact final
  parity for an effect the live preview does not implement.
- Keep the preview and action footer usable at **1280×720**, including after
  scrolling. Check **390×844** and **320px** narrow layouts where relevant.
- Use space for the task: text needs a writing area; presets, color and timing
  need compact fields. Avoid empty columns and excessive nested cards/help text.
- Secondary desktop actions generally use content-sized widths and ~34px height;
  touch/coarse-pointer targets retain at least 44px. Save/Schedule stay prominent.
- Check top and scrolled states, long names, disabled/busy/error states and
  keyboard focus. No horizontal overflow or footer covering the last controls.
- Upload tiles can be larger when they are the actual source entry. Once media
  is selected, Preview/Replace should be compact, not another giant empty tile.

### Laptop-first layout: 14-inch and 15.6-inch users

Physical diagonal size alone does not determine a browser's usable space.
Resolution, operating-system display scaling, browser zoom, browser chrome and
the app's own navigation change the **CSS viewport**. A 15.6-inch laptop can
have less usable space than a 14-inch laptop. Do not infer device inches from
screen width or build a rule called “14-inch mode.” Adapt to measured available
width **and height**, using container queries where panel width matters.

Use the following representative checks; they are layout scenarios, not exact
mappings from inches to pixels:

| Scenario | CSS viewport to review | Required behavior |
| --- | --- | --- |
| Constrained everyday laptop | 1280×720 | Clear task entry, usable preview, reachable upload/replace and visible editor Save/return; no large-screen minimum sizes forcing clipping |
| Common compact laptop workspace | 1366×768 | Check overview cards, reference Remix discoverability, footer and scrolled tools without hiding core controls |
| Wider laptop workspace | 1536×864 | Use extra width for readable preview/tools and useful grouping; avoid simply stretching every field or inserting large gaps |
| Larger workspace / comparison | 1920×1080 | Preserve grouping and bounded control widths; do not let the large layout dictate the smaller laptop layout |
| Short usable browser area | 1280×600 | Reflow/compact media and scroll tools so actions remain reachable; no lost last field or trapped nested scroll area |
| Narrow fallback | 390×844 and, where relevant, 320px wide | Stack or switch panels clearly; retain the preview/controls route and reveal the destination before focusing |

Also check a representative laptop at 125% and 150% browser zoom where tooling
supports it, and record the resulting viewport. Browser zoom checks do not claim
to emulate operating-system scaling or a particular physical laptop. A resized
browser with desktop pointer input does not verify coarse-pointer touch sizing.

At each laptop viewport, inspect both the top and the lower scrolled state:

- **Preview sizing:** portrait, landscape and square media retain aspect ratio.
  A tall portrait must not push its Edit/Change/playback actions out of reach.
  A wide clip must not force an oversized empty video column. Scale within the
  available width and height, not a single fixed video size for all laptops.
- **Space use:** reduce avoidable padding, vertical gaps and repeated headings
  before shrinking readable text. Bound preset/color/time controls; give writing
  and preview areas the useful space. Do not remove functions to make the form fit.
- **Layout change:** use columns only while the preview and tools remain usable;
  reflow when they do not. Shorter screens may need shorter media and independently
  scrollable tools even if the width still supports two columns.
- **Button access:** check the actual viewport intersection and scroll path,
  not only `display`, DOM presence or a full-page screenshot. Save/return must
  remain reachable; Replace must visibly expose its picker/section. Focus must
  not land in a hidden or covered region.
- **Scroll boundaries:** the last control is visible above the footer at the end
  of the tools' scroll area. Avoid multiple nested scrollers that strand an action.
  Browser chrome and app headers consume real height; `100vh` is not all content.
- **State changes:** repeat with a selected demo, long filename, expanded Remix,
  validation/error message and prepared output. Empty screens alone are not enough.

For a layout-affecting change, record viewport dimensions, which workflow/state
was inspected, and screenshots of top/scrolled states. If a size or zoom level was
not checked, list it as unverified. These are acceptance requirements for future
changes; this document update does not mean those sizes have now been tested.

## 7. Mistake log — do not repeat these

Status: **Local fix** means implementation/local checks were recorded, not
production acceptance. **Rule** means a recurring design requirement. **Open**
means unresolved or not established by the evidence. Keep the history when a
mistake recurs; add the recurrence and its cause rather than deleting the row.

| ID | Mistake and user impact | Prevention / current status |
| --- | --- | --- |
| EX-01 | Edit tab mixed demo setup, clip editing and final settings; users could not identify the step | Name Hook/Talking Head's second step Demo; distinguish overview from focused editors. **Local fix** |
| EX-02 | Continue wording/destination did not match what opened | Match the visible action to its actual destination; test the click. Talking Head Continue → Demo. **Local fix** |
| EX-03 | Create/Edit/Schedule tabs appeared again inside a selected clip editor | Hide outer stages while editing; retain a clear return action. **Local fix** |
| EX-04 | Hook and Demo were represented by one ambiguous preview/action | Separate named cards and compact Edit hook/Edit demo actions; show upload when missing. **Local fix** |
| EX-05 | Hiding sidebar demo setup alongside preview cards removed replacement access; Change focused a nonexistent selector | Keep source choices visible; mobile panel reveal plus real focus destination. Recurred after an earlier cleanup. **Local fix, regression added** |
| EX-06 | Talking Head Demo upload/sound disappeared in a simplification pass | Restore task-relevant controls; never equate fewer controls with clearer UX. **Local fix** |
| EX-07 | Remix form duplicated in overview and editor; another Remix button appeared next to the expanded form | One editing entry and one scoped form; remove obsolete portal targets, not just their labels. **Local fix** |
| EX-08 | Remix was closed or below the first visible area, especially at 1280×720 | Reference text leads with expanded Remix; scratch editing has a visible nearby entry. **Rule with local fixes** |
| EX-09 | Separate Additional instructions, orange glow and repeated helper text added complexity | One text/guidance box, neutral styling and concise status. **Local fix** |
| EX-10 | Huge Generate/audio buttons, full-width preset fields and stacked sliders wasted space | Compact secondary actions/inspector; draggable trim with small numeric inputs. **Local fixes; recheck each screen** |
| EX-11 | Oversized selected-demo Preview tile repeated an upload-sized empty box | Use compact Preview and directly accessible Replace controls. **Local fix** |
| EX-12 | Changes did not appear immediately, leaving users guessing about trim/text/style | Wire draft state to player and overlays; verify actual visual updates, not only saved JSON. **Local checks recorded; final-render parity remains effect-specific** |
| EX-13 | Opening optional Remix hid manual text or style controls | Keep manual editing available while Remix opens. **Local fix** |
| EX-14 | Hook and Demo inherited each other's text, reference or audio assumptions | Independent drafts and explicit per-product audio capability. **Regression coverage; provenance gaps still open** |
| EX-15 | Hook exposed separate demo music although one background track should span both clips | Remove Hook-only demo audio controls and reject hidden legacy attachments; retain Talking Head Demo sound. **Local fix after user correction** |
| EX-16 | Back to previews actually returned to Create; Demo used Apply demo edits while others used Save edits | Use truthful, consistent labels; test destination and retained state. **Local fixes** |
| EX-17 | Save, return, preparation/refresh and Schedule competed without a clear hierarchy | Reserve primary Save, secondary return, and composition/scheduling actions in their appropriate screens. **Rule with local fixes** |
| EX-18 | Preparing a final video replaced clip cards, removing later edit entry points | Demo overview keeps editable clips; Schedule owns final output. **Local fix** |
| EX-19 | Wall opened an isolated empty edit screen with no selected clip and hid normal controls/gallery | Source-less entry stays in Create; preserve genuine saved-asset restoration. **Local fix** |
| EX-20 | Slideshow called its source Video reference; business status implied missing context was saved | Use format-specific source names and truthful readiness states. **Local fix** |
| EX-21 | Later gallery selection could supply the wrong source copy; slide position confused source identity | Resolve generated-asset provenance and stable slide ID; never use current selection as a substitute. **Coverage in Hook/Wall/Slideshows; Talking Head gap open** |
| EX-22 | Claimed all workflows were fixed based on shared code, tests or old screenshots | Inventory each route and inspect its actual rendered interaction; report test/visual/production evidence separately. **Ongoing verification rule** |
| EX-23 | A black demo frame was visible but its cause was not established | Inspect loading, source, media errors and playback. Do not assume every black frame is one known codec bug or call it resolved from metadata alone. **Open for the originally reported asset** |
| EX-24 | Huge gaps, nested boxes and long scroll made preview/actions hard to use | Review both top and scrolled states with real content and compact dimensions, not a full-page screenshot alone. **Recurring design rule** |
| EX-25 | Forgot a section's purpose while changing its layout, losing core functionality | Make a before/after map of every retained section, task and action; missing or newly inaccessible functionality blocks completion. **Recurring process failure; preservation rule** |
| EX-26 | Changed what a feature did while attempting to improve how it looked | Preserve handlers, target media, audio scope, drafts and readiness during visual changes; record any explicit functional request separately. **Recurring process failure; behavior-preservation rule** |
| EX-27 | Renamed sections casually or replaced Demo with Edit tools despite the agreed workflow | Treat the public stage map as a product contract. Internal state names do not define user-facing names. Keep Demo setup and focused editing separate. **Repeated user correction; stable naming rule** |
| EX-28 | Buttons existed but users could not reach them at their laptop size | Check on-screen geometry, occlusion, scroll path, focus and successful click at constrained width and height. DOM presence alone is insufficient. **Repeated access failure; viewport acceptance required** |
| EX-29 | Used large-laptop spacing and preview sizes unchanged on a smaller usable workspace | Review constrained and wider laptop CSS viewports; reflow columns and bound media by available height and width. Never use physical screen inches as the breakpoint. **Repeated responsive-layout failure; laptop matrix required** |
| EX-30 | Added audio or other controls in whatever empty space was available, separating them from their meaning | Assign one named group by task and scope; keep selection, change/remove and status together. Background music spans the composition; Talking Head Demo sound is explicitly separate. **Repeated grouping failure; ownership map required** |
| EX-31 | A simplification pass removed or hid working features and was called an improvement | Keep core functions and navigation intact; compare before/after capabilities and test round trips. Fewer visible controls is not evidence of clarity. **Repeated regression; functional and visual evidence required** |
| EX-32 | Kept irrelevant Crop & zoom and Sound panels in focused Hook editing, creating excess scroll and unused inspector space | Hook demo editing excludes crop/zoom; audio setup stays in Demo for Hook/Talking Head. Keep Wall's single-video audio path distinct. Do not restore generic panels simply because a shared editor supports them. **Local implementation and regression checks passed; fresh visual acceptance pending** |
| EX-33 | Used “audio,” “Demo sound” and “background sound” interchangeably, obscuring speech and track timing | Name Talking Head's embedded speech, demo-only added audio, and whole-video background music separately. Hook and Wall each have one complete background track. **Audio-scope contract clarified by user** |
| EX-34 | Treated a Background music On/Off switch as proof that users could upload their own whole-video track | Keep upload/library selection, current track, playback and removal in Background music. Carry that exact owned selection through preview, captions, preparation, recovery and Schedule without reusing demo-only audio. **Locally implemented 15 October; production acceptance pending.** |
| EX-35 | A recovered render/default-music cache could reuse a previously removed custom track | Persist the explicit off/default/custom choice alongside the finishing receipt; require the current choice before reusing an output or default snapshot. Never substitute old custom audio when switching back to default. **Regression covered.** |
| EX-36 | Showed trim/style/audio alongside Wall's primary text tasks, adding complexity and unused inspector space | Default Wall Edit to Remix/manual text and live preview. Place one compact Edit action below text for advanced tools, with Back to text and the same draft/player. Audio remains available in advanced controls. **Locally implemented; fresh visual/production acceptance pending.** |
| EX-37 | Gave Wall text Show from/Until and timing badges even though it must stay to the end | Hide timing UI and normalize Wall text to the full selected duration on recovery, editing, Remix and shorter/longer trims. Preserve Hook/demo timing and legacy Wall blocks/styles. **Functional regression checks passed.** |
| EX-38 | Exposed import names such as Fitness 01 and Goal Tracker 01 as slideshow card titles | Show the category/topic consistently throughout reference selection. Preserve stable IDs and source metadata; slide position numbers remain useful inside editing. **Locally fixed for all 58 catalogue slideshows; production acceptance pending.** |
| EX-39 | Treated five selected slideshow slides as context for two individual images instead of generating two five-slide versions | Freeze slide count and version-major positions into jobs, recovery, result groups and editor selection. Estimate credits for every output. Keep legacy request semantics intact. **Local 5×2 regression passed; production pending.** |
| EX-40 | Assumed slideshow image generation included business context, while only Remix used it | Read the authenticated owner's applied profile on the server before billing, freeze it per job and test the actual provider prompt. Keep private context out of visible prompt labels. **Locally fixed.** |
| EX-41 | Hid History when the current Explore session was empty, and had no way to reopen saved slide sets | Keep History reachable, distinguish generated versions from edited drafts and saved Library items, preserve drafts when switching, and offer Edit slides for saved Explore sets. Do not infer legacy grouping or unbake pixel text. **Slideshow/Hook/Wall locally improved; Talking Head history differs.** |
| EX-42 | On the reported 15.6-inch laptop, two shallow empty Hook/Demo cards stayed at the upper-left of a much larger preview area | Use centered portrait upload slots with centered source actions, bounded by usable height; check empty/one-clip/two-clip and narrow/short viewports. Keep actual media ratios and existing selection actions. **Local layout change; browser screenshot and production acceptance pending.** |
| EX-43 | Exposed Hook 01/02/03 catalogue numbers as user-facing reference names | Show **Hook** consistently for active, archived and development references. Preserve reference IDs, provenance, reviewed prompts and saved-job lookup; automation must identify media by stable identity rather than depend on visible numbering. **Catalogue regression passed locally; production pending.** |

Process incident: an intermediate edit introduced an invalid UTF-8 byte and
temporarily broke local compilation. It was corrected. Preserve UTF-8 and check
the actual page after edits; tests that transpile source alone can miss this.

## 8. Known gaps and verification limits

1. Uploaded video references, including Talking Head uploads, do not have a
   general automatic OCR/transcription path into Remix. Users currently need to
   supply copy. This remains open, not an accepted permanent product limitation.
2. Talking Head's shared editor does not receive the same reference catalogue
   wiring as Hook/Wall. Reusing a catalogue-generated asset may lose usable
   reference-text association despite provenance in owned-media metadata.
   Recheck and fix that path before claiming all reference cases are supported.
3. The new music reference/custom/none row is a prototype/implementation plan;
   clean-source retention and the complete replacement/removal pipeline must be
   verified before release. The music plan reports a Hook 76 HEVC compatibility
   issue; investigate that exact asset rather than generalize the diagnosis.
4. Latest recorded local suite: **380 tests passed**, with targeted ESLint,
   TypeScript and whitespace checks. This is dated evidence, not a permanent
   test count or proof of first-time-user comprehension.
5. Actual local browser checks covered Hook demo replacement (desktop/mobile),
   Talking Head upload/replacement and restored sound controls, and Wall's
   source-less entry. Earlier reports contain additional editor/slideshow checks.
   Earlier browser quota/compiler failures are historical; later local checks
   succeeded. Do not copy an old blocker forward without rechecking it.
6. Production Explore redirected the checked browser session to sign-in. These
   local UI changes were not deployed as part of these checks. Authenticated
   generation → edit → preparation → Schedule/publication acceptance remains
   outstanding. Do not silently submit paid jobs or publish posts as UI checks.
7. Latest audio-scope/editor-panel follow-up: 243 targeted tests passed, with
   11 additional clip-control/Talking Head checks; the final Demo/Talking Head
   rerun passed 62 tests (overlapping the earlier checks). TypeScript, targeted
   ESLint and whitespace checks passed. Logs are in
   `outputs/explore-editor-scope-tests.log`,
   `outputs/explore-editor-scope-extra-tests.log` and
   `outputs/explore-editor-scope-final-tests.log`. Fresh full-page browser
   acceptance remains pending: the local application bundle reported Invalid
   or unexpected token and stayed on Opening your workspace; an isolated local
   fixture was not reachable by that browser. Do not reuse earlier screenshots
   as evidence for the newly removed panels. The temporary helper was stopped.
8. Talking Head custom whole-video music is now locally implemented through
   `use-workflow-background-music.ts` and the existing Audio Library picker.
   Owned asset ID and playback are saved in workflow session options separately
   from demo-only audio. Missing music blocks preparation until replaced or
   removed. Failed replacement retains the prior selection. See
   [the music implementation report](docs/talking-head-background-music-2026-10-15.md)
   for evidence. Production acceptance remains outstanding; the older scope
   audit's missing-upload finding describes the state before this change.
9. The 15 October scope recheck confirmed the current local callers hide Sound
   in both Talking Head clip editors and Hook opening editing; Hook demo's
   focused controls contain no Sound or Crop & zoom. Wall intentionally retains
   its single-video audio controls; Slideshow is images-only. See
   [the scope recheck](docs/explore-workflow-scope-recheck-2026-10-15.md) for
   current verification evidence and limits. Local removal is not proof the
   deployed authenticated editor contains the change.
10. Wall now defaults to text-only controls with optional advanced video tools.
    The shared focused editor remains mounted between modes; text, style, audio,
    preview and draft ownership are retained. Local functional suites (96 tests),
    TypeScript and targeted ESLint passed. Fresh browser/laptop screenshots and
    authenticated production acceptance are still pending. See
    [the Wall simplification report](docs/wall-text-simple-editor-2026-10-15.md).
11. Slideshow naming and flow recheck: 137 local checks passed across generation
    admission/recovery, image results, editing, save/recovery and schedule inputs;
    TypeScript and targeted ESLint passed. These include stubbed service boundaries,
    not paid provider execution. Production `/explore/slideshows` redirected to
    sign-in on 15 October, so authenticated generation, deployed saving enablement
    and publication remain unverified. Prompt-only scratch generation is blocked
    by the current composer; output sequences have a ten-slide maximum. See
    [the slideshow report](docs/explore-slideshow-flow-2026-10-15.md).
12. The subsequent user correction supersedes that audit's single-image quantity
    semantics. Selected slides × versions now generates grouped image jobs;
    business context, Flare, history and editable Library reopening are locally
    implemented. **249 application tests and 20 worker/provider tests passed**,
    with TypeScript, worker build and targeted ESLint. Network/provider/database
    boundaries are stubbed in these suites. The local browser fixture compiled,
    but Edge launch failed and the MCP browser could not reach its local server;
    fresh laptop screenshots and signed-in production acceptance remain pending.
    A final production navigation retry reported the browser profile already in
    use; the shared browser was not closed or reset.
    See [the versions/history report](docs/explore-slideshow-versions-and-history-2026-10-15.md).

### Portrait overview and recovery follow-up — 15 October 2026

- Local changes center Hook's overview cards and give empty Hook/Demo source
  slots a viewport-bounded 9:16 shape with centered source selection. Talking
  Head's empty overview canvas uses the same portrait treatment. Selected video
  ratios, focused editors, replacement handlers and audio ownership are retained.
- Hook reference labels now read **Hook** for published, staged and archived
  references. Browser-card checks target stable reference IDs so duplicate
  display labels do not select the wrong media.
- **236 targeted tests passed** across source/replacement, demo state, saved
  Talking Head composition, slideshow editing/recovery, workflow sessions,
  live clip controls, catalogue identity, reference actions and previews.
  TypeScript, targeted ESLint, CSS parsing and whitespace checks passed.
- Fresh visual acceptance is **pending**: the production browser retry reported
  its profile already in use; a separate headless Edge launch then failed during
  profile initialization. The shared browser was not reset. This pass therefore
  does not claim screenshots, laptop/zoom interaction acceptance, deployment or
  authenticated production end-to-end success.
- Recovery is available through the distinct paths listed in section 3. A
  universal gallery of every historical editable composition across all video
  workflows is not implemented; do not describe generation History that way.
- Release review on 16 October found that legacy slideshow reference-role paths
  could drop frozen business context/output position. Every provider-prompt path
  now uses the contextual slide prompt; all three legacy roles have a regression.
  See `docs/production-release-2026-10-16.md` for ordered rollout and actual
  deployment evidence; older local reports are not production acceptance.

## 9. Where the implementation lives

Paths below are pointers, not an excuse to treat every shared component as the
same product. Inspect current callers and props before editing.

| Concern | Main files |
| --- | --- |
| Menu and route inventory | `lib/explore/workflows.ts`, `app/explore/` |
| Hook/Wall/Slideshow workspace, stages and portal ownership | `components/explore/format-workspace.tsx` |
| Talking Head entry, composition and clip integration | `hook-workflow-entry.tsx`, `hook-workflow-preview.tsx`, `talking-head-clip-editing.tsx`, `workflow-composition-panel.tsx` under `components/explore/` |
| Shared clip editor / separate Hook demo editor | `components/explore/format-video-editor.tsx`, `components/explore/format-demo-section.tsx` |
| Trim, playback, text and appearance | `clip-trim-timeline.tsx`, `clip-preview-controls.tsx`, `format-video-text-fields.tsx`, `format-text-overlays-editor.tsx` under `components/explore/` |
| Remix UI and source resolution | `components/explore/remix-text-section.tsx`, `lib/explore/remix-source.ts`, `reference-text-store.ts`, `remix-text-edit.ts`, `remix-text-draft.ts` under `lib/explore/` |
| Slideshow identity/text/preview | `components/explore/format-slideshow-editor.tsx`, `format-slideshow-text-tools.tsx`, `lib/explore/slideshow-draft.ts` |
| Preview vs final composition | `components/explore/workflow-sequence-preview.tsx`, `workflow-edit-workspace.tsx`, `format-schedule-panel.tsx`, `pending-schedule-panel.tsx`, `lib/explore/wall-pending-composition.ts` |
| Layout/button behavior | `format-workspace.module.css`, `workflow-video-layout.module.css`, `workflow-section-layout.module.css`, `format-video-editor.module.css`, `workflow-creation.module.css`, `workflow-secondary-action.module.css`, `remix-text-section.module.css` under `components/explore/` |
| Draft lifecycle and media ownership | `components/explore/use-workflow-source-video.ts`, `use-local-workflow-media.ts`, `use-clip-draft-save.ts`, `lib/explore/clip-draft-contract.ts`, `workflow-draft-lifecycle.ts` |

Historical evidence, in order of relevance:

- [Demo step/replacement/audio follow-up](docs/explore-demo-step-fix-2026-10-15.md)
- [Workflow recheck and overview cleanup](docs/explore-workflow-recheck-2026-10-15.md)
- [Reference/scratch edge-case audit](docs/explore-remix-edge-case-audit-2026-10-15.md)
- [Earlier UI review](docs/explore-workflow-ui-review-2026-10-15.md)
- [Earlier clip editor review](docs/explore-clip-editor-clarity-2026-10-15.md)

Older reports contain superseded choices such as calling Demo Edit, hiding
sidebar upload controls, or permitting separate Hook demo audio. Follow this
document's current decisions and the latest user instruction, not those lines.
Media inventory counts and exact reference batches change; inspect current
catalogue/release records rather than copying counts from historical audits.

## 10. How to change Explore without repeating the mistakes

1. Read this context and relevant repository instructions. State the specific
   workflow, screen and scope being changed; inspect its actual caller/state.
2. Sketch the responsibility split: source setup, overview, focused editor,
   preparation, Schedule. Record current section names, tasks and entry points,
   then map each retained function to its new location. Do not solve
   discoverability with duplicate forms or silently replace Demo setup with Edit.
3. Trace actions through handlers, visibility conditions and real DOM targets.
   A button existing in JSX does not mean it is visible or usable.
4. Check reference-backed and scratch content, no media, existing media,
   replacement failure/cancel, restore/reload, and prepared output → edit again.
   Keep accepted media/drafts on failed changes and invalidate stale outputs.
5. For a shared change, examine all four public workflows. Include independent
   Demo text/audio and slideshow reorder/source identity where relevant.
6. Run meaningful existing regressions. Useful suites include
   `scripts/explore-format-source-workspace.test.mjs`,
   `explore-format-demo-state.test.mjs`, `explore-format-common-editor.test.mjs`,
   `explore-clip-live-controls.test.mjs`, `explore-slideshow-editor.test.mjs`,
   `explore-slideshow-text-tools.test.mjs`, `workflow-composition-panel.test.mjs`,
   `explore-background-composition.test.mjs` and `workflow-sections.test.mjs`
   under `scripts/`. Add a regression for a repeated functional defect; avoid
   brittle tests that merely assert decorative CSS or mirror implementation.
7. Inspect actual browser interactions using the laptop matrix in section 6,
   plus narrow layouts, scroll and error states. Verify preview sizes and button
   reachability, not just CSS presence. Capture screenshots of the final code.
   Label isolated fixtures honestly; do not present a mockup or old image as a
   current app capture. Report untested sizes and zoom states explicitly.
8. Record what changed, evidence, remaining gaps and deployment status. Final
   authenticated acceptance uses the production domain per `AGENTS.md`.
9. Update this context and the mistake log when a decision changes or a defect
   recurs. Do not close a mistake just because code compiled or tests passed;
   record visual verification and production acceptance separately.

### Decision history

| Date | Decision |
| --- | --- |
| 2026-10-15 | Focused clip editing hides workflow tabs; keep immediate preview, compact controls, truthful return actions and independent drafts. |
| 2026-10-15 | Reference-backed text leads with expanded Remix; scratch uses optional Remix; source copy and guidance share one input; remove glow and duplicate forms. |
| 2026-10-15 | Restore visible Demo upload/replacement; label Hook/Talking Head's second step Demo. Wall remains a single-video text workflow. |
| 2026-10-15 | Hook has one shared background track and no separate demo audio picker; Talking Head retains optional Demo sound. |
| 2026-10-15 | Establish this file as the durable Explore context, with explicit historical mistakes, open gaps and verification limits. |
| 2026-10-15 | Strengthen recurring-mistake prevention: preserve section identity/core functions during visual work, map feature ownership, and require constrained/wider laptop viewport checks rather than assuming a single desktop layout fits both 14-inch and 15.6-inch users. |
| 2026-10-15 | Remove irrelevant Crop & zoom from Hook demo editing and duplicate Sound panels from Hook/Talking Head focused editors; audio setup stays in Demo. Wall keeps its single-video audio path. Preserve existing saved edits and explicit legacy-framing recovery. |
| 2026-10-15 | Clarify Talking Head's embedded influencer speech (no default extra upload), optional demo-only audio attachment and optional whole-video background music as three distinct layers. Hook and Wall each use one complete background track. |
| 2026-10-15 | Implement Talking Head whole-video music upload and Audio Library selection in Demo, with independent owned-track recovery, repeat/play-once, removal and preview/preparation/Schedule plumbing. Preserve embedded speech and separate demo audio; guard old custom-track render reuse. |
| 2026-10-15 | Whole-video Background music starts Off for new Talking Head videos; selecting/uploading a track preserves On/Off until the user explicitly enables it. Existing saved choices retain their setting. |
| 2026-10-15 | Wall Edit leads with Remix/manual text and preview. A compact Edit action opens advanced trim/style/audio; Back to text retains the same draft. Wall text spans the whole selected clip and has no per-block timing UI; Hook/demo timing stays independent. |
| 2026-10-15 | Slideshows generate selected slides × versions, with server-owned business context and Flare default. Compact reference selection retains direct thumbnail toggles; History, full-version editing, earlier drafts and saved Library Edit slides restore prior work without overwriting it. |
| 2026-10-15 | Hook/Demo empty overview slots use centered portrait upload areas with viewport-bounded sizes; Talking Head's empty-demo canvas follows the same principle. Hook reference captions omit catalogue numbers while keeping stable media IDs. Recovery entry points and their distinct limits are recorded per workflow. |
