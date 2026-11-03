# AI character reliability: implementation and verification receipt

Date: 3 November 2026, Asia/Kolkata. Status: **implemented in the worktree; real backend integration verified; deployment acceptance incomplete**.

The fragile catalog preparation path is replaced, the default Node UUID admission crash is fixed, and a real Full image now shows the character's head and both feet. The existing UI is unchanged. This patch has **not been pushed or deployed**. The complete production build currently fails an existing Hook public-asset tracing guard after compilation, typechecking and prerendering succeed; its relationship to the unmodified baseline has not been established.

## Scope contract and implementation

The requested boundary is reliable character preparation/admission with the same dock, controls, layout, existing personal-photo upload, selected reference order, model, credits and worker behavior. No dependency, migration, cloud/IAM setting, global style or worker runtime change was made by this task. Concurrent billing, Hook, pricing, trait-registry and cover work was preserved.

1. Catalog selections use authenticated `POST /api/characters/studio-references` with registered trait IDs only. The owner comes from verified Firebase authentication. Invalid IDs, client-supplied owners, duplicate IDs, non-image choices, oversized batches and insufficient credit access fail before preparation.
2. The server validates source hashes, encodes JPEGs within 1280 pixels, prepares at most three images concurrently and returns IDs in the original reference-role order. Catalog GET retries are bounded; response bodies and database/storage acknowledgement waits have deadlines. The browser no longer downloads/reencodes/reuploads every stock reference before admission.
3. Owner plus source version determines immutable object/asset IDs. Completed preparations survive refresh and fresh server instances. Create-only storage, exact byte verification and owned database receipt recovery cover concurrent requests and lost acknowledgements. No generic retry was added to paid submission.
4. Default admission previously called `(dependencies.createId ?? crypto.randomUUID)()`. The complete browser test using actual admission exposed `ERR_INVALID_THIS` on Node 24.13.1. Calling `crypto.randomUUID()` with its receiver fixes this independently reproduced blocker. Existing injected-ID tests had missed it.
5. Two completed live images failed the requested Full composition. The compiler still included studio-portrait language and a foreground chair instruction. New Full prompts now ask for a wide head-to-feet photograph, visible floor and the chair to the side. Half keeps its previous composition text. Historical requests remain frozen. A third real output passes the head-to-feet review; this is one successful visual sample, not a promise that every model result will match every trait.

The original screenshot's exact browser transport trigger is still **UNKNOWN**. Earlier evidence established a pre-admission failure with four ready references and no generation job. The newly reproduced UUID failure is a second blocker; it is not retroactively attributed to that screenshot. See `docs/character-fetch-deep-investigation-2026-11-03.md` for the preceding read-only investigation.

## Real backend evidence

The connected UGC Pilot profile independently returned owner `oPQhLloYHKQFCysJ4cznV2dv8v02`. The test used the same character compiler, ordered references, atomic reservation service and deployed production AI worker. It was run from here, without Chrome generation or a substitute image-generation service.

The local integration harness supplied the already-authorized gcloud credential in memory through a matching GCS SDK auth adapter and Cloud Tasks transport. It used real database functions, real GCS objects, the real queue, deployed worker and OpenRouter provider. It did **not** exercise a signed-in hosted browser or the new hosted route's deployed credential configuration.

- Eight references for Extreme / Bedroom / Middle Eastern / Vibrant Open / Natural Casual / neck / height / headphones became owned READY assets and decodable GCS JPEGs. The first successful server preparation took 10.356 seconds in this run. Fresh-instance reuse took 0.829–0.869 seconds in subsequent runs and performed no catalog fetch/upload. These are observations, not a production performance guarantee.
- All three jobs completed with `attempt_count=0`, exactly one persisted `openrouter-image` provider operation each, and exactly one committed 1-credit reservation each. Total charge: **3 credits**, observed balance 719 → 716. Failed visual samples were preserved truthfully.
- Each output downloaded as real image bytes, saved through the actual character identity service and appeared as saved in durable character history. The final image is 720×1280 and was visually inspected: full head, both legs and both shoes visible; chair beside the subject.

