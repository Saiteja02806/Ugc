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

The website snapshot initially preserved production deployment
`dpl_FykkpKgW4iGKUAjcGzh7ttU4r5pX`, including its 116 differences from the
worker baseline. A concurrent MCP Edit-draft release then promoted
`dpl_2bnCDVseTHoX3aR9e1BqioaAC1bG`. Its twelve additional source changes were
preserved before staging the combined reference release. A subsequent MCP
export release, `dpl_G198B6atCGSVU8WfjYJ8mbAecYYp`, was also preserved in
the final combined build. SHA-1 verification matches all 3,005 retained
production files and the 23 scoped patch files. Six added patch files bring
the final source snapshot to 3,011 files.
Excluded baseline paths are `tsconfig.tsbuildinfo` (TypeScript build cache)
and `supabase/.temp/cli-latest` (local CLI cache). Local deployment JSON,
environment files, installed dependencies, and build output remain excluded.

The final website deployment `dpl_CSji6apQuMfvuyHwu8P1VZt7s2Tb`
(`ugc-gh7poj4op-ugcpilot.vercel.app`) is promoted to the production domain.
The Vercel API confirms that `www.getugcpilot.com` resolves to this READY build.
Its build compiles, passes TypeScript, and renders all 153 static pages.
The 81 reference tests and sixteen preserved MCP Edit-draft/export tests pass.

The worker image build `bdf82290-e69d-4b7a-918c-7bda2635e770` succeeded with
digest `sha256:94eeaa1266b91f16611a452b947335c916087438a8bb01e62141a279e4921bc8`.
Cloud Run revision `ugc-ai-generation-worker-00170-qay` passed startup checks
at zero traffic and now receives 100% of production traffic. Internal ingress
is preserved. Runtime and baked identity are
`f8a614b8f08730ed82dfb0f6a37d16ad061347b5`.

The first production canary reached Gemini with the video and image, but Google
rejected an aspect-ratio setting for edit mode. Its 40-credit reservation was
released, with no provider operation accepted. The adapter now omits explicit
aspect-ratio and duration settings in edit mode; its tests reject either override in edit
requests. Ordinary generation still sends its selected ratio and duration.

After reconnecting the browser, the exact ten-second owned upload succeeded on
combined production deployment `dpl_4NiAfTi4YsUhC5cNppwJ2FJhp8AB`, which
contains the same reference runtime as the final build. Its image remains attached, the form and
pending result both display ten seconds, and job
`6de321e4-206f-41aa-910f-72fe8e9a4e1b` queues `google_omni`, `edit`,
ten-second source/billing metadata and one image. This job completed through
Gemini with one accepted operation, no retry, and a committed 40-credit charge.
The worker verified 10.006 seconds from the returned MP4 container before saving.
The downloaded result independently measures 10.000 seconds of video and
10.005 seconds of audio with ffprobe. The production editor displays the saved
result and both references remain attached.
After final promotion, a fresh reload on `getugcpilot.com` recovers the same
saved output and displays `Omni Flash 1.1 0:10`. The new generation form resets
its inputs on reload; this does not alter the saved job or result.

Visual fidelity remains a provider limitation: this canary retained some source
text and returned a landscape 1280-by-720 frame from a portrait source despite
the preservation prompt. The requested ratio is still stored as generation
metadata, so its 9:16 label is not proof of the output frame's actual shape.
The reference-delivery and duration checks passed; exact visual edits and framing
must be reviewed before publishing. No automatic additional paid call was made.

Provider contract: https://ai.google.dev/gemini-api/docs/omni
