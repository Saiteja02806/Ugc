# UGC Pilot private plugin beta — 7 October 2026

The first private package is built and saved. The setup page is implemented and checked in an isolated preview. This is ready for installation testing; it is **not a declaration of production readiness**.

**Later integration test, 7 October:** Direct Codex OAuth, discovery, paid image generation, image-to-video generation, retrieval, playback, billing, and stable retries passed against production. Thirteen credits were used. A read-only free-credit regression was corrected locally and its tests pass. Intermittent transport failures, undeployed setup/downloads, existing Explore type errors, and installed-plugin/other-host acceptance remain open. See the [integration test report](ugc-pilot-mcp-integration-test-2026-10-07.md). The verification and preservation statements below describe the earlier package-build stage.

## What was built

- `plugins/ugc-pilot/`: a portable Agent Plugins 1.0 manifest, hosted MCP configuration, Codex and Claude compatibility manifests, existing brand icon, setup instructions, and ten manual evaluation scenarios.
- Three workflow skills: connect/check the account, create images and short videos, and manage/retrieve media. They use the existing twelve MCP tools. They cover credit estimates, existing authorization, owned references, stable request IDs, uncertain retries, partial batches, bounded polling, and returning actual finished assets.
- `public/downloads/ugc-pilot-0.1.0.zip`: a twelve-file, allowlisted bundle, with a SHA-256 checksum. The separate `ugc-pilot-setup.md` includes full client instructions and CLI commands so it can be read independently.
- `/connect-ai`: a new beta setup page with Codex, ChatGPT, Claude, and Claude Code instructions, a copyable endpoint and first prompt, CLI alternatives, downloads, and current capability limits. It is marked `noindex`. Existing navigation was not changed.
- Setup-page controls use a darker brand orange scoped to this page: text on white and white button labels have a calculated 5.18:1 contrast ratio. Global brand colors and existing pages are unchanged.
- `scripts/validate-ugc-pilot-plugin.mjs` and `scripts/build-ugc-pilot-plugin.py`: package validation and deterministic archive generation, using the existing local development dependencies and Python standard library. Published schema snapshots are kept in `scripts/mcp-plugin-schemas/`.

No new MCP server, app dependency, executable hook, credential file, or installation script is included. The package reuses `https://mcp.getugcpilot.com/mcp` and the existing per-user OAuth flow. Each person connects their own UGC Pilot account; their AI subscription does not provide UGC Pilot credits.

## Saved private plugin

