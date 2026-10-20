# Explore audio contract — 3 October 2026

The user's latest clarification supersedes the earlier interpretation that “main voice” meant a separate demo voice-over. This applies to Create Hook and Creator Phone.

| Input | Location | Intended role |
| --- | --- | --- |
| Main voice reference | Create | Optional audio guidance for generating the hook/creator video. Not a soundtrack layered over the finished video, and not demo audio. |
| Demo audio | Edit video, alongside Demo | User-uploaded background audio mixed underneath the appended demo's original sound. Preserve the original sound. Never send it as a generation reference or play it over the opening. |
| Background music | Separate toggle | Off by default. When enabled, use a vetted default with an optional user choice; no default asset or licensing approval has been established yet. |
| Auto subtitles | Edit video | English speech captions for the complete opening + demo, up to 60 seconds total. Never trim automatically. Clean is the default style. |

## Confirmed Demo audio behavior — 4 October 2026 (Asia/Calcutta)

- The user explicitly chose mixing: keep the demo video's original audio and add the uploaded audio as its background. Do not replace or mute original demo sound. The uploaded layer is demo-only, not opening audio or a generation reference.
- The unregistered local composition helper already implements this mixing behavior with a quiet uploaded layer. Synthetic-tone checks cover a demo that already has audio, verify background isolation from the opening and subtitle speech track, and verify the source files are unchanged. This is not a production export connection.

## Background duration fitting — 4 October 2026 (Asia/Calcutta)

The user requested fixing audio-length gaps after the clarification that added music may be fitted, while source video/speech must not be shortened.

- A pure shared timing policy now governs both Explore editing panels and the isolated composition helper. Longer background audio is limited to its target segment and faded out; this creates a derivative, never edits a source file. Equal-duration audio also receives short endpoint fades.
- Uploaded Demo audio defaults to Play once. Shorter audio fades out, then original demo sound continues. Repeat music is an explicit local draft choice for suitable loopable music, not an automatic treatment of uploaded speech. Accepted replacement/removal of the audio or demo clears the repeat choice; failed replacements and switching sections retain it.
- Demo audio fits only the demo duration and never plays during the opening. Separate whole-video music fits the complete opening + demo duration. Both layers can coexist with independent inputs and remain outside the separate original-speech track prepared for subtitles.
- Standalone background MP3/AAC encoder-delay timestamps are normalized to zero. Strict original-video soundtrack timing checks remain unchanged; offset video/audio relationships are not silently shifted.
- Added audio is bounded at 50 MiB and 10 minutes. Each original video remains bounded at 120 seconds; the complete subtitle-enabled sequence remains English and at most 60 seconds. These are separate limits. Changing music length never evades the subtitle cap or shortens a video.
- The UI choices are explicitly identified as local preferences, not applied output. The finishing helper is still unregistered: no authenticated production export API, owned durable upload/job/save path, default-track activation, or combined browser playback was enabled by this patch.

## Default music source decision remains pending

- The supplied paths are `D:/walloftext_sound`, `D:/walloftext_sound/notbeen`, and `D:/hook sound`. Metadata inspection found 48, 23, and 26 MP3 files respectively; one Hook file (`ReelAudio-88085.mp3`) is empty and must not be offered as a new default. No supplied file was edited, uploaded, moved, or deleted.
- No new Explore default has been chosen. Existing Wall-of-Text/Hook music selection and rendering are unchanged. A rights-confirmed library is the recommended initial default source; ElevenLabs custom music remains an optional future integration, not an activated provider.
- Await confirmation of the local tracks' rights for customer video exports and the applicable ElevenLabs plan/customer-use agreement. Filenames and an API subscription do not establish rights for these local files or a reusable customer-facing music library.
- Once approved, the deployed app must use versioned GCP asset identifiers/verified metadata, not a browser blob URL or a desktop `D:/` path. Prefer a track that naturally covers the target; repeat library music only when approved as loopable. Default-track selection and ownership checks belong to the production finishing handler.

## Backend follow-up — 4 October 2026

The [Scribe integration slice](explore-scribe-integration-2026-10-04.md) now includes a registered owned finishing worker and authenticated reservation/status API. Older statements that the helper is unregistered describe the earlier patch, not current code. Uploaded Demo audio still mixes underneath preserved original demo sound during the demo only; the known added layers are excluded from the Scribe speech input. English subtitles remain limited to the complete 60-second sequence without trimming. The migration and worker/API are not deployed or activated, and client controls, owned uploads, generated-audio selection, Editorial rendering and scheduling still require integration. Default-track approval/configuration remains outstanding.

## Decisions still needed

- Keep the current Edit video tab pending a navigation decision. It also contains whole-video subtitles/music, so a Demo-only label would conceal their scope. Demo & edits is a possible clearer label, not an implemented rename.

## Code state

- Both workflow parents already keep generation audio and Demo audio in separate attachment states. The generation draft contains only `hookAudio.asset` / `creatorAudio.asset`, never `demo` or `demoAudio`.
- The shared Create popover now says Main voice reference and explicitly identifies generation guidance, not Demo audio. It still discloses that the input is not connected.
- Demo help now states the confirmed background-mixing behavior and preservation of original sound. Standalone local audio/video previews are not synchronized combined playback.
- Removed the newly added, unregistered `demoVoicePath` replacement input from the composition primitive after the clarification. No approved existing media/control was deleted. The primitive remains unregistered and cannot be described as a working production export.
- `getWorkflowGenerationDraftError`, the existing video API and the current OpenRouter adapter reject audio references. No validation was relaxed, provider switched, paid request sent, or unsupported reference silently discarded.

## Provider findings, not an application connection

The older “image references only” statement described the application's implemented reference path, not a requirement to upload an image. Text-only requests remain supported for the application's three configured video models.

Seedance 2.5 documents audio references. Runway's adapter also contains `referenceAudio` support for legacy routing, while the application's new Seedance requests are explicitly routed to OpenRouter and its current adapter accepts images only. OpenRouter's model-specific page documents multimodal references, but its generic guides/API descriptions vary in specificity. Supporting an input at the model level does not establish reliable voice identity matching or exact recording reproduction.

Before connecting this UI, reconcile an owner-validated audio upload/request path and the correct provider payload together, verify limits and model routing, preserve request recovery, and add negative tests before billing. Do not send a browser blob URL, arbitrary external audio URL, or another user's asset. Do not enable audio for Kling/Omni without checking their actual selected adapters.

Read-only official sources checked on 3 October 2026: [OpenRouter Seedance model](https://openrouter.ai/bytedance/seedance-2.5), [OpenRouter model-specific reference guidance](https://openrouter.ai/blog/insights/seedance-2-5-review/), [OpenRouter video request workflow](https://openrouter.ai/docs/guides/overview/multimodal/video-generation), [Runway API inputs](https://docs.dev.runwayml.com/assets/inputs/), [Runway API changelog](https://docs.dev.runwayml.com/api-details/api_changelog/). No inference/generation request was made.
