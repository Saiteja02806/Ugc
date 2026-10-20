# MCP current capability audit

Last reviewed: 2026-10-17

This audit supersedes the initial 15-tool/12-tool snapshot in the historical remaining-work report. It describes the current server source at `lib/mcp/server.ts`, whose `registeredMcpTools` export contains **79** registrations. It does not claim that every tool is enabled or accepted in production: rollout gates and each account's capability reads remain authoritative.

## Evidence collected

- The current `registeredMcpTools` export lists 79 tool names, across 15 registration modules.
- The full `npm run test:mcp` suite passed on 2026-10-17. It covers OAuth/PKCE, permission isolation, generation, generic uploads/downloads, Demo records, finishing, operation recovery, Edit drafts/exports, audio, reference/remix, asset groups, Library and account settings.
- A connected production account's safe reads reported short-video generation and video finishing available. No write or customer-media work occurred in that verification.
- The local Claude Code client is signed out and is still using the older 0.1.8 plugin, so it does not yet prove clean Claude host acceptance. See `ugc-pilot-plugin-context.md`.

## Current MCP coverage

| Product area | Current source tools | State and boundary |
| --- | --- | --- |
| Media generation | `generate_image`, `generate_video`, `get_job`, capabilities and owned-asset reads | Implemented for the supported fixed model/input contract. Website-only model/resolution/reference choices and character/avatar workflows are still absent. |
| Hook → Demo finishing | finishing capabilities, `finish_video`, receipt read; Demo register/list/get/delete | Implemented. The shared finisher supports owned hook/demo composition, trims, exact text, volumes, framing and supported subtitles when enabled. Codex existing-media acceptance is recorded historically; clean Claude Code acceptance remains pending. |
| Generic uploads and recovery | create/confirm/delete, get/list/renew upload, server probe and local transfer helper | Implemented for the released public-media path. Private IDE upload rollout remains disabled pending separate bucket/delivery verification. |
| Operations and saved Edit work | list/get/cancel/retry operation; list/open/get/update draft; export/get export | Implemented with owner-bound, revision-safe recovery. Host acceptance remains required for a real user journey. |
| Audio | capability, voices, assets, generation, preferences/bookmarks, upload reservation and video import tools | Implemented source contract, but production audio runtime and new imports are gated. Full music/voice-clone lifecycle is not exposed as a complete MCP workflow. |
| References and text remix | reference catalogue/detail, remix create/read/list | Implemented for reviewed catalogue text. Full application reference/editor/pairing surface remains incomplete. |
| Creative Assets and Library | asset groups/folders and membership; Carousel/slideshow Library save/archive/recovery | Implemented for the listed flows. Library capability explicitly reports `slideshow_text_rendering_available: false`. |
| Business and account settings | read business context; publishing defaults/timezone reads, updates and receipts | Partial. Onboarding, business/brand editing, logo and screenshot workflows still require the unreleased business candidates. |
| Slideshows | Library snapshot/save operations | Partial. Backend rendering of finished slides with text is absent; browser canvas export remains the application dependency. |
| Trending and Carousel | owned Carousel discovery and Library save only | Partial. Feed decisions, creative editing, rendering status and broader Trending actions are not registered MCP workflows. |
| Social publishing | account defaults only | Missing. There are no MCP tools for account connection, schedule create/update/cancel, publish or retry. |
| Analytics | no analytics-specific MCP registration | Missing. Platform-report retrieval and refresh are not available through MCP. |

## Release order

1. Complete the pending Claude Code sign-in, plugin/OAuth return and safe read-only acceptance.
2. Deploy a reviewed plugin candidate to protected staging, confirm its version/source/tool discovery, then repeat the clean Codex and Claude Code install paths.
3. With explicit selected-content authorization, run one bounded hook → Demo → finished-download workflow in each host and verify its immutable receipt and actual output bytes.
4. Build the missing parity areas in dependency order: business/onboarding, advanced generation, server slideshow rendering, Trending/Carousel actions, social publishing, then analytics.

No deployed capability should be inferred from this source audit alone.
