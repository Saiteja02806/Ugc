# Hook and Wall of Text: product intent versus production behavior

Audit date: 19 October 2026. Production website is READY at
`fac61da34608dc3f4414702ab87f3f332bdcc14f`, deployment
`dpl_8vDMoogxxG5vxzoCFRH3heNKumpo`. Findings below refer to that deployed
source. They are not a claim that the proposed corrections are deployed.

## Accepted product contract

The user clarified the main purpose of these two Explore workflows:

1. The selected gallery or uploaded video is the source footage to edit.
2. Selected portraits supply the replacement facial appearance, not the room,
   clothes, starting frame or body performance.
3. Retain the source's scene, framing, camera motion, performance and timing,
   except for the requested face/text changes.
4. Remove the old source captions when making clean footage; place the user's
   new Hook/Wall text in the existing deterministic editor/rendering stage.
5. **Sound is OFF by default for new Hook and Wall of Text generations.** The
   user explicitly confirmed that OFF means a completely silent output,
   including any reference/background music. Sound requires user opt-in.

This contract is different from using source footage as a loose example for
generating another scene. The latter remains a possible separate advanced
operation; it must not silently replace source editing.

## Overall finding

The implementation is partially aligned. Asset delivery, ownership checks,
durable provider-task recovery and one Omni source-edit path exist. However,
changing the model on the same workflow changes the operation being performed.
There is no common explicit source-edit contract or default-silent output
policy across the selectable models. A model returning a playable file is
currently sufficient technical completion without proving the requested face
change or source-caption removal.

## Model behavior actually implemented

| Workflow model | Deployed operation with source + portraits | Alignment with selective source editing |
| --- | --- | --- |
| Omni Flash 1.1 | Source video and all images are sent with source/reference role tags; `video_config.task: edit`; forced output duration/aspect ratio omitted; source ≤10s | Has an implemented edit path. This is not proof of acceptable face/text quality or default silence. |
| Seedance 2.5 | `doubao-seedance-2.5-face`, `content_filter: false`, `omni_reference_task_type: reference`, fixed selected duration/ratio, `generate_audio: true` | No Seedance source-edit operation through this flow. API and worker currently reject its explicit edit flag. |
| WAN 3.0 | `wan3.0-video`, `generation_type: reference`, fixed selected duration/ratio, `audio: true` | Current integration implements multimodal reference synthesis, not a selective source edit. Do not label it equivalent to the Omni edit path. |

Kling is available in the broader AI Studio, but Explore API admission only
allows Omni, Seedance and WAN for these two formats. Kling's connected route
is first/last-frame generation and does not supply an alternative source-edit
implementation here.

Primary code boundaries:

- `components/video/video-generation-workspace.tsx`: derives source-edit
  behavior only when `model === google_omni`; submits selected assets, settings
  and instructions; no generation-sound toggle/state in this request.
- `lib/ai-studio/video-generation-api.ts`: permits the three workflow models,
  but restricts explicit `referenceVideoMode: edit` to Omni; freezes provider
  and validated inputs before reserving/queuing.
- `worker/src/jobs/generate-hook-video.ts`: validates the same Omni-only mode,
  selects the recorded provider, constructs a request fingerprint, downloads
  output, applies reference audio, validates timing for explicit edits and
  uploads a generated result.
- `worker/src/lib/gemini-omni-video.ts`: implements actual source-video edit
  configuration and appearance-reference tags.
- `worker/src/lib/reapi-video.ts`: fixes Seedance and WAN to their respective
  reference-generation controls and sound enabled.

## Reference eligibility is a catalogue-wide issue

The verified release's live 98-Hook catalogue snapshot (14:49:13Z) contains:

- 80 source clips shorter than 4 seconds; only 18 are in Seedance's documented
  4–30-second edit-source window.
- Five clips shorter than Seedance's existing 2-second reference-input minimum.
- All 98 are ≤10 seconds (range 1.634–8.634s), which fits Omni's source-duration
  maximum. This checks duration only, not size, region, content eligibility,
  model availability or creative quality.

