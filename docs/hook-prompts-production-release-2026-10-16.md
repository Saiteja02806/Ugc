# Hook reference prompts and Remix text release — 16 October 2026

Scope: all 98 active Hook references. Recreate supplies the matching editable
Reference prompt; Remove prompt retains the video and omits that suggestion
from submission. The existing generation UI and API already support this.
This release completes the source-bound prompt data and reviewed Remix captions.

There are 96 ready Hook caption records and two graphic-only references with
no remixable caption copy. Hooks 01–05 have confirmed source captions, including
their brief screen-tail text where present. The selected/generated clip's
reference provenance determines its Remix source. Caption text stays separate
from footage-generation instructions; it is not automatically burned into video.

## Scope and validation

The release checkout starts at production commit
`fd06a61f5c044e07139fb554fc174b79151ac3e6`. It contains these paths only:

- `lib/explore/reference-video-prompts.ts`
- `lib/explore/reference-text-catalog.json`
- `scripts/hook-reference-prompts-release.test.mjs`
- `scripts/remix-text-catalog.test.mjs`
- `docs/hook-reference-individual-review-2026-10-15.md`
- `docs/hook-prompts-production-release-2026-10-16.md`
- The Reference performance prompts section of `EXPLORE_CONTEXT.md`.

Other pending workspace changes are outside this Hook-specific release.
Database migrations and worker services require no change for this catalog
update. Website and shared MCP catalog consumers use the same release source.

- Isolated production build passed: compile, TypeScript and all 163 pages.
- 26 prompt, catalog, Remix and reference-submission checks passed.
- 15 additional Remix API, provenance and full-caption-catalog checks passed.
- Full-caption-catalog validation now includes archived references, matching
  the existing historical-draft resolver rather than only the visible gallery.
- Real-component browser checks passed for Recreate on Hooks 01–05: matching
  reference ID, editable prompt, removal retaining video, restore and retained
  personal instructions. All five exact Remix captions loaded in Edit hook video.
- Desktop and mobile checks passed, with no page errors. Focused ESLint and
  whitespace checks passed. Local evidence: `.tmp/hook-prompts-release/`.

## Production acceptance

Deployment identity, production route checks and authenticated acceptance are
recorded in the local release receipt after rollout. The production browser
currently requires sign-in; authenticated live Recreate/Remix acceptance is
pending that session. Local fixture checks do not establish production acceptance.
No paid generation, media save, scheduling or post publication is used to test
this catalog release.
