# Starting-frame facial edit investigation — 22 October 2026

## Subsequent authorized prompt A/B test

Two fresh Gemini 3 Pro (`gemini-3-pro-image`) calls completed with the same source
from `2d6398b7-39e0-4898-b3e5-28db054f4fc8`, main asset `495d8905-7a1b-4cbf-a38f-7a526a4dbff5`,
and supports `e85501ab-d5c2-4dac-97e9-dcc786e02ac5` / `95d46a09-5f15-4e80-a57b-dbb40f4e1b49`.
Both requested 2K 9:16 and returned 1536x2752 JPEGs. The baseline prompt hash
exactly matches the saved request. The changed variable is the complete textual
instruction package (prompt and adjacent role labels), not image order or bytes.
No seed was set. There was one output per arm and no paid retry.

Both outputs preserve the source scene and remove captions. Visual inspection
does not show a clear identity improvement from v3: its face remains strongly
source-like. V2 makes more visible brow/skin changes, but neither is accepted as
a convincing match to the influencer. This does not prove a universal failure
rate or isolate internal model reasoning; it rejects claiming this pair as a
successful prompt fix. Deployment stays paused.

Original outputs, exact prompts, SHA-256 input manifest and provider receipts:
`outputs/hook-prompt-ab-2026-10-22/` (ignored private evidence). Calls used the
configured Google provider directly, not UGC Pilot credit deductions.

This is a read-only investigation of existing owned results. No new inference or
production mutation was performed. Deployment remains paused.

## Established evidence

The glasses/hand screenshot corresponds to two recent owned Hook starting-image
outputs. Completed jobs and operations were inspected without retrying them.

| Saved job | Selected still model | Output asset |
| --- | --- | --- |
| c3c7cad3-1bb3-4356-9ea9-a6fb8f03bf88 | gemini_3_pro | 0f000ea8-892a-4819-931d-b343d2837759 |
| 778ab6a8-6c93-49f7-a5f7-a2460462c94e | nano_banana_2 (Flash) | 19377d4a-8093-4b0f-abfa-58658664e8eb |

Both saved requests contain:

- Hook `explore-paired-hook-f24aeb3d18886faf62ca3b8c`, frame zero, 720x1280.
- Source frame SHA `bccf6b2195765ff89804a28592ae5abca09a91245c9690034132b6048270c265`.
- Main asset `495d8905-7a1b-4cbf-a38f-7a526a4dbff5` followed by supporting asset
  `a30050de-3e47-48ca-9c43-7b68aba1ad0e`; three image URLs including the base scene.
- Prompt v2, SHA `9307441c178d2ad808e6b2b2b014751969f4a15bffce09bcfa9b986e390adefd`.
- Empty custom instructions. The compiled prompt explicitly replaces facial
  features/proportions, prohibits averaging and separately requests caption removal.
- Completed provider operation, output_persisted, no reported provider failure.

Main/support dimensions are both 1122x1402, with sizes 2,470,091 and 2,579,318
bytes. These are full images, not the small displayed chooser thumbnails. The
known main file was inspected: the face is clearly visible. The screenshot's
supporting pose looks similar; this is not evidence of corrupt or unusable input.

The two owned output PNGs were downloaded through their verified asset delivery
links and inspected. Captions are absent and the original scene, hand, glasses
and hairstyle remain prominent. The requested facial edit has not been shown to
meet the user's acceptance. Small skin/feature changes do not establish successful
replacement. File byte differences only establish distinct outputs, not identity.

The earlier user-described successful request, job
`08338668-5953-4780-af81-62a606523c78`, used a different keyboard Hook and different
person image asset IDs. It is not a controlled same-scene comparison.

### Role-precedence trace

The main asset `495d8905-7a1b-4cbf-a38f-7a526a4dbff5` also occurs in eight
completed starting-image outputs across four distinct source-frame hashes. That
is sufficient to reject the idea that the screenshot is the only attempted
combination, though it does not by itself make every output an acceptance
failure.

One of those earlier runs, job `808b8505-90e7-4adb-9654-fa5918a22125`, has a
saved Google interaction from 21 October. It independently verifies the actual
provider input order and bytes: keyboard base scene first, this main face photo
second, a supporting photo third, then the explicit role/preservation prompt.
Its output instead adopted the bedroom scene from the face references. The
application did not replace that output afterward. This proves a role-precedence
failure in the general Gemini image-editing route for this influencer/scene
combination: the model can promote identity-reference imagery into scene input
despite the prompt. It is not evidence of missing app instructions, swapped
uploads, UI thumbnails, or incorrect image ordering in that recorded request.

