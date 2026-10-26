# PR71 remaining issue repairs

This follow-up fixes a stale scheduling regression fixture and stops Git builds on the unused duplicate Vercel project. It does not change application UI, scheduling runtime, production configuration, database schemas or permissions. PR71 remains a draft until hosted staging acceptance is complete.

## Changes and protection boundary

- `scripts/workflow-sections.test.mjs`: identify the controlled time field by its stable `postTime` name instead of obsolete `type=time`. Preserve all platform/caption/date/time assertions; assert one field and timezone association. Add a test for midnight/morning/evening/end-of-day/cleared values, no mutation on render, preservation of the other draft fields and controlled restoration. This does not declare the PR's older text field an accepted replacement for the separate newer interactive picker work in the primary checkout.
- This verification receipt. Existing primary-checkout `docs/ai-context/clear.md` receives append-only UGC-OPS-006 evidence; unrelated existing user work is not included in the PR.
- Vercel project `prj_sEUePx1qDIZgisRySeJTeMlMGmsI` (`trending-release-web-3f35202`) only: set Ignored Build Step to `exit 0`. This is reversible; restore its previous unset value (`null`) to allow builds again. No repository-wide `git.deploymentEnabled` setting was added, because that would affect the real projects. No deletion, credential copy, protection change, domain change or promotion occurred. Acceptance requires the next Git deployment to demonstrate the ignored-build behavior.

The previous failure reproduces on both baseline8be325d5 and catalogue repair495ca826 with identical test/component hashes. It is not introduced by the catalogue repair. Current hosted logs on dpl_Bd66NnFN6Kvjm3iHwtzL6Djf9VMP confirm Firebase auth/invalid-api-key while prerendering; source compilation and TypeScript completed first. Fresh inventory shows no READY deployment and only the generated vercel.app domain on the duplicate. Real website domains remain on `ugc`; `mcp.getugcpilot.com` remains on `ugc-mcp`. The main project timestamps were unchanged by the duplicate setting update.

Vercel documents Ignored Build Step exit0 as skip and exit1 as continue: https://vercel.com/docs/project-configuration/vercel-json#ignorecommand. This retires unnecessary duplicate builds, not a repair to its intentionally unused Firebase configuration or erasure of old failed checks.

## Supabase access diagnosis

The newly connected Supabase plugin authenticates successfully. Its project inventory includes production UGC in organization `mxorsznmwilngqwwvsyt` but does not include UGC test. An explicit migration-list request to `zmmayoyslgtvrmwiabqq` returns permission denied. This is different from the obsolete ambient CLI PAT's HTTP401: that PAT is not needed if the plugin is authorized for the correct staging account/organization.

The user subsequently supplied a staging management credential. It successfully verified UGC test as ACTIVE_HEALTHY in organization `pztieohuzapgdlgmjjyh`. It was used through hidden terminal input, held in process memory and cleared at process exit; it was not written to repository/environment files, deployment variables or command arguments. The separately connected Supabase plugin still needs correct-organization authorization for future use. Revoke the chat-exposed credential after this work; no replacement token is needed in chat.

Live inspection confirmed the historical153-version ledger and149 application tables, all with RLS. Exact counts found no profiles, jobs, media, schedules, connections or MCP tokens; existing catalogue/settings and one timezone preference were preserved. The advisor reported149 informational RLS-without-policy notices, consistent with server-only staging access, and no warning/error. This supersedes earlier inability to inspect the database.

Applied exactly the seven missing existing PR migrations in timestamp order, with each source and its canonical version/name committed atomically. They are `20261013112752_mcp_business_context`, `20261013141043_mcp_business_onboarding`, `20261013165323_mcp_business_media_uploads`, `20261022092140_slideshow_execution_plans`, `20261024061601_saved_post_captions`, `20261024170716_mcp_confirm_tokens`, and `20261025114510_automatic_hook_text_drafts`. No new migration file was authored. Two extra staging-only migrations remain intact. The final160-version history includes all158 PR migration files plus those two extras.

