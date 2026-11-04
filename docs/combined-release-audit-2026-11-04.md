# Combined release audit — 4 November 2026

Status: **NOT DEPLOYED**. Source reviewed and non-build checks completed. Explicit production build authorization remains required by the user's global no-build rule; prior local development authorization does not authorize hosted production builds. No push, deployment, promotion, hosted setting change or paid generation performed.

## Complete proposed release

All intentional pending paths are included in the proposed release: Analytics contrast/TikTok logo, Geist italic preload, five compressed Explore covers, workflow/catalog/frame preloading, public frame-zero storage/read-only recovery, source-ingestion gates, raw influencer photo retention, slideshow face-swap steps, Talking Head full sources/transcript/script Remix/two preparation sections/source isolation, Hook lip-motion/Sound instructions, reference-view registries, worker image-response diagnostics, related scripts/tests and all documentation. This includes the payment-failure audit document that appeared during inspection; no application billing changes were found in this release.

Exact path inventory: `docs/combined-release-inventory-2026-11-04.json`. This is a worktree snapshot, not a commit or artifact fingerprint. Final staging must re-audit concurrent edits. No intentional git-visible path is excluded. No Git staging or commit performed yet.

Local excluded diagnostics: `.tmp/release-audit-20261104/` and `.tmp/release-vercel-audit.md`; they are ignored logs/inventory/tool diagnostics. Existing ignored environment files, credentials/CLI state, caches/build output, dependency trees, private plaintext media and screenshots remain excluded by existing .gitignore/.vercelignore. The secret-pattern scan of the original152paths found0candidate private keys/API tokens; it is a heuristic, not a guarantee. No secrets printed. Eleven added public assets total11,486,691bytes; largest5,520,595bytes. New cover filenames match their content-hash prefixes. Changed JSON documents parse.

## Findings and remaining limits

1. **P1 — Talking Head draft words are not review-gated before video generation.** `components/explore/talking-head-script-section.tsx` retains reviewed state for Remix; onChange passes only text, frame approval stores only preparation.script, and `lib/explore/talking-head-script-input.ts` validates text/audio/duration rather than review status. Direct generated speech can therefore consume unchecked transcript drafts. Independently confirmed in the current source; recorded earlier in `docs/talking-head-deployment-readiness-2026-11-04.md`. No silent protocol/product-policy change made here. All25transcripts remain draft/cross_checked_draft; no catalog-wide listening/boundary or generated-speech certification.
2. **P1 product limitation — literal first frame plus additional raw identity photos is unsupported by the current ReAPI route.** Selection is intentionally retained up to5; worker face-reference capacity is0 and pre-submit guards block before spending. This prevents silent photo loss/charges but can block video generation after normal frame/photo preparation. The original combined-reference capability is not delivered by passing tests. No provider/model switch authorized or made.
3. **P2 — Private slideshow late hydration failures remain a known open issue.** Progressive batches publish successfully, but a later account-level error can supersede already-ready gallery content. Earlier incident PRIVATE-SLIDESHOW-LATE-FAILURE is documented in the deep-loading audit. No runtime repair in this release audit; not claimed resolved.
4. **Existing lint gate repaired.** A pre-existing render-time `scheduleDraftRef.current=scheduleDraft` write was redundant: the sole schedule state setter already synchronously writes the ref before state/persistence. Removed that one render write; preserved all setter logic, UI and backend contracts. Removed an unused registry-test import. Expanded session recovery test had a stale harness missing the actual credit-policy module; imported that module without weakening assertions. These are the only application/test corrections made in this audit.
5. **Production acceptance remains partial.** No new authenticated full-release desktop/mobile screenshots, live image→approved frame→spoken video output, provider identity/lip-sync acceptance, browser-independent publishing, or production build/native trace checks. A build cannot establish those outcomes. The separate payment audit reports43/44billingchecks with one policy/fixture mismatch; billing source is unchanged here, and no successful live payment/credit activation is certified.
6. **Search Console Domain verification remains separate.** Existing HTML meta tag is live and correct; Domain verification requires the Google TXT token in Vercel DNS. No DNS mutation performed in this release audit, and deployment alone will not create the TXT record.

## Fresh verification

Logs under `.tmp/release-audit-20261104/`:

