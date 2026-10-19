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

Validation uses isolated provider/storage fixtures and local FFmpeg; no paid
generation was submitted. Coverage includes both workflows, source edits,
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
changed face. A paid visual acceptance test requires the user's approval. Live
authenticated browser acceptance must remain separate from local fixtures and
deployment identity checks.
