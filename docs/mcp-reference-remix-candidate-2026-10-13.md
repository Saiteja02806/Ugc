# Reference catalogue and application text remix through MCP

This is an isolated, unreleased candidate on `codex/mcp-reference-access` in `C:/Users/chund/.codex/worktrees/audio-release-preserve/UGC`, based on approved restoration source `4042fc64bd468ebba825240cb6fb62385e3b9d40`. It adds six tools to that 46-tool baseline, for 52 source registrations. Advanced-generation PR #45 is separate and still awaiting production migration authorization; these counts must not be added as if either candidate were deployed.

## Implemented

- `get_reference_capabilities`: current account access, creation gates, provider/storage configuration, business-context readiness and the application's input/quota limits. Reads explicitly avoid refreshing credits or initializing an allowance.
- `list_references`: the same published Hook, Wall-of-Text and slideshow catalogue as the application, with filters, complete pagination, slide IDs and supplied paired audio. Cursors bind filters and the catalogue media snapshot. Catalogue IDs remain distinct from owned media UUIDs.
- `get_reference`: selected catalogue media and existing text, preserving exact blocks/timing/source fingerprints and reviewed/unreviewed/missing status. Slide selection is checked against its parent. It does not transcribe or generate text.
- `remix_reference_text`: intended application text remix through the website's extracted owner service, using the same request schema, business grounding, immutable claim, daily quota, provider options and saved outcome. Website authentication, header/size validation and access-before-body behavior are preserved. No OAuth token is forwarded to Firebase HTTP.
- `get_text_remix`: owner-scoped saved-result verification/recovery, including website requests. No provider call or new claim; remains readable after plan/provider/gate changes. Uncertain or failed work never automatically resubmits.
- `list_text_remixes`: metadata-only history with owner-bound keyset cursors and stable ordering across equal timestamps, so a lost request UUID can be rediscovered without exposing private grounding.

MCP creation separately requires `MCP_TEXT_REMIX_ENABLED=true`; its default is false. The existing website gate remains authoritative as well. Reads do not enable creation. A remix saves copy; it does not apply an editor draft, create a finished slideshow or render a video. Existing package 0.1.9 and older downloadable artifacts have not been overwritten or republished for this candidate.

## Current verification evidence

Twelve actual MCP protocol checks and two real published-catalogue checks passed. They cover pure capability reads, scoped discovery, filters/snapshot pagination, exact reference/slide identity, website↔MCP request replay, concurrent uncertain outcomes, recovery after access/configuration changes, ownership, invalid/custom copy, quota, saved business grounding and corrupt/failed receipt handling. The catalogue tests traverse all published pages and existing source-bound text without a provider call.

All nine existing website text-remix adapter regressions passed after extracting the owner service. TypeScript and scoped runtime ESLint passed. The production build log records successful compilation, TypeScript, all 155 static pages and the complete final route table. Its process handle is no longer available, so a separate terminal exit-code receipt was not retained.

The history helper now handles SDK error replies. All three history checks passed through actual MCP/PostgREST queries, including equal timestamps, foreign/injected cursors, missing scopes, limits and outages. No production runtime workaround was made.

The first complete MCP run stopped at existing actual-byte transfer fixtures because the clean dependency install omitted install scripts and therefore lacked FFmpeg. When normal approval review became available, matching FFmpeg 5.3.0 was restored from the existing locked dependency and verified by SHA-256 `04e1307997530f9cf2fe35cba2ca7e8875ca91da02f89d6c7243df819c94ad00`. The complete MCP suite then passed, including the real byte-transfer and SQL regressions. The earlier review-service usage failure is resolved for those checks; no alternate executor or checkout bypass was used.

Final source review aligned intended first-use text submission with the website's standard one-time free allowance initialization. Catalogue/capability/history reads still explicitly prohibit it. Capabilities report `initialization_required` when an allocation has not yet been initialized and specify the rolling 24-hour quota window. A new protocol regression verifies that only intended submission initializes it. All 24 focused protocol/history/website adapter checks and all thirteen package/migration-parity checks pass. The package inventory was updated from 46 to 52, with no annotation checks removed. The final production build has a retained successful exit-code receipt. The final complete MCP suite after this access correction passed with exit code 0; its final reference/history/website group reports 26 passing checks, followed by the existing actual PostgreSQL claim/quota check. Five deterministic package-builder tests and the migration freeze guard also passed. The final build returned exit code 0. No older download was changed. Deployment, packaging of these new workflow instructions and installed-host acceptance remain pending.

A read-only production database inspection confirmed that the existing `explore_text_remixes` table has RLS enabled, service-role reads allowed and browser-role reads denied. `explore_claim_text_remix` is an invoker function with an empty search path, service-only execution and denied anon/authenticated execution. Its body MD5 `f10c46c4f5b7d12fb775b772fba2754c` matches the unchanged reviewed local migration. This candidate creates no migration and no customer row/provider call was made during verification.

## Host and complete-journey boundary

The live server still exposes 46 tools. Native visual-generation and finishing capability reads report available, including editing/framing/subtitles. Dedicated Demo and creator-library reads succeed. No selected hook/demo has been submitted for finishing.

Codex now loads installed plugin 0.1.9. Its visual and audio helper files are byte-identical to the reviewed 0.1.9 archive, and the available Node runtime is 24.13.1. File parity does not prove a real transfer/render/download. Local Claude Code reports `loggedIn=false` and `authMethod=none`; its separate login/OAuth and actual journey remain unverified.

The primary acceptance still needs an intended, user-selected hook → demo → finished local download task in both hosts. No customer media is generated, edited or uploaded merely to prove discovery. Full application parity remains unfinished, including advanced-generation release, audio configuration/lifecycle, characters, complete editing/slideshow persistence/rendering, Trending/Carousel, Library/business/settings, publishing and analytics.


Consent follow-up: requested business-grounded text remix requires both `generation:write` and `brand:read`, checked before entitlements, claims or provider calls and mirrored in SDK challenges/metadata. The existing generation-consent description now explicitly includes speech and text remixes. No new OAuth scope is created; missing existing grants use normal consent. A protocol regression rejects generation-only, brand-only and creative-only permission combinations. This source correction supersedes the earlier reviewed head and requires new exact-head validation before release.
