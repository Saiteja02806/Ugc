# Talking Head audit fixes — 27 October 2026

Status: fixes verified locally; staged hosted build and all14 reference MP4 hashes PASS. Live switch and authenticated acceptance recorded separately below.

## Scope implemented

UGC-OPS-008: bound both authentication waits and generation-start response/body to30seconds. Release submitting state on timeout, retain exact request body/key/durable receipt, and give recovery instructions. No automatic generation resubmission. Late replies cannot acknowledge or replace the saved receipt. This does not limit background generation job runtime.

UGC-UI-017: derive caption-preview identity from clip timing/audio, excluding overlay text/color/placement/typography. Visual edits retain word corrections and caption evidence. Trim/audio changes still invalidate them. Final export receives the complete visual composition.

Primary runtime files changed: `lib/explore/workflow-generation-client.ts`, `components/explore/workflow-finishing-boundary.tsx`. Tests: `scripts/workflow-generation-client.test.mjs`, `scripts/workflow-generation-recovery.test.mjs`, `scripts/workflow-finishing-ui.test.mjs`. Documentation: this receipt, append-only `docs/ai-context/clear.md`, and `EXPLORE_CONTEXT.md`. Unrelated user changes preserved.

## Verification

- Focused actual client/controller/finishing boundary tests118/118 PASS on primary and exact isolated release source. Includes stalled response/body, both auth deadlines, late acknowledgements, immutable retry identity, durable receipt preservation and GET recovery without another generation POST, visual correction retention and trim/audio invalidation.
- Primary TypeScript and scoped ESLint PASS. Isolated source initially lacked generated Next types; `next typegen` then TypeScript PASS. Isolated runtime ESLint PASS.
- `npm run test:explore`: worker build PASS;1289/1291tests PASS. Two catalogue assertions fail because separate primary-only Wall additions introduce six references omitted from old expectations (130versus124; six new badges versus zero). Both exact tests PASS on isolated release source2/2. Those unrelated files were not changed by this fix; broad primary suite is not fully green.
- Hosted staged build PASS, including TypeScript/static pages/native route bundle checks. Staged with skip-domain as dpl_8BRwiJK2Kanr75D6CGPLEgqqADX2, https://ugc-i4jx4x4pa-ugcpilot.vercel.app.
- All62files from previous reference-release manifest remain hash-identical. All14 staged MP4 downloads match prepared SHA256/bytes. Eleven new references and three full replacements retained.
- Evidence: `.tmp/talking-head-additions-20261026/fix-{focused-tests,release-focused,explore-tests,release-catalog-check,build,staged-verification}.log`, `fix-staged-verified.json`. Pre-fix runtime copies: `flow-fix-baseline/` within that evidence directory. Exact isolated source: `.tmp/talking-head-live-release-20261027`, now with this two-file runtime patch.

## Protected contracts and limits

VERIFIED through scoped diffs/tests: unchanged JSX/layout/controls; final visual composition retained; ownership checks, source/identity/prompt inputs, quantity, request keys, pending receipts and no automatic paid retry. Scheduling code unchanged in isolated patch; existing focused tests cover receipt recovery and stale requests.

NOT VERIFIED: fresh signed-in production Generate → Demo → captions → render → schedule/provider journey, generated pixel fidelity, real provider publication, desktop/mobile screenshot acceptance for these fixes. No paid generation, transcription or social publishing triggered. Fixtures/build do not establish production end-to-end success.

Applied mandatory context-memory/immutable-contracts/UI-clarity/regression-gate procedures; those skill files and video-prompt routing guidance read. Reviewed root AGENTS.md, nonnegotiables, relevant Explore/history sections and audit reports. Retain prior receipt's limitation: large historical context output was partially truncated; no claim that every historical paragraph was re-read. Preflight script PASS (readability discovery only). Installed Next16.4.2 use-client guide read. No prompt/frame/model changes.

Rollback: preceding deployment dpl_B6HT7nNDKy5HXq6ETmk7gY48Fnno. No schema/worker/dependency/IAM/environment/scheduling rollout. Source-based deployment; no Git push claimed. All unrelated worktree changes excluded from this targeted fix release, including marketing, Hook optional face-photo changes, Wall references, scheduling and migrations; no user work reverted.


## Live release readback

Promoted dpl_8BRwiJK2Kanr75D6CGPLEgqqADX2 to getugcpilot.com. Live-domain inspection confirms exact deployment ID and READY. Previous live identity checked immediately before promotion to avoid replacing newer work. Runtime baseline/deployed hashes saved in `docs/talking-head-audit-fixes-manifest-2026-10-27.json` (additional documentation file changed).

Local headless reference browser check did not complete after more than five minutes, with no new screenshot/playback report. Stopped only its verified Node process and eight total own processes/descendants. It is NOT PASSED. Old October17 screenshots/playback report are not evidence for this release. Full signed-in browser acceptance remains NOT VERIFIED. No user browser session changed by this test.


Final live media verification:14/14MP4 SHA256/byte counts PASS. First batch completed13with posters/ranges but the49MB studyfetchlauren full-body urllib read timed out. Independent bounded curl download then returned the exact49,125,562bytes/SHA256; its streaming request returned206and1024bytes with correct full Content-Range. Original timeout log retained, not overwritten. Combined evidence:`fix-live-combined-verification.json`. This establishes live file integrity/streaming, not signed-in UI playback or a fresh generated export.
