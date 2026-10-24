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

Commit `a1fdfd2924bc571217cd422ae0afe999455508e8` is on production main.
Website deployment `dpl_BruB79WQ6YmWYomRuBoH5evLy5nr` and MCP deployment
`dpl_9Erqsyo4yo3P4hxzoqpkcxjDp6bU` are READY with production domain aliases.
Live reference reads confirmed the revised source hashes, captions and all-frame
review notes for Hooks 01–05, graphic-only Hook 94 and final Hook 98. Website
Remix is enabled and its provider configuration exists. Dedicated MCP remix
creation remains disabled by its existing configuration.

Public website and MCP health passed; the caption API correctly returns 401
without authentication. The automation browser still redirects to sign-in;
the user reports a separate already-authenticated browser session. The in-app
browser controller fails to initialize due to a missing kernel-assets path.
Authenticated live Recreate/Remix UI acceptance remains pending. Local fixture
checks and authenticated source reads do not establish that browser acceptance.
Full local receipt: `.tmp/hook-prompts-release/production.json`.
No paid generation, media save, scheduling or post publication is used to test
this catalog release.
