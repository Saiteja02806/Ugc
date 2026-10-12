# Recover saved Edit exports from operation history — 12 October 2026

## Problem and change

An agent could discover an owned Edit render using `list_operations`, but `get_operation` did not expose its saved export request UUID. The dedicated `get_edit_export` tool required that UUID. Also, the Edit worker reports a video URL; generic output-field scanning could not recover the immutable asset created by the export receipt's completion trigger.

The candidate adds nullable `edit_export_request_id` to the existing `get_operation` output. For a `render_edit_video` operation with the `edit-export:` identity, the shared export service validates the owner-scoped receipt, its job binding, frozen render payload and render identity. It uses the existing export status/output validation to return the exact owned ready immutable asset. Raw inputs, URLs, text, storage/provider details and receipt payload remain hidden. Reads do not submit, dispatch, retry or reserve credits, and remain available with creation disabled.

Legacy website renders retain their existing generic output behavior and return no export handle. Finishing handles remain separate. A malformed export key exposes no handle/output; a missing or mismatched receipt/render, corrupt payload or storage outage returns a sanitized retryable error. Pending, failed or cancelled work keeps a verified export handle without advertising an output. A removed/foreign/misidentified output is omitted.

No migration, additional OAuth scope, worker change, registration-count change or public plugin/archive update is required. Source registration remains 33. Agents can use the updated server description: list the desired final_render operation, read it, then pass its recovered `edit_export_request_id` to `get_edit_export` and retrieve the returned output with `get_asset`.

## Verification

Sixteen targeted operation/export adapter checks pass, including five new history recovery scenarios using the actual shared service and Supabase query code against an offline HTTP database fixture. The first fixture used a nonexistent history category; it was corrected to the application's existing `final_render` filter. Every recovery database request is read-only and owner-scoped; no dispatch occurred. Existing finishing, operation controls and dedicated export checks pass.

The complete npm run test:mcp suite, TypeScript, touched-file ESLint and Next.js 16.3.8 production compile passed. The production receipt table was checked read-only: RLS enabled, service_role SELECT allowed, anon/authenticated SELECT denied. CI and release verification are recorded below as they complete. Offline fixtures do not prove customer render/download execution. No customer media operation was submitted for acceptance. Wider full application parity remains unfinished.

## Release status

Released at runtime `415405fc834577c7547583e66ebbb989f985b85b`. [Draft PR #40](https://github.com/Saiteja02806/Ugc/pull/40) is attached and stacked on `codex/mcp-private-upload`; the whole deployed MCP/Edit ancestor is retained. Exact-commit MCP CI `38243928556` and `38243974106` passed.

Website project `prj_mVOxt7AUko5egMAESaxjGyC60Kvu`: `dpl_4bszasuCMsTM3ibWiH1eFBgbUfFA`, `ugc-36fgmbqah-ugcpilot.vercel.app`. MCP project `prj_IU0eCl6JEnHt2mMaEV0g2Ej1NMYU`: `dpl_D2GUbYmA4YVWiuNDDYxgD4rsRPwc`, `ugc-8lborddgf-ugcpilot.vercel.app`. Both reached READY at the exact project/commit/production target. Managed staged reads confirmed setup 200 with version 0.1.8 links/noindex and MCP health 200 ready. Previous production aliases were checked immediately before promotion. Website promotion preceded MCP. Real `getugcpilot.com`/`www.getugcpilot.com` and `mcp.getugcpilot.com` aliases now map to those deployments.

All 24 production package/auth/isolation checks passed at `2026-10-12T11:55:03.397Z`; immutable 0.1.8 ZIP/guide and older archives are unchanged. Fresh normal managed authenticated Codex CLI discovery returned all 33 tools, OAuth, no tools error, and the new `get_operation` output field. Native read of an existing owned final_render operation succeeded with the new field null and its existing output ID. This proves served shape/backward compatibility, not a saved-export customer journey. A read-only production aggregate found zero export receipts, so no real export recovery is claimed.

Both deployment commands explicitly set `MCP_PRIVATE_UPLOADS_ENABLED=false` for build/runtime and retained the correct MCP_ONLY_DEPLOYMENT target. No environment secrets were pulled or used to infer gate values. No database migration, worker release, bucket/IAM change, upload, generation, draft edit, export, cancellation/retry, media deletion or publishing was performed. New-deployment 30-minute error/fatal grouping returned no entries for either project; the short observation window is not complete workflow acceptance.

Scope exclusions: unrelated primary-root source changes, machine configuration/credentials, `.tmp` fixtures/logs and build/cache output. All seven reviewed intentional isolated changes are committed/pushed; no intended release path was omitted. Full application parity, Claude Code authentication and real hook/demo/render/local download acceptance in both IDEs remain unfinished.
