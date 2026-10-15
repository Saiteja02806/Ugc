# UGC Pilot MCP goal progress — 14 October 2026

This is the current capability report. It supersedes historical paragraphs labelled “current” in older release notes.

## Local development update — 15 October 2026

Latest local source adds owner-bound Trending Carousel assignment discovery and
the website's lightweight assignment-checked edit status: 96 source tools on the
isolated slideshow branch, separate from the business candidate's different 96.
Three SQL-backed adapter cases, full SDK discovery/read checks, TypeScript, lint
and plugin contracts pass. Full Trending editing/render submission remains open.
Live recheck still shows 79 tools, finishing available, Library writes disabled
and audio runtime unavailable. Local Claude Code remains signed out.

The isolated slideshow candidate adds four export commands: capabilities,
submit, recover and history. Its source catalogue has 94 tools; the last live
audit remains 79. Authenticated website API and MCP share the saved-revision
export service and PNG worker. Focused adapter tests pass with actual SQL and
native rendering over synthetic images and a simulated cloud transport.
The expanded full MCP regression passed, including nine adapter and sixteen
worker/storage cases. TypeScript, scoped lint and plugin contract checks passed.
The local milestone is committed as `2057d430`. A complete Webpack application
build passed with non-secret Firebase placeholders; production authentication
was not checked by that build.

This is not deployed. New exports remain disabled by default. The browser export
button is not switched to the new API. A following local 0.1.17 package adds
the shared slideshow edit/export/recovery workflow (16 skills, 43 files), with
seven new manual evaluation scenarios. Archive/contract checks pass and 0.1.16
remains unchanged. The integrated synthetic export fixture also downloads the
actual PNG bytes through get_asset and the local helper, verifies hashes and
preserves existing destination files. Cloud transport is simulated.

The following local integration also passes the exported PNG IDs through real
Library preparation/MCP/SQL. It verifies exact slide order, owner/deleted-source
rejection and recovery of one Library item after a lost committed response.
Replay after disabled writes/source deletion does not rerender. Production
Library and Codex/Claude acceptance remain unverified.

Plugin release/installed-host verification, Linux
font coverage, live cloud/output download/Library verification, reviewed release
and actual Codex/Claude workflow acceptance remain outstanding. No customer
media was generated. See the [adapter report](../.tmp/mcp-explore-drafts-20261014/docs/mcp-slideshow-export-adapters-2026-10-15.md).

A following local worker preflight command now shares the actual configured-font
loader and smoke-renders all three pinned font families/weights. Twenty worker,
storage and preflight tests pass. It does not supply or redistribute font files.
Docker's Linux engine is unavailable here, so Linux image acceptance and glyph
coverage remain open; a Windows smoke result is not production readiness.

## Goal and honest completion boundary

The goal is full UGC Pilot control from Codex, Claude Code and other capable IDE clients: generate media, upload local hook/demo files, attach and edit them, save/reopen work, render/download outputs, and manage the wider application.

The existing-media hook → demo → downloaded video journey is verified in Codex. The full journey starting with a newly generated hook and local uploads is not yet production-accepted. Claude workflow acceptance is not complete. Full application parity is not achieved.

There are 79 distinct tools exposed in this chat and in the released source. Two connected namespaces expose the same catalogue; that does not mean 158 features. The combined business candidate contains 96 tools, adding 17 business/context/onboarding/logo tools. Advanced-generation PR #45 adds four separate tools and is not part of that 96-tool candidate.

Tool counts are implementation inventory, not a completion percentage. Some tools only read state; several write tools are disabled or lack runtime configuration. An overall percentage would require a complete, weighted application-action inventory and verified acceptance. The evidence below is a more useful measure.

## Source and connections verified

- Website: dpl_CUXcYhNf8ykvHiG8pxzVLRxnYsYX, READY.
- MCP: dpl_FfqQgPemMxdXcLvWyNWiiAwarr1W, READY.
- Both deployment inspections report source 07a4e516407151d5411f37e05fece468e8dcfdbd, merged PR #57.
- Connected Supabase URL: https://kltxwijhluawgveykfbt.supabase.co.
- Live authenticated capability reads succeeded for generation, finishing, Edit export, audio, groups, Library, references and account settings.
- Local Claude Code auth status reports loggedIn=false. The earlier Claude.ai connector screenshot does not establish Claude Code login or a completed Claude media workflow.
- The production setup source advertises plugin 0.1.12; PR #56 packages 0.1.15. Installed-host updates and actual skill execution remain distinct from a server catalogue refresh.

