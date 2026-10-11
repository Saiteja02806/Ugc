# MCP video release readiness — 11 October 2026

The isolated candidate is based on website production commit `e4cd22228b72e9b0c41f5cc3cd00e860082f281b` in the managed `mcp-full-app-access` worktree. Only the reviewed MCP adapter, shared finishing boundary, plugin source, tests and associated documentation were copied from the original checkout. Unrelated ongoing website, Carousel and worker changes in that checkout remain outside this scoped MCP release. The original checkout is not the deployment source.

## Verified before staging

- A complete Next.js 16.3.8 production build passed, including TypeScript and generation of all 153 static pages. Only public Firebase browser configuration was forwarded for this build; server environment files were not copied.
- Existing MCP unit, HTTP transport, OAuth SQL, generation SQL, signing and nine finishing contract checks passed. The fresh install initially omitted ffmpeg because lifecycle scripts were disabled; rebuilding the existing locked ffmpeg-static package restored the fixture executable. All twelve real-byte local-transfer tests then passed.
- The combined transfer, website finishing API/store and plugin validator run passed all 46 tests. Three deterministic plugin package-build tests passed after correcting stale release notes. The production dependency audit reported zero vulnerabilities.
- Supabase project `kltxwijhluawgveykfbt` is ACTIVE_HEALTHY. The existing `explore_video_finishes`, `background_jobs` and `media_assets` tables have RLS enabled. `explore_create_video_finish(p_user_id text, p_request_key uuid, p_fingerprint text, p_draft jsonb)` exists as SECURITY INVOKER, with service_role execution allowed and anon/authenticated execution denied. No schema changes were made.
- GCP queue `projects/ugcsaas/locations/us-central1/queues/ugc-video-render` is RUNNING. Cloud Run job `ugc-video-render-job` is Ready and uses immutable image `us-central1-docker.pkg.dev/ugcsaas/ugc-worker/ugc-worker@sha256:e42643fbacdde6fdee5ad12917931a2b986ca391daf65f34a115547198bbfafc`. The finishing contract files have no differences between that release's recorded source revision `bb83ce32` and the candidate base.
- Website production finishing, editing, framing and subtitle configuration is enabled. The verified dispatch URL is `https://getugcpilot.com/api/internal/jobs/launch-render`, using the existing render queue. These non-secret runtime configuration values were added to the MCP project. `MCP_VIDEO_FINISHING_ENABLED=false` keeps creation disabled during staging.

## Still required

Stage the immutable candidate on the existing `ugc-mcp` Vercel project without assigning its live domains. Verify health, OAuth metadata, original route isolation and the expected new scope before promotion. New finishing creation remains disabled until deliberate activation and normal `creative:write` consent. A live hook/demo upload, render, recovery and final download in both Codex and Claude Code is still required. No generation, upload, transcription, render or publishing occurred during readiness checks.

The plugin candidate remains version 0.1.4; public download links and installed hosts have not been updated. Corrected manifest release notes require a newly built archive and checksum. Full application parity remains the scope in `mcp-remaining-work-audit-2026-10-11.md`; this release does not complete the audio, drafts, advanced generation, full editor, slideshow, Library, Trending/Carousel, business/settings, publishing or analytics adapters.
