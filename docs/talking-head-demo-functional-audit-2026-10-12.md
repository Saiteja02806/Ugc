# Talking Head + Demo functional audit — 12 October 2026

The code sends selected image, video and audio references to Seedance 2.5. Both **image + video + audio** and **image + video** are supported. The backend is implemented, but the complete deployed workflow cannot yet be described as fully verified: production exposes an older editing interface, recorded OpenRouter generations failed, and the broad regression suite is not green.

This audit covers `/explore/create-hook` (Talking Head + Demo), its shared generation/finishing/scheduling services, the current workspace, and the signed-in production application at `https://getugcpilot.com`. The separate `/explore/hook-video` reference-recreation workflow has different rules and should not be confused with Talking Head + Demo.

No production source was changed, no release was deployed, and no paid generation or live post was submitted. Browser tests against the local fixture used real components with mocked authentication, media uploads, render receipts and scheduling. They establish request wiring and UI behavior, not production provider acceptance.

**What happens to generation references**

1. The user selects a creator image, a video reference and/or an audio reference in Create. These initially remain browser files/previews.
2. Generate snapshots the prompt, model, settings and references. It validates inputs, then uploads files through the real media upload API and confirms the resulting assets.
3. The client sends image URLs, the video URL/asset ID/duration and audio URLs/asset IDs to `/api/ai-studio/videos/workflow-start`.
4. The server checks authentication, owned ready timed assets, trusted media URLs, model support and credits. It saves the full inputs in durable generation jobs.
5. The worker resolves owned media URLs and submits `model: "bytedance/seedance-2.5"` to OpenRouter with typed `input_references`: `image_url`, `audio_url`, and `video_url`.
6. The prompt uses direct mode: only surrounding whitespace is trimmed. The system does not replace it with a talking-head template.

The client fields are visible in [workflow-generation-client.ts](C:/Users/chund/OneDrive/Desktop/UGC/lib/explore/workflow-generation-client.ts:154); worker media resolution is in [generate-hook-video.ts](C:/Users/chund/OneDrive/Desktop/UGC/worker/src/jobs/generate-hook-video.ts:363); the provider request is in [openrouter-seedance-video.ts](C:/Users/chund/OneDrive/Desktop/UGC/worker/src/lib/openrouter-seedance-video.ts:41). Direct prompt handling is in [ugc-video-prompt.ts](C:/Users/chund/OneDrive/Desktop/UGC/worker/src/lib/ugc-video-prompt.ts:82).

Image/audio/video references guide generation. An audio reference is not an exact soundtrack attachment, and this code does not implement a dedicated voice-cloning or guaranteed lip-sync stage. A video reference is not appended to the output. Demo footage and demo audio are separate finishing inputs. OpenRouter documents Seedance's multimodal reference support on its [model page](https://openrouter.ai/bytedance/seedance-2.5) and [video generation guide](https://openrouter.ai/docs/guides/overview/multimodal/video-generation).

In this workflow the UI accepts one image, one video and one audio reference. Video and audio guidance require Seedance 2.5; unsupported combinations are rejected instead of silently dropping files. Timed generation references must be at most 30 seconds. The app supports Seedance output durations of 4–30 seconds, 480p/720p, and 9:16/16:9.

**Functionality and evidence**

| Function | Code/backend status | Verification and remaining limit |
|---|---|---|
| Image + video + audio generation | All modalities reach the Seedance adapter | Client/API tests and provider request tests pass. No successful current OpenRouter production example with all three was found. |
| Image + video generation | Both are preserved and sent | Same code path and typed request tests. Production provider acceptance remains unproven. |
| Prompt, model, duration, ratio, quality, quantity | Real request settings; direct prompt mode | Passing integration tests; live Seedance selection and Generate access verified. A temporary prompt enabled Generate and displayed 20 AI credits; it was cleared without submitting. |
| Uploaded or saved opening video | Owned upload/asset APIs | Production Creative Assets loaded real saved videos; selecting one displayed a playable opening preview. |
| Saved voice/audio references | Real sample/asset reads, then the normal reference upload path | Code is wired. Upload and saved-choice controls are present live; provider acceptance of a selected voice sample was not exercised. |
| Demo after the opening | Real saved finish request, job and FFmpeg composition | Shared production finishing records include three completed opening-plus-demo compositions. |
| Demo audio once/repeat | Passed to the renderer; plays during the demo | Passing renderer/client tests and captured browser request. No completed production receipt with demo audio was found. |
| Background music | Loads approved configured music and mixes it into the final video | Passing tests; three completed shared production finishes include music, two also include demos. |
| Automatic subtitles, style and position | Real transcription and subtitle rendering | Enabled in production configuration and exposed live. Passing renderer/client tests. No completed production finish with subtitles was found; end-to-end live acceptance remains unproven. English and 60-second total-duration limits apply. |
| Separate opening/demo trim and text overlays | Implemented in the current `TalkingHeadClipEditing` integration | Manually verified with real components and mocked HTTP boundaries. These separate editors were absent from the live Talking Head page checked during the audit. |
| Demo framing | Real framing contract and renderer | Browser request correctly rebased framing after demo trim; tests pass. No completed production finish with framing was found. |
| Scheduling | Real connected-account lookup, review and schedule API | Production Instagram accounts loaded. Fixture confirmed one explicit schedule using the final composition asset. No live schedule was submitted. |
| Recovery and duplicate prevention | Durable receipts, request keys, status recovery and tab coordination | Passing tests cover lost acknowledgements and interrupted requests. Browser fixture recorded zero overlapping renders and no automatic schedule before confirmation. |
| Bottom inspiration Library | Static empty placeholder | Both source and production show `No videos yet.` This section has no populated inspiration backend; the separate Creative Assets picker works. |