## What is in the 79-tool release

“Available” means code/live capability support exists. It is not a claim that every operation below has been exercised against customer media.

| Area | Tools | What has been added | Current usability and acceptance |
| --- | ---: | --- | --- |
| Core visual/account/media access | 15 | Account/plan/brand reads, asset browsing/delivery, image/video generation and polling, generic local upload/confirmation/deletion, video finishing capabilities/submission/recovery | Basic image/video generation and finishing report available. Video uses the V1 contract: 3–10 seconds, 1/2/4 outputs, one optional image reference and no video-reference input. No new provider generation was submitted for this audit. |
| Dedicated Demo library | 4 | Register a confirmed upload as a Demo; list/get/delete owned demos | Released. Existing demo selection was verified in the Codex render. Real local demo upload → registration acceptance remains pending. |
| Upload recovery | 3 | Recover/list lost reservations, renew the same pending upload, preserve request identity | Released with server byte/media validation and local binary helper. Complete intended local hook/demo transfer acceptance remains pending. Private upload creation is disabled. |
| Job history/control | 4 | List/get operations, supported cancellation and retry | Released with owner/credit/policy checks and durable recovery. Not every website job type is retryable; actual user-requested cancel/retry acceptance is separate. |
| Dedicated Edit page | 7 | Open/create/reuse a source draft, list/read/save exact trim/text revision, export/read export and capability | Export reports available. Shares the website’s saved Edit records. Real open → change → reopen → export acceptance remains pending; this does not expose every Explore/slideshow working draft. |
| Audio | 13 | Voices, saved audio/history/preferences/bookmarks, requested generation, local upload, delivery and audio-to-video import | Live generation/upload/download/import are unavailable. Generation access is allowed, but runtime configuration is incomplete; catalogue is public-preview. Voice cloning is not exposed. Preferences/bookmark adapters do not grant generation access. |
| References/text remix | 6 | Browse Hook/Wall/slideshow references and reviewed text; save/recover/discover remix operations | Catalogue/text access are available. Remix is disabled and its provider is unconfigured. Reading references does not extract missing text or generate a remix. |
| Creative Asset groups | 11 | Browse groups/membership; create/rename/delete/add/remove with revisions and recovery receipts | Storage configured; writes disabled. Shared schema is applied under canonical migration version 20261013072941. No full group-write customer acceptance. |
| Application Library | 10 | Browse saved Carousel/slideshow outputs and sources; inspect/save/remove with exact revisions and receipts | Storage configured; writes disabled. Schema applied at 20261013072958, permissions follow-up at 20261013073411. Slideshow saves accept already-rendered images; backend text rendering is unavailable. |
| Account defaults/settings | 6 | Read/update six publishing defaults, initialize unset timezone, recover/discover changes | Reads available; writes disabled. Migration 20261013090422 is applied. Initialize-once timezone semantics preserve existing timezone; this is not arbitrary rescheduling. |
| Total | 79 | | |

The core finishing schema supports separate clip preparation, opening-then-demo composition, trims, exact text overlays, volume, framing, existing supported audio snapshots, and supported English subtitles. Audio import currently being unavailable limits private-audio attachment. The real render verified trim/order/download, not every text/audio/subtitle option.

## Concrete result already achieved

The user-approved Codex production test used the last second of “Creator 006 - Shock Surprise” and the first second of “less time caurosels part 2.”

- Both preparation jobs and the composition job completed.
- Output downloaded through the local helper.
- File: C:/Users/chund/OneDrive/Desktop/UGC/outputs/mcp-hook-demo-test-2026-10-13.mp4.
- Verified duration 2 seconds, 720×1280 H.264, 60 frames, AAC audio.
- Full decoding and frame-order inspection passed; local SHA-256 rechecked in this audit:
  ff61f35e9452cccd5d4b95891ddc74fd3d0aeb27a78bc2166200dad638461a0c.
- Provider generation, local uploads, paid subtitles, Edit export and Claude execution were not part of that test.
- This sample had about 162 seconds of processor-startup delay before about four seconds of processing; per-owner preparation/composition is sequential.

