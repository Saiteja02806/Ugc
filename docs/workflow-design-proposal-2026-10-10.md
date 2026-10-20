# A first-video workflow: design proposal

Status: proposed, interactive concept only. This does not replace the current
application implementation. The previous sidebar-shaped workflow rail was
rejected in review. The user has now explicitly selected first-time users making
their first video as the primary audience.

Latest clarification: the user means the populated References / Your videos
gallery in Hook and Wall-of-text. The prior mockups omitted this core browse,
preview and Recreate experience. The empty Library in Talking Head + Demo is
a different implementation. For Hook and Wall-of-text, the gallery must remain
visible beside a comfortably sized Create form. See
[the corrected dark screen studies](design/workflow-dark-screens-and-references-2026-10-10.md).
The earlier interactive concepts predate this correction.

## What we know, and what we do not

Evidence from the user:

- The primary goal is that a person entering a workflow understands how to use it.
- Three sections should organise the task.
- A large preview previously took too much useful space.
- Repeating the app sidebar's visual treatment inside the workflow is undesirable.
- The main audience is a first-time user making their first video.
- The first guided concept was judged simple and understandable, but visually
  unprofessional. The current revision addresses that explicit feedback.
- The user also found the source-video choice and optional video guidance
  duplicative. This is direct evidence that the labels failed to communicate
  their different purposes.

Evidence from the product:

- Create supports generation, upload, and choosing Creative Assets.
- Generation requires instructions. Creator images are optional. Video and audio
  guidance are also optional, with model compatibility and duration restrictions.
- Video and voice references guide generation; they do not append a demo or music.
- Duration, quantity, model, quality and shape are real generation choices.
- Credits must be verified before generating. An uncertain request cannot safely
  be replaced with a new paid request.
- The opening can remain on its own. Demo, extra demo audio, music and subtitles
  are optional. Added demo audio sits underneath the demo's original sound.
- Auto subtitles currently support English and up to 60 seconds total.
- The sequence preview and the saved, rendered finished video are different states.
- Publishing requires the finished video plus a platform, posting account, date,
  time and time zone. Caption belongs to the post, not the spoken script.
- Existing controls preserve drafts while switching sections.
- Scheduling is a separate action after saving a finished video.

These facts were checked in workflow-video-source-section.tsx,
workflow-generation-client.ts, workflow-generation-boundary.tsx,
workflow-generation-settings.ts, workflow-composition-panel.tsx,
use-workflow-finishing.ts, workflow-finishing-boundary.tsx,
workflow-scheduling-panel.tsx and workflow-edit-workspace.tsx.

We do not yet have observations of first-time customers using this workflow.
We do not know their vocabulary, their most common starting method, which
references they typically need, their device distribution, or their tolerance
for extra clicks. We also have not measured whether they prefer a horizontal
progress control. Those are research questions, not fundamental truths.

## The proposal

The page answers three questions: what do I need to provide, what happens next,
and what exists now?

Keep Create, Edit and Schedule. Place their progression above the workspace as
connected steps rather than a second sidebar. Preserve the app sidebar's role
and scale. Give the active task one heading and one main action.

Create starts as a brief-writing surface. References remain visible as compact
optional controls. Output length, shape and quantity sit together because they
describe what will be made. Model and quality are one expandable group, with
their current values visible. Estimated credits sit next to Generate.

Once a video is available, Create becomes a review surface. The person sees the
result, chooses a variant when relevant, and explicitly uses that opening.
Revision remains available without turning the entire page back into a
permanent split editor.

Edit shows the opening and its optional demo in playback order. It exposes only
the controls relevant to selected media: demo audio after a demo is attached,
subtitle style and position when subtitles are on. The person saves a finished
video before reviewing combined output. Scheduling remains optional.

Schedule shows the finished video beside the posting details. Platforms come
before account selection; no platform, account, caption or time is chosen on the
person's behalf. The chosen time zone remains visible. The final action names
what it does.

## Element-by-element decision ledger