A transport interruption occurred after the fourth transaction. Live ledger/source-hash readback confirmed it had committed; the runner skipped it and resumed only missing versions. No mutation request was blindly retried. Final server ledger hashes for all seven match normalized reviewed source. No database reset, migration-history repair or production request was used.

Hosted postchecks PASS:155/155 tables have RLS; all inspected MCP/business RPCs remain server-only; advisor has155 informational notices and zero warnings/errors. Exact counts of all149 pre-existing tables are unchanged, and all six new tables are empty. A transaction that ended in ROLLBACK proved confirmation-token duplicate rejection, owner-scoped plan claims/replay/conflict, foreign logo-lease rejection, anonymous/authenticated denial on all six new tables and selected RPCs, and pure missing-profile/onboarding reads. No probe jobs, schedules, profiles, uploads or receipts persist. These checks prove hosted schema/permission behavior, not client OAuth or media delivery.

## Verification at preparation

- Workflow section regression suite13/13 PASS, including the previously failing test.
- Scheduling UI suite105/105 PASS.
- Catalogue/staging-isolation/plugin tests24/24 PASS.
- Final scoped ESLint and TypeScript PASS. Full `npm run test:explore` PASS1282/1282, zero skipped. The added test increases the prior1281 total by one.
- Initial sparse-checkout attempts lacked tracked infra/icons/font inputs and worker dependencies; restore/link corrections resolved those harness failures. The Windows sandbox also denied a catalogue fixture's atomic rename; the unchanged fixture passed10/10 with normal filesystem permissions. Final full suite ran with all fixtures restored and normal permissions. No product implementation or weakened assertion was used to accommodate these environment failures.
- Before edit, read actual test/component, caller/draft and scheduling contracts, prior ledger/reproduction evidence, relevant Explore/deployment sections and repository preflight. Applied context-memory, immutable-contracts, scheduling, regression-gate, Supabase and Vercel deployments skills. The change is test-only, so no before/after product screenshot claim is made.

## Hosted release checks and remaining limits

Test source commit572e351d is pushed to draft PR71. New full MCP Linux run40314773605 PASS, including catalogue/isolation guards, MCP/onboarding suites, archive tests and audits. Migration reconciliation and completed-video-delivery PASS. Main ugc preview dpl_C6rk9Vy2ViZ2EDcfggZj5u5T5Yk9 is READY on that exact commit. Duplicate deployment dpl_8tkPfMjTkwWWnGSeviRmndYXmTzw is CANCELED with the Ignored Build Step documentation link, and its GitHub status is SUCCESS: this verifies the project-specific skip setting. Old failed deployments are retained. No active website/MCP project was disabled.

Production website and MCP health both returned HTTP200 in read-only checks. Actual website/MCP domain ownership is unchanged. Both dedicated staging Vercel projects remain READY/protected on all domains, with their prior deployment IDs/timestamps unchanged. They still serve an older snapshot and are not exact-current-candidate acceptance.

The broad Linux preserved-application run40314773667 is still in its test-media provisioning step as of this verification; it is not claimed green. The complete local Explore1282/1282 run is recorded separately, not substituted for that remote run. No CI failure or provider success is concealed.

Protected status: application code/UI unchanged VERIFIED by diff; draft fields VERIFIED locally; primary unfinished work preserved VERIFIED; deployed main domains and duplicate-only change VERIFIED; hosted staging schema, RLS, RPC roles, replay/owner boundaries and row-count preservation VERIFIED. Clean Codex/Claude install/sign-in/consent/callback, protected native-client ingress, matching candidate staging build, isolated media infrastructure and final download/provider acceptance remain NOT VERIFIED. Staging schema readiness is not production release approval. No flags were enabled, no production migration/deployment/merge occurred, and no paid provisioning or publication ran.

Evidence is in ignored `.tmp/verification/`: `remaining-explore-final.log`, `remaining-scheduling.log`, `remaining-mcp-focused.log`, `remaining-typecheck.log`, `staging-before.json`, `staging-after.json`, `staging-migration-repair.json`, `staging-migration-verified.json` and rollback probe SQL. Inspection/apply scripts have no embedded credential. UGC-OPS-006 and UGC-OPS-005 updates in the primary append-only ledger distinguish each verified layer and open gate.
