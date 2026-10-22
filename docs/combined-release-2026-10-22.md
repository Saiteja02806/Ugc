# Combined release — 22 October 2026

The user authorized deployment of all intentional worktree changes. Release
branch: `codex/starting-frame-release-20261022`, based on main `3c5b0a21`.

## Included behavior

- Hook starting-frame preparation: compact side-by-side previews, enlargement,
  face-reference strip, model selection, 1–4 variations, choices before approval
  and explicit selected-image handoff. Video controls stay in the video composer;
  new preparations start with sound off.
- Model-aware image receipt/prompt version 2, explicit scene/identity image roles,
  source integrity validation, model capacity checks and bounded output padding
  correction. Legacy accepted requests remain recoverable. These input fixes do
  not prove generated facial or scene fidelity.
- Shared image-library admission, bounded uploads, Demo recovery, visibility and
  offline-aware reads, Scheduling/Analytics/Trending loading corrections.
- Connected social-account picture refresh/proxy fixes, marketing/pricing and
  founder-guide updates, existing slideshow source links and staged additions.
- Associated tests, source-of-truth context, audit documents and Vercel source
  packaging exclusions. No intentional smaller source change is omitted.

## Validation and limits

Hook checks: 177 focused offline cases and worker TypeScript build passed.
Combined non-Hook audit: focused suites passed; the catalog test's sandbox
temporary-file failure passed all 10 cases when rerun with filesystem access.
Analytics: 89 checks; pricing: 19 checks; incremental avatar audit: 48 checks.

Fresh local browser verification at 1020×594 and 390×844 passed enlargement,
Escape/focus restoration, main-photo promotion/removal, retained picker changes,
four mocked variations, selection and composer handoff with sound off. Choices
precede approval. At the short desktop height, approval needs a small vertical
scroll and remains reachable; neither layout overflows horizontally. Mocked
portraits/outputs demonstrate controls only, not image generation quality.
Screenshots: ignored `outputs/hook-release-ui-2026-10-22/`.

An earlier complete production build and native decoder bundle gate passed.
The final repeat encountered a local Buffer allocation failure while reading
large Webpack cache files. A clean-cache repeat then failed with ENOSPC on the
local C: drive. Only generated caches were removed. Final application type checks
passed after correcting the local fixture's missing-photo error path. A hosted
Linux build with the decoder bundle gate is required before
promotion; no failed local repeat is described as a pass. Authenticated hosted acceptance and a real
30-minute memory soak remain separate from these local checks.

## Ordered deployment

1. Freeze, inventory, validate and commit all intentional source changes.
2. Build the generation worker from the exact reviewed commit; deploy its pinned
   image and verify baked/runtime identity on the active AI service.
3. Merge the reviewed release and deploy/verify website and MCP target parity.
4. Check actual production serving, relevant routes and accessible user flows.
   Record deployment IDs and remaining authenticated acceptance limits.

No production database migration, paid AI generation, billing-cap change or
public upload of the 60 staged slideshow images is authorized by this release.
The render-only worker does not admit image jobs and need not be rolled merely
because the shared image worker source changed.

## Excluded paths

Every excluded local path and its reason is recorded in the ignored local
`outputs/release-20261022-inventory.json`. Categories: credentials/environment and
tool state; dependencies/build caches; separate local worktrees/database scratch
areas; diagnostic screenshots/logs/raw account exports; prototypes and local
media. None is an intentional release source file. `.vercelignore` separately
excludes these from hosted source upload. The final dry-run manifest is 4,126
entries / 266,055,113 bytes, versus 31,353 / approximately 2.33 GB originally.
This is source-transfer reduction, not measured runtime billing savings.

The 13 new slideshow sets / 60 unpublished images remain dev-only staged JSON;
their public media transfer was previously rejected pending explicit payload and
destination approval. Existing 59 production sets remain available. The
ReelFarm comparison document remains an unpublished draft.

## Budget

See `docs/vercel-monthly-budget-2026-10-22.md`: approximately $0.23 infrastructure
usage, $19.77 credit remaining in the 21 October–21 November cycle at inspection.
Target $15 usage plus $5 headroom and measure seven restored live days. No
monthly guarantee or exhausted-credit explanation for HTTP 402 is established.