For each element: which user question does it answer, why here, and what happens
if it is removed?

| Element | User need and reason for placement | Decision / uncertainty |
|---|---|---|
| App sidebar | Move among app areas; belongs outside the workflow | Preserve. Enlarging it does not explain workflow progression. |
| Back to Explore | Leave or choose another workflow | Header link, with the existing unsaved-change protection in implementation. |
| Workflow name | Confirm the format the person selected | Header. Do not repeat the name in several cards. |
| Create / Edit / Schedule | Know where the current task fits and return to previous work | Compact stage navigation above the task, with numbering and a restrained active underline. Horizontal placement is a testable design choice. |
| Stage numbers | Explain a genuine dependency order | Three simple markers, not numbered decoration elsewhere. |
| Completed markers | Distinguish an available artifact from an unstarted stage | Derived from verified video/save state, never from visiting a tab. |
| One task heading | Explain the immediate job | At the start of each active section. No duplicate section-title cards. |
| One sentence of guidance | Explain what a novice must provide and what is optional | Near the task; test whether it is sufficient without overwhelming repeat users. |
| Generate / existing video | Choose the source of the opening | Before instructions. These are alternatives, not successive requirements. Preserve each method's state in production. |
| Upload / Creative Assets | Retrieve an existing opening by two different mechanisms | Only within the existing-video branch. Avoid three equally prominent choices on every screen. |
| Instructions field | Supply the required generation brief | Largest input near the top. Never replace what the person typed. |
| Example placeholder | Demonstrate the format of a usable brief | Inside the empty input, marked as an example. Never submitted as user instructions. |
| Spoken words / scene helper | Clarify the difference between dialogue and visual direction | Directly below the brief. Test the wording with real novice users. |
| Optional-reference label | Prevent believing all three references are required | Before the reference controls. The word Optional stays visible. |
| Image reference | Guide the AI creator's appearance when desired | In the AI references group, only within Generate new video. It selects an image rather than creating one. |
| Video reference | Guide a newly generated scene or motion | In AI references, only within Generate new video. Using the clip itself as the opening belongs to Use existing video. |
| Voice reference | Guide the voice in a newly generated video | Same generation-only group. Music and demo audio remain in Edit. |
| Reference compatibility message | Prevent a selection that cannot generate | At the relevant reference. Offer an explicit compatible-model change; never silently switch models. |
| Selected reference / remove | Know what will influence the request and undo it | Visible attachment state and replacement/removal within its details. |
| Length | Specify the opening duration and understand cost | Before Generate, beside other output choices. |
| Shape | Specify portrait/landscape | Plain-language label with the ratio visible; do not require ratio knowledge alone. |
| Number of videos | Decide how many results are generated and paid for | Visible before the paid action. Do not bury a multiplication of cost in an advanced panel. |
| Model and quality | Change genuine engine/output choices when needed | Single disclosure level with selected values in its summary. Actual availability comes from the product. |
| Credit estimate | Understand the paid consequence before committing | Adjacent to Generate. Quote verified account rates; never invent a rate, ETA or progress percentage. |
| Generate video | Start the paid creation action | One dominant action below the inputs, with an explicit reason whenever unavailable. |
| Pending / failure / unknown status | Understand what is happening and recover safely | Replaces normal action state locally. Unknown status offers Refresh, not another paid Generate. |
| Result preview | Assess what was actually produced | Only after a result/source exists. Empty space and Show empty preview are removed. |
| Variant choices | Choose among multiple requested results | Beside result review, only when multiple results exist. |
| Use this video | Confirm the chosen opening and proceed | Dominant action in result review. It does not submit a second generation. |
| Revision action | Change the brief or starting video | Secondary action near result review; preserve previous output until its replacement is actually ready. |
| Opening → demo sequence | Understand playback order | Beside the preview in Edit. Uses the media's actual measured durations. |
| Change opening | Replace the correct part of the video | In the opening segment, not an ambiguous global Replace button. |
| Add demo | Append a walkthrough if needed | Edit. It is not a creation reference. Optional remains explicit. |
| Demo replacement / removal | Correct the appended footage | Beside its selected-media summary; removal follows the existing demo-audio clearing behavior. |
| Extra demo audio | Add sound only to the appended demo | Revealed after a demo exists; it cannot affect the opening's generation voice. |
| Play once / repeat | Fit added audio according to its purpose | Revealed after extra audio exists. Do not repeat spoken audio by default. |
| Auto subtitles | Choose whether to render captions | Edit, with the real English/60-second constraint beside it. |
| Subtitle style / position | Control captions only when they will be used | Revealed when subtitles are on. Keep selected values when toggled off and back on. |
| Subtitle preview / examples | Evaluate style appearance | Selection shown in context; rendered examples still need an accessible preview route in implementation. |
| Background music | Add optional music across the finished video | Edit, with original-sound/mixing scope explained. Respect the existing approved-track rules. |
| Save video | Produce the actual finished artifact | One main action in Edit. The proposed label must describe existing save/render behavior accurately. |
| Saved-state message | Know whether edits have been rendered and saved | Replaces draft instructions after confirmed completion. It is not an optimistic success claim. |
| Optional scheduling continuation | Proceed to publishing without making it mandatory | Appears after a saved video exists. A saved result remains accessible from the Library. |
| Finished-video preview | Verify the artifact that will be published | Schedule alongside destination/caption/time. Never use an unsaved opening as the finished result. |
| Posting platforms | Choose destination(s) | Before accounts. Show only platforms currently enabled in the product. |
| Account selection / connection | Specify whose account receives the post | Under the selected platform; no automatic account selection. |
| Post caption | Write the text shown below the post | Schedule, clearly different from the spoken generation script. |
| Date / time | Specify when posting should happen | Paired fields in Schedule; validate a future time with the actual scheduling contract. |
| Time zone | Interpret the chosen time correctly | Adjacent to date/time, visible before confirmation. |
| Destination/time summary | Catch a wrong account or time before scheduling | Beside the finished preview and near the final action. |
| Schedule post | Submit the actual scheduling request | One final action; no optimistic success until confirmed by the product. |
| Keyboard focus / touch targets | Use every control without precise mouse input | All stages. Essential actions are never hover-only. |
| Draft preservation | Explore and correct work without re-entering it | Same state owners/mounted forms in implementation; also checked in the concept. |

