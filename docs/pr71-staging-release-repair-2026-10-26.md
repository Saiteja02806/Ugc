# PR71 catalogue repair and staging reconciliation

The catalogue defect is locally verified fixed against PR head `8be325d54f827188be054b33652cbd7537f42caa`. Hosted staging acceptance remains open. No production deployment, migration, environment edit, paid provisioning, media generation or publication occurred.

## Implemented scope

- `scripts/mcp-tool-catalog.mjs`: catalogue groups follow the source registry; five missing metadata groups are included; the fixed 79-tool assertion is removed. Cyclic registry re-exports fail clearly. Windows checkout line endings do not produce false drift failures.
- `scripts/mcp-tool-source.mjs`: inspect TypeScript syntax without importing implementations. Resolve static descriptions, confirmation instructions, literal scopes and loop-generated tools; reject missing/duplicate registrations, unknown expressions and registry disagreement.
- `lib/marketing/mcp-tool-catalog.json`: regenerate 106 unique tools from the actual candidate. Permissions, enabled capabilities and feature gates are not changed by catalogue generation.
- `scripts/mcp-tool-catalog.test.mjs`: verify the candidate against the independent package validator; exercise stale output, arbitrary counts, Windows line endings, missing metadata, duplicate registrations, unsupported expressions and re-export cycles. A fixture that throws on execution proves source modules are not executed.
- `scripts/check-agent-staging-isolation.mjs` and its `.test.mjs`: bring the existing unfinished checkout's offline safeguards into this candidate, adding the three business write gates, required browser credentials, project/role checks on legacy JWT credentials, credential-type checks and malformed-input handling. Existing unfinished files are preserved. This is explicit-input offline preflight, not deployment enforcement, JWT signature verification or credential authentication.
- `.github/workflows/mcp-contract-tests.yml`: run catalogue drift and preflight regressions in CI; include their source and generated catalogue in path triggers.
- This receipt records evidence, remaining gates and the rollback boundary. UGC-OPS-005 was appended to the primary checkout's existing `docs/ai-context/clear.md`; that checkout's unrelated ledger history is not copied into the PR.

No new dependencies, application service changes, database migrations, publishing controls or OAuth behavior changes were introduced. The generated marketing reference includes the candidate's expanded tool text/count; its component layout is unchanged.

## Corrected staging evidence

The historical setup document at `.tmp/mcp-analytics-read-20261018/docs/agent-staging-setup-2026-10-23.md` and its ignored migration receipt identify existing **UGC test**, ref `zmmayoyslgtvrmwiabqq`, organization `pztieohuzapgdlgmjjyh`. They record 153 migrations, isolated test data policy, protected staging website/MCP snapshot builds and a separate Firebase project. Do not create another database or reset this one based on the later handoff's claim that no hosted migrations ran.

| Resource | Recorded staging identity | Current verification |
| --- | --- | --- |
| Database | `zmmayoyslgtvrmwiabqq` | Management PAT exists but API returns HTTP401; browser requires sign-in |
| Website | `https://ugc-agent-staging-web.vercel.app`, `prj_ZblBbIB3tOpMRKAQLUY0CbcbTSOI` | Historical protected snapshot, not current exact-commit acceptance |
| MCP | `https://ugc-agent-staging-mcp.vercel.app`, `prj_1x1ziEhzA29U5gWMISdIQRjCyHKU` | Historical health/metadata success; native-client protected ingress unresolved |
| Identity | `ugc-agent-staging-20261023` | Historical Google provider/domain setup; current authenticated flow unverified |
| Workers/storage | Planned separate resources | Historical record says unprovisioned; no paid provisioning attempted |

The staging snapshots were based on uncommitted older candidate source and had a different package/catalogue. They do not establish deployment of PR71's current 0.2.9 / 106-tool candidate. Production's connector and local URLs identify `kltxwijhluawgveykfbt`; they must not be reused as staging defaults. Browser public variables are frozen at Next build time, so verify staging inputs before building and rebuild when they change.

### Migration inventory reconciliation

This is a comparison with the retained historical receipt, **not a current database query**. The candidate has 158 canonical migration files; the historical receipt has 153 versions. Seven candidate versions are absent from that receipt:

- `20261013112752_mcp_business_context`
- `20261013141043_mcp_business_onboarding`
- `20261013165323_mcp_business_media_uploads`
- `20261022092140_slideshow_execution_plans`
- `20261024061601_saved_post_captions`
- `20261024170716_mcp_confirm_tokens`
- `20261025114510_automatic_hook_text_drafts`

