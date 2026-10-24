# WAN reference generation investigation — 2026-10-14

The user was correct that WAN 3.0 can accept image, video and audio references.
The application connected its WAN option only to OpenRouter's image-input route,
then treated that route limitation as a model limitation in the interface.
The error also exposed the underlying provider name to users.

## Verified contracts

- [Alibaba WAN 3.0 capabilities](https://www.alibabacloud.com/help/en/model-studio/wan3-0-video) support text, image, video and audio inputs.
- [Runway inputs](https://docs.dev.runwayml.com/assets/inputs/) support all three WAN reference types together. Combined video duration is at most 15 seconds; combined audio duration is separately at most 15 seconds. Output duration is 2–30 seconds, at 480p/720p/1080p. The installed SDK 4.20.1 exposes these typed fields on `TextToVideoCreateParams.Wan3`.
- The public [OpenRouter WAN endpoint metadata](https://openrouter.ai/api/v1/models/alibaba/wan-3.0/endpoints), checked on this date, lists `input_modalities: ["text", "image"]`. Its general [submission contract](https://openrouter.ai/docs/api/api-reference/video-generation/create-videos) warns that unsupported audio/video references can be ignored. Removing the old guard alone would risk charging for a video that ignores the user's inputs.
- The [OpenRouter model catalogue](https://openrouter.ai/api/v1/videos/models), checked on this date, still lists Seedance 2.5 durations 4–30 seconds. Both [Runway's inputs](https://docs.dev.runwayml.com/assets/inputs/) and the installed Seedance SDK contract agree. Three-second Seedance requests remain rejected; WAN supports three seconds.

## Implemented correction

New WAN requests containing an audio or video reference freeze the existing
Runway route before queuing. They use `wan3` and send `references`,
`referenceVideos`, and `referenceAudio` together in one request. This is reference
generation rather than a keyframe request or a timeline-preserving Omni edit.
The chosen output duration and resolution remain independent of the reference
video's duration. A registered Hook or Wall gallery video can also be used,
provided its actual server-read duration is at most 15 seconds.

Application limits remain six files, including at most one audio and one video.
Both timed references must be positive and at most 15 seconds each. Ready media
ownership, canonical URLs, type, size and saved duration are verified before any
application credit reservation or atomic workflow dispatch. Video references
must be at most 32 MiB and audio at most 25 MiB. Accompanying owned PNG/JPEG/WebP
images must be at most 16 MiB. The new image URL lookup is bounded and always
scoped to the authenticated owner. Audio duration metadata comes from the saved
media record, not request hints.

Image-only WAN requests and earlier OpenRouter jobs keep their existing route,
accepted IDs and recovery fingerprint. The Runway path uses the existing secret,
daily credit budget and operation recovery. SDK submission retries are disabled.
Rejected references or an exhausted budget cannot create a paid request; an
accepted task is recovered without creating another generation.

The API also rejects malformed explicit Kling/Omni duration, resolution and
ratio values instead of silently substituting five seconds, 720p or portrait.
Kling's valid 11–14 second durations are preserved. Public API configuration and
unsupported-reference errors no longer name OpenRouter or environment variables.

## Verification limits

Provider calls in the tests are mocked. Tests cover complete client-to-API and
worker-to-SDK request construction, all reference types together, settings,
ownership and size rejection before billing, budget checks, saved operation
IDs, polling failures, moderation and duplicate-submission prevention.
Worker compilation and application TypeScript checking pass.

No paid generation or deployment was performed for this fix. Live output
quality and the production account's WAN availability require a separately
authorized generation after the worker and API/frontend release are deployed.
The worker must be released before the API/frontend can enqueue Runway WAN jobs.
