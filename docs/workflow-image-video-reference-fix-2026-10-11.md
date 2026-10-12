# Image and video references in Explore workflows

The production job `40f51f54-a748-48f2-b4c2-4327f96114ab` selected `explore-hook-07`, but saved the clip URL only as `referenceUrl` metadata. The actual `referenceVideoUrl` was null. Gemini received one image and the direct prompt, so it could not reproduce the reference actions or edit the original clip.

## Changed contract

- Hook and Wall of text keep their optional image and video selections independently. Replacing or removing one does not remove the other. Uploading a new source video clears the previous gallery selection and its soundtrack provenance.
- A selected gallery video is an actual source input. The client requests its registered ID, and the server resolves its URL from the published catalog; the client cannot supply an arbitrary gallery URL. Its MP4 movie header is read before billing to verify the duration. Unavailable or overlong gallery clips are rejected with a clear message.
- New workflow video submissions carry `referenceVideoMode: "edit"`. Google Omni receives the actual video bytes, optional identity/appearance image and full user instructions. Source/reference tags distinguish the video to edit from the appearance image. The provider task is explicitly `edit`; input-token preflight includes both media.
- Native edits accept one optional image and a source video up to 10 seconds / 32 MB. Downloads reject redirects and bound streamed bodies. Clips are not automatically truncated. Credits use the source duration rounded up to whole seconds, with the existing three-second minimum. Unknown gallery duration is checked before any credit reservation.
- Unsupported model selection cannot silently discard an active workflow video. A missing or unreadable source fails before paid provider submission, without an image-only fallback.
- Existing jobs without the edit-mode field preserve their provider routing, fingerprint shape, polling/resume rules and billing contract. Existing image-only, prompt-only and Seedance/WAN paths remain available. No schema change is needed.

## Verification and release

`npm run test:workflow-video-references` passes all 98 tests, including the worker build. Behavioral tests cover both selection orders, independent removal, gallery source resolution, actual video duration, batch inputs, ownership rejection, pre-billing validation, native multimodal submission, input-token counting, streaming limits and existing retry/provider fences. Website TypeScript (`npx tsc --noEmit`), targeted lint and diff whitespace checks pass.

The full website production build passes with `npm run build -- --webpack`, including Next.js TypeScript validation and all 154 static pages. It required running outside the sandbox after an `EPERM` writing generated `.next` files. The default Turbopack attempt was stopped after remaining in compilation for over eight minutes; that build path is not confirmed by this check. No build configuration was changed.

Local browser checks cover Hook and Wall of text at 1366 × 768 and 390 × 844: both media remain selected, removing the image preserves the video, there is no horizontal overflow, and preview generation remains disabled. These checks submit no paid provider requests.

The broader `npm run test:explore` run passes 699 of 715 tests. Sixteen failures remain in catalog-staging expectations, missing mocks for source/audio/media/job imports, older route-visibility assertions, shared Generate-button fixtures and an older responsive-settings assertion. The worktree contains other feature changes; these failures are outside the focused reference contract and prevent claiming a clean overall Explore release. Logs are under `.tmp/explore-video-reference-regression.log`.

The website and worker need a coordinated release, with the worker updated first: an older worker would route a new edit request to the legacy video-only path. Local fixtures and mocked provider calls verify the wiring without spending generation credits. After deployment, an authenticated production canary must verify that the saved job contains both references, the operation uses Gemini, and the result preserves the source actions with the requested identity and text changes.

Provider completion is not semantic acceptance. The UI says generated edits need review; precise likeness, motion and text removal still require checking the real result. This patch does not claim that an MP4 container check validates those qualities.

Provider contract: [Google Omni video generation and editing](https://ai.google.dev/gemini-api/docs/omni). Read-only verification of the original hosted `explore-hook-07` source found a 3.4-second, 1,373,019-byte MP4.