The receipt also includes `20261023052240_mcp_social_connection_requests` and `20261023073218_mcp_schedule_actions`, which are outside this PR. Preserve these; do not delete their ledger entries, reset staging or mark unapplied SQL as applied to force equality. Once access works, read the live ledger, inspect relevant schema/functions/security and compare migration contents before preparing the exact forward-only plan. Older missing versions require dependency review rather than a blind linked push.

The production-designated connector independently records `mcp_confirm_tokens` and `automatic_hook_text_drafts`; the confirmation table exists. It lacks the other four PR-specific migration versions and the verified-identity migration's `email_verified` columns. None of these observations authorizes production changes.

## Validation performed

All commands ran in isolated `.tmp/pr71-release-repair-20261026`, without loading production environment files:

- Repository `tools/preflight.py --repo . --task ...`: PASS in the primary checkout; prerequisite files discoverable. Sources inspected: root AGENTS, nonnegotiables, incident ledger and relevant Explore/deployment/MCP sections; context-memory, immutable-contracts and regression-gate skills; bundled Next environment-variable guide; actual registry, callers, package validator, CI and historical staging/acceptance receipts. The large Explore history was inspected by relevant sections; this is not a claim of a complete reread of every historical section.
- `node --test scripts/mcp-tool-catalog.test.mjs scripts/check-agent-staging-isolation.test.mjs scripts/validate-ugc-pilot-plugin.test.mjs`: PASS 24/24.
- `node scripts/mcp-tool-catalog.mjs --check`: PASS, 106 tools.
- The same builder against the primary checkout: PASS, 79 tools / 15 groups. The candidate does not rewrite that checkout's catalogue or plugin.
- `NODE_OPTIONS=--max-old-space-size=8192 npm run test:mcp`: PASS, 409 tests across 30 runners, zero skipped; additional standalone contract runners also completed. Local fixture/PGlite/provider-mock evidence only.
- Scoped ESLint across all five changed/new script files: PASS.
- `next typegen`, followed by `tsc --noEmit --incremental false`: PASS.
- Workflow YAML parse and presence of the new check step: PASS.
- `git diff --check`: PASS before commit.

An initial sparse-checkout run failed because the test loader required the checkout's own `node_modules/next/...` path. Linking existing dependencies fixed the harness; no application code was changed for it. Marketplace metadata, auth context and brand/type-generation inputs omitted by sparse checkout were restored before the final passing checks. A full frontend build and browser visual acceptance were not run for this tooling change.

## Protected behavior and remaining acceptance

| Boundary | Status and evidence |
| --- | --- |
| Existing user changes | VERIFIED: separate checkout; no reset, stash, merge or overwrite of either unfinished checkout |
| Existing MCP permission/gate behavior | VERIFIED locally by full MCP suite; runtime tool implementations unchanged |
| Production schema/configuration and publishing | VERIFIED no mutation performed; no production release claimed |
| UI geometry, selected-video/timestamp fidelity, scheduling wall-clock/provider behavior | NOT TESTED in a real hosted flow; no runtime implementation changes in this repair |
| Actual staging environment exports, IAM and schema | NOT VERIFIED: invalid management access; no replacement configuration invented |
| Clean Codex/Claude install, consent, callback and safe read against this exact candidate | NOT VERIFIED: user sign-in and supported protected native ingress remain pending |
| Candidate Hook/Demo download | NOT VERIFIED: no staging worker/storage provisioning; older successful production runs do not certify this candidate |
| Review recording | NOT VERIFIED: package validator continues to report the recording missing |

At source `8be325d5`, main `ugc` Vercel preview passed and the separate `trending-release-web-3f35202` preview failed; `preserved-application` was still running when checked. Detailed Vercel API access returned HTTP403. The 23 October sibling audit records an accidental duplicate with no READY deployment/custom domain and an earlier Firebase invalid-key build failure; that is historical evidence, not proof of the newest failure's cause. Do not copy production Firebase keys into it or suppress its check as a substitute for inspecting its intended role and current logs.

## Next hosted steps and rollback

Restore authorized access to UGC test, read its current ledger/schema, inspect staging-only deployed environment exports and reconcile candidate/source versions. Run the offline checker on explicit private JSON exports; it never loads `.env.local`, contacts a cloud API or prints credential values. All three participating role exports and actual isolated worker targets are required for its full gate-off preflight. Missing worker resources must remain an explicit blocker for media acceptance, not be filled with production URLs.

Keep all staging write gates off for initial health/authentication checks. Use supported protected native ingress; do not disable protection or put bypass secrets into package URLs. Only enable a selected test capability after its isolated dependencies and cost scope are approved. Complete clean client acceptance and media evidence before production promotion. No production-ready claim follows from this local repair.

Rollback is reverting this repair's tooling, generated reference and CI/doc files together. No application data or environment rollback is required because none was changed. Keep PR71 a draft while hosted gates remain open.