Removed: the second sidebar, duplicate task titles, an empty-player toggle,
permanent large empty previews, always-expanded subtitle galleries, unavailable
demo-audio controls before a demo, arbitrary percentages and fake ETAs.
For Hook and Wall-of-text, the References / Your videos gallery stays in the
core Create task. A contextual link alone is insufficient for the user's
stated requirement to see, preview and recreate the examples.

## Visual decisions and critique

The existing product orange is reserved for the current stage and main action.
The sidebar remains quieter. Neutrals carry the form and preview so different
features are not assigned arbitrary competing colors.

The revised visual direction is a video studio. Cool neutral tokens distinguish
the canvas (#111217 / #f4f5f8), the workspace panels (#191b22 / #ffffff), and
control wells (#20232d / #f8f9fc). Dividers are #303440 / #e1e5ed; foreground is
#f1f2f6 / #191c25. The product orange remains #f5774e. These changes belong to
the concept, rather than silently changing the application's brand system.

Manrope carries headings, Inter carries controls and body copy, and IBM Plex
Mono marks media dimensions and durations. Family fallbacks remain available.
Create has a coherent input surface and integrated action bar. Edit uses a
framed media workspace beside an inspector, with thumbnail context in the
opening/demo sequence. Switches distinguish optional effects from text inputs.
Schedule groups posting fields beside an artifact review.

The prior long connecting lines, floating player, loose form rows and generic
square effect checkboxes contributed to the wireframe appearance. Their
replacements express sequence, media context and setting scope. The revision
also uses concise task headings and keeps explanatory copy subordinate.

The distinctive structural element is the real playback sequence in Edit.
Create uses a spacious writing surface because there is no media to inspect
yet. The page therefore changes according to the available artifact, rather
than reserving an equally large preview in every state.

I removed redundant eyebrow labels above the task headings during critique.
The progress control already names the section. I kept reference controls
visible after questioning whether hiding all references would make them hard
to discover for a novice.

I also removed a second Add demo action from the sequence itself. The sequence
explains order; the labelled Add action in the edit controls owns attachment.
Result-state headings now ask the user to choose a video rather than continuing
to ask them to write a brief. Revisions preserve the previous opening until a
replacement is ready, and changing an edit clears the completed-state marker.

This visual refinement is a design response to the user's stated preference,
not proof of improved customer trust or willingness to pay. The interaction
model stays unchanged so those claims can be evaluated separately.

The source paths are now labelled Generate new video and Use existing video.
The first creates a new AI result; the second takes uploaded or saved footage
directly into editing. Optional Image reference, Video reference and Voice
reference controls sit under AI references within the generation branch only.
The existing-video branch explicitly says it skips AI generation. This corrects
the perceived duplication through scope and vocabulary, while preserving both
capabilities.

## Prototype boundaries

All generation, rendering, connection and scheduling interactions are local
simulations. The sample still is an existing creator reference image, not an
AI-generated result. The example credit rate is fictional, not a production
quote. The model list and duration choices are illustrative subsets, not a
replacement for the current dynamically available capabilities.

The prototype does not implement file picking, real video playback, framing,
the complete subtitle-example gallery, authenticated connections or request
recovery. These capabilities must be retained and verified if implemented.
Changing framing has a meaningful outcome; it belongs with the selected demo
as a secondary Fit demo action rather than a new always-open panel.

## How we find out whether this is better

The local prototype was checked through Create, result selection/revision,
Edit and Schedule. The review confirmed that edits clear the saved marker,
the post draft survives stage navigation, and scheduling becomes available
only after a finished video, an account and a future date/time are selected.
Keyboard activation was checked, browser error logs were empty, and the
fragment's script passed a syntax check. DOM bounds checks found no horizontal
overflow at approximately 323px and 1,119px of available content width.
These checks cover the proposed interaction, not authenticated production
generation, rendering, publishing or demonstrated novice usability.

The studio refinement was also checked through generation, result acceptance,
demo attachment, native subtitle switches, style selection, saving, the
Schedule review and returning to the creation draft.
The new form and expanded edit controls had no horizontal overflow at roughly
298px and 374px of available width. On narrow screens, generation settings
stack so complete selected values remain readable. The refined script passed
the syntax check and browser logs showed no script errors.

Run an observed, task-based review with first-time users. Do not teach the
interface during the task.

1. Make an opening from a short brief without attaching references. Observe
   whether the user thinks an image or demo is mandatory.
2. Use an existing opening, add a walkthrough, and add audio only to the
   walkthrough. Ask the user to predict what they will hear before saving.
3. Add subtitles, change position, return to Create and come back. Observe
   whether the person can find the setting and whether the draft survives.
4. Save a finished video without scheduling. Observe whether the person
   understands that their video exists and that publishing is optional.
5. Prepare a post for a specified account/date/time. Observe whether the person
   notices the selected account and time zone and reviews the finished output.
6. Present an unconfirmed generation request. Observe whether the person
   refreshes status rather than attempting a duplicate paid request.

Record unassisted completion, misunderstandings, incorrect actions, points of
hesitation and recovery. Compare the same tasks with the current implementation.
Define quantitative acceptance thresholds before testing; do not invent a
completion-rate claim or claim the design is liked because it looks cleaner.

General method references:
[Task analysis](https://www.nngroup.com/articles/task-analysis/),
[Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/),
[Observed usability testing](https://www.nngroup.com/articles/usability-testing-101/).
These support the method; they do not establish this product's users' preferences.
