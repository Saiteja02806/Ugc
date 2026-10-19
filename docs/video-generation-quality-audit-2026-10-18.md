# Existing video generation audit — 18 October 2026

The current Omni requests reach Google intact, but successful delivery does not establish successful face editing or silence. The latest WAN request actually completed at ReAPI and was lost at the application's output-validation stage.

## Scope and evidence

Read-only review of the connected owner's production records, production worker configuration/logs, Google retained interactions and ReAPI's existing task. No generation, retry, billing change, database update or deployment was performed. Existing media was downloaded locally for inspection.

The owner's history contains 15 Omni jobs (13 completed, 2 failed), 2 completed Kling 3.0 jobs and 3 WAN jobs (1 completed, 2 failed in the app). These counts describe application status, not quality; the latest failed WAN has a completed provider task. Other accounts were excluded.

Detailed tracing covered 17 jobs from 9–18 October, plus the two Kling jobs from 1 October. Frame/stream inspection covered five delivered generated videos, the latest undelivered WAN provider video, and two Kling videos. Compared the relevant source videos and supplied appearance images. Visual assessment uses sampled frames, not an exhaustive frame-by-frame or listening review. Exact spoken-script accuracy and lip sync were not transcribed or certified.

## Prompt and reference delivery

Google's retained records independently confirm these three recent requests:

| Job | Created, IST on 18 October | User prompt length | Retained provider input |
| --- | --- | ---: | --- |
| `d5afaff7-41d7-4d7f-932b-dde77660985c` | 18:28:21 | 5,056 | Source video, two PNGs, 5,347-character text including the entire user prompt |
| `02cf91c5-e239-441a-bd25-2098c4be4bac` | 18:25:43 | 407 | Same source video and PNGs, 698-character text including the entire user prompt |
| `a28654b3-2848-490f-bce5-b499597aa57b` | 18:20:51 | 2,147 | Three appearance images in saved order, complete 2,147-character prompt |

All three report model `gemini-omni-1.1-flash` and completed status. Both video edits retain `generation_config.video_config.task = edit`; their response format specifies 720p and deliberately omits duration/aspect ratio so the source timeline/framing is inherited. The image-only request specifies portrait and three seconds.

For both edits, local SHA-256 hashes of the source MP4 and both PNG files exactly match the provider-retained media bytes. The 291-character edit wrapper names the video and image references and asks to preserve the source except for requested changes. The complete saved user prompt follows it, unchanged. This rules out truncation, missing attachments or wrong files for these requests. It does not prove what was typed before the application saved the request.

Recomputed request fingerprints match all 17 detailed job records. Direct mode trims surrounding whitespace and does not apply the generic UGC template (`worker/src/lib/ugc-video-prompt.ts:82`). WAN's task endpoint does not echo its original request body; its exact wire prompt cannot be independently recovered the same way. Its saved 5,056-character prompt, references and fingerprint are consistent with the deployed adapter, and its existing task reports model `wan3.0-video`.

## Output quality

| Output / job | Observed result | Assessment |
| --- | --- | --- |
| Omni long prompt, `d5afaff7…` | 720×1280, 24 fps, 3.008-second container. Text removed; original room, prop and broad action preserved. Requested appearance replacement is not visibly achieved in sampled frames. | Fails the central face-change requirement. Substantial non-silent audio remains: mean −17.2 dBFS, peak −6.3 dBFS despite explicit silence instructions. |
| Omni short prompt, `02cf91c5…` | 720×1280, 24 fps, 3.008 seconds. Similar source appearance remains; text removed. Hand/prop placement differs near the end. | Also fails the central face-change requirement. Audio is much quieter (mean −47.6, peak −36.0 dBFS), but not strictly silent. The longer prompt did not solve the appearance problem and returned louder audio. |
| Omni image-only, `a28654b3…` | 720×1280, 24 fps, about three seconds. Gray room, dark top and yellow prop appear; framing moves closer and expression changes. | Broadly follows the scene direction in samples. It has no attached source video, so it cannot establish video-action replication quality. |
| Latest WAN, `56b8b792…` | Downloaded existing provider output: 720×1280, 30 fps, 3.019 seconds. Requested appearance changes are much more apparent; text is absent and the broad surprise/hand-to-mouth sequence is present. | Partial adherence. Replaces the original gray-wall background with the appearance image's furnished room and introduces sleeve/clothing changes. Fails the requirement to preserve everything except face/text. Audio is substantial: mean −16.2, peak −5.3 dBFS. App never delivered this result. |
| Earlier WAN, `d465722c…`, 14 October | 720×1280, 30 fps, 3.019-second container versus 2.234-second source. Broad scene/clothing retained and overlay removed; appearance changes visible. | Recreates rather than exactly preserves the source timing/performance. Non-silent audio: mean −21.2, peak −4.5 dBFS despite silence in prompt. |
| Kling, `9c782f48…` and `55c18e8b…`, 1 October | Both contain 15 seconds of 24 fps video; 15.042-second containers, actual dimensions 716×1284. Reference clothing/room are broadly retained with visible gestures and expressions. | Sampled appearance consistency is reasonable. Exact dialogue, natural speech and lip sync need a separate listening/transcription review. Motion samples do not certify natural walking throughout. Stored dimensions are absent, and the generic 720p label does not expose the actual encoded dimensions. |

