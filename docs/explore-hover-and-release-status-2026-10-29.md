# Explore hover fix and release checkpoint — 29 October 2026

## Hover finding and local change

UGC-UI-066: landing workflow and AI-character cards already call useCoverPlayback with warmCover=true. That branch requested metadata only, and pointerleave/blur discarded src and called load. The next hover therefore could need media again. No arbitrary250ms delay was present on these landing cards; that delay belongs to reference galleries and is preserved.

Visible landing covers now set preload=auto (metadata only when navigator.connection.saveData is true). Pointerleave/blur pauses without discarding the buffer. Hover/focus attempts play synchronously without a timer. Offscreen, page-hidden, reduced-motion and unmount states still pause and release media. Touch does not start hover playback. Source changes clean up the old video. The card layout, links, posters, gallery lazy loading and gallery private-media policy are unchanged. A cold network request/decoder can still delay the first decoded frame; do not promise literal zero latency.

Files: components/explore/use-cover-playback.ts; scripts/reference-cover-playback.test.mjs; append-only docs/ai-context/clear.md; EXPLORE_CONTEXT.md; this receipt. No new dependency, global CSS or permanent control.

Verification:10/10 playback/private-preview tests PASS, including repeated hover with one source assignment/no reset, immediate play attempt, offscreen/reduced-motion/hidden cleanup, touch, keyboard focus and save-data. Scoped lint/typecheck recorded under .tmp/cover-hover-{tests,lint,types}.log. Browser visual/perceived latency and authenticated live acceptance NOT VERIFIED. No layout changes.

## Combined release validation

Before the additional hover patch:645application tests and118worker/provider tests PASS; worker TypeScript build PASS; scoped application lint PASS. The separate stale caption-heading assertion was reconciled with actual shared PostCaptionField accessible labeling:7/7PASS. A full production UGC webpack build PASS, including native Hook decoder isolated trace checks. This is the main project build; no separate MCP build/deployment occurred.

The first production build rejected one invalid Windows-1252 punctuation byte in components/explore/hook-starting-frame-workspace.tsx. Normalized that byte only to UTF-8; all release text paths were scanned.58starting-frame UI tests PASS again. UGC-OPS-018-ENCODING records this verified build failure. Full build then passed. After the hover patch a final main-project build is running separately; do not treat the earlier passing build as its result.

Complete intended release includes the direct compact-frame picker, account avatars, compact schedule confirmation, tab independence, source-aware Hook duration, Nano Banana2.1 model/worker binding, editable starting-image prompt and saved browser default, editor/schedule read/save recovery, Talking Head Sound placement, selected audio names and approved image+voice reference mode. All intentional tracked/untracked source, tests and receipts must be included. No migration/config/package/lockfile/CI diff. No live media generation, real schedule or publication was submitted.

## Deployment checkpoint — NOT DEPLOYED

Remote main and current production website/worker baseline remain ecba34d05f34d27389475ad0738724870f893880. Website project ugc, prj_mVOxt7AUko5egMAESaxjGyC60Kvu, baseline dpl_8aoX6pqU2qz11pXChetgoznYCVx1. Six existing services and two jobs are on image sha256:0a0681e8d51ab5d76c8329742fd2e9ae4184e5d52c1a5b565b421ca472094d2d. Read-only baselines recorded in .tmp/release-20261029-followup-ugc/. No worker/cloud or Vercel settings changed, no commit pushed. MCP read-only check confirmed no Git repository link; main-project-only release helper excludes MCP. No canary or unrelated service is a target.

Automatic approval review failed on a read-only process-status check because the approval service reported an account usage limit. The action was not executed. This was review-service failure, not a determination of unsafe action. Do not bypass the failed review by routing deployment through another tool. Deployment needs approval service availability restored. No live change was made.

Prepared rollout order remains: finish final local build/gates; freeze complete reviewed release commit; build exact committed worker source through existing Cloud Build; update two existing jobs without executing them, then six services preserving configuration and verify exact digest/source/readiness/traffic; push complete commit to main; adopt matching Git website deployment when available, otherwise stage one UGC production deployment; promote after all worker targets pass; verify real production aliases, version and public/auth boundaries. User explicitly excludes MCP. No migrations are needed.

Excluded from release: existing ignored .env/secrets, .tools credential/cache content, .tmp logs/generated evidence, .next output, node_modules, worker/dist, .vercel local metadata and private plaintext files already ignored. No intentional source feature is silently excluded. Exact public-path inventory is generated locally; secrets are not enumerated or printed.

Final hover-build outcome: FAILED from Windows sandbox EPERM creating `.next/server/app/api/internal/jobs/prepare-wall-text`. This is not a passing final release build. The earlier outside-sandbox main build passed before the hover change. No further elevated build/deployment was attempted after approval-service failure. Local hover tests/typecheck/lint PASS; browser latency acceptance remains NOT VERIFIED.

Current risks: final outside-sandbox hover build/browser acceptance pending; authenticated live editing, actual generated identity/voice/lip-sync/ending fidelity and real publishing remain unverified. New stored prompt default is browser-local only. Save/recovery tests do not prove elimination of production slow requests.