- `tests.log`:516/516changed application/API/component/import/recovery testsPASS,0skips.
- `tests-worker.log`:29/29current-source generation-provider/OpenRouter testsPASS,0skips.
- Python `scripts/prepare-talking-head-references.test.py`:3/3PASS.
- `tests-neighbor.log`:109/109neighbor analytics/theme/video API/ReAPI/session testsPASS. Exact CLI includes two nonexistent explicit paths; do not claim coverage for nonexistent workflow-session.test.ts or hook-starting-frame-video.test.ts. Actual session .mjs suite is covered below.
- `tests-repair-final.log`:46/46affected registry, actual-parent Schedule/Demo/audio, workflow session and recovery checksPASS. This group overlaps earlier tests; do not sum it into a unique aggregate.
- App and worker noEmit/nonincremental TypeScriptPASS. App rerun after runtime repairPASS (`types-app-final.log`).
- `lint-final.log`:all initially changed TS/TSX/MJS/CJS0errors/0warnings after repair. Added workflow-session-ui.test.mjs separately lintedPASS. Original error/warning log retained, not erased.
- Scoped/global `git diff --check`:PASS (Git line-ending notices only).
- Original152path changed-data/asset inventory and heuristic secret scanPASS. Reference stats registries deliberately remove unverified badge rows: Hook106→74, Slideshow86→28; source catalogs are separate. Existing/new registry testsPASS; no claim that dropped stats rows delete the underlying references.

Initial PowerShell sandbox browser launch failed in earlier Analytics QA and was successfully rerun elevated. In this release audit, two Python console summaries hit Windows cp1252 Unicode printing errors *after* their underlying commands ended; logs show test command exit0 and lint exit1 before repair. The JSON comparison initially hit cp1252 decode and was rerun with explicitUTF8. These reporting failures are not application test failures. One expanded session fixture initially failed (45/46); its final46/46pass is recorded above with the unchanged assertions.

## Cost guardian / release topology (PR guard)

- Existing linked project:ugc, teamugcpilot, production branchmain. Live website `vidmake.io` and legacy domains point to READY deploymentdpl_5V82CG82ghtbajsB26nQcuiAjD6W at GitSHA c6d474d3e63beb9212fed4ac68baeab8f606f237, matching currentHEAD.
- MCP projectugc-mcp serves `mcp.getugcpilot.com`, READY at the sameSHA. It shares the Next repository; release it consistently if shared code/runtime artifacts require it.
- Sibling trending-release-web-3f35202 has canceled production/preview targets. Preserve it; do not change triggers/settings merely to reduce fanout. API inventory had5projects, no pagination;3matched the release/repository filter. Saved sanitized read-only GET result:vercel-topology.json.
- `worker/src/lib/generation-provider.ts` and `openrouter-gemini-image.ts` change worker runtime. Website-only deployment is insufficient for the complete release; deploy a matching generation-worker revision, retain old revision for rollback. No evidence calls for replacing render/publish/Carousel services or altering their settings.
- No pending package/lockfile/Next/Vercel/CI build-trigger changes. Existing Vercel install command installs root and worker; existing build command uses Next webpack. Static cost scan flags validation/install signals as hypotheses only. No7/30daybilling/cpu/cache history measured; buildCPUminutes, bill and forecastUSD areUNKNOWN. Do not claim savings or launch duplicate manual+Git builds.
- Proposed order after authorization: freeze complete reviewed source; build/test required deploy artifacts once; deploy matching generation worker candidate and verify identity/readiness; deploy website/MCP as required, confirm exactSHA/domains and perform production read-only/authenticated acceptance. Rollback website first if jobs require newer worker compatibility; retain historical provider receipts, never replay paid jobs.

## Audit edits / sources / protected behavior

Audit edits: `components/explore/hook-workflow-preview.tsx` (one redundant line removed); `scripts/slideshow-reference-views.test.mjs` (unused import); `scripts/workflow-session-ui.test.mjs` (actual credit-policy fixture); append-only `docs/ai-context/clear.md`; this report; full release manifest. All other pending changes pre-existed this audit and are included, not reverted.

Sources: suppliedAGENTS rules, context-memory/immutable-contracts/UI-clarity/regression-gate skills read earlier and retained, vercel-cost-guardian full skill/data-collection guidance and static audit, scheduling skill/contract, current source/callers/tests, source JSON/assets and individual task receipts, especially Talking Head readiness/HOLD reports. Relevant Explore/incident/nonnegotiable sections from current session were consulted; huge historical output was truncated earlier, so no claim of a complete fresh history read. Full prompt/frame skills and full-video source review were not rerun because this audit does not author new motion prompts or certify video fidelity.

VERIFIED locally: owner/source-scoped script recovery, unchanged null-vs-zero/newest-first analytics behavior, draft/media/result isolation, exact selected recovery, synchronous schedule-draft setter behavior, protected Demo/audio state, no geometry/control changes from the audit repair. NOT TESTED freshly: complete released UI/production integration and actual media fidelity. No schedule/backend/prompt change made by the audit repair. IncidentUGC-QA-20261104-RELEASE-RENDER-REF is locally verified; original Talking Head/provider/corpus incidents remainOPEN. No unconditional release sign-off.

## Production authorization received

4November2026: user explicitly answered yes/approve to production builds and deployment of this entire audited release with the disclosed Talking Head limitations. This supersedes the pending-authorization status above for this release only. It does not authorize unrelated production settings, DNS changes, provider migration, paid media smoke generation or destructive cleanup. Freeze all reviewed paths; build/release matching generation worker and web/MCP targets, then record exact source/artifact/revision evidence. Retain rollback targets noted above.
