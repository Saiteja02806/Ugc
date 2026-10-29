# WALL-LAYOUT-02 — Structured manual Wall remix

29 October 2026. Locally verified; no deployment or paid provider calls. Hosted/provider acceptance remains unverified.

## Implemented contract

New manual remixes for an exact source-ID/hash-bound `heading-body-v1` Wall profile return `{ blocks: [], heading, body }`. Provider schema requires both fields and an empty blocks array. System/user prompts explain the roles; blank lines inside body remain body paragraphs. The source-relative AI length budget counts heading plus body. Heading max180; Wall body max6000. Generic Hook/Slideshow provider schemas and limits remain unchanged.

New manual Wall prompt version5 and `outputStructure: heading-body-v1` freeze in the existing claimed input JSON. No table/schema, permission, quota, auth or idempotency changes. Owned accepted/pending/legacy requests are looked up before creation gates and retain their original saved content/version; no regeneration or migration. Structured values are saved, reviewed as separate fields, restored including unfinished/empty edits, and applied directly without paragraph-boundary inference.

Existing two-layer styles, positions, timing, trim and audio settings remain. Deliberately saved single-layer layouts retain their geometry and combine the two explicit fields only at the final layer value. New blank layouts use the existing measured heading/body initializer. Incompatible geometry requires review rather than replacing saved layout. Legacy block-based heading/body receipts/drafts keep their compatibility parsing and meaning. Ordinary/multi-region Wall layouts continue on their existing paths. Custom text without a verified source/hash layout is not silently assigned a structured profile.

## Files changed in this task

Implementation:

- `lib/explore/reference-text.ts`: source-bound structure detection, strict new output schema, legacy reader compatibility, correct length accounting.
- `lib/explore/remix-text-api.ts`: selects strict provider schema, freezes structure/version and rejects newly generated ambiguous combined blocks before completing a receipt.
- `lib/explore/remix-text-prompt.ts`: structured prompt instructions; manual Wall prompt version5.
- `lib/explore/remix-text-edit.ts`: direct field application; existing styles and legacy parsing retained.
- `lib/explore/remix-text-draft.ts`: structured and legacy recovery, incomplete drafts and other-format limits.
- `components/explore/remix-text-section.tsx`: existing heading/body review fields used for structured Wall results, appropriate body limit and validation message. Existing generic/legacy review controls retained.
- `lib/mcp/reference-tools.ts`: shared receipt output schema accepts structured Wall bodies above600; old receipt shape remains accepted. Shared API still validates source, ownership and length.

Tests:

- `lib/explore/wall-heading-body-remix.test.ts` (new): explicit fields, multiple body paragraphs, saved two/single-layer styles, trim/audio/timing, source binding, source-relative length, bounds, incomplete/legacy draft recovery and cross-format rejection.
- `lib/explore/remix-text-api.test.mjs`: strict actual provider-payload schema/prompt, persisted structured fields, replay without another call, combined-block rejection and preexisting version4 legacy receipt recovery. Updates new manual Wall version expectations.
- `lib/explore/remix-text.test.ts`: new manual Wall prompt version expectation; existing behavior retained.
- `scripts/mcp-reference-tools.test.mjs`: structured610-character body through MCP generation/read and website recovery with one mocked provider call; fixture resolves the selected source/format.
- `scripts/wall-heading-body-remix.browser.cjs` (new): extends existing isolated actual-component Remix fixture with canonical structured source and full generation/review/reload/apply/legacy compatibility scenarios.

Documentation: this receipt, `WALL_TEXT_CONTEXT.md`, `EXPLORE_CONTEXT.md`, append-only `docs/ai-context/clear.md` incident `UGC-UI-055-WALL-LAYOUT-02`.

Rollback boundary: task-start source copies/hashes under `.tmp/wall-layout-02/baseline/` and `baseline.json`. Preserve preexisting and concurrent work; do not reset to HEAD. No dependencies, migrations, production settings or CreatorPhone files changed.

## Validation