[UGC Pilot](https://chatgpt.com/plugins/plugins_6ac5dfae127081919c929c4fdfe29b1c)

- Version: `0.1.0`
- Plugin ID: `plugins_6ac5dfae127081919c929c4fdfe29b1c`
- Release ID: `pluginrel_6ac5dfb0ddf88191b311a772ce57b36f`
- Stored scope: `USER`; discoverability: `PRIVATE`, verified after creation.

This is an account-scoped private plugin, not a public directory listing or an assurance that the link is installable by other accounts. Other eligible clients can use their supported direct MCP connection path. Broad plugin distribution remains a separate release step.

Archive: 37,623 bytes, twelve entries under `ugc-pilot/`.

```text
f7d363d5f297cc7a04f34bf5c0e2c8d428e3920773df0807183c6b5423df23b5
```

## Verification

| Check | Result | Limits |
| --- | --- | --- |
| Portable plugin and MCP schemas | Passed | File/schema validation, not host behavior |
| Package allowlist, references, icon, compatibility manifests, credential patterns | Passed | Credential scanning is a limited pattern check, supplemented by an explicit file allowlist and source review |
| Three Skill Creator validations | Passed | Instruction format only |
| Claude's `plugin validate` | Passed | Manifest compatibility, not an authenticated connection |
| ZIP CRC, exact entries, byte equality | Passed | Browser-downloaded ZIP also matches the source SHA-256 |
| Lint for new TSX and validator | Passed | Scoped to this change |
| Isolated setup-page TypeScript | Passed | New page and its dependencies, without the production application providers |
| Isolated Next.js rendering | HTTP 200 | Local compile/layout check, not production acceptance |
| Client chooser, keyboard selection, CLI disclosure | Passed | Tested in the in-app browser |
| Copy control | Success feedback shown | Clipboard content could not be independently verified by the browser clipboard API |
| ZIP and standalone guide downloads | Passed | Both served successfully and matched local files; guide downloaded through the browser |
| Desktop and 390-pixel mobile layout | Passed | No horizontal overflow at the tested mobile size; screenshots retained locally |
| Browser warning/error log | No entries captured | Isolated setup page only |
| Live MCP health | HTTP 200, `ready` | Does not exercise authenticated tools or workers |
| Live OAuth metadata | HTTP 200 | Advertises S256 PKCE, refresh/revoke, registration, client metadata documents, and all six scopes |
| MCP source preservation | Passed | All 33 runtime/auth files checked against before-build hashes; none changed |
| Entire website TypeScript | **Failed** | Eight errors in existing Explore files outside this addition; see below |
| Fresh-account OAuth and installed-host generation | **Pending** | Package creation does not prove these flows work |

The full Git status was compared with its before-build snapshot. Existing status entries remained; the additions were confined to this package, setup page, downloads, validation/build scripts, schema snapshots, and this report. Local evidence and the isolated preview are under `.tmp/`; they are not part of the plugin archive.

No production deployment, Git push, billing mutation, or new paid generation was performed in this build. Earlier generation audits are separate evidence and do not replace testing this newly installed plugin.

## Website deployment blocker found

The whole-repository command `node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false` reported:

- `components/explore/hook-workflow-preview.tsx:73` and `phone-workflow-preview.tsx:76`: `invalidDemoAudio` is passed to a component whose declared props do not contain it.
- `components/explore/workflow-composition-panel.tsx:12–15`: missing `worker/src/subtitles/explore-policy`, `worker/src/lib/explore-background-audio`, `components/explore/use-workflow-finishing`, and `components/explore/workflow-saved-audio-picker` imports.
- `components/explore/workflow-edit-workspace.tsx:9`: missing `lib/explore/workflow-scheduling-draft` import.
- `components/explore/workflow-edit-workspace.tsx:48`: an implicitly typed callback parameter.

These paths were not changed for the plugin build. They need reconciliation with the existing work in the shared worktree before a combined website release. The `/connect-ai` page and downloadable files are not yet live on the production website.

## Required gates before customer rollout

1. Install the private plugin in the owning account and complete sign-in in the provider's UI. Confirm actual tool discovery and the read-only first prompt: profile, entitlements, and capabilities.
2. Exercise a fresh UGC Pilot account through each supported host's OAuth flow, including insufficient scope, revoked access, and reconnection. Verify production endpoints and account isolation; do not substitute another account's tokens.
3. Run one authorized image and image-to-video workflow through the installed host. Check the displayed credit estimate, accepted jobs, completion, actual media previews/links, and billing. Evaluate stable retries, partial batches, pending-job resumption, unsupported requests, ambiguous deletion, and foreign assets using `evaluation-cases.json`.
4. Resolve the existing website type errors, validate the complete intended website release, deploy it, and check `/connect-ai` plus both downloads on the actual production domain. Local rendering is not final acceptance for hosted or authenticated flows.
5. Prepare the reviewed public plugin release and customer-facing distribution path. Do not advertise the current private, personal link as a universal installation link.

## Review and maintenance

Read `plugins/ugc-pilot/README.md` for the bundle's user instructions. To rebuild:

```sh
node scripts/validate-ugc-pilot-plugin.mjs
python scripts/build-ugc-pilot-plugin.py
claude plugin validate plugins/ugc-pilot
```

The page currently points to version `0.1.0`; update its download link with future package versions. The validator intentionally fails if the tool count changes, requiring a review of the workflow instructions. The ten evaluation scenarios are marked pending and must not be represented as passed host tests.

Private plugin creation used [Plugin Creator](C:/Users/chund/.codex/plugins/cache/openai-curated-remote/plugin-creator/0.1.22/skills/create-plugin/SKILL.md). Screenshot evidence is retained in `.tmp/mcp-plugin-build/connect-ai-desktop.jpg` and `connect-ai-mobile.jpg`; runtime preservation evidence is in `final-evidence.json` in the same directory.
