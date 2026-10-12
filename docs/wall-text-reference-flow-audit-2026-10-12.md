# Wall of Text reference flow: production audit, 12 October 2026

## Result

Production does not consistently send the selected references to Google Omni
Flash 1.1. Wall of Text and Hook share the same video composer, generation API,
and `generate_hook_video` worker.

| Selected input | Backend receives | Video provider receives |
| --- | --- | --- |
| Optional image | `avatarImageUrl` / `referenceImageUrls` | Gemini downloads the actual image and sends its bytes with the prompt to Omni. |
| Selected gallery video | `referenceId`, `referenceType`, `referenceUrl` metadata | The gallery video is not included as a video input. Without an optional image, the request is text-only. |
| Uploaded optional video | `referenceVideoUrl`, owned asset ID, duration | Valid clips up to 3 seconds route to Runway Aleph 2, despite selecting Omni in the model picker. Longer clips are rejected. |
| Uploaded image and uploaded video | The composer retains one optional media selection | Selecting the second kind clears the first. They are not submitted together. |
| Gallery video and optional image | Gallery metadata plus image URL | Omni receives the image and prompt, without the gallery video. |

The user's prompt is submitted. Wall of Text additionally instructs the provider
to create the moving background without text, captions, subtitles, letters or
logos. Prompt instructions mentioning a gallery video cannot give the model
access to media that is absent from its input.

## Production evidence

- Inspected the authenticated workflow at
  `https://www.getugcpilot.com/explore/wall-of-text`, which redirects to
  `https://getugcpilot.com/explore/wall-of-text`.
- Current production Vercel deployment: `dpl_FDBFpvcyXYikMeMMSSrWfwKm1quy`,
  ready on 12 October at 09:30 IST. Its public composer bundle
  `/_next/static/immutable/chunks/08ichqf8w-sid.js` submits uploaded video fields
  and gallery metadata separately, without `referenceVideoMode` or
  `useGalleryVideoReference`.
- The deployment source tree reports
  `src/lib/ai-studio/video-generation-api.ts` with file checksum
  `b411db1054162d4aeeaa442229321ad046fe54eb`. This exactly matches the SHA-1 of
  the repository HEAD version with Windows CRLF line endings. It does not match
  the locally modified API. The file-content connector truncates long base64
  responses; the checksum comparison establishes the complete deployed file's
  identity without relying on that truncated response.
- The production AI worker sends 100% of traffic to
  `ugc-ai-generation-worker-00130-pqq`. Its build identity is
  `bb83ce32773011562702adb90ed6966a4279cc7e` / `worker-gcp-bb83ce3`, and its Omni
  model is `gemini-omni-1.1-flash`. Container digest:
  `sha256:e42643fbacdde6fdee5ad12917931a2b986ca391daf65f34a115547198bbfafc`.
  That worker's video-reference branch selects Runway before its Gemini branch;
  its Gemini adapter accepts images and text, without a video input.
- Completed production Hook job `40f51f54-a748-48f2-b4c2-4327f96114ab`, created
  11 October at 19:13 IST, selected `explore-hook-07` and Omni. It saved a
  gallery metadata URL and one image, but no `referenceVideoUrl` or edit mode.
  Its `primary-gemini` operation reached `output_persisted`. This is direct
  evidence for the shared pipeline, not a newly executed Wall of Text canary.

## Pending local correction

The existing local correction is documented in
`workflow-image-video-reference-fix-2026-10-11.md`. It retains the image and
video independently, resolves gallery clips as actual video inputs, and sends
video bytes, an optional appearance image, and instructions to Omni in edit
mode. Its workflow limit is 10 seconds / 32 MB.

Both the website and worker require the coordinated release described there.
An authenticated production canary remains necessary after that release to
check both the saved inputs and the resulting video.

This audit used production source identity, public deployed bundles, read-only
worker configuration, and existing job records. It did not submit a new paid
generation or change application code or deployments.
