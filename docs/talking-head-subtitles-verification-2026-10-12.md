# Talking Head + Demo subtitles — production verification

The production subtitle-processing path successfully transcribed English speech, burned Clean/Bottom captions across two clips, saved a ready owned MP4, and played that file to completion. There are still concerns about processor startup latency and recognition wording. This is a successful bounded production render, not a guarantee of perfect captions for every input.

## What was checked

- Signed-in `https://getugcpilot.com/explore/create-hook`: the Auto subtitles toggle, eight styles, and Bottom/Middle/Top controls are present. Switching On → Karaoke/Middle updated the selected controls; they were restored to Off/Clean/Bottom afterward.
- Production finishing capabilities reported `available: true` and `subtitles: true`.
- Worker build passed. A fresh focused run passed **129 tests**, with zero failures or skips. These cover UI draft serialization/restoration, API ownership and rollout gates, actual FFmpeg caption pixels across opening/demo, all eight styles and three positions, sound preservation, transcript caching, failed/uncertain provider handling, and English/combined-duration validation. Offline speech-provider responses are fixtures; those checks do not establish real ASR accuracy.
- Two bounded production finishing requests used existing owned clips. No footage was generated and no social schedule or post was submitted. The positive render was submitted through the connected MCP tool, which uses the shared owned finishing service used by the website API. The exact browser Prepare final video submission with these two selected clips was not driven in this test; browser controls, request propagation tests, production processing, storage and output playback were verified separately.

## Real production render

| Item | Evidence |
| --- | --- |
| Request | `634bab88-6584-4f84-a5e3-b1ffbb149532` |
| Job | `bd2c9372-7696-4d18-b9fa-958d57083393` |
| Source | Owned English-speaking clip `2dd63909-82f3-477a-a46f-79f363517616`, about 15 seconds |
| Appended clip | Owned English-speaking clip `7150a483-591a-4a69-845b-09d5adc301c0`, about 5 seconds |
| Options | English, Clean, Bottom; no additional Demo audio or background music |
| Transcription | Actual ElevenLabs `scribe_v2`; detected `en`; 58 saved words with ordered valid millisecond intervals |
| Timeline coverage | 35 words begin before the approximately 15.042-second boundary; 23 begin afterward |
| Saved result | Ready `combined_render` asset `7ab67e8a-2fde-49cb-80a4-8a6dcd17be70` |
| Video | H.264, 716×1284; about 20.067 seconds |
| Audio | AAC, about 20.074 seconds; retained speech in both segments |
| Browser playback | MP4 reached its end at 20.074 seconds, readyState 4, with no media error |

The durable receipt and job both completed. Saved media metadata records Clean/Bottom, 58 words, `classic-v1`, the exact draft and request key, and `subtitleAudioTimeline: final-composition-v1`. The stored source hashes match the downloaded original inputs.

The downloaded file has SHA-256 `38e1da605a774241776ead55277a3d0172b2ce33a5dced839cd7e4cfee9f7ca8` and 6,327,987 bytes. Extracted frames show visible captions at 3.2 seconds in the opening, 15.4 seconds immediately after the cut, and 17.5 seconds in the appended clip. The opening caption at 3.2 seconds reads “20,000 visitors last month,”; at 15.4 seconds the new speaker has “Yesterday, I gave one AI agent,”. The captions are burned into video pixels, not merely subtitle metadata.

A local uncaptioned composition of the identical sources provided an audio baseline. Decoded mono PCM correlation was approximately 0.9997 for the opening and 0.9902 for the appended clip, with an approximately 0.31 ms alignment difference in the latter. This comparison supports preservation of the composed soundtrack; it is not an independent word-recognition score or an assertion of identical encoded AAC bytes between local and cloud encoders.

## Issues and practical limits

### Processor startup delay — confirmed

The request was saved at `2026-10-12T18:23:37.537953Z` and its output was finalized around `18:27:24.723314Z`: approximately **3 minutes 47 seconds** total. Cloud Run execution `ugc-video-render-job-zr9mm` explicitly reported “Started deployed execution in 3m1.91s.” Its container execution was created at 18:23:38.767Z and its Started condition changed at 18:26:41.515Z.

Most of the observed wait was therefore before the processor began work. This can make Prepare final video appear stalled while the job is correctly queued. The existing status distinguishes preparing the processor from transcription/rendering. This audit did not change deployment configuration or fix startup latency. Worker logs also contained PassThrough MaxListeners warnings during input processing; the job nonetheless completed. Those warnings alone do not establish a memory leak.

### Recognition wording — review still needed

The saved transcript and final frame include “and drafted personally outreach”. The source generation prompt asks for “drafted personalized outreach”. The prompt is not definitive evidence of what the generated clip actually says, so this is a **possible recognition/source-delivery mismatch**, not a proved ASR defect. Every word was not independently checked against a human transcript. Rendering and timed word placement passed; perfect recognition accuracy has not been established.

The inspected Explore subtitle UI exposes style and position, but no subtitle-transcript correction flow was found. A wording error cannot be corrected through the subtitle settings examined here. This is a product gap worth addressing if users need exact caption wording.

### Quiet input / no-speech behavior — confirmed

The first request, `d652209f-d36d-4111-9ad1-432a16a015d9`, ended with `NO_SPEECH` and no output. It used existing prepared opening/demo clips with mean audio levels of approximately −69.0 and −45.4 dB respectively. The provider submission was recorded, but no valid transcript was saved. The originals were unchanged. This failed sample did not prove a renderer defect; it demonstrated the no-speech error path on quiet inputs.

The positive clips measured approximately −24.5 and −23.3 dB and completed successfully. Levels alone do not prove speech content; real Scribe results and the output frames provide the positive evidence.

### Preview and scope behavior — expected

- Auto subtitles begin Off. A style selection alone does not render captions.
- Subtitles appear in the prepared final file. The interim browser sequence preview can remain uncaptioned and explicitly states that auto subtitles appear in the rendered file.
- The shared style example is a fixed example rendered at Bottom; it is not a preview of the user's selected words or placement.
- The supported launch scope is detected English and **60 seconds total across opening plus Demo**. Overlong inputs are rejected rather than silently shortened.
- Only Clean/Bottom received a real production canary in this audit. All styles/positions passed local rendering tests; production ASR/render tests were not repeated for every combination.
- The appended test clip was another speaking video, rather than a product screen recording. This verifies speech across the append boundary; a silent screen-recorded Demo naturally has no spoken captions unless a speech-bearing audio track is present.

## Artifacts

The ready output remains in the account as Finished Explore video. Its direct durable media URL is:

[Production subtitle test MP4](https://storage.googleapis.com/ugcsaas-media/explore/finishes/7ab67e8a-2fde-49cb-80a4-8a6dcd17be70/video.mp4)

Local evidence is under `.tmp/talking-head-subtitle-audit/`: both requests, actual transcript, production receipt and metadata, input/output probes and hashes, uncaptioned baseline, captioned MP4, frame JPEGs and audio comparison. Application code, worker code, database schema, source media and deployment settings were not changed by this verification.
