# UGC Pilot creative skills — implemented and checked

Follow-up: the private account plugin has since been updated to 0.1.2 and live read-only checks passed. See `plugin-private-release-client-readiness-2026-10-09.md` for the saved release and remaining installed-client acceptance. The statements below record the earlier local implementation checkpoint.

The local **0.1.2 candidate** contains all five creative workflows alongside the existing three connection/media skills. It is ready for signed-in client acceptance testing. It is **not yet certified for customer rollout, installed in the current clients, deployed, or submitted to a directory**.

## What changed

| Verified issue | Implementation |
| --- | --- |
| Wall-of-text source was only example transcriptions | Added `wall-text-generation` with business-context intake, format choice, original writing, claim grounding and exact-copy handoff. The original transcript document remains intact. |
| Hook Intelligence overlapped writing and directing | Its default role is now short hook words, transcription and copy review. Hook footage prompts use `emotion-hook-director`; paragraph/list copy uses the wall writer. |
| 18 declared resources were absent | Extracted the supplied embedded hook library, patterns and examples into real references. Added real schemas and curated performance/visual guides. Removed dependencies on unavailable clip logs, audit CSVs and claimed evaluations from the packaged versions. No audit or retention evidence was invented. |
| Only the original three skills were packaged | Added five discoverable entrypoints, synchronized all three manifests to 0.1.2 and replaced duplicated build lists with one explicit 31-file allowlist. |
| Handoffs needed a shared context contract | Added shared context/claim guidance and copy-to-director handoffs. Existing wall-director text-preservation rules were retained and clarified; combined drafting can run both steps in one response. |
| Activation and execution needed separate checks | Added 12 creative acceptance cases to the 10 existing cases. Draft-only requests forbid generation and mutation tools; actual-video requests use the existing generation workflow. Independently trialed ten requests offline. |

The five new skill names are `ugc-hook-intelligence`, `emotion-hook-director`, `wall-text-generation`, `wall-text-video-generation` and `ugc-native-slideshow`. Names match their folders. Automatic selection remains available through descriptions; no application keyword router was added.

The slideshow schema now rejects a missing first cover, repeated cover, blank copy, inconsistent role/mode and missing mode-specific fields. `goal_based_routine` is explicitly defined. Slideshow output is a semantic copy plan, not an application Carousel payload or rendered export.

## Safety and scope

The SHA-256 comparison passed for **20 protected files**: all supplied source documents and original slideshow resources, the existing three skill workflows and client setup, both MCP configuration files, the logo, and all existing public download files. The released 0.1.1 ZIP and public setup guide remain byte-identical.

Only eight pre-existing baseline files changed: the three plugin manifests, package README, evaluation cases, package validator/test and builder. Nineteen files were added inside the plugin; four supporting validation/build files were added under scripts. This report and the plan are documentation additions. No application API, OAuth handler, database migration, billing implementation, worker or Carousel source was edited for this task. Existing unrelated worktree changes were left alone.

The builder defaults to `.tmp/plugin-packages/`, writes a versioned setup guide, checks every ZIP entry against its source and refuses to replace any existing artifact with different bytes. Rebuilding identical inputs is deterministic. It does not publish the candidate or overwrite the public release.

## Verification results

| Check | Result and limit |
| --- | --- |
| Baseline package regression | 6/6 passed before changes |
| Official skill-creator `quick_validate.py` | 8/8 skills passed using the local Python with PyYAML and UTF-8 mode |
| Package and creative-output tests | 16/16 passed: metadata, contained references, exact Unicode/newline preservation, duration/count, contiguous timelines, overlay persistence, mode-specific slideshow requirements and negative cases |
| Real local ZIP build tests | 3/3 passed: complete inventory/source equality, deterministic rebuild, release preservation, overwrite rejection and contained output paths |
| Existing `npm run test:mcp` | Passed: 11 unit tests plus read/mutation, generation, token-error, OAuth-migration, generation-migration and storage-signing regression scripts. Integrations here use local fixtures; this is not fresh-account production acceptance. |
| Independent offline forward trial | 10 scenarios completed with no observed package/instruction failure. Four structured outputs passed their schemas and cross-field validation; selected text, counts and timings checked. Missing context elicited a focused question; actual-generation steps were described without execution. |
| Claude Code 2.1.76 | `claude plugin validate` accepted the local `.claude-plugin/plugin.json`; this verifies the manifest, not account login or automatic skill activation |
| Protected-file integrity | 20/20 unchanged |
| Candidate archive | 31 entries, eight SKILL.md entrypoints, source equality and ZIP CRC passed |

The bundled evaluation cases remain marked `manual-host-evaluation-pending`. A missing review demo recording still prevents submission-mode validation. Existing starter prompts retain their value, array type and order. The twelve-tool MCP contract is unchanged.

## Candidate artifact

Local ZIP: `.tmp/plugin-packages/ugc-pilot-0.1.2.zip` — **84,128 bytes**.

SHA-256: `9c6b67e47449dc36ced8965459dd4f8e377ce2a45f230020ba90d3b5cd9ad6e0`.

Sibling files contain the checksum and versioned standalone setup guide. The ZIP contains both compatibility manifests, both MCP connection files and every referenced creative resource.

## Reproduce the local checks

```powershell
node --test scripts/validate-ugc-pilot-plugin.test.mjs scripts/validate-ugc-creative-output.test.mjs
python scripts/test-ugc-pilot-plugin-build.py
npm run test:mcp
claude plugin validate ./plugins/ugc-pilot
python scripts/build-ugc-pilot-plugin.py
```

The builder will reject changed bytes for an existing version. Bump the candidate version in all manifests for a later release, rather than replacing a versioned artifact.

## Remaining acceptance and release work

No manual source-file repair is required. The next step needs the signed-in sessions previously deferred by the user: load/update the actual package in a supported host, confirm all eight descriptions are discoverable, run the supplied activation cases, then exercise fresh-account OAuth and a supported paid generation on the real production domain/MCP. Confirm the actual job/result and media preview, plus a retry without duplicate charging. Inspect any exact-text composition in the separate editor; MCP footage alone is not a finished overlay video.

Adding the MCP URL alone supplies tools, not these Markdown skills. ChatGPT/Claude web connectors, Claude Code local plugins and public directory listings have distinct installation/distribution paths. This candidate does not change the live download or the currently cached plugin. Upload/release and directory submission must follow authenticated host checks and the applicable platform review requirements; local validation alone does not establish eligibility or approval.

Evidence is stored in `.tmp/plugin-creative-integrity.json`, `.tmp/plugin-creative-mcp-regression.log`, `.tmp/plugin-creative-skill-validation.log`, `.tmp/ugc-creative-forward-tests/report.json` and `.tmp/ugc-creative-forward-validation.json`.