| Job | Result | Visual Full check | Created → completed (UTC) |
| --- | --- | --- | --- |
| `f168e403-5bae-47b5-8e15-1b35390e55a0` | Completed / saved / downloaded | FAILED: feet cropped, chair obscures body | 13:36:07 → 13:36:52 |
| `cefc175f-71f5-4378-8b65-f9d50b0be267` | Completed / saved / downloaded | FAILED: added final instruction insufficient | 13:42:32 → 13:43:07 |
| `951eebe0-8312-4e17-91d4-9420e9c84397` | Completed / saved / downloaded | VERIFIED: revised compiler, head to feet visible | 13:47:58 → 13:48:35 |

Final asset: `cf1fe19d-3bf6-46ad-8dca-607389516d9c`. Final image: `.tmp/character-workflow/live-composition/extreme-fullbody.png`. The output has PNG bytes; the integration's initial `.jpg` filename is retained as historical evidence, with a `.png` delivery copy.

## Tests and protected behaviors

| Check | Result / evidence |
| --- | --- |
| `python tools/preflight.py --repo . --task ...` | PASS: required paths discoverable/readable. The script does not replace reading the sources. |
| Character library plus current builder/session/studio suites | **185/185 PASS**. Includes default real Crypto, preparation failures, source hashes, ownership, malformed receipts, stalls, bounded concurrency, races and recovery. Log: `.tmp/character-workflow/final-character-tests.log`. |
| Real workspace/browser fixture | PASS: injected build-image failure reserves zero credits; six completed refs survive refresh; retry finishes eight total uploads and one admission. A transient status 503 recovers. Save, Download and saved History selection after reload pass. Real UI/API/preparer/admission/builder/identity code; controlled auth/stores/queue/provider. Zero page errors. |
| Desktop/mobile UI | **VERIFIED unchanged**: current selected empty state is pixel-identical to the `b09e721f` workspace at 1440×1000 and 390×844; zero changed image channels. Result views have no horizontal overflow. Styles and JSX were not edited. |
| Existing Full/Half controls and trait order | VERIFIED by actual browser admission and compiler tests. Half prompt retains previous composition; Full framing alone receives the documented correction. |
| Keep hairstyle/head shape/hair color and color tiles | VERIFIED by current registry/studio regressions; retained from earlier work. No new UI edits in this reliability patch. |
| Personal photo upload | Source path retained unchanged. Shared reference/upload tests in `npm test` pass. New signed-in hosted personal-photo flow **NOT TESTED**. |
| Uncertain paid submission / duplicate admission | VERIFIED by existing builder/session/generation regressions; same request keys retained. No paid POST auto-retry introduced. Live ledger shows one charge per test job. |
| Worker | `npm run worker:build` PASS; character and general image-worker tests **42/42 PASS**. Worker runtime unchanged; only stale mock export repaired. |
| Main repository tests | `npm test` PASS, including **663 main tests** and the required pretest suites. Run before final Full compiler correction; the final character suite subsequently verifies that correction. |
| Types / lint / whitespace | Final `npx tsc --noEmit --incremental false` PASS. Scoped ESLint: zero errors, one existing unused `authLoading` warning. Targeted `git diff --check` PASS. |
| Compiled route / auth | Actual `next start` production build responds **401 / no-store** for both missing and invalid login tokens. No writes occurred. Sharp native executable is present in the route's trace. Local startup checks required matching sandbox permissions for loopback networking; initial connection errors were test environment restrictions. |
| Production build | Next compilation PASS (2.6 minutes), TypeScript PASS, 373 static pages generated; new route included. **Overall `npm run build` FAILED** in mandatory postbuild Hook public-asset trace guard. No guard was bypassed. |
| Legacy old-composer tests | Wider `components/characters/*.test.mjs`: 52 pass / 18 fail before final new Full assertion. The 18 failures are in obsolete composer harness imports. Running those tests against the original `b09e721f` workspace reproduces the same 18 failures (`Unexpected import @/lib/ai-studio/reference-media-upload`). Kept visible; not rewritten or deleted. |
| Hook / Slideshow / Schedule / publishing | Shared static/behavioral regressions in `npm test` PASS. Fresh authenticated cross-tab navigation, publication and provider delivery for those unrelated features **NOT TESTED**. No edits to those flows by this task. |
| Signed-in hosted new character endpoint | **NOT VERIFIED**: patch not deployed; available production browser was signed out. Real backend proof and controlled browser proof are distinct. |

