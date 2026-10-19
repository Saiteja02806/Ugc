# Hook and Wall of Text source editing and sound

New requests distinguish two operations. Attaching a source video selects an
edit: the video controls scene, framing, lighting, performance and timing;
portrait images guide the replacement facial appearance. Without a video,
images and the prompt guide a new video. User instructions remain intact.

Sound defaults off. ReAPI receives its audio-disable parameter; all providers'
silent deliverables also pass through a stream-copy audio removal step. The
saved operation/sound contract prevents catalogue music being reattached when
the result is reopened or exported. Turning sound on enables generated sound
and the existing selected-reference music behavior. Toggling off retains audio
selections locally without sending or counting them as active references.

Compatibility is checked before app credit reservation and again by the worker
and provider adapter. Omni edits accept sources up to ten seconds. Seedance
edits accept four to thirty seconds and send edit mode, automatic source
duration and adaptive framing. WAN remains available for new clips; its current
adapter cannot edit an attached source. No source is padded or shortened to
satisfy a model. Source edits use the measured positive duration rounded up for
app credit estimates, independently of the provider's automatic-duration value.

Existing queued requests keep their original fingerprints and sound behavior.
The generated-media trigger copies the new settings only from an owner-matched
job; existing media and schedules are not rewritten. Completed ReAPI tasks also
accept the exact verified `reapiflexible.b-cdn.net` output host. Host spoofing,
redirects and credentials on output URLs remain rejected.

Initial validation uses isolated provider/storage fixtures and local FFmpeg.
Coverage includes both workflows, source edits,
image-only generation, sound off/on, incompatible-model credit guards, short
source timelines, owned metadata, historical recovery and exports. Silent-output
tests inspect the MP4 and compare every decoded picture with the provider
fixture. The actual picker browser fixture covers desktop/mobile selection,
pagination, warm reopening and multiple file uploads. TypeScript, scoped lint,
the worker build and a production Next.js webpack build pass. Local Turbopack
cannot follow this worktree's shared dependency junction; hosted builds use
normal dependencies.

These checks verify request routing and delivered audio, not creative fidelity.
Generative video editing cannot guarantee a pixel-identical source with only a
changed face. Additional paid visual tests require the user's approval. Live
authenticated browser acceptance must remain separate from local fixtures and
deployment identity checks.

## Approved visual acceptance result: strict preservation failed

The user's exact source and three portraits were verified against their uploads.
The test retained attachment order (bed, car, sofa) and the full user prompt.
One accepted Omni edit used release `4fb1c433`, the production-bound credential,
explicit source-video/image-reference roles and sound off. Storage and operation
bookkeeping were local test boundaries; no website credit reservation was made.
A different local credential's earlier request returned HTTP 402 without a task.

The output is 720x1280, 24 fps, 3.166667 seconds and contains no audio stream.
Its SHA-256 is `df199affff21f333be315090311a1e844956f4f35a5afcc47fdd9fcabfb8d0dd`.
Facial appearance changed and captions were removed. The room, clothing and
general action remained recognizable. Hair shape/texture changed and the
hand-to-mouth action shifted in time. Timestamp-matched comparisons therefore
fail the user's requirement to change only the face and visible text.

Do not promote this as a completed face-only recreation fix. PR #76 remains open;
website and MCP builds are ready, AI/render worker revisions have zero traffic,
and the additive metadata trigger is already applied. Main and live app/worker
traffic remain on the previous release. The render job has not been updated.
Evaluate a pipeline that preserves source frames outside tracked face and text
regions before claiming strict fidelity. No further paid test is authorized.
