# Hook / Wall generation input and sound audit

Local implementation; not deployed. No paid generation or production database changes.

## Two supported user intentions

| Inputs | Generation instructions |
| --- | --- |
| Source video + person photos | Recreate the video's performance, expression, gaze, pose, clothing, camera and scene using the photos for facial identity and proportions. The body can be regenerated. |
| Person photos + prompt | Generate the requested new scene and emotional performance. Main photo supplies identity and default appearance; supporting views describe the same person. No nonexistent source-preservation instruction. |
| General images + prompt, or prompt alone | Follow ordinary creation instructions without assigning a face-swap role to product/scene images. |

One main image remains first; supporting images retain selection order. The app
does not turn photos into trained identity embeddings or guarantee exact facial
geometry through a prompt. Existing source-edit mode remains available on Omni;
Seedance uses the existing reference-recreation route. This work does not silently
switch providers or assume edit mode fixes facial fidelity.

## Instructions and settings influencing the result

1. Reviewed gallery performance instructions, editable/removable in the form.
2. The user's complete instructions, preserved after that reference text.
3. Server instructions for person/source roles and explicit sound policy.
4. Wall's background-only/no-generated-text instruction.
5. Model-specific source wrappers in the Omni adapter. Direct workflow jobs do
   not run the older generic UGC template.
6. Provider-native settings: model, reference classification, media order,
   duration, ratio, resolution and sound. Seedance assets use `@Image N` /
   `@Video 1`; WAN uses ordinary `Image N` / `Video 1`.
7. Provider behavior: WAN's moderated route documents `prompt_extend: true` by
   default. The app does not explicitly disable it today. This is a documented
   provider expansion layer, not evidence of an app-owned hidden master prompt.
8. Postprocessing: old jobs may replace provider sound with catalogue music;
   new explicit sound requests bypass that replacement. OFF removes all audio
   while copying the video stream.

Do not rewrite user instructions silently to resolve contradictions. When testing
identity, use an unambiguous performance/identity request and inspect actual output;
five attached photos and correct API syntax alone do not prove facial fidelity.

## Sound switch

- Bottom-right of Your instructions, labeled Sound off/on with a speaker icon.
- Default off in Hook and Wall. Pending requests retain their original choice.
- Stored server-side as `generateAudio`, validated before billing.
- Seedance/ReAPI: native `generate_audio: false/true`.
- WAN/ReAPI: native `audio: false/true`.
- Direct Omni SDK route: no supported native audio switch in the current adapter;
  prompt policy and local output stripping enforce OFF. No unsupported SDK field.
- ON permits requested dialogue/music/effects and chosen audio references. It
  does not force speech or automatically reattach gallery music.
- OFF means the generated file is silent, including reference/native music.
  Explicit music added later in Edit/Demo is a separate choice.
- Old accepted jobs retain their original provider-operation fingerprints and
  recovery behavior. Neither this switch nor collection recovery creates a second
  paid task for an already accepted operation.

## Cost evidence

[ReAPI WAN docs](https://test.reapi.ai/docs/wan-3-0) explicitly state that audio
true and false cost the same. [Seedance docs](https://test.reapi.ai/docs/seedance-2-5)
document `generate_audio` but do not establish a separate audio-off discount.
Muting a completed file cannot reduce generation charges. App credit estimates
have therefore not been reduced based on the sound toggle.

## Comparison with other public workflows

[Higgsfield Face Swap](https://higgsfield.ai/apps/face-swap) presents source face
and target media separately. [Higgsfield Recast](https://higgsfield.ai/apps/recast)
separates a character image from motion footage.
[Runway Act-Two](https://help.runwayml.com/hc/en-us/articles/42311337895827-Performance-Capture-with-Act-Two)
separates a driving performance from the target character. These public workflows
support explicit task/input roles; they do not disclose a universal secret prompt
or prove which proprietary face engine Higgsfield uses.

## Verification limits

API/input-role tests: 29 passed. UI request tests: 77 passed. Provider/worker and
saved-task recovery tests: 49 passed. Media and legacy soundtrack tests: 10 passed,
including actual no-audio output with identical decoded pictures and timestamps.
Another 68 workspace/provider regression tests passed.
TypeScript, worker compilation, the local production build and targeted ESLint
passed. The build needed a retry with access to the existing Next.js cache after
a sandbox EPERM; no deployment ran. Browser navigation to
both local host forms timed out; visual layout acceptance remains pending. No live
model quality claim, paid generation, migration or deployment is included.
