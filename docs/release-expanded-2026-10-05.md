# Expanded production release — 5 October 2026

Base: 8207241225426d46b5649279047451aba00c61ba. This release adds every completed change captured across the desktop, Explore and Audio checkouts. All 74 source paths and source statuses were checked again before staging; none had changed. Original working files and their indexes are preserved.

Wall of Text: authored line breaks, paragraph gaps and short phrases survive preview, saved edits, shared PNG and worker export. Width handles, keyboard controls and the slider keep fixed typography within safe bounds. AI-generated copy retains its existing word, sentence and layout checks. The web app requires the updated renderer.

Explore: Recreate resizing and history behavior, workflow navigation feedback and Quick start presets; Calory Tracking and the user-approved Pet Tracking references (54 slide images, nine examples). The existing four approved workflow videos remain unchanged. Audio: bookmark/session recovery, independent Use It selection, route-persistent account-scoped library caching and explicit saved sample/recording attachments. The earlier Trending, character credit, cleaned portrait, audio and Content Library changes remain included through the base release.

Validation: optimized Next build, standalone application TypeScript and worker compilation passed. The 87-file offline run passed 707 of 709 checks; two stale manual-edit assertions were corrected, and all 66 focused generated/manual Wall checks passed. The compiled Wall worker checks passed 30/30. Changed-code lint has zero errors and two existing unused-variable warnings. Whitespace validation passed. React review checked account-scoped queries, authenticated API access, cancellation/cleanup, accessible labels and keyboard controls.

The only additional database migration is audio_voice_selection, applied as hosted version 20261005115049. RLS is enabled; browser roles have no table access; the verified-owner server uses select/insert/update only. The advisor INFO notice for no browser RLS policies is intentional for this server-only table. Existing migrations are not replayed.

Signed-in production acceptance is pending at the user’s explicit request. Public production pages, route auth guards, deployed Git SHA, worker startup health/release identity and migration parity must be verified after rollout. No paid media generation, customer scheduling/publication or saved-demo reset is used as a test.

Rollout: build an immutable worker image from the committed release, verify startup before shifting traffic, update the renderer service and render job before pushing production main, then verify all five services and the job plus the Vercel production deployment. Keep existing IAM, ingress, secrets and service settings. The job is updated but not executed.

Rollback target: base 8207241; web dpl_86ukASYKZHcGY8FU1nG6dqcaXxaR; worker digest sha256:cef38cacf3ea92ee9e6a6139b0dc901816a80cdfbae981822141807eaa7e22b7. Preserve the new additive preferences table if rolling back. Once users have saved manual layouts, retain the compatible renderer or forward-fix it rather than sending those edits to an older renderer.

## Exclusions and preserved compatibility

- index.ts: obsolete paid Higgsfield example; already reviewed and excluded.
- supabase/migrations/20261003045336_character_gemini_3_pro_image.sql: duplicate historical alias of the canonical, already-applied 20261003045651 migration.
- Original Create Content backend deletions: existing production APIs and in-flight job compatibility remain preserved; only the authorized screen retirement is included.
- Private .env files, .vercel, node_modules, .next, worker/dist, .tmp, generated preview/review files, design autosaves/recovery copies, private Terraform variables and state: local credentials, dependency/build output or temporary artifacts. Intentional editable design sources and approved final assets already on main stay included.
- Experimental workflow-video replacements: explicitly deferred by the user’s choice to keep the old four videos.
- ugc-tinder-deck: unrelated legacy runtime; no change needed for this release.

Every prior retained-main/screen-retirement/excluded path and reason is carried forward in release-expanded-review-2026-10-05.json. The original 901-path audit remains in release-review-2026-10-05.json.

## Additional included source paths

- components/trending/wall-text-edit-overlay.tsx
- docs/audio-bookmarks-explore-fix.md
- docs/wall-text-manual-edit-formatting-2026-10-05.md
- lib/trending/wall-text-editor-layout.ts
- lib/trending/wall-text-manual-copy.ts
- lib/trending/wall-text-manual-layout.test.mjs
- CAROUSEL_CONTEXT.md
- WALL_TEXT_CONTEXT.md
- app/api/trending/creatives/[format]/[creativeId]/edit/route.ts
- app/api/trending/creatives/wall_text/[creativeId]/overlay/route.ts
- components/trending/trending-creative-editor.tsx
- components/trending/wall-text-overlay.tsx
- lib/trending/creative-edit-contract.test.ts
- lib/trending/creative-edit-contract.ts
- lib/trending/creative-edit-schema-contract.test.ts
- lib/trending/creative-edit-service.ts
- lib/trending/wall-layout-engine.ts
- lib/trending/wall-text-render-validation.ts
- lib/trending/wall-text-text-logic.ts
- lib/trending/wall-text-types.ts
- package.json
- worker/src/jobs/render-wall-text-video.ts
- worker/src/lib/wall-text-overlay-renderer.ts
- worker/src/lib/wall-text-render-spec.ts
- app/explore/loading.tsx
- components/explore/explore-link-indicator.tsx
- docs/explore-slideshow-categories-2026-10-05.md
- scripts/explore-navigation-ui.test.mjs
- scripts/explore-quick-start-presets.test.mjs
- scripts/recreate-history-ui.test.mjs
- scripts/recreate-resize-behavior.test.mjs
- app/explore/create-hook/page.tsx
- app/explore/recreate/page.tsx
- components/explore/ai-character-card.tsx
- components/explore/explore-workflow-card.tsx
- components/explore/explore-workspace.module.css
- components/explore/explore-workspace.tsx
- components/explore/hook-workflow-preview.tsx
- components/explore/recreate-layout.module.css
- components/explore/recreate-workspace.tsx
- components/explore/use-workflow-generation-settings.ts
- components/video/video-generation-workspace.tsx
- components/workspace/ugc-chat-workspace.tsx
- docs/explore-ui-review-2026-10-05.md
- lib/explore/imported-catalog.json
- lib/explore/launch-presets.ts
- lib/explore/workflow-generation-settings.ts
- scripts/explore-catalog-update.test.mjs
- scripts/explore-recreate-catalog-contract.test.mjs
- scripts/recreate-split-pane.test.mjs
- scripts/workflow-demo-audio-state.test.mjs
- scripts/workflow-generation-client.test.mjs
- app/api/audio/selection/route.ts
- app/api/audio/voices/[voiceId]/sample/route.ts
- components/audio/use-audio-voice-selection.ts
- components/explore/workflow-saved-audio-choices.tsx
- components/explore/workflow-saved-audio.module.css
- lib/audio/client.test.mjs
- lib/audio/client.ts
- lib/audio/library-query.test.ts
- lib/audio/library-query.ts
- lib/audio/selection.ts
- lib/audio/voice-sample.test.mjs
- lib/audio/voice-sample.ts
- supabase/migrations/20261005090038_audio_voice_selection.sql
- components/audio/audio-generation-workspace.tsx
- components/audio/use-audio-bookmarks.ts
- components/explore/use-local-workflow-media.ts
- components/explore/workflow-audio-reference.tsx
- docs/audio-ugc-native-plan.md
- lib/audio/api.test.mjs
- lib/audio/bookmarks-db.test.mjs
- lib/firebase/auth.ts
- scripts/workflow-composition-panel.test.mjs

The corrected schema-contract test and this report/JSON ledger are additional release-only paths. Deployment completion receipts and private operational baselines stay in ignored local audit folders.