The seven published paired Wall examples span 6.067–14.067 seconds: all seven
fit Seedance's edit duration range, while two exceed Omni's 10-second source
maximum. There are also 62 legacy Wall references without catalogue durations
in that source list; those 62 were not exhaustively downloaded/probed in this
audit. Their unknown eligibility must be resolved per selected source before
spending, not assumed from the seven paired examples.

The previously inspected `cdd.mp4` is 3.166667 seconds and falls into the short
Hook case. Changing only Seedance's task field to edit would not be a valid
complete fix. No source was padded, slowed down, looped or trimmed here.

## Confirmed sound gaps and the agreed toggle

The speaker-control proposal fits this product. Make it a generation setting
with visible text such as **Sound off** and an accessible switch state. Keep
it outside the editable prompt, near the other generation settings and action.
It must remain distinguishable from the preview player's playback mute button.

OFF must have all of these effects:

- The new generation request explicitly records the silent-output choice.
- Disable provider-generated audio where the connected model documents that
  control: Seedance `generate_audio: false`, WAN `audio: false`.
- Do not pass optional audio guidance that is not being used by this silent
  operation. Retain the user's uploaded files/selections for later opt-in;
  do not delete them from the library or catalogue.
- For a model without a verified generation-audio disable switch, ask for
  silence in the prompt and guarantee the deliverable by removing audio in
  local post-processing. Do not invent an unsupported provider field or claim
  that no audio computation occurred upstream.
- Skip automatic reference-music attachment and strip any returned audio
  before saving the generated result. Verify the resulting file has no audio
  stream. Silence must be checked after the last audio-appending stage.
- Persist the policy in request receipts, fingerprints, history/draft recovery
  and media metadata. Reopening or exporting should keep it silent until the
  user explicitly changes sound/audio in the editor.

Why a provider flag alone does not suffice: current generation processing
calls `applyGeneratedReferenceAudio` for eligible catalogue references. It
replaces native audio with a paired MP3 at volume .2; rejected Hooks 3, 13 and
59 instead strip audio. Finishing also reloads soundtrack provenance through
`getAssetReferenceSoundtrack`. Neither mechanism currently knows about a new
per-user Sound OFF choice. A new explicit silent policy must take precedence
over catalogue defaults, including later edit/export provenance fallback.

Sound ON must visibly indicate its audio source. The current Choose audio
input is provider guidance; paired gallery music is a separate finishing step.
The controls must not imply that these are the same thing. New implementation
should show whether the opted-in source is generated sound or selected music.
The accepted decision here is default OFF and silence when OFF; no separate
user decision on automatic Sound ON source selection was inferred.

Do not apply this default to Talking Head, existing uploads, historical output
files, existing paid provider operations or already-scheduled snapshots.
Preserve older request fingerprints and explicitly stored soundtrack receipts.

## Prompt roles and text behavior

The inspected Seedance job preserved the full 2,027-character user prompt and
all three correct portraits. Pixel comparisons matched the attached originals;
the exact source-video hash matched `cdd.mp4`. An offline replay through exact
deployed worker source reproduced the saved request fingerprint. The main
problem is not missing files or a truncated prompt in that job.

UI and provider bindings should consistently identify:

- **Source video**: scene, body, performance, camera and timing to preserve.
- **Face reference 1/2/3**: facial appearance only, with consistent numbering.
- **Text policy**: remove old captions and render the user's new text later.
- **Sound policy**: explicit request state, not inferred from a sentence.

Bind these to each provider's documented syntax. Provider numbering is per
media type; a source video is not "image 1". Prefer short, specific edit
directions over a hidden general UGC template. Keep user text intact and make
app-supplied role instructions reviewable.

Wall generation appends an instruction to create moving background without
text; this is a prompt instruction, not proof that source captions have been
removed. Hook relies on its submitted prompt for that request. Clean footage
must be reviewed before rendering new business copy over retained old text.

## Credits and result acceptance

Existing safeguards worth retaining:

