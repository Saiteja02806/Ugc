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

User action requested: reconnect Supabase with the account/organization owning UGC test (`pztieohuzapgdlgmjjyh`) or grant the connected account access. No token should be pasted into chat. No production database operation substitutes for staging access. Do not assume staging was deleted or replay migrations while the live ledger is unreadable.

## Verification at preparation

- Workflow section regression suite13/13 PASS, including the previously failing test.
- Scheduling UI suite105/105 PASS.
- Catalogue/staging-isolation/plugin tests24/24 PASS.
- Scoped ESLint PASS at the first test correction; final lint/typecheck and broad Explore rerun are in progress at preparation. Final results will be recorded separately.
- The first broad isolated run lacked infra inputs and worker/node_modules. Restored tracked infra and linked existing worker dependencies, then restarted. These are local checkout fixes, not product changes.
- Before edit, read actual test/component, caller/draft and scheduling contracts, prior ledger/reproduction evidence, relevant Explore/deployment sections and repository preflight. Applied context-memory, immutable-contracts, scheduling, regression-gate, Supabase and Vercel deployments skills. The change is test-only, so no before/after product screenshot claim is made.

Protected status: application code and UI unchanged VERIFIED by diff; draft-field behavior VERIFIED locally; primary unfinished work preserved VERIFIED by isolated checkout; deployed main domain ownership VERIFIED by Vercel; real staging schema/credentials/hosted OAuth/provider/media acceptance NOT VERIFIED pending staging access. No production release or broad all-behavior guarantee follows from these local tests.
