# Remaining .tmp storage audit — 3 November 2026

Measured **68.149 GiB** across 926,365 files and 3,638 immediate entries. Four directories under subtitle-editorial-research/python-libs returned access-denied errors; linked/junction directories were skipped. This is a logical-size audit, not a physical allocation measurement. No deletions were performed.

## Decision

Do not delete the whole folder. It includes real uncommitted source and reference/review data.

- **12.365 GiB** consists of node_modules dependencies and Next/Vercel build output. These are candidates for removal while preserving source; the affected local checkouts/tools need reinstall/rebuild before reuse.
- **3.355 GiB** is the standalone subtitle-alignment Python environment. It is used by scripts/subtitle-pilot/pipeline.mjs, not a production application import. Optional to remove if that pilot is no longer needed; recreate it before running the pilot again.
- **4.873 GiB** is reference-text analysis evidence: about 4.806 GiB images and 0.067 GiB JSON. The saved transcript file contains 7,918 references into this directory. Keep this evidence or archive it; deleting it breaks local audit/review links.
- **2.306 GiB** is the carousel role-library staging/review material. Remote completeness and a recoverable backup were not verified, so do not assume these image copies are disposable.
- Old release archives and extracted source snapshots are cleanup candidates only after proving their source and any private/recovery files are preserved elsewhere. Naming and age alone do not prove this.

## Git work that must be preserved

Checked 37 registered worktrees: 26 have clean normal Git status and 11 have uncommitted changes. Clean status excludes ignored files and does not prove a whole checkout can be discarded. Four standalone repository copies were also checked; two contain uncommitted changes. No safe.directory setting was persisted (a per-command override was used for two ownership checks).

- `.tmp\audio-bookmarks-explore-fix` — 22 modified/untracked entries.
- `.tmp\explore-cover-refresh-20261007` — 6 modified/untracked entries.
- `.tmp\hook-production-release-20260812` — 2 modified/untracked entries.
- `.tmp\mcp-analytics-read-20261018` — 66 modified/untracked entries.
- `.tmp\mcp-production-audit` — 30 modified/untracked entries.
- `.tmp\merge-scheduling-main-20260809` — 1 modified/untracked entries.
- `.tmp\release-analytics-account-consistency-20260809` — 33 modified/untracked entries.
- `.tmp\release-non-create-20260907` — 28 modified/untracked entries.
- `.tmp\release-wall-text-audio` — 44 modified/untracked entries.
- `.tmp\subtitle-position-20261007` — 63 modified/untracked entries.
- `.tmp\workflow-performance-release-20261014` — 2 modified/untracked entries.
- `.tmp\ugc-pilot-analytics-build-20261016` — 3 modified/untracked entries.
- `.tmp\ugc-pilot-public-package-release` — 21 modified/untracked entries.

## Largest entries

| Path | GiB |
| --- | ---: |
| `.tmp\explore-reference-text-local` | 4.873 |
| `.tmp\subtitle-alignment-venv` | 3.355 |
| `.tmp\explore-release-20261015` | 2.438 |
| `.tmp\release-2026-10-12` | 2.414 |
| `.tmp\carousel-role-library` | 2.306 |
| `.tmp\merge-scheduling-main-20260809` | 2.114 |
| `.tmp\release-20261001` | 2.046 |
| `.tmp\trending-layout-release-20261008` | 1.669 |
| `.tmp\mcp-production-audit` | 1.626 |
| `.tmp\kling-3-release-20261001` | 1.617 |
| `.tmp\mcp-readiness-candidate-20261007` | 1.567 |
| `.tmp\ugc-pilot-public-package-release` | 1.458 |
| `.tmp\power-carousel-image-import-upscaled` | 1.291 |
| `.tmp\mcp-explore-drafts-20261014` | 1.288 |
| `.tmp\workflow-theme-cache-20261012214652` | 1.254 |
| `.tmp\carousel-main-release` | 1.248 |
| `.tmp\character-release-20261003` | 1.215 |
| `.tmp\wall-early-release` | 1.204 |
| `.tmp\hook-reference-prompt-review` | 1.110 |
| `.tmp\local-carousel-image-import` | 0.962 |
| `.tmp\remix-text-audit` | 0.844 |
| `.tmp\ugc-combined-release-20261027` | 0.808 |
| `.tmp\talking-head-live-release-20261027` | 0.797 |
| `.tmp\marketing-release-20261024` | 0.681 |
| `.tmp\onboarding-hotfix-20261026` | 0.678 |
| `.tmp\marketing-restored-release-20261025` | 0.677 |
| `.tmp\explore-release-20261016` | 0.654 |
| `.tmp\face-engine-evaluation-20261019` | 0.624 |
| `.tmp\mcp-scheduling-parity-20261017` | 0.621 |
| `.tmp\workflow-performance-release-20261014` | 0.619 |
| `.tmp\explore-preview-release-20261016` | 0.603 |
| `.tmp\ugc-plugin-oauth-staging-20261017` | 0.591 |
| `.tmp\trending-hook-release-20261016` | 0.590 |
| `.tmp\ugc-pilot-analytics-build-20261016` | 0.590 |
| `.tmp\trending-hook-live-release-20261016` | 0.587 |
| `.tmp\ugc-plugin-oauth-acceptance-20261017` | 0.587 |
| `.tmp\mcp-business-combined-release-source-945ddf2a` | 0.583 |
| `.tmp\character-partial-generation-release` | 0.575 |
| `.tmp\multi-output-build-workspace` | 0.574 |
| `.tmp\release-create-content-render-20260907` | 0.568 |
| `.tmp\trending-release-web-3f35202.tar` | 0.547 |
| `.tmp\wall-text-reference-release` | 0.546 |
| `.tmp\release-web-bb83ce3` | 0.545 |
| `.tmp\trending-release-web-3f35202` | 0.545 |
| `.tmp\subtitle-position-20261007` | 0.528 |

## Actual application dependencies

Development-only routes read `.tmp/explore-catalog/media`, `.tmp/explore-upload-batch-20261023/media`, `.tmp/explore-paired-references/media`, and `.tmp/workflow-final-preview.mp4`; those routes reject production requests. Existing source/audit scripts also read local media, OCR frames/JSON, import manifests, release snapshots, and subtitle tools. No production API/data was modified or queried.

## Evidence and limits

The JSON inventory lists every immediate entry, recursive byte counts, dependency/build breakdowns and large files. The worktree JSON records Git status checks. No app code/configuration changed and no runtime tests were run. File-by-file non-use and remote recoverability have not been established for all remaining media, snapshots or archives.
