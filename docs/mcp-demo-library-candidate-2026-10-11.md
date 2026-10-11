# Dedicated Demo library candidate

Implementation and release on 11 October 2026 in the isolated managed checkout `C:/Users/chund/.codex/worktrees/mcp-full-app-access/UGC`, branch `codex/mcp-demo-library`, based on the reviewed MCP release branch. Deployment and discovery are verified; authenticated production workflow execution remains unproven.

## Behavior

Four tools extend the source server from fifteen to nineteen registrations:

- `register_demo`: turn a confirmed IDE video upload into a dedicated Demo record and `demo_upload` media asset atomically. The asset ID stays unchanged. The application's existing limits apply: 1–60 seconds, at most 100 MB, MP4/MOV/WebM.
- `list_demos`: bounded browsing of the connected owner's Demo records, including website demos and unfinished records, with signed cursors bound to owner and project.
- `get_demo`: retrieve a Demo summary and its matching ready source asset ID. Playable delivery remains through `get_asset`; raw keys, URLs and private draft JSON are excluded.
- `delete_demo`: hide the owned Demo and linked source asset together, with safe replay. Stored bytes remain available to existing renders; finished outputs and jobs are unchanged.

The upload journey is `create_upload` → local byte transfer → `confirm_upload` → `register_demo`. Registration takes the application's current default project `test-project-001` unless another valid project is supplied. It uses the confirmed asset ID as the durable registration identity. Repeating registration preserves subsequent website draft edits/render state; moving an existing registration to another project is rejected.

The application delete route recognizes registered IDE demos in the generic media namespace. Legacy raw-demo deletion retains its existing behavior. A database trigger propagates generic media deletion to a registered Demo within the same transaction, covering deletion based on a stale pre-registration upload snapshot. Confirmation recovery still accepts the same registered MCP upload when its saved dimensions and duration match.

## Authorization and database changes

Reads require `assets:read`; registration/deletion require `assets:write`. Identity comes from the validated OAuth Firebase principal. Caller-supplied ownership, storage keys or URLs are not accepted by the tool schemas.

Migration creation used `supabase migration new mcp_demo_library`. Supabase's authenticated migration tool then applied the reviewed SQL to production and recorded version `20261011144624`; the canonical file is aligned to that authoritative version as `20261011144624_mcp_demo_library.sql`. It adds an owner/project pagination index, two atomic RPCs and a scoped deletion trigger. All functions use invoker privileges. RPC execution is denied to PUBLIC/anon/authenticated and granted only to service_role. Existing RLS remains enabled. No new tables, public grants, billing operations or renderer changes are introduced.

Before registration can be exposed in production, apply and verify the additive migration and deploy the website compatibility route as well as the MCP server. Otherwise newly registered generic-path demos cannot be deleted from the old website route. Production registration should not be released ahead of that compatibility change.

## Verification

- Complete `npm run test:mcp` passed, including HTTP tool discovery/annotations, account ownership, upload/generation/OAuth SQL, storage signing, finishing and local binary-transfer regressions.
- Seven PostgreSQL fixture tests use the actual baseline Demo/media table definitions and the entire new migration: registration identity/classification, replay preserving edits, rejected foreign/unconfirmed/invalid inputs, both-write rollback, deletion replay/ownership, invoker grants, stale generic deletion, and deletion rollback. These passed after the final deletion-trigger change.
- Seven tool/website-route tests passed: permission enforcement, strict inputs, owner/project-bound cursors, protected summaries, ready-source matching, error handling, generic-path website deletion and retained legacy behavior.
- Registered upload confirmation regression passed, including rejection of unrelated Demo rows and changed confirmation metadata.
- TypeScript check and a complete Next.js 16.3.8 production build passed; all 153 static pages generated. The build forwarded only six existing public Firebase values, with generation/finishing disabled.
- Production schema inspection confirmed the Demo/media identity, project, metadata and deletion column types match the implementation. Post-application catalog checks confirmed the reviewed migration's functions, grants, index and enabled trigger.

