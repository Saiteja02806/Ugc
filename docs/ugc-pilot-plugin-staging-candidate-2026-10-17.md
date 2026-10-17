# UGC Pilot OAuth staging candidate — 17 October 2026

## Purpose

This is the staging candidate for a clean Codex and Claude Code install/OAuth acceptance test. It deliberately contains the portable OAuth/CIMD plugin package changes without the unrelated application changes found in the earlier `0.2.2` worktree.

## Exact source

- Production base: `683d750c16c721be03bf7ef23844d4fb4d00aec0`
- Applied OAuth/package commits: `d3d1d51e4ec4613a0c9736bb98abbce30af332be` and `2a6c8596096b8ed3d4760d80801a330d2e83c9e5`
- Candidate branch: `codex/ugc-plugin-oauth-staging-20261017`
- OAuth/package source commit: `f4d42a879c424b769cdf9f0d21da86aa9c38f6a3` (this evidence record is an additional documentation-only commit)
- Plugin version: `0.2.2`

The only integration conflict was `package.json`: the production base added `test:explore-text-fonts`, while the OAuth candidate added `audit:mcp:oauth-public`. Both scripts are retained. The production-only `@types/opentype.js` development dependency is retained. No runtime dependency was downgraded.

## Scope guard

Compared with the production base, this candidate changes only the plugin package, local marketplace metadata, OAuth preflight/package validation scripts, and release documentation. It does not change migrations, worker code, media routes, slideshow routes, account data, storage, IAM, or feature gates.

## Validation

Completed against this exact candidate:

- deterministic package validation: passed (`0.2.2`, 41 files, 14 skills, 79 declared tools)
- package validation tests: 7/7 passed
- TypeScript no-emit check: passed
- full local MCP regression suite: passed, including transfer, Demo, finishing, drafts, exports, audio, references, groups, Library, and account settings
- public OAuth preflight: passed health, protected-resource metadata, authorization-server metadata, PKCE S256, issuer-bound redirects, CIMD, and anonymous OAuth challenge
- `git diff --check`: passed

The test suite uses fixtures and temporary loopback servers only. The public preflight is read-only and anonymous. Neither step authenticates an account, creates media, runs a migration, or deploys a service.

## Remaining acceptance gates

1. Create protected staging deployments from this exact commit.
2. Perform a clean Codex installation, complete normal OAuth, return to the IDE, and run `get_profile`, `get_entitlements`, and `get_capabilities`.
3. Repeat the same clean flow in Claude Code.
4. With explicit selected-media approval, run one bounded hook → Demo → exported/downloaded file check and verify receipt, bytes, duration, and requested edits.

Do not promote this candidate merely because source tests pass. Those host and real-media acceptance steps remain required.
