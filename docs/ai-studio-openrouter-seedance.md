# Seedance 2.5 through OpenRouter

Implemented on 2026-10-03 after checking the live OpenRouter video catalog. AI Studio and Explore share the Seedance option and existing generation workflow. Code, mock tests, and production build checks pass. The user explicitly declined paid generation tests; live output and moderation behavior are unverified. The availability flag defaults to false until worker configuration and deployment are complete.

## Verified availability

OpenRouter lists `bytedance/seedance-2.5` in its live video models API. The canonical version is `bytedance/seedance-2.5-20260807`. OpenRouter is the API gateway; Seedance 2.5 is the model users would select in Videos.

| Setting | Verified support |
| --- | --- |
| Output duration | Every integer from 4 through 30 seconds |
| Resolution | 480p, 720p |
| Aspect ratios | 16:9, 4:3, 1:1, 3:4, 9:16, 21:9 |
| Frame guidance | First frame and last frame |
| References | Images, video, audio, as documented on the model page |
| Audio generation | Supported |
| Pricing | $0.0000107 per output video token; $0.0000064 with video input |

For our existing 9:16 and 16:9 output options, a 10-second 720p generation is approximately $2.3112 at the listed base rate. This estimate uses 720 × 1280 pixels × 24 fps × 10 seconds / 1024 × $0.0000107; actual provider usage must be recorded from the completed job. Our application credits are a separate balance.

Sources: [live video catalog](https://openrouter.ai/api/v1/videos/models), [Seedance 2.5 model page](https://openrouter.ai/bytedance/seedance-2.5), [pricing explanation](https://openrouter.ai/blog/insights/seedance-2-5-review/).

## Implemented application flow

1. AI Studio exposes Seedance with 4–30 second durations, 480p/720p quality, the existing 9:16/16:9 ratios, and up to six uploaded image references. Text-only generation is supported. Audio output is enabled; audio/video reference uploads are outside this integration. Existing session canvas, History, prompt display, and copy actions are retained.
2. Explore's Pro Recreate selector uses the same model definitions. `lib/explore/video-generation-link.ts` transfers the model, reference ID, format, and source URL into AI Studio. Hook and Wall of Text recreations still require an uploaded image.
3. `lib/ai-studio/video-generation-api.ts` rejects unavailable models and invalid Seedance settings before reserving application credits. Each new Seedance job includes `provider: "openrouter"`. Existing app credits and reservation policy are retained.
4. `worker/src/lib/openrouter-seedance-video.ts` submits once to `POST /api/v1/videos`, saves the accepted job ID before polling, and retrieves the authenticated content endpoint. The existing worker verifies the media, uploads it to GCP storage, and persists the output. OpenRouter content URLs are never exposed as playable browser URLs, and provider redirects never receive the API key.
5. Provider types and the migration `20261003051936_allow_openrouter_generation_provider.sql` add `openrouter` to the durable operation store. Completed usage cost and generation ID are retained when supplied by OpenRouter.
6. Previously accepted Runway/Higgsfield Seedance jobs resume through their saved provider. New OpenRouter operations have distinct operation keys. Polling and download recovery reuse the saved job ID; uncertain submissions never trigger another paid POST. Terminal moderation failures retain existing failure and credit-release handling.

The OpenRouter branch runs before legacy reference-video routing. Image uploads use `input_references` for identity, style, or content guidance; they are not sent as first/last-frame constraints.

Sources: [video workflow and request format](https://openrouter.ai/docs/guides/overview/multimodal/video-generation).

## Credentials and account requirements

- A funded regular OpenRouter inference API key, configured as `OPENROUTER_API_KEY` on the AI generation worker. Keep the value out of frontend bundles and Git. Production should use a Secret Manager reference.
- Configure an appropriate spending limit on that key. Verify key validity and limits with `GET /api/v1/key`; no management API key is required for ordinary inference or this check.
- Check account and request routing settings: video generation is incompatible with enforced Zero Data Retention because asynchronous outputs must be temporarily retained.

The user added `OPENROUTER_API_KEY` to Vercel Production as a sensitive variable and subsequently to the ignored root `.env.local` file. Vercel does not export the sensitive value, and the video worker runs on GCP, so production requires a separate Secret Manager reference for that worker. Key values must not be printed. Terraform supports an optional `openrouter_api_key_secret_id`; it does not create or populate that secret.

Sources: [current key information](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key), [video account restrictions](https://openrouter.ai/docs/guides/overview/multimodal/video-generation).

## Verification and release order

`npm run test:openrouter-video` passed 47 API, Explore-link, adapter, worker, recovery, and provider regression tests. `npm run test:viral` passed 52 Explore/catalog contracts; `npm run test:ai-edit` passed 100 checks. Worker compilation, production build with the Seedance flag enabled and test authentication disabled, and lint checks passed (two existing image-element lint warnings). Local fixture checks confirm model transfer, reference-image validation, supported settings, consecutive session results, and prompt/result layout at 1366 × 768 and 1536 × 864. These mocks establish UI behavior, not paid provider availability.

The release checkout includes the newer character-builder commit from `main` so it does not revert that deployment. Its production navigation decision is retained: `/viral` has the new model selector, while the separate private `/explore` character preview remains blocked and the production sidebar omits Explore.

1. Inspect the supplied key configuration without submitting a paid request. The user's no-paid-test instruction supersedes the earlier proposed live-generation check. The worker validates the regular key and remaining allowance before a user's actual generation.
2. Configure the key as a worker-only Secret Manager reference and apply the provider constraint migration. Preserve every existing provider secret and runtime setting.
3. Build and deploy the worker from a verified commit and immutable image digest. Confirm its ready revision and source identity before promoting traffic.
4. Set Vercel Production `NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE=true` and deploy the web release. This variable is compiled into the browser; changing it requires a new deployment. Never use a public variable for the API key.
5. Verify the production AI Studio and Explore flows, generated playback, application credit accounting, session canvas, and History. If provider validation fails, keep the flag false.

Changing gateways does not establish that reference-image moderation is fixed. OpenRouter still reports upstream content-policy failures. Retain clear failure messages and the existing credit-release behavior; paid generation tests were not performed for this release.
