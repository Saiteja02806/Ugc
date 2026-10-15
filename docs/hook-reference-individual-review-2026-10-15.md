# Individual Hook reference prompt review

Scope: only active references in the Hook video workflow, in gallery order.
The first nine source files were decoded completely and hash verified. Every
decoded frame was visually inspected in ordered contact sheets, including the
last frame. This does not claim real-time playback or audio evaluation. The
first nine local prompt entries are now version 2 with frame-review provenance.

| Gallery item | Frames inspected | Actual performance | Ending |
| --- | ---: | --- | --- |
| Hook 01 | 92 | Looks screen-right at desk; turns gaze to camera; covers mouth with screen-right hand; reaches toward camera with other hand; camera moves closer | Last frame is a monitor shot |
| Hook 02 | 92 | Opens silver laptop lid; reacts with raised brows/open mouth; grasps eyeglass temples with both hands; pulls glasses forward and lowers them, continuing to stare toward laptop | Last frame is a laptop shot |
| Hook 03 | 110 | Reclines on pillow; looks upward, blinks, widens eyes toward lens; glances screen-right then screen-left, returns toward camera, holds disbelief and glances sideways | Last frame is a stylus/screen shot |
| Hook 04 | 94 | Reacts at laptop, covers mouth, reaches other hand toward camera; camera lifts; glasses remain on | Final instruction caption then browser view |
| Hook 05 | 96 | Holds can near mouth without sipping; side glance; raises index finger beside lips; squints and lowers finger/can | Remains in cafe |
| Hook 06 | 112 | Wide-eyed reaction; raises and tilts can for sustained sip; lowers it, glances down, briefly closes eyes, resumes open-mouth reaction | Last frame is a desktop shot |
| Hook 07 | 78 | Holds eyeglass corner; lifts glasses onto head; releases frame and covers mouth with same hand, looking toward lens | Last frame is laptop/blue pen; both creator captions visible |
| Hook 08 | 79 | Interlaces fingers and extends arms; stretches neck to each side with alternating hands; lowers hands to laptop keyboard | Same seated shot; no screen cut |
| Hook 09 | 85 | Close-up with mouth open; raises glasses onto head, blinks; lowers same hand with fingertips across lips | Same face close-up; no screen cut |

The performance paragraph follows each exact source, rather than inventing a
generic surprise or hand gesture. The last-frame cuts are preserved at their
brief source timing without elongation. The original footage is not trimmed.
Creator-added overlay words and associated emoji are requested to be removed;
physical object text remains. No influencer-specific green shirt or hairstyle is
embedded. Replacement is conditional on an attached influencer image.

Evidence is under `.tmp/hook-reference-prompt-review/<permanent-reference-id>/`.
`scripts/inspect-hook-reference-frames.mjs <ordinal>` prepares the next clip's
full frame sequence, validates its exact source hash and count, and leaves review
status pending. Only after inspecting every sheet should the agent add/update
that clip's prompt entry and review notes. No script automatically marks unseen
frames as reviewed. `scripts/export-hook-reference-prompt-review.mjs` exports
only entries whose inspected frame counts and hashes match the recorded review.

Nine of 98 Hook references have this frame review; 89 remain. Hook 10 is next.
At the user's request, captions are now checked during the same inspection as
performance prompts. Hooks 04–09 already had saved Remix source text, which was
rechecked rather than duplicated or rewritten. Hook 04's “Go to Pinterest” starts
at frame 91 (3033 ms), before the browser cut; its former 3200 ms boundary was
corrected using actual frame presentation timestamps. Hooks 05–06 retain their
existing wording and timing. Creator captions and associated emoji are retained
for Remix; application UI and physical labels are excluded. The review page
exports both prompt.txt and source-bound remix-text.json for each reviewed Hook.
Hooks 01–03 caption records retain their earlier sampled-review provenance.
No new video generation, paid analysis, production write or deployment occurred.
Prompt controls' browser/production acceptance remains separate from this
content-review pass. This pass does not resolve the previous preview startup issue.
