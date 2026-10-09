# Existing video sources in Explore

Workflows 1 (Create a Hook) and 3 (Creator Shows App on Phone) share a source section at the top of Create. Generate is the default; Upload and Creative Assets let the user reuse an existing opening segment and Continue to edit without calling video generation.

Generation fields stay mounted while hidden, preserving instructions, references and settings. Upload and Creative Assets retain independent selections while the user switches modes. Changing the active source invalidates an export for different inputs through the existing finishing signature. Edit video shows the selected opening segment and offers Change video to return to Create; optional demo, music, subtitles and scheduling retain their existing finishing flow.

Live uploads use the existing authenticated media upload/completion endpoints with project `explore-source`. MP4, MOV and WebM files up to 250 MiB and 120 seconds are accepted. No generation provider or generation credit reservation runs when choosing a source. Layout preview (`preview=1` in development) remains browser-only; it cannot upload to storage, render or schedule. Creative Assets requires the signed-in account in the live workflow.

Creative Assets selection uses the existing owner-scoped `/api/media` list, including ready video MIME assets in both `video` and legacy `influencer` collections. Existing library visibility filtering is retained by that endpoint. Finishing reservations and worker lookups independently enforce ownership, ready status, absence of deletion and video MIME. The migration `20261007132823_explore_existing_video_sources.sql` patches only source eligibility in the current reservation RPC, preserving durable request replay, subtitle validation and service-only grants.

Release requires deploying the app and worker and applying that migration. Existing `EXPLORE_FINISHING_ENABLED` and catalogue gates are unchanged. Generation in these pages remains a preview. Existing phone footage is used as supplied; this change does not replace an app screen inside an already filmed phone.

Validation:

```powershell
node node_modules/typescript/bin/tsc --noEmit
npm run worker:build
node --experimental-transform-types --test scripts/workflow-source-video.test.mjs scripts/workflow-source-video-ui.test.mjs scripts/workflow-creation-form.test.mjs scripts/workflow-finishing-ui.test.mjs scripts/workflow-finishing-api.test.mjs scripts/workflow-finishing-store.test.mjs scripts/explore-finishing-job.test.mjs scripts/explore-finishing-receipts-db.test.mjs scripts/explore-media-upload.test.mjs scripts/explore-finishing-storage.test.mjs scripts/explore-video-finishing.test.mjs
```

Local browser acceptance covers existing-clip upload → Workspace preview → Continue to edit → original opening segment, returning to Generate with the prompt preserved, the Creative Assets sign-in state and mobile layout without horizontal overflow. Production acceptance requires the deployed, authenticated workflow and real owned assets on `https://www.getugcpilot.com`.

The focused validation above passes 119 tests. The older `hook-workflow-preview`, `phone-workflow-preview` and `workflow-sections` suites also contain pre-existing stale assertions about catalogue gates, demo audio behavior, platform visibility and local-preview footer wording. They are not the acceptance tests for the new authenticated source flow; their outdated expectations remain to be reconciled separately.
