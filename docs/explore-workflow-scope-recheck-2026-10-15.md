# Explore editor and audio scope recheck — 15 October 2026

This is a code and regression audit of the current worktree. It does not
establish that these uncommitted changes are deployed. The supplied screenshot
shows the unwanted older panels; it is not evidence of the current live build.

## Current section and action map

| Workflow | Source / setup | Focused editing | Audio ownership |
| --- | --- | --- | --- |
| Talking Head + Demo | Create generates/uploads/selects the speaking opening; Demo retains optional demo upload, replacement and removal | Edit hook video / Edit demo video open separate trim, text, Remix and appearance tools with preview, Save edits and Back to videos; Sound is disabled for both callers | Embedded influencer speech stays in the footage. Optional Demo sound attachment plays only during demo. Background music On/Off selects default whole-video music. **Custom whole-video upload is missing.** |
| Hook video | Create selects/generates opening; Demo retains upload/assets, replacement/removal, original demo volume and one shared background group | Opening hides Sound; focused demo controls have trim, Remix, text and style, with no Crop & zoom or Sound panel; Save edits and Back to videos remain | One background track spans opening and demo. No separate demo-only added-audio picker in the public Hook path. |
| Wall of text | Create generates/uploads/selects one background video; source-less Edit returns to source controls | Edit contains trim, reference Remix/manual text, appearance, preview and one audio group; return is Back to Create | One background track for that single video, with upload/library, removal, volume and playback where supported. Retaining this group is intentional: there is no Demo step. |
| Slideshows | Create generates/selects images; Edit slides uploads/arranges images | Per-slide text/appearance and preview; earlier/later, remove, replace/recreate; Save slideshow before Schedule slideshow | Still images, with no video crop/zoom or Sound panel. A slideshow soundtrack is not an existing capability to infer from the video workflows. |

## Evidence in current source

- `components/explore/talking-head-clip-editing.tsx`: both `FormatVideoEditor`
  instances pass `showSoundControls={false}`.
- `components/explore/format-workspace.tsx`: Hook opening passes
  `showSoundControls={format !== "hook"}`; Wall keeps it enabled. The public
  Hook caller does not enable `allowDemoAudio`.
- `components/explore/format-demo-section.tsx`: focused `editingControls`
  contains trim, Remix/text and a style dock. Original volume and permitted
  audio setup belong to overview controls. Legacy framing can be explicitly
  reset there without restoring a Crop & zoom editor.
- `components/explore/workflow-composition-panel.tsx`: demo audio has its own
  attachment; Background music currently only has an On/Off control. It is not
  a custom music uploader.
- `components/explore/format-slideshow-editor.tsx`: ordered image editing and
  save/schedule actions, without video sound/crop panels.

## Verification and remaining work

The targeted nine-file run executed 228 tests: 227 passed; one audio-render test
hit a Windows `EBUSY` error while deleting a temporary font after its checks.
Rerunning that audio-composition file passed all four tests. Thus all 228 distinct
tests passed across the main run and cleanup rerun. See
`outputs/explore-workflow-scope-recheck-2026-10-15.log` and
`outputs/explore-background-scope-recheck-2026-10-15.log`.

The first invocation omitted the repository's TypeScript resolver/transform
flags and failed to load three test files; the main run above used the required
loader and transform flags. Those loader failures are not product failures.

Production `https://www.getugcpilot.com/explore/hook-video` redirected this
browser to sign-in. No authenticated production acceptance, paid generation,
render or scheduling was performed. The existing local app fixture produced
an incomplete noninteractive Hook shell and the Wall navigation timed out;
it does not establish visual acceptance. The isolated real-component layout
check compiled its fixture, but Edge failed to launch in the sandbox before
any assertions or screenshots. See
`outputs/explore-editor-browser-recheck-2026-10-15.log`. These attempts do not
provide fresh laptop-size visual acceptance; no current screenshot is offered
as proof of the removed panels.

Open requirements remain: Talking Head custom whole-video music upload and its
complete preview/preparation/recovery/Schedule plumbing; Talking Head reference
text provenance; uploaded-reference transcription/OCR; authenticated production
acceptance. Do not claim all workflows are complete from the panel removals.
