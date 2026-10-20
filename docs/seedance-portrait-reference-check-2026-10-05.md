# Seedance portrait references and safe public errors

## Provider check (2026-10-05)

- OpenRouter supports Seedance 2.5 text generation and image, audio, and video references. Reference support does not override the upstream provider's input restrictions.
- BytePlus documents approved portrait solutions on its own ModelArk platform: trusted outputs, preset digital characters, and authorized real-person assets. Its private real-human asset library is documented for invited users and includes verification, asset enrollment, and active asset IDs.
- No documented OpenRouter portrait-authorization/enrollment API or approved portrait-asset integration was found. This is **not** proof that OpenRouter cannot offer it; confirmation from OpenRouter is still required before promising creator-portrait generation.
- The public, unauthenticated `GET https://openrouter.ai/api/v1/videos/models` returned `bytedance/seedance-2.5` with 4–30-second durations, 480p/720p resolutions, and only `watermark`, `req_key`, and `output_format` as allowed provider passthrough parameters. No portrait-approval control is listed there. Do not invent a bypass flag or substitute another provider silently.

Sources:

- [OpenRouter Seedance 2.5](https://openrouter.ai/bytedance/seedance-2.5)
- [OpenRouter video generation](https://openrouter.ai/docs/guides/overview/multimodal/video-generation)
- [OpenRouter Seedance 2.5 controls](https://openrouter.ai/blog/insights/seedance-2-5-review/)
- [BytePlus portrait solutions](https://docs.byteplus.com/en/docs/modelark/seedance-portrait-asset-guide)
- [BytePlus private real-human asset library](https://docs.byteplus.com/en/docs/modelark/guide-preview?redirect=1)

## Targeted application fix

Historical video jobs saved as `JOB_FAILED` can contain a structured upstream HTTP 400 error with the exact code `InputImageSensitiveContentDetected.PrivacyInformation`. The public job contract now recognizes this known signature and returns `PROVIDER_REFERENCE_IMAGE_REJECTED` with a safe explanation that the image **may** contain a real person's face. It does not claim the portrait is definitely real, or that audio references are unsupported.

The status API and both Explore preview canvases already display the public job message. Recognized privacy rejections cannot be replayed through the retry endpoint. Existing job rows do not need modification, and normal upload recovery, unrelated failures, and private Wall of Text diagnostics retain their previous behavior.

Raw provider messages, request IDs, private URLs, and tokens are not sent to the frontend. Unknown signatures retain the safe generic fallback instead of guessing a cause.

Verification uses synthetic job fixtures, mocked API dependencies, and rendering the actual Explore preview component. No paid generation request, production database write, provider change, or deployment is part of this fix. Production acceptance remains pending deployment and authenticated verification.
