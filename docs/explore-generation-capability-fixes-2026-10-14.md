# Explore generation capabilities — 14 October 2026

This review continues the Wall of Text/slideshow audit and fixes. The generation changes are local; they have not been deployed or exercised with a paid production generation.

## What caused the two reported problems

**WAN 3.0 references:** the model supports image, video and audio inputs. The existing application connection, however, advertised only text/image inputs and ignored unsupported timed references. The frontend, API and worker therefore blocked video/audio. The wording incorrectly presented that connection limit as a model limit, and included the internal routing provider in the user's instructions.

The fix adds a WAN path using the existing service account that supports all three reference types. New requests with video or audio use that path; image-only requests retain their existing path. Each queued job records its chosen provider so retries cannot change the connection. No selected reference is silently discarded or trimmed.

**Seedance 2.5, three seconds:** both the exact configured model catalog and the alternative service's official documentation currently specify whole-second output durations of **4–30**. Three seconds is not accepted on these verified connections. Enabling it in the UI would let the user spend time uploading files before a guaranteed provider rejection. The custom-duration message now names the actual supported range. WAN supports a three-second output.

## Other confirmed defects

| Defect | Correction |
|---|---|
| Kling custom durations 11–14 seconds were rejected despite provider support. | Shared Kling duration choices now include every integer from 3 through 15. |
| Invalid raw API durations could turn into five seconds before validation. | Validate the submitted duration before normalizing it or reserving credits. |
| Shared Studio model changes cleared audio/video or truncated images. | Retain the selections and explain an incompatible combination. |
| Studio's main picker offered images only even when its selected model supported timed references. | Expose the supported reference types and validate their limits. |
| A failed reference selection was visible inside the picker but did not block the parent Generate action. | Propagate the selection error to the generation gate. |
| The phone app-screen picker kept a preview URL but lost its original File. | Retain the File so the selected screenshot or recording can actually upload. |
| Audio/video picker counts and helper copy differed from the API's limits. | Apply one video, one audio and six total references; remove routing-provider names from user-facing instructions. |
| Saved audio offered 30-second recordings under WAN, and its video picker still accepted 250 MB files. | Filter and validate saved audio against the selected model's duration; reject WAN videos over 32 MB at selection time. |

## Connected limits

| Model and workflow | Output duration | Reference inputs supported by the app |
|---|---|---|
| WAN 3.0 | 2–30 whole seconds | Images plus one video and one audio; six total. Video/audio up to 15 seconds each; video 32 MB, audio 25 MB. Images accompanying timed references up to 16 MB. Image-only uploads retain the 20 MB app limit. |
| Seedance 2.5 | 4–30 whole seconds | Images plus one video and one audio; six total. Video/audio up to 30 seconds each; video 250 MB, audio 25 MB. |
| Kling 3.0 | 3–15 whole seconds | Up to two images, used as first/last frames. |
| Omni Flash 1.1 | Existing supported choices through 10 seconds | Images; actual video editing only in the Hook/Wall of Text format flow, where its source limit is 10 seconds. Audio references are unsupported. |

WAN's video and audio duration budgets are separate, rather than a combined 15 seconds across both types. The app intentionally retains its existing six-reference product limit, even where a provider supports more. Uploaded asset ownership and verified metadata remain backend requirements; browser duration hints cannot establish ownership or bypass limits.

The app's Omni connection uses native Gemini interactions. Runway's similarly named Omni endpoint has different quality limits; those restrictions must not be applied to the native connection without checking its own contract.

## Evidence

- [Alibaba WAN 3.0 model documentation](https://www.alibabacloud.com/help/en/model-studio/wan3-0-video): text, image, video and audio input support.
- [Runway official input requirements](https://docs.dev.runwayml.com/assets/inputs/): WAN multimodal references, WAN 2–30 seconds, Seedance 4–30 seconds, Kling 3–15 seconds, and URL media-size limits.
- [Configured video model catalog](https://openrouter.ai/api/v1/videos/models): exact Seedance/WAN duration and resolution lists. Read-only catalog evidence is retained in `.tmp/explore-generation-capability-audit-20261014/openrouter-model-capabilities.json`.
- Current installed SDK types were checked before writing the WAN request adapter.

## Earlier Wall of Text/slideshow work

The blank Edit sidebar now offers video upload, Creative Assets and generation actions. Slideshow image preparation runs two independent slides at a time and reports progress. Reopening uses the exact authenticated Library item ID instead of searching only the newest 60 items. Existing backend images could be healthy while that browsing-page lookup failed. Interrupted-save recovery preserves newer unsaved text, and slideshow account tiles use the Instagram carousel label. Details and controlled performance measurements are in `docs/wall-slideshow-fixes-2026-10-14.md`.

## Verification and release

**338 focused tests passed:** 282 shared frontend/API/reference/recovery checks, 39 provider/budget/routing unit checks, and 17 worker dispatch/SDK integration checks. The worker build, full application TypeScript check, scoped ESLint and Git whitespace check also passed. The integration tests use mocked service responses; they verify request contents and recovery behavior without a paid generation.

Three existing source assertions were updated to the current recovery adapter, conditional generation labels and Slideshow 4:5 default. The earlier Talking Head settings-hook assertion was updated to its current persisted-session implementation, retaining checks for settings normalization and persistence. These tests no longer require obsolete implementation shapes.

No additional AI credits have been spent. Deploy the updated worker first, then the API/frontend that can queue WAN multimodal jobs. Production acceptance must use `https://www.getugcpilot.com`, including account availability and an actual generated result. Live output quality has not been tested in this change. The current source changes do not establish that the feature is live. Existing intentional work from other chats is preserved.