See docs/mcp-hook-demo-acceptance-2026-10-13.md for receipts and exact scope.

## Built, but not in production

| PR | Added behavior | Release boundary |
| --- | --- | --- |
| #45 | Four advanced-generation adapters: current model/options catalogue, image/video generation with website choices/owned references, request recovery | Separate candidate; not integrated into PR #56. Migration 20261012154819 absent. Character/avatar workflows are still separate missing adapters. |
| #51 | Six Business Context tools: read/save/apply shared context drafts and recover/discover receipts | Unreleased. Migration 20261013112752 absent; brand:write consent and disabled-by-default gate. |
| #53 | Five onboarding tools for both saved website modes: progress/source intake/identity/goals/submission/edit/recovery | Unreleased. Migration 20261013141043 absent; brand:write and disabled gate. Uses existing completion/preparation jobs rather than a new worker rollout. |
| #55 | Six logo tools: local reservation, discovery, recovery, renewal and actual-byte confirmation, plus packaged transfer helper | Unreleased. Migration 20261013165323 absent; brand:write and disabled gate. Attaching the verified logo is a separate intended onboarding identity change. |
| #56 | Combines #51/#53/#55 with latest live PR #57, preserving application/navigation fixes; packages plugin 0.1.15 | 96 source tools. Exact-source Linux application/MCP/concurrency/migration checks and local build passed. Protected production-target stage creation is awaiting approval. |

PR #56 source is 945ddf2a15a89ba26215dbfcb9fc9cb4440fb168. Both Linux application runs passed 907 Explore, 606 worker, 97 scheduling UI, 3 scheduling metadata, 20 Business Context and 10 onboarding schema cases. MCP/concurrency passed eight independent-session cases and package checks. The configured local build passed with 267 route-table entries and 157 generated static pages. The primary website preview check passed; the separate non-target trending-release-web preview failed and is excluded from this release.

Creating protected stages does not finish this release or the goal. Subsequent readiness verification, authorization for three migrations/live promotion, deployment, normal brand consent, intentional write activation and real business workflow acceptance remain required. The plan explicitly keeps nine new-write gates false at build and runtime.

Automatic approval review rejected the preceding production-target stage attempt despite --skip-domain. No stage was created, no protection bypass was created, and no candidate migration/promotion occurred. The latest user asked for this clarity before approving; that is not authorization.

## How the many PRs relate

- #39: private-upload infrastructure adapter, released with private creation disabled.
- #43/#44: audio/import adapters and plugin workflow, released; current MCP audio runtime remains unavailable.
- #45: advanced generation remains a separate unreleased candidate.
- #46: reference/remix adapters, released; reference reads work, remix creation remains unavailable.
- #47/#48: groups/Library adapters, released through combined source; writes remain disabled.
- #49: plugin workflows for those capabilities, included in released source.
- #50: account defaults/settings adapters, included in released source; writes remain disabled.
- #51/#53/#55: new business/context/onboarding/logo features, not yet released.
- #56: combined business release, not four unrelated new features.
- #57: already-live general application/navigation release, preserved by #56.

An original feature PR can remain OPEN even when its changes have been incorporated and deployed by a later combined release. Runtime capability, deployed source and migration evidence determine usability; GitHub PR state alone does not.

## Still missing implementation or complete parity