- Reproduction before fix: two new structured validation/application/reload tests fail; a third cross-format negative passes (`before.log`). Earlier audit also reproduced API validation accepting separator loss and editor application rejecting it.
- Final focused/neighbor suite:258/258PASS, no skips (`regression.log`). Includes all97 Wall layout/save/reapply checks, API/receipt tests, MCP/history, shared video/slideshow editors and all106 active-Hook source/prompt contracts. Existing Node server-only loader, experimental module mocks/type transformation; `--test-concurrency=2`.
- Real-component browser PASS (`browser.log`): existing Hook, Wall and Slideshow manual flows; immutable uncertain request/reload; failed request recovery; stale-account reply isolation; source changes; structured empty-heading disables Apply; empty and700-character unfinished edits survive reload without another generation; multiple body paragraphs remain in the body; apply/reopen preserves two-layer style/trim/audio; legacy completed block draft reopens/applies without regeneration. HTTP/auth/provider/storage boundaries are isolated fixtures.
- Desktop1100/mobile390 structured review screenshots produced and inspected. Existing generic compact/draft/caption screenshots at desktop/mobile are byte-identical to a separate run of the task-start review component:5/5PASS (`visual-comparison.json`). Both screenshots and baseline bundle are under `.tmp/wall-layout-02/`.
- `npx tsc --noEmit --incremental false`:exit0 (`types.log`). Scoped ESLint across implementation/tests:exit0/no diagnostics (`lint.log`). Scoped diff whitespace check PASS.
- CreatorPhone component and disabled route SHA256 equal the task-start baseline (`creator-phone.json`). Shared data changes remain Wall/source-profile gated; Hook/Slideshow behavior has regression coverage.
- Production build outcome appended below. Only generated `.next/cache/webpack` was cleared after resolving/validating the in-workspace path to provide build space. No source/media/receipts deleted. Native browser/build require execution outside Windows sandbox; local fixtures only.

## Preflight and limits

Applied context-memory, immutable-contracts, UI-clarity, regression-gate and Supabase receipt guidance; read relevant source/incident/context entries, nonnegotiables, Wall context, installed Next client/testing guide and actual callers/storage/prompt/editor paths. Ran `tools/preflight.py`. Supabase changelog markdown fetch was unsupported by the web tool; no Supabase API/schema/auth/storage-policy behavior was changed. Existing SDK/storage methods retained and exercised through owned-claim fixtures; no production query/write needed for this JSON-contract change.

Protected saved drafts/styles/layouts, full Wall duration, other-format limits and CreatorPhone: VERIFIED locally as above. Live model response quality, authenticated hosted persistence, real provider operation and production deployment: NOT VERIFIED / not performed. Local mocked provider counts demonstrate recovery logic, not live billing behavior or AI quality. No paid generation, publishing, commit, push or deployment.

Final build gate: npm run build -- --webpack completed exit0: compilation, TypeScript,353staticpages and all native Hook module/metadata/executable/traced-route postbuild checks PASS. CreatorPhone freshly matches both this task's baseline and the original six-fix baseline. Final258tests, scopedlint, types anddiffcheckPASS. Newstructured and existinggeneric desktop/mobile screenshots inspected;5old UI snapshots byte-identical. Only generatedwebpackcache cleared for space, including after completedbuild; no source/media/history removed. No deployment/paidcalls/livewrites.


## End-to-end local recheck — 29 October 2026
-275/275checksPASS/no skips, freshrun: structured/unit/API/legacyclaims/MCP/history/all97Walllayouts/sharedvideoandSlideshoweditors/all106Hookcontracts/realPGliteDB/clipdraftandrecovery. Logs recheck-final-tests.log.
-Directpre-fixcomparison for97sources: originallegacyapplication, customsavedstyles, oldcompletedandemptyreviewdraftreload andsavededit/export aredeep-equal topre-fixbehavior. Audit loads task-startcopies with reboundimports, never replaces applicationsources. recheck-parity.log and recheck-legacy-parity.json.
-Freshactual-componentdesktop/mobilebrowserPASS: generatereview/emptyvalidation/unfinished700characterreload/bodyparagraphs/apply/reopen/legacyrecovery plus existingHook/Slideshow/error/stalescope flows. Provider/auth/storageHTTPfixtures; no paidcall. recheck-browser.log.5genericdesktop/mobilePNGcomparisonsremainbyte-identical topre-fixcomponent (recheck-visual-comparison.json).
-Newregressions added onlyto lib/explore/remix-text-api.test.mjs (oldpending/failedWallreceipt exactsnapshot andzero-providerrecovery), lib/explore/wall-heading-body-remix.test.ts (structuredapply/savededit/reopen/export andexplicitblankdraftretention), scripts/remix-text-db.test.mjs (realPGliteJSONB/actualclaimfunction retainsoldv4andnewv5snapshot/source/output unchanged).
-Freshnpx tsc --noEmit --incremental falsePASS; scopedESLintanddiffcheckPASS.10runtime/layout/Phonepaths matchturn-startSHA256; noapplicationimplementationchanged. CreatorPhone remainsunchanged. Fullproductionbuildnotrepeatedfortest-onlyadditions; precedingbuild353pages/nativechecksPASS remainsseparateevidence.
-Documentation appended here, EXPLORE_CONTEXT.md, WALL_TEXT_CONTEXT.md andclear.md incidentUGC-UI-055. Existingdirtyworktreepreserved. No newlyobservedapplicationregression in tested scope. No staging/push/deployment, liveproductionwrite or paidgeneration.
-Status LOCALLY VERIFIED; hostedauthenticatedpersistence/providerAIquality NOT VERIFIED. RealPGliteandlocalHTTPfixtures are not productionacceptance.