- Ownership/readiness/reference checks before billing, bounded media limits,
  atomic request receipts and idempotency.
- Save accepted provider task IDs, resume the same operation, never silently
  create another paid generation or switch a historical paid provider.
- Technical job failure releases its application-credit reservation.

Gaps to address:

- Eligibility currently validates model input limits, not whether the selected
  operation can fulfill the source-edit intent.
- `assertGeneratedMp4` checks a container header; an explicit Omni edit also
  checks duration within .25 seconds. The unchanged original reference passes
  both checks, as demonstrated without a provider request. These checks do
  not establish face transformation, caption removal or clean background.
- Billing settlement follows technical job completion. It is not conditioned
  on an independently verified successful facial edit. Do not describe every
  completed video as validated against the requested transformation.
- The separate Seedance output-CDN collection correction is still local. It
  fixes retrieval, not creative fidelity; exhausted historical jobs still need
  controlled same-task recovery with their original billing state.

Prevent unsuitable combinations before credit reservation, and distinguish
provider completion, successful collection and reviewed creative suitability.
Do not introduce an automatic paid retry loop on a disappointing output. Any
quality-compensation policy is a separate product/billing decision; it was not
silently changed by this audit.

## Concrete implementation order

1. **Define and enforce the common operation.** Default a selected-source
   Hook/Wall recreation to source editing, with required source and facial
   reference(s). Offer reference synthesis as a clearly different operation
   only if kept as an advanced feature. Use one shared typed contract for both
   workflows so the model picker cannot silently change product behavior.
2. **Check compatibility before spending.** Compute available models from the
   operation, measured source duration/size, image count and configured route.
   Block and explain an unsupported combination; never silently pad the clip,
   substitute another model or change it into reference generation.
3. **Implement the agreed silent default end to end.** UI switch, API schema,
   immutable request, worker adapter, audio post-process, saved metadata and
   downstream editor/export must agree. Leave historical requests unchanged.
4. **Implement and validate Seedance's own source-edit adapter.** For eligible
   clips use edit/-1/adaptive, explicit roles and audio policy. Carry measured
   source duration separately from the provider's sentinel `-1`; never feed
   `-1` into application duration/credit arithmetic. Follow the provider's
   reservation and eventual settlement rules without inventing free retries.
5. **Keep text rendering and result checks explicit.** Clean old captions,
   apply the user's text through the existing editor, verify timeline/ratio/
   decode/silence and review representative output for the actual face-change
   requirement. A documented edit contract still does not guarantee every
   untouched pixel or every requested facial detail.
6. **Release only a verified complete flow.** Regress both formats, catalogue
   and uploaded sources, short/ineligible clips, multiple portraits, mute/on,
   reload/recovery/export and historical jobs. A future bounded real-provider
   output test is needed for creative acceptance; unit tests alone cannot
   establish it. No new paid generation was authorized or started in this audit.

## Verification and limits

Fresh Vercel read confirmed the live deployment identity. Exact-commit source
inspection, offline request replay, catalogue duration statistics, an unchanged
source acceptance check and 29 focused local adapter/worker tests support the
findings. Those tests include the separately prepared local collector fix;
they do not mean it is deployed or that face-edit quality has passed.

Live browser inspection was attempted but is disabled by Work settings. No
fresh authenticated UI acceptance or new paid output was claimed. No product
code, deployment, production records or billing state changed in this audit.
The sound-default requirement was recorded for implementation, not shipped.

Evidence: `outputs/explore-recreation-alignment-2026-10-19/alignment-evidence.json`.
Earlier exact-job evidence: `docs/seedance-reference-edit-flow-audit-2026-10-19.md`.

Primary documentation checked:

- [ReAPI Seedance fields and edit constraints](https://reapi.ai/docs/seedance-2-5).
- [ReAPI WAN reference-family behavior and audio control](https://reapi.ai/docs/wan-3-0).
- [Google Omni source editing, duration limits and prompting](https://ai.google.dev/gemini-api/docs/omni).
