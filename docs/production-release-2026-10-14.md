# Complete production release, 14 October 2026

The user authorized deploying all current changes and making them active. This release includes every intentional source, configuration, script, test, font and documentation change in the current worktree. Generated local QA artifacts and private/local configuration are listed in `production-release-excluded-paths-2026-10-14.md`; no intentional product fix is deferred.

## Product changes

- Talking Head + Demo actions use compact widths. Caption corrections open in a centered dialog with the actual sequence preview and timestamped words.
- All eight subtitle previews follow their export layouts, fonts and animations. Serif black box remains one line. Orange plus/minus controls make the appearance section discoverable and allow collapse beside Play example. Explanatory paragraphs are removed. Quiet polling preserves the caption button and card geometry during generation.
- Background music has an approved shared catalogue, preview/search/selection, and the existing owned audio attachment path.
- Explore demo selections and uploads use the dedicated Demo inventory. Saved Explore demo drafts reopen from the Demo screen. Existing original editors remain accessible.
- Reference uploads display their actual duration and consistent controls for multiple images. Upload recovery and saved source behavior are included.
- Remix Text reports real provider/storage readiness and has simpler copy. The website release activates `EXPLORE_TEXT_REMIX_ENABLED=true` and explicitly selects the verified `gpt-5.6-luna` model.
- All current navigation, pricing, tests and audit documentation are included. The isolated Business candidate on another branch is outside this worktree; persisted MCP experimental gates remain unchanged.

## Reviewed runtime activation

The two Vercel projects are `ugc` (`prj_mVOxt7AUko5egMAESaxjGyC60Kvu`) and `ugc-mcp` (`prj_IU0eCl6JEnHt2mMaEV0g2Ej1NMYU`). Production deployments must use the complete release commit.

The immutable worker image must carry that commit in `WORKER_BUILD_GIT_COMMIT`, OCI revision metadata and runtime `WORKER_GIT_COMMIT`. Deploy it to both `ugc-video-render-worker` and `ugc-video-render-job` in project `ugcsaas`, region `us-central1`.

Activate the existing opt-in interactive Explore receiver with one minimum instance, one maximum instance, concurrency one, request timeout 900 seconds, `WORKER_JOB_TYPES=render_demo_video` and `WORKER_EXPLORE_FINISH_ONLY=true`. Preserve internal ingress, scheduler-only invocation, CPU throttling, resource limits and every existing secret binding. Other render types retain the one-shot Job and app launcher. Configure `GCP_EXPLORE_FINISH_TASK_URL=https://ugc-video-render-worker-ano542ohmq-uc.a.run.app/tasks/jobs` on both Vercel projects after the receiver is healthy.

One warm 2 CPU / 4 GiB instance adds approximately $38.88/month in gross idle charges before free-tier allowances. Earlier real caption requests spent about 119 seconds awaiting Job startup and 12 seconds processing. Warm activation addresses startup; transcription and export processing still take time.

Apply narrowly scoped Cloud Run updates because the ignored Terraform variables contain a stale image, SHA and job-type list. Reconcile the local Terraform variables with the verified production profile after rollout; do not apply unrelated stale values.

## Validation and acceptance

Explore suite: 953 passed. The initial sandbox-only temporary file rename failure was eliminated by rerunning the same suite outside the Windows sandbox. Additional modified API/source and subtitle playback tests: 22 passed. Web TypeScript and scoped ESLint passed with one existing unused-variable warning. The worker suite and its Edit export follow-up passed. Production receipt table and claim RPC exist. The configured OpenAI credential can read `gpt-5.6-luna` (HTTP 200); no paid generation was submitted.

The complete webpack production build passed, including TypeScript, all 160 prerendered pages and build traces. The complete MCP suite passed. Worker regressions passed 313 tests plus 15 Edit export tests. Terraform validation passed. Prior actual-React desktop/mobile caption, polling, collapse and all-eight-style browser checks passed; the real render parity audit is detailed in the subtitle analysis.

Immutable image, deployment IDs, final remote commit and authenticated production acceptance are recorded in the local release receipt after execution. Existing rollback service/job specifications are retained in ignored local release evidence. Rollback restores the previous image and disables the new dispatch URL before restoring the prior Vercel deployments.