| Area | Remaining work |
| --- | --- |
| Complete intended media journey | New hook generation → real local hook/demo uploads → demo registration → edits/composition → finished download in Codex and Claude; intentional text/framing/subtitle/Edit-export acceptance. |
| Advanced generation/characters | Integrate/release #45; character creation/selection/history/preferences, avatar/Talking Head workflows and additional website-specific options. |
| Audio completeness | Restore correct MCP runtime configuration and controlled activation; voice samples, cloning/verification/removal, original audio-library removal, default music and music management. |
| Explore/slideshow drafts | Six shared Explore clip-draft adapters are implemented locally, followed by five shared slideshow working-draft adapters on `codex/mcp-slideshow-drafts` (90 tools on that separate source). The slideshow candidate includes owner-bound persistence, gated website Save/Load draft controls, revisions and receipt discovery/recovery. There are 72 passing focused tests; the full MCP suite passed again at 616137dc. The real browser→actual API→service-role SQL→MCP fixture also passes after the shared text-module move; its earlier run exposed a now-fixed native-fetch receiver bug. Its migration is not applied, and release, activation, full production-page/host acceptance remain pending. A native backend raster engine and frozen-revision render boundary now exist locally; durable owner/request export persistence, atomic queued-job reservation and verified output recovery now exist locally too. The following 15 October candidate now connects the actual worker/native renderer/GCS adapter to service-role SQL with source-generation/hash pinning and prepared-output recovery. Sixteen worker/storage cases, the complete MCP regression and the editor/API/SQL/MCP browser fixture pass; GCS transport is simulated. The newer local adapter milestone above adds export commands; live storage, Library integration and host acceptance remain unfinished. This source is separate from PR #56 and the immutable 0.1.16 Explore package. Dedicated Edit-page tools cover their separate editor system. |
| Slideshow text export | The local worker engine now produces actual PNGs from saved text using shared layout and pinned font checks. Fourteen full-font/snapshot tests and 81 matching-font browser geometry comparisons pass. A following local candidate adds immutable exact-revision export receipts, atomic queued-job/output-ID reservation, lease-aware output storage/finalization and shared service recovery/history; sixteen focused SQL/service cases and the full MCP regression pass. The 15 October local candidate adds worker dispatch and a real GCS adapter, generation/hash pinning and interrupted-upload recovery, verified with actual renderer/SQL plus simulated GCS transport. The newer local adapter milestone above adds submit/recovery/history MCP tools. It still needs live-cloud verification, Library integration, pinned Linux/browser fonts and fallbacks, release and real host acceptance. Production edited-slide export still uses browser canvas. See the isolated renderer and export persistence reports in `.tmp/mcp-explore-drafts-20261014/docs/`. |
| Trending/Carousel | Current feed discovery/decisions/actions, supported creative editing/render status and complete current workflow control. Library adapters only inspect/save already-existing completed outputs. |
| Business media/context completeness | Dedicated app screenshots/Carousel product assets, website reanalysis, remaining logo lifecycle/cleanup and verified business acceptance. |
| Social publishing | Normal connection/reconnection/disconnection flows, publish settings, schedule/create/update/cancel, publish/retry individual targets and calendar discovery. Listing background jobs does not provide these commands. |
| Analytics | Platform report reads and controlled refresh/sync adapters. Seeing an analytics job in history is not report access. |
| Other customer application actions | Billing checkout/portal and feedback/support handoffs. Current entitlements are read-only information, not subscription management. |
| Host/distribution acceptance | Supported plugin updates; actual Claude Code login/OAuth and workflow acceptance; execution in other supported IDE hosts. Local binary transfers require client filesystem/terminal capability. A remote MCP connector alone cannot read a Windows file path. |
| Activation/release verification | Private uploads, audio imports, groups, Library, remix and account settings are disabled; the three new business gates are also planned disabled. Test and activate requested workflows deliberately rather than equating deployment with readiness. |

## 15 October local worker milestone

The slideshow candidate now connects saved export receipts to worker rendering,
prepared/uploaded PNG recovery and atomic owned-output registration. The real
handler, native renderer, storage adapter and service-role SQL pass sixteen local
worker/storage tests with simulated GCS transport. The sixteen persistence/service
cases, complete MCP regression and actual editor/API/SQL/MCP browser fixture pass too. No production source,
schema, worker, gates, bucket/IAM or customer media changed. The first source read
pins its object generation and bytes; submission-time remote byte identity,
Linux/browser fonts, live GCS acceptance, export MCP adapters and intended
Codex/Claude workflows are still open. Details are in
`.tmp/mcp-explore-drafts-20261014/docs/mcp-slideshow-worker-2026-10-15.md`.

## Recommended order

1. Complete practical acceptance of the core intended media journey and Claude client, and resolve configuration/activation for already-deployed useful adapters.
2. Finish the reviewed business release/consent/acceptance as one combined release; avoid treating each original PR as a separate milestone.
3. Integrate advanced generation, then fill character/audio lifecycle and shared Explore/slideshow drafts/rendering gaps.
4. Add current Trending/Carousel workflow control, business screenshots/reanalysis, social publishing and analytics.
5. Track each user action with code, release, configuration and host-acceptance evidence before declaring complete application access.

No new generation, upload, rendering, publishing, schema or infrastructure action was performed for this status audit.