The build guard currently rejects `public/explore/covers/sources/product-demo-source.mp4` from the `api/explore/hook-keyframe` trace. This file is tracked. Concurrent Hook changes exist, but exact causal attribution is unproven. Changing the guard, Next tracing configuration, or Hook architecture would exceed this character patch. Release remains blocked until the complete guard passes.

## Files changed by this implementation

Only these implementation changes belong to this task; other dirty files are concurrent work.

- `app/api/characters/studio-references/route.ts`: Node route and bounded execution window.
- `components/characters/character-workspace.tsx`: replace stock reference relay with batch preparation; JSX/styles and personal upload preserved.
- `components/characters/influencer-studio.test.mjs`: Full/Half conflict regression.
- `lib/characters/studio-preparation.ts`, `studio-preparation-api.ts`, `studio-preparation-client.ts`: immutable server preparation, authenticated handler and bounded client.
- `lib/characters/studio-preparation.test.mjs`, `studio-preparation-api.test.mjs`, `studio-preparation-client.test.mjs`: preparation/API/client regressions.
- `lib/characters/studio-image-fingerprints.json`: source content versions for 132 catalog files.
- `scripts/character-catalog-fingerprints.mjs`: refresh manifest after catalog image changes.
- `scripts/character-workflow.browser.mjs`: actual workflow browser harness, failure/reload/status/save/download/history checks and before/after captures.
- `lib/characters/generation-service.ts`, `generation.test.mjs`: UUID receiver fix and real-default regression.
- `lib/characters/master-prompt-compiler.ts`: Full-only conflict removal and wide framing.
- `lib/characters/studio-references.test.mjs`: additional Full/Half assertions only; concurrent trait tests preserved. `studio-references.ts` has no final implementation change from this task.
- `lib/characters/explore-release.test.mjs`: align stale legacy-host redirect test with existing 308 migration and verify destination; runtime proxy unchanged.
- `worker/src/jobs/generate-character-image.test.mjs`: supply existing `assertImageOutputAspectRatio` export in old mock; runtime worker unchanged.
- `EXPLORE_CONTEXT.md`, `docs/ai-context/clear.md`: append-only decisions/evidence/incidents.
- This report. The preceding investigation report is also an intentional task artifact.

Ignored `.tmp/character-workflow/` contains tests/logs, screenshots, three persisted live request receipts, downloaded provider source, ledger proof and local integration harnesses. It contains no printed or persisted access tokens. No generated test media was added to `public`.

## Preflight sources, incidents and rollback boundary

Actually read: root `AGENTS.md`, `docs/ai-context/nonnegotiables.md`, relevant Explore/ledger entries and architecture/callers, installed Next route/runtime/maxDuration documentation; mandatory `ugc-context-memory`, `ugc-immutable-contracts`, `ugc-ui-clarity`, `ugc-regression-gate`, `ugc-video-prompt` skill files and Supabase skill. The Vercel cost skill was consulted during the build investigation; no cost/config optimization was performed. Earlier bulk reads of the very large Explore context and ledger were truncated; a fresh full-history read is **not claimed**. Applicable current contracts and incidents were explicitly inspected. No reference video or timestamp-based recreation is involved.

Incidents: `UGC-UI-20261103-CHARACTER-FETCH-RECURRENCE` mitigated in worktree / hosted acceptance open; `UGC-GEN-20261103-CHARACTER-UUID` fixed in worktree; `UGC-GEN-20261103-CHARACTER-FULL-FRAMING` final live sample verified, earlier failed samples preserved; `UGC-TEST-20261103-CHARACTER-RELEASE-GATE` open. Previous stale redirect/worker-mock test issues were corrected without runtime changes.

Rollback boundary: revert only the listed character preparation integration and new endpoint/helpers, UUID line or new Full compiler instructions as appropriate. Existing owned assets/jobs/results are valid immutable records and should remain; no schema or cloud rollback is required. Preserve all concurrent work. No destructive cleanup, push, deployment or production setting change was performed.
