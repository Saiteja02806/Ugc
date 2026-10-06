# Release preflight — 2026-10-06

This release includes every intentional change in the isolated checkout on top of `9927b52dfaac277551370680d0d20baa74996d27`. Previously shipped Trending, Audio, AI character, Wall of Text and Explore changes remain included in the ancestor commits.

## User-visible changes

- Demo controls in Create Hook and Creator Shows App on Phone: fixed crop and smoothly recorded movement with matching live preview and export, Save/Cancel/Reset, replacement cleanup and legacy-draft compatibility.
- Right-aligned compact outlined controls button with a controls icon, truncating filename, saved indicator and accessible reset. Laptop/mobile footer layouts and touch emulation pass.
- Demo audio is explicitly optional in both workflows; original demo sound is preserved when no added audio is selected.

## Media correctness and safety

- Legacy combined exports save measured duration, dimensions and byte size in both owning records.
- Private-media reads validate ownership, readiness and deletion; queued references remain canonical and temporary playback URLs are resolved when needed.
- Upload confirmation uses the reservation's recorded bucket. Public asset/catalog behavior and existing private Audio behavior remain unchanged.
- Private migration tools are shipped for inspection or explicit verified copies. `PRIVATE_USER_MEDIA_ENABLED` remains absent/off; no bucket activation, IAM change, row switch, source deletion or migration is part of this deployment.
- The previously completed metadata backfill is not rerun.

## Validation

- Optimized Next.js build and worker TypeScript build pass.
- 400 Explore, 110 media/Audio and 103 worker checks pass; the full MCP suite passes.
- Scoped ESLint: zero errors, two existing unused-variable warnings. `git diff --check` passes.
- Both workflow browser flows pass Save, Cancel, Reset, playback/recording, replacement/removal, Escape cleanup and paused-preview checks without page errors. Footer alignment passes at 1366px, 1024px and 390px; touch emulation passes.
- Signed-in production rendering/storage and physical-device acceptance remain pending at the user's instruction. Verification performs no paid generation or post publishing.

## Deployment and rollback

Build an immutable worker image from the committed source with the matching build SHA. Verify each no-traffic revision's startup identity before routing traffic, and update the render job without executing it. Preserve all other environment, capacity, networking and IAM settings. Enable the additive Demo controls flag only after workers are ready, then deploy the website and the separate MCP service from the same reviewed commit. Verify real production domains, aliases, commit identity, public pages, authentication guards and configuration preservation. The release receipt records previous deployment IDs, worker revisions, digests and final checks for rollback.

## Excluded local paths

The desktop source checkout contains prior drafts and generated artifacts already reconciled by the previous release ledgers. Its `.env*`, `.tmp/**`, `node_modules/**`, `.next/**`, `.trigger/**`, build output and Git metadata are not release source. Credentials and expanded private cloud baselines remain local. The earlier paid-provider experiment `index.ts` and redundant old Gemini migration alias remain explicitly deferred under those ledgers. Approved workflow cover videos are retained as previously deployed. No new visual/video experiment is included.

## Complete pending path inventory

The following 68 paths plus this preflight document form the release; none is excluded because of its size or feature area.

- `app/api/edit/render/route.ts`
- `app/api/edit/videos/[sourceVideoId]/route.ts`
- `app/api/edit/videos/route.ts`
- `app/api/media/complete-upload/route.ts`
- `app/api/media/create-upload-url/route.ts`
- `app/api/schedules/[scheduleId]/render/route.ts`
- `app/explore/create-hook/page.tsx`
- `app/explore/creator-phone/page.tsx`
- `components/explore/hook-workflow-preview.tsx`
- `components/explore/phone-workflow-preview.tsx`
- `components/explore/use-workflow-finishing.ts`
- `components/explore/workflow-composition-panel.tsx`
- `components/explore/workflow-edit-workspace.tsx`
- `components/explore/workflow-finishing-boundary.tsx`
- `lib/ai-studio/image-generation-api.ts`
- `lib/ai-studio/video-generation-api.ts`
- `lib/explore/workflow-finishing-api.ts`
- `lib/explore/workflow-finishing-client.ts`
- `lib/mcp/generation-tools.ts`
- `lib/mcp/mutation-tools.ts`
- `lib/mcp/read-tools.ts`
- `lib/mcp/upload-store.ts`
- `lib/media/media-storage.ts`
- `scripts/explore-demo-upload.test.mjs`
- `scripts/explore-finishing-job.test.mjs`
- `scripts/explore-finishing-storage.test.mjs`
- `scripts/hook-workflow-preview.test.mjs`
- `scripts/phone-workflow-preview.test.mjs`
- `scripts/workflow-composition-panel.test.mjs`
- `scripts/workflow-demo-audio-state.test.mjs`
- `scripts/workflow-finishing-api.test.mjs`
- `scripts/workflow-finishing-ui.test.mjs`
- `scripts/workflow-sections.test.mjs`
- `worker/src/jobs/finish-explore-video.ts`
- `worker/src/jobs/generate-hook-video.ts`
- `worker/src/jobs/generate-image.ts`
- `worker/src/jobs/publish-social-post.test.ts`
- `worker/src/jobs/publish-social-post.ts`
- `worker/src/jobs/render-schedule-combination.test.ts`
- `worker/src/jobs/render-schedule-combination.ts`
- `worker/src/lib/explore-finishing-contract.ts`
- `worker/src/lib/explore-finishing-storage.ts`
- `worker/src/lib/explore-video-composition.ts`
- `worker/src/lib/render-engine.ts`
- `worker/src/lib/supabase.ts`
- `app/api/media/delivery/[assetId]/route.ts`
- `components/explore/demo-framing-recording.ts`
- `components/explore/workflow-demo-controls.tsx`
- `docs/demo-controls-2026-10-06.md`
- `docs/media-safety-fixes-2026-10-06.md`
- `lib/edit/private-video-delivery.test.mjs`
- `lib/edit/private-video-delivery.ts`
- `lib/media/media-delivery.test.ts`
- `lib/media/media-delivery.ts`
- `lib/media/media-reference.ts`
- `lib/media/private-media-boundaries.test.mjs`
- `lib/media/private-media-storage.test.mjs`
- `lib/media/private-media-storage.ts`
- `scripts/backfill-render-media-metadata.mjs`
- `scripts/demo-framing-editor.test.mjs`
- `scripts/demo-framing-render.test.mjs`
- `scripts/demo-framing.test.mjs`
- `scripts/media-maintenance-core.mjs`
- `scripts/media-maintenance-core.test.mjs`
- `scripts/media-maintenance-runtime.mjs`
- `scripts/migrate-user-media-to-private-gcs.mjs`
- `worker/src/lib/private-media.test.ts`
- `worker/src/lib/private-media.ts`
