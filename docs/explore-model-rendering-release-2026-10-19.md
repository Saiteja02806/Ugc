# Explore models, library selection and rendering release

## Scope

- Offer Seedance 2.5 in Hook and Wall-of-Text model dropdowns. Talking Head's
  shared form already offers it; preserve selected/saved duration and quality.
  New Seedance requests retain the existing ReAPI `doubao-seedance-2.5-face`
  route with `content_filter: false`. Existing workflow defaults are unchanged.
- Keep Image, Video and Audio reference tiles together when all three are
  visible. Multiple images remain inside the Image tile.
- Include the pending library selection/review UI, controlled multi-selection,
  explicit confirmation of owned backgrounds and a clear Manage library entry. Keep
  existing text, slide identity, recovery and save boundaries.
- Collect completed ReAPI videos from the two verified output hosts. Preserve
  the original provider operation on retries, settle provider completion before
  collection, and distinguish collection failures in website/MCP messages.
- Serialize finite SVG glyph coordinates for Carousel edits and Explore video
  text. Advance the manual renderer version for new saves; retain all text and
  styling. Existing rendered media is not rewritten by deployment.
- Keep standalone browser fixtures compatible with Next's client environment.

## Verification and rollout

The release audit compares every intentional dirty/untracked workspace path
against main `1fa2f8bb21318bbb8f05c34bf0754a04240ae2f1`. No intentional source,
configuration, documentation, migration or test is deliberately excluded.
Private local environment/tool state, dependencies, build output and temporary
QA artifacts stay local.

302 combined regression tests, 84 worker tests, worker compilation, route type
generation, application TypeScript and scoped lint passed. Automated local
library, Trending text-editor and slideshow assembly browser fixtures passed.
These use isolated service boundaries, without paid generation or publishing.

The live UGC database migration ledger matches all 145 source migrations and
already permits ReAPI. No database migration or runtime secret change is needed.
Build and deploy immutable workers first; verify all six services and two jobs
before staging/promoting website and MCP builds from the same commit. Preserve
runtime configuration and restore the prior automatic-build settings.

Final deployment identities, health/route checks and workspace inclusion audit
are recorded separately under `.tmp/explore-release-20261019/`. Local browser
fixtures are not signed-in production acceptance; real provider generation and
customer publishing are outside deployment verification. The historical failed
WAN task requires separately controlled existing-task recovery and is not reset
by this release.