No production media was generated, uploaded, registered, deleted, rendered or transcribed during these checks. The migration and both server/website changes are deployed. Installed Codex/Claude plugin behavior and production Demo workflow acceptance remain pending.

Post-application production catalog checks confirmed all three functions are SECURITY INVOKER, service_role-only, the deletion trigger is enabled, the pagination index exists, and both tables retain RLS and required service access. Security advisors reported the same pre-existing INFO-only `rls_enabled_no_policy` notice for 135 tables, consistent with the Firebase/server ownership boundary; no new warning/error was reported. Existing timestamp differences between the older canonical history and production were observed before release and were not repaired or replayed by this change. Only the reviewed additive Demo SQL was applied.

The code candidate was pushed as commit `0eb09ea119f6d1b34488a6ab363521ba44aa8b90` in [draft PR #32](https://github.com/Saiteja02806/Ugc/pull/32), stacked on the finishing release PR. Both remote MCP contract runs and the migration guard passed. The `ugc` website preview `dpl_GpfH2wyZA1fEpxm1dhUDKeC5g4u1` is READY and reports that exact commit. The separate `trending-release-web-3f35202` preview failed at prerender with `Firebase auth/invalid-api-key`; its log shows compile/TypeScript passed before that environment failure. Production aliases were not changed. A successful website preview/build is not authenticated production acceptance.

## Broader goal

Normal Codex CLI OAuth reconnect completed successfully with the requested `creative:write` scope. After promotion, fresh authenticated discovery through the supported Codex app-server API returned all nineteen deployed tools, including finishing and dedicated Demo operations, with no discovery error. It created no chat or model turn and read no credential files. This chat still exposes twelve cached UGC tools. The shared desktop proxy could not connect to its control socket; fresh CLI discovery succeeded independently. Local package installation and acceptance of hook → demo → finished download in both Codex and Claude remain required. The standalone discovery process cannot call a tool for this desktop chat because that thread is not loaded there; discovery is not execution acceptance.

## Production release evidence

- Exact reviewed source: `ac83ad8aef61a896f43619bc35f94754096e2a5a`; both final MCP CI runs and the migration guard passed for this SHA.
- Website staged production build: `dpl_HfNnhqxv5yXdz5N7q9BeGcqnwCZA`, `https://ugc-441vjxeiu-ugcpilot.vercel.app`. Promotion preceded MCP promotion. Alias inspection confirmed both `getugcpilot.com` and `www.getugcpilot.com` point to it. Against the real website domain, unauthenticated `/api/demo/list` returned the expected JSON 401, GET `/api/demo/delete` returned 405, and `/mcp/health` returned 404.
- MCP staged production build: `dpl_31tdj2yrJ2FGXACeATAv48BF9ZxK`, `https://ugc-imoj6lek5-ugcpilot.vercel.app`. Its exact commit/project/production target/READY state were verified before promoting the same build. The production alias `mcp.getugcpilot.com` points to it. Production health returned 200/ready, OAuth metadata advertises `creative:write`, and website-only `/api/demo/list` returned 404.
- The new MCP build includes the deliberately enabled non-secret `MCP_VIDEO_FINISHING_ENABLED=true` setting. Existing editor/framing/subtitle and renderer queue configuration remains in effect.
- The protected staged website fetcher treated the application's 401 as a protection error, so that result was not claimed as a verified application response. The actual JSON authentication boundary was checked on the real production website after promotion.
- Fresh authenticated Codex discovery returned nineteen tools. No paid generation or production media operation was submitted to establish discovery.

Upload reservation lookup/renewal/idempotency and server media probing remain separate missing work. Full application parity still includes drafts/history, advanced generation, audio, full editing/references, slideshows, Trending/Carousel, Library/groups, business/settings, social publishing and analytics. See `mcp-remaining-work-audit-2026-10-11.md`.