The newest two outputs retain the same saved input contract but their provider
interactions cannot currently be read with the configured key, so they are not
byte-level evidence of the identical provider behavior. Their visual result
instead exhibits the other failure mode: scene preservation dominates and the
identity edit is weak. Together, the two modes show that prompt labels alone do
not give the base scene and face reference stable, controllable precedence.

### Cross-frame visual comparison

The existing output files were compared directly with hash-verified source-frame
snapshots and the actual main identity image. The comparison covers all eight
completed starting-image outputs that used the same main asset, across four Hook
source frames:

| Source group | Attempts | Visual result |
| --- | ---: | --- |
| Purple keyboard scene | 1 Flash attempt | The result adopts the identity-photo bedroom scene instead of retaining the keyboard source. |
| Headphones/laptop scene | 4 Gemini 3 Pro variations | The room, performer, pose and reaction persist, but all four faces remain source-like rather than the selected fair, brunette identity. |
| Separate Hook scene | 1 Gemini 3 Pro attempt | The scene remains recognizable; the selected identity still does not pass visual review. |
| Glasses/hand scene | 1 Gemini 3 Pro + 1 Flash attempt | Both retain the source face much more strongly than the selected identity. |

No custom image instructions were supplied on any of these eight jobs. The
comparison therefore rules out a conflicting user instruction. It also shows
that adding two extra supporting views in the four-variation run did not repair
this identity failure. The problem is reproducible for this influencer across
different scenes and poses, and across both exposed still-image models.

## What remains unknown

The two existing Gemini interactions returned 404 to GET using the configured
key. No alternate keys or accounts were probed. Thus saved application request
fields and stored output images are established here; actual retained provider
inputs and returned model fields were not independently recovered. This differs
from the 21 October incident, where retained provider inputs were recovered.

There is no evidence that the user's blank optional instructions caused failure:
the app's compiled prompt already asks for the requested replacement. The current
Gemini path uses general multi-image editing, with textual base/identity labels.
It does not use a face mask or structural identity-strength/face-lock parameter.
Preservation winning over the facial edit is a plausible failure mechanism, not
an assertion about the model's internal reasoning. Glasses, upward gaze, differing
expression and hand occlusion make this source more demanding than a clear
front-facing portrait. This cannot isolate an influencer-specific cause.

## Recommended qualification before changing production

1. Keep the exact glasses source, face inputs and output dimensions fixed. Judge
   caption cleanup, facial-edit adherence, occlusion and scene preservation
   separately. One successful output on another scene is insufficient evidence.
2. Assess one sharp main photo and genuinely different supporting views where
   the selected engine supports them. Do not label repeated near-identical views
   as a guarantee or blame the existing clear photo.
3. Compare the existing general-edit baseline against a targeted facial edit or
   dedicated face-swap engine. Clean captions with a localized edit first, then
   perform the facial stage so later broad edits cannot overwrite it. Preserve
   the hand and glasses in front of the face. Evaluate artifacts on this scene.
4. Retain explicit human review and Use this. Never silently resubmit, switch
   providers or claim a completed response passed visual quality. Dedicated face
   tools can also fail; no universal similarity score or accuracy promise is made.

Following the user's explicit suggestion, a local prompt v3 now asks to recreate
the primary shot with the selected influencer as its performer. The scene image
defines shot composition, pose and expression; the main influencer photo defines
facial identity. Adjacent provider labels follow the same instruction. Prior
accepted requests retain their original prompt and labels. This change has not
been qualified with a paid generation and does not establish improved fidelity.
A new paid benchmark needs a concrete limited set of calls and an agreed cost
before execution. Deployment remains paused.

Primary sources checked:

- [Google image generation](https://ai.google.dev/gemini-api/docs/image-generation):
  multi-image editing and reference guidance; not an exact-identity guarantee.
- [ReAPI Face Swap](https://reapi.ai/docs/face-swap): separate target/source-face
  inputs; clear source photos recommended; angle/occlusion limitations documented.
- [FaceDancer research](https://arxiv.org/abs/2210.10473): pose and occlusion are
  explicit technical challenges for dedicated face-swapping systems as well.

Media inspection used the [UGC Pilot manage-media skill](C:/Users/chund/.codex/plugins/cache/ugc-pilot-local/ugc-pilot/0.2.1/skills/manage-ugc-media/SKILL.md)
and owner-scoped MCP assets/operations. Database reads were limited to the exact
job IDs discovered through that account's operation list. The local output
folder contains private evidence and is not a source-controlled fixture set.
