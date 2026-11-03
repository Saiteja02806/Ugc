# Temporary dependency cleanup completed — 3 November 2026

Removed **21 approved directories**, comprising **12.365 GiB** and 568,940 files in the pre-deletion inventory. Remaining targets: **0**. Deletion errors: **0**.

## Scope

Only `node_modules` and `.next` directories inside the audited `.tmp` folders were deleted. The main project dependencies, source checkouts, `.vercel` configuration, application assets, reference media, subtitle environment and subtitle models were outside all deletion targets. No application code/configuration or production data was edited.

## Verification

- Checksums compared for **736** uncommitted files across **42** repositories.
- Missing protected files: **0**.
- Content differences during cleanup: **5**. All are outside deletion targets. Cleanup did not write these files, and their current contents were retained; they cannot be described as byte-for-byte unchanged.
- All 42 repository status checks succeeded. No pre-existing status entries disappeared; the only added status entry was this cleanup JSON receipt at verification time.
- Free disk space after verification: **38.84 GiB**.
- Measured free-space increase during execution: **12.84 GiB**. This live value can include other processes and filesystem allocation effects.
- No runtime tests were run: application code and configuration were not changed. Removed temporary checkout dependencies/builds require reinstall/rebuild before reuse.

## Preserved reference and subtitle folders

File counts and logical byte totals match the preceding audit for every folder below. These are inventory checks, not full content-hash checks.

| Folder | Files | GiB | Matches audit |
| --- | ---: | ---: | --- |
| `.tmp/subtitle-alignment-venv` | 32,235 | 3.355 | True |
| `.tmp/subtitle-alignment-models` | 79 | 0.366 | True |
| `.tmp/explore-reference-text-local` | 12,632 | 4.873 | True |
| `.tmp/explore-catalog` | 532 | 0.191 | True |
| `.tmp/explore-upload-batch-20261023` | 21 | 0.011 | True |
| `.tmp/explore-paired-references` | 435 | 0.196 | True |
| `.tmp/carousel-role-library` | 15,134 | 2.306 | True |

## Deleted directories

- `.tmp\carousel-main-release\node_modules`
- `.tmp\character-release-20261003\node_modules`
- `.tmp\explore-release-20261015\source-final\.next`
- `.tmp\explore-release-20261015\source\.next`
- `.tmp\hook-emoji-audit-20261021\comparison-NbCbMU\node_modules`
- `.tmp\kling-3-release-20261001\node_modules`
- `.tmp\kling-3-release-20261001\worker\node_modules`
- `.tmp\mcp-explore-drafts-20261014\worker\node_modules`
- `.tmp\mcp-production-audit\node_modules`
- `.tmp\mcp-production-audit\worker\node_modules`
- `.tmp\mcp-readiness-candidate-20261007\node_modules`
- `.tmp\merge-scheduling-main-20260809\node_modules`
- `.tmp\release-2026-10-12\checkout\.next`
- `.tmp\release-20261001\node_modules`
- `.tmp\release-20261001\worker\node_modules`
- `.tmp\release-checkpoint-5c214213-20261004\source\.next`
- `.tmp\trending-layout-release-20261008\node_modules`
- `.tmp\vercel-cli-cache\_npx\69f9afb961c37556\node_modules`
- `.tmp\wall-early-release\node_modules`
- `.tmp\wall-early-release\.tmp\sim-ts-build\.next`
- `.tmp\wall-text-cli-cache\_npx\5472f65ac9020734\node_modules`

## Protected files with concurrent content differences

- `docs\ai-context\clear.md`
- `public\explore\covers\ai-character-promo-contact-sheet.png`
- `remotion\AICharacterPromo.tsx`
- `scripts\render-ai-character-promo.mjs`
- `scripts\verify-ai-character-promo.test.mjs`

The adjacent JSON receipt records authorization, exact targets, before checksums, per-repository status snapshots, deletion outcomes, and final verification. The earlier storage audit remains a historical pre-cleanup inventory.
