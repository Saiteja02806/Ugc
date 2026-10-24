# Hook frame decisions — 24 October 2026

User approves the nineteen proposed replacements and explicitly permits changing Hook 18 to its displayed frame 44 (1.466667 s). This supersedes the earlier instruction to preserve the airplane-window opening in this image-based adaptation. Original source videos are not trimmed or overwritten.

## Recorded decisions

- Approved replacements: 12, 14, 18, 19, 25, 29, 34, 38, 46, 47, 50, 52, 64, 71, 85, 93, 94, 96, 101, 104 (20 total).
- Hook 27: on hold.
- Hooks 45, 63, 73 and 83: retain original opening, accepted by user despite known limitations. “Use that” for 63/73 is interpreted as accepting their existing review-section opening because no alternative was displayed.
- Hook 78: inspected all 47 decoded frames; hand stays over mouth. Keep original under user's explicit fallback instruction.
- Hook 84: inspected all 342 frames; lower face stays cropped out throughout. No better frame found. Existing opening retained provisionally pending user decision.
- Hook 88: inspected all 74 frames plus full-resolution frames 23 and 62. New candidate frame 23, 0.766667 s elapsed: mouth uncovered and more eyes below caption, but caption still overlaps brow/upper-eye area and footage remains dim/soft. This proposal is not approved by the user yet.
- Hook 89: inspected all 77 frames plus full-resolution frames 59 and 66. Later eyes become more visible but sleeve covers mouth. No clearly better overall view found; keep original provisionally pending user decision.

## Evidence and limits

All 540 decoded frames of Hooks 78/84/88/89 are shown in seven full-frame contact sheets in outputs/opening-frame-audit-2026-10-24/. Source and frame hashes verified; 251 gallery routes checked, including source video ranges. The earlier review is preserved in review-initial.json; user-decisions.json records approvals and current review.json reflects their status. approved-hook-frame-selections-2026-10-24.json records the twenty exact approved source/frame choices with hashes.

Gallery: http://127.0.0.1:8201/opening-frame-audit

These decisions update the review/preparation artifacts, not the application generation contract. Approved later frames still need versioned extraction/receipt/history support and matching motion plans before they can be used in Recreate. No paid calls, runtime change or deployment. Keep deployment paused. Browser interaction is not asserted; gallery integrity and HTTP checks are local.
