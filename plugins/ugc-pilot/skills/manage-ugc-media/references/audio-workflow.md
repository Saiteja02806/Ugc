# Speech and private audio in UGC Pilot

Use this workflow for requested speech, saved recordings, voice preferences, local audio transfer or an audio attachment to a video. Discover the tools and call `get_audio_capabilities` first. Installing this helper does not enable generation, upload or video import. If tools are absent or a capability is false, report the available state. A browser-only Claude.ai connector cannot execute this local helper; Codex or Claude Code needs Node.js 22+ and process/file access.

## Select and generate speech

Use `list_audio_voices` for permitted IDs and availability, and `get_audio_preferences` for the website's saved selection/bookmarks. Reading voices does not verify a private voice or generate a sample. Only save a requested selection/bookmark through the corresponding tools. `set_audio_voice_selection` and `set_audio_voice_bookmark` save the preference directly. A preference does not grant access or generate speech. Sample delivery, cloning, verification and removal are not exposed here.

For requested speech, preserve the chosen script and resolve a permitted available voice. Check generation access, model/language support, speed, character limit and credit cost from capabilities. Save a fresh client request UUID and the exact `generate_audio` input before submitting: `request_id`, `script`, `voice_id`, `model_id`, `speed`, `name`. Generation needs `generation:write` and may spend credits/provider allowance. The first call returns a preview; pass `confirm_token` only after an explicit yes. Do not generate speech to prove connectivity. A free-test result remains marked `test_only` and cannot be used commercially in a video.

Recover/poll using `get_audio_generation` with the CLIENT request UUID, not the returned generation/job UUID. `list_audio_generations` can rediscover owned requests; reads need `jobs:read`. An interrupted response or `confirmed:false` does not prove no submission. Reuse identical saved inputs/UUID when submission recovery is required; changed content needs a new intentional request. Do not mint new IDs to work around a conflict or uncertain provider outcome. A queued result is not ready audio.

Browse `list_audio_assets` and read `get_audio_asset` for owned private audio. These IDs belong to the audio library and are distinct from generic visual `get_asset` IDs. A completed generation's verified output IDs can be read through `get_audio_asset`.

## Upload a local recording

Use the bundled helper `../scripts/transfer-audio.mjs` with absolute paths. It measures actual file bytes and persists a non-secret receipt before the account call. Inputs are self-contained MP3/WAV/M4A/OGG/WebM, 32 bytes–3 MiB, with the server decoding the complete stream and applying a 180-second limit. The `exact` purpose is a recording intended for use; `reference` is a voice reference and is ineligible for video import. Neither path clones a voice.

1. Run `node /absolute/path/to/transfer-audio.mjs prepare /absolute/path/to/recording.wav /absolute/path/to/audio-receipt.json exact`. It emits measured `create_audio_upload` inputs and a saved UUID. For a voice reference use `reference` explicitly.
2. Call `create_audio_upload` with those exact inputs. There is no separate audio confirm tool: this call issues the content-bound link directly and does not spend credits. It returns a short-lived content-bound POST descriptor, not a ready asset. Upload needs `assets:write` and the current account's upload capability.
3. Run `node /absolute/path/to/transfer-audio.mjs upload /absolute/path/to/audio-receipt.json`, passing the complete returned descriptor as JSON on stdin through the host process API. Do not put signed URLs in command text, shell history, durable receipts or a final response. No OAuth tokens or audio bytes belong in tool text inputs.
4. A 202 acknowledgement is accepted processing. Read `get_audio_generation` with the saved client UUID until completion and retrieve the ready recording through `get_audio_asset`.

After a lost response/crash/timeout, run `recover /absolute/path/to/audio-receipt.json` and read the same request before retrying. A local receipt exists before network transfer and is not proof that bytes were accepted. If a transfer must be repeated under the existing request, obtain a fresh descriptor using identical `create_audio_upload` inputs and reuse the same receipt/UUID; the shared server protects immutable intent and replay. Never prepare a second UUID automatically for uncertain work. If local bytes changed, first resolve the original request; changed bytes are a different intentional upload.

## Download a ready recording

Read `get_audio_asset` for a fresh `download` descriptor. Run `node /absolute/path/to/transfer-audio.mjs download /absolute/path/to/new-recording.wav` and pass the whole `{asset,download}` result on stdin. The destination directory must exist; the helper refuses to overwrite files and removes an incomplete new file on failure. It permits only the official application transfer routes, rejects redirects/expired or mismatched grants, and checks actual byte count, SHA-256 and container before reporting a saved absolute path. Download is bounded to 12 MiB. Refresh the account read if its link expires. Report `test_only` accurately.

## Attach eligible saved audio to a video

Check `video_import_available`; select the user's intended ready owned audio with `usable_for_video:true`. Voice references/free tests remain excluded. Persist a fresh import UUID and exact `{request_id,source_audio_id}` before `import_audio_for_video` (`assets:write`). The copy runs directly and does not spend generation credits. Recover with `get_audio_video_import` (`assets:read`). For a lost acknowledgement keep the same UUID; replay the identical import only when recovery is needed. A pending copy is not a ready finisher input.

Only the ready `media_asset_id` can be passed as `finish_video`'s `demoAudioAssetId` or `backgroundAssetId`. It identifies an independent editing snapshot; never pass the private `source_audio_id` directly. Import uses the current media-upload storage policy: the current default editing copy is public while the original remains private. When private creation is selected, unavailable private policy/configuration must be reported, without a public fallback. Accepted imports retain their original location across rollout changes.

`import_id` identifies the editing copy even while pending. If the user requests removing that copy, use existing `delete_asset` on the verified import ID; this does not delete the original private recording. Audio-library removal/default music are separate unavailable adapters. Continue through the video-finishing skill using the user's selected audio and its existing authorization. Importing alone does not render or generate speech.
