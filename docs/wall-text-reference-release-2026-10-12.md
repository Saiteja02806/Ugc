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

The website snapshot preserves all 2,998 files from current production deployment
`dpl_FykkpKgW4iGKUAjcGzh7ttU4r5pX`, including its 116 differences from the
worker baseline, before applying the scoped patch. Only local deployment JSON,
TypeScript build caches, and Supabase CLI cache metadata are excluded from upload.
Environment files and installed/build dependencies remain excluded.

The worker image build succeeded with digest
`sha256:cbe44cb4b8ebcbe6df74bc47ddbf9040043413de29550104d7b71509c656a301`.
Cloud Run revision `ugc-ai-generation-worker-00168-fop` passes its platform
startup probe with internal-only ingress and zero traffic during staging. Its
runtime and baked source identity are `7aec285e20e59c9bbce766bf0c40d8d1b1893278`.
The website staging build passes production TypeScript checks and all 153 static
pages, and the same 81 focused tests pass against the preserved source.
Promotion and an authenticated production generation remain outstanding.

Provider contract: https://ai.google.dev/gemini-api/docs/omni
