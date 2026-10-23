# Hook frame, model and scheduling corrections — local

Deployment is paused. This records code verification, not production acceptance.

The still-generation path decodes frame zero from the selected canonical Hook
video, verifies its hash and dimensions, and sends it as the first image. The
main face photo follows, then supporting photos. The worker checks the downloaded
scene bytes against that receipt before calling the image provider. The scene is
the base to edit; face photos supply identity. The earlier failed bedroom result
remains evidence that correct inputs do not guarantee a visually faithful output.
No fresh paid still or video generation was run for this revision.

The video-model lock was explicit in three places: the selector disabled every
non-Seedance option, admission required Seedance, and the worker required ReAPI.
The revision preserves the chosen supported model and freezes its provider when
admitting a new job. Omni uses Gemini's first-frame binding with image_to_video;
Seedance and WAN use ReAPI's first_frame role. All paths retain the same owned
asset/job verification, source identity, silent default and recovery identity.
Existing availability flags still apply. App durations are 4–10s for Omni and
4–15s for Seedance/WAN; quality follows each model's existing supported options.

Provider contracts checked on 22 October 2026:

- https://ai.google.dev/gemini-api/docs/omni — first-frame binding and task mode.
- https://reapi.ai/docs/wan-3-0 — frame/reference families must not be mixed.

The selected-frame container now follows the verified aspect ratio within a
200px bound. The whole image fits without square side gutters. Pending and ready
video results share larger viewport-based sizes. A container query places the
prompt next to the portrait when there is space, otherwise below it. Playback,
sound, seeking, downloads and prompt expansion retain their existing behavior.

The Schedule footer's sticky positioning caused underlying timezone/form content
to appear beneath its padded lower edge. It now stays in normal document flow.
Schedule post remains the short label after a confirmed result; explicit
completion state keeps View in Scheduling visible. Repeated scheduling still
opens a new intent without automatically posting again, and uncertain requests
still recover their exact identity.

Validation:

- 208 frontend/scheduling tests; 97 source/API/review tests; 51 video provider and
  worker tests; 12 image-contract/output tests. All 368 distinct checks pass.
- Application TypeScript, worker compilation and scoped ESLint pass.
- The deployed site was inspected read-only. It retains the earlier separate
  influencer/photo controls and restores source-video editing after closing
  Recreate. The pending local fixes have not been released.
- Fresh local browser screenshots remain blocked pending browser access. Source
  inspection and automated tests are not presented as visual acceptance.
- No paid request, scheduling mutation, database change, push or deployment.
