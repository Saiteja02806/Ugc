# Wall of Text and Hook reference input release

## Intended behavior

A selected gallery or owned uploaded video is a real source input to Google
Omni Flash 1.1. An optional image remains attached alongside it, and the full
user prompt accompanies both inputs. The source duration controls the edit:
a ten-second source produces a ten-second edit. The UI displays the source
duration instead of offering a conflicting output-duration selection.

Omni uploaded-video editing supports sources up to ten seconds. The application
also bounds source downloads to 32 MB. Longer/unreadable sources fail clearly;
they are never silently shortened or discarded, and an incompatible selected
model cannot silently replace Omni with Runway.

The worker checks the actual MP4 output duration before storing it, allowing
up to 0.25 seconds for frame/container rounding. A materially shortened,
extended, or unreadable result is recorded as a terminal provider failure,
with no automatic fresh paid generation. Verified output duration is persisted
for recovery. MP4 source duration is also checked before provider submission.

Billing continues to round source duration up to whole seconds with the existing
three-second minimum; this accounting rule does not change the output timeline.
Ten seconds costs 40 credits per output under the existing Omni rate.

## Isolation and compatibility

The candidate is on `codex/wall-text-reference-inputs`, based on the deployed
worker commit `bb83ce32773011562702adb90ed6966a4279cc7e`. It includes reference
handling, duration validation, focused tests, and documentation only. Unrelated
worktree UI, audio pairing, Carousel, character, scheduling, and MCP changes are
outside this requested release and remain in the original worktree.

Old jobs lacking `referenceVideoMode` retain their original routing and request
fingerprints. The worker can be updated before the website without changing
previous accepted operations. No schema migration or secret change is needed.

## Validation and deployment state

The isolated website production build (`next build --webpack`) compiles, passes
Next.js TypeScript validation, and prerenders all 153 static pages. Targeted lint
passes. Behavioral tests cover both reference selection orders, separate removal,
real gallery resolution, ten-second source billing, actual multimodal provider
input, unchanged legacy routing, and duration mismatch rejection.
The focused release suite passes 81 tests, and the worker regression suites
pass 308 plus 15 tests. Standalone TypeScript validation also passes.

The website deployment must preserve the current deployed source, including any
concurrent releases. The saved local Vercel CLI credentials are unauthorized and
point at a different team; the user's sign-in is pending. Production remains
unchanged until the complete release can be verified. An authenticated production
generation and inspection of the returned clip remain outstanding.

Provider contract: https://ai.google.dev/gemini-api/docs/omni