Audio measurements use FFmpeg volumedetect. An audio stream alone is not proof of audible content; the reported finite signal levels establish that these streams are not digital silence. No claim is made about the spoken words in them.

## Confirmed information-flow defects

1. **Completed WAN output rejected and shown as failed.** Job `56b8b792-b13f-448d-9fed-8e14b4cf9c52`, created 18 October at 18:35:25 IST, has provider task `task_01a14f1e0128769d801b2ff0513c92c0`. A read-only GET returns HTTP 200, `completed`, model `wan3.0-video`, no error, output video and usage of 495 provider credits. Output host is `file.deepytb.com`. The deployed adapter accepts only `cdn.reapi.ai` (`worker/src/lib/reapi-video.ts:109,151`). It rejects the real completed output before marking provider success. Logs show polling recovery exhausting all three attempts; app status becomes failed with `provider_operation_pending` while the operation remains submitted. The existing video downloads successfully. Fix the verified output-host contract and recover this same task; a new paid generation is unnecessary.

2. **Silence is not enforced.** Both Runway WAN and ReAPI WAN explicitly send `audio: true`, even when the prompt requests silence (`worker/src/lib/runway-wan-video.ts:58`, `worker/src/lib/reapi-video.ts:68`). Omni edit supplies the source's audio with the video, and has no explicit mute stage. Silence depends on model interpretation and demonstrably fails. A structured silent-output setting with final audio removal would make this requirement enforceable.

3. **Historical selected-reference metadata did not mean video input.** Omni job `40f51f54-a748-48f2-b4c2-4327f96114ab`, 11 October, stores a gallery `referenceUrl` but `referenceVideoUrl: null`. Its prompt asks to copy a video, but only an image was attached as generation input. This historical run cannot support a claim that the provider saw that video. The recent 18 October edits do attach their video correctly.

4. **Failure messages hide useful causes.** The latest WAN's delivery rejection appears as a generic unrecoverable failure. An Omni rejection on 16 October stores Google's explicit HTTP 400 prompt-blocking message, while the customer-facing state says submission was uncertain. A 12 October Omni edit was rejected because aspect ratio was sent for an edit; later successful requests and the deployed adapter omit it. These are distinct from model adherence failures. The 17 October Runway WAN failed for insufficient provider credits; its lack of output is not a video-quality judgment.

## Priority

First repair existing-task WAN collection and its error reporting. Then enforce silent output as a structured requirement. Evaluate face-only editing separately from general reference-guided recreation: the sampled WAN result applies broader appearance/scene transfer, while the current Omni edits preserve the source too strongly to achieve the requested appearance change. Longer prompt text alone did not resolve this.

Audit checked production worker revision `ugc-ai-generation-worker-release-1fa2f8bb`, serving 100% of traffic, and its exact committed adapter source. Latest Omni runs occurred before that revision switch; Google's retained inputs establish their actual received model and payload independently of current local source.

Local supporting artifacts: `.tmp/video-quality-audit/provider-check.json`, `reapi-output-summary.json`, `media-analysis.json`, `extra-media-analysis.json`, comparison images and downloaded videos. Credentials were kept in memory; signed provider output links are omitted from this report. No product implementation was changed.