The finishing worker is real: [finish-explore-video.ts](C:/Users/chund/OneDrive/Desktop/UGC/worker/src/jobs/finish-explore-video.ts:35) loads owned media and calls the renderer; it conditionally transcribes composed audio before rendering subtitles. Scheduling posts the confirmed final asset in [workflow-finishing-boundary.tsx](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/workflow-finishing-boundary.tsx:131). The placeholder library is explicit in [hook-workflow-preview.tsx](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/hook-workflow-preview.tsx:170).

**Production findings**

- Three OpenRouter Seedance jobs were recorded on 5 October; all failed. Each had one image and one audio reference, with no video reference. One failed the inference-key check. The two subsequent jobs received HTTP 400 `InputImageSensitiveContentDetected.PrivacyInformation`: the provider considered the image potentially a real person. These errors establish failed provider acceptance, not missing reference forwarding.
- The current production worker's configured key passes the read-only OpenRouter `/key` check and is not a management key. The older key error is historical; that check does not prove a paid video generation will complete.
- The shared Explore finishing table has 14 completed receipts: ten individual edits, three opening-plus-demo compositions, and one standalone finish with music. Shared `kind: hook` records also serve other Explore editing paths, so all 14 must not be represented as completed Talking Head journeys. None of these receipts exercised demo audio, subtitles or demo framing.
- Production configuration enables generation, finishing, manual editing, subtitles, demo framing and OpenRouter Seedance. The connected application also advertises available manual editing/framing/subtitles capabilities. Availability flags do not prove rendered output succeeds.
- The live page displayed `Create a Hook` with Create / Edited demo / Schedule. After selecting a saved opening, it exposed composition controls and `Change video`, but no separate `Edit talking-head video` or `Edit demo video` controls. Current workspace source integrates both. The deployed UI therefore does not match the current workspace behavior.
- The production generation worker reports release commit `0a8bc1beecea03b811940e0b371d988b504a6c5a`; its ready revision dates to 9 October UTC. The render job uses the same older worker image. The current checkout HEAD is `bb83ce32773011562702adb90ed6966a4279cc7e` and includes additional uncommitted changes. The older worker's Seedance request builder already sends all three reference modalities; worker age is not evidence that references are omitted. The exact web source revision could not be established from Vercel deployment metadata.

**Tests and browser checks**

- `npm run test:explore`: **723 passed, 16 failed, 739 total**. Worker compilation succeeded. Passing tests include client-to-real-API reference wiring and real FFmpeg editing/composition/audio/subtitle behavior.
- The 16 failures consist of 11 incomplete import mocks, three Generate-button extraction assertions, one obsolete responsive class assertion, and one Windows sandbox `EPERM` temporary-file rename. These are failing verification infrastructure/assertions, not evidence of 16 user-facing backend defects. They still prevent a clean regression result.
- Focused OpenRouter adapter and worker tests: **18/18 passed**, including typed image/audio/video request construction, worker forwarding, operation recovery and failure handling.
- The existing Talking Head browser runner stops at its first trim input because it does not open the now-collapsed Trim disclosure. It also contains older Apply-edits label assumptions. It did not complete and must not be reported as passing.
- Manual browser verification against the same real components expanded Trim and saved an opening trim of 1–4 seconds plus text, and a demo trim of 0.5–2.5 seconds plus text. The final request used the two edited output IDs, repeat demo audio, default background music, clean bottom English subtitles, and rebased demo framing. One explicit mock schedule used the final output ID; three renders and zero overlaps were recorded. Changing a saved clip's text invalidated the final preview and disabled composition until the edit was saved.
- Signed-in production checks verified the workflow route, Seedance model selector, video/audio-reference controls, generation access, saved-video lookup and preview, composition controls, connected-account lookup, and the requirement to finish before scheduling. Live paid generation, subtitle transcription, final export and social publication were not performed.

Local evidence: [test log](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/talking-head-audit/explore-tests.log), [provider tests](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/talking-head-audit/provider-tests.log), [captured mock requests](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/talking-head-audit/manual-browser-requests.json), [production generation screenshot](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/talking-head-audit/production-generation.jpg), and [production finishing screenshot](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/talking-head-audit/production-finishing.jpg).

**Expected user journey and follow-up work**

The user chooses Seedance, attaches guidance in Create and writes the intended words/actions; generates and chooses an output, or selects an existing opening; adds optional demo footage/audio; saves any individual clip edits; prepares the final composition with music/subtitles; reviews the actual exported video; selects connected accounts, caption and time; and explicitly confirms scheduling. The deployed interface currently provides composition rather than the new separate clip editors.

Priority follow-up is to reconcile and release the intended Talking Head interface with its worker contracts, repair stale verification fixtures, and then run a controlled production generation using acceptable image/video/audio references followed by finishing and schedule review. Real-person moderation failures need a clear user-facing explanation and a compatible model/product policy; the code correctly does not automatically spend again on a fallback model. Populate the inspiration Library or remove its invitation until content is available. Preserve the distinction between reference guidance and appended demo/audio throughout that work.
