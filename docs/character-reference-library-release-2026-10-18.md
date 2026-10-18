# Character references and editor release — 18 October 2026

The release starts from `14000f34` and includes all 37 pending paths found in
the complete workspace audit, plus this release note. The other 341 audited
paths already match production. The original working directory is retained.

## Included changes

- AI influencer uploads, repeated pastes and multiple-file selection append
  references and retain saved influencer selections, with one combined limit
  of ten. Admission validates every owned image before reserving credits.
- Submitted text wraps within the generated image's width, directly above its
  batch, with a Copy icon. There is no Prompt heading or disclosure. Full
  multiline text copies intact; denied clipboard access reports failure.
- Candidate image controls scroll behind the sticky composer. Prompts restored
  from owned jobs and History remain separate from the editable next draft.
- Image-library selection offers composed previews, clear slide scope, explicit
  Apply, collection order/repetition and failed-file-only retries. Music state
  and competing previews are handled consistently. A duplicate Hook reference
  library entry is removed from the shared reference control.
- Trending Carousel editing supports multiline text and compact appearance
  controls. Movement no longer adds implicit heading panels. Explicit alignment,
  weight, wrapping, outline, backgrounds and spacing share the worker renderer;
  saved v1 text styles retain their compatibility path.

## Validation and rollout

The exact release checkout passes 196 combined API/component/persistence tests,
30 compiled worker rendering tests, route type generation, TypeScript and scoped
ESLint. Four real-component browser suites pass: character references, media
library, Trending text editing and slideshow assembly. Fixtures spend no paid
media credits and create no customer posts. The persistence suite runs after
worker compilation because it imports that compiled parser.

No migration or runtime-secret change is required. Verify the unchanged migration
tree, hold automatic web builds, commit/push the complete snapshot, build and
verify the immutable worker image, roll out compatible workers preserving their
configuration, then stage and promote website/MCP builds from the same commit.
Restore the previous automatic-build settings and verify production domains,
commit identities, health, authentication boundaries and delivered assets.

Local tests are distinct from authenticated hosted acceptance. The earlier
library usability review and remaining follow-ups are recorded in
`library-usability-validation-2026-10-18.md`; this release does not claim a
first-time-user study or comprehensive production library acceptance.

## Exclusions

No intentional source, configuration, migration, script, test or documentation
path is excluded. Local `.env*` files (except tracked `.env.example`), `.tools/`,
`.vercel/`, `.agents/`, `.codex/`, `.tmp/`, other ignored QA/output directories,
dependencies, `.next/`, `worker/dist/`, logs, caches and private Terraform or
Supabase local state remain outside Git. These contain credentials, local tools,
temporary evidence or reproducible generated output. Only the previous release
checkout's verified `.next/` output was removed to recover disk space.

Deployment receipts and full path inventories are retained locally under
`.tmp/character-release-20261018/`.
