# Real local starting-frame and face-swap check — 2 November 2026

Status: execution and local saved-stage reuse VERIFIED; image fidelity FAILED. No application code, palette, layout, environment file, hosted job or deployment changed.

## Credential finding
`.env.local` supplies a key for which OpenRouter GET `/api/v1/key` returns HTTP200 with `is_management_key=true` and `is_provisioning_key=true`. Development and test loaders resolve the same key; no whitespace or dotenv-assignment contamination was found. It is not a missing/invalid credential: it is the wrong key capability for inference. Its generation request returned HTTP401 `User not found.`.

Earlier successful test `outputs/hook07-seedream-comparison-2026-10-27/run.mjs` instead reads `openrouter-api-key` from Google Secret Manager project `ugcsaas`. Existing latest version verified HTTP200 with both management/provisioning flags false. That existing inference key was held in memory for the authorized test, never printed or written to environment files. Earlier successful receipts used Seedream 5 Pro; they do not establish Gemini two-stage fidelity.

## Actual run
Executed `.tmp/real-starting-frame-test-2026-11-02-inference/run.mjs` with current compiled worker helpers, current `buildOriginalOpeningImagePrompt` version7 and real OpenRouter Gemini 3 Pro image calls. The actual durable runner used a local file-backed operation ledger and storage adapter. This tests provider images and stage reuse locally; it does not verify the hosted Supabase/GCS implementation or authenticated UI admission/billing.

Source: Hook `explore-paired-hook-4585ee949081c4e5cd835cd3`, original decoded frame0/time0, 720×1280; canonical source hash and PNG hash are recorded in source-receipt.json. Main/support photos are existing files in `outputs/hook-keyframe-incident-2026-10-21`; exact hashes are in run-receipt.json. Source and main identity were viewed; Stage1, Stage2, harmonized starting-frame and harmonized standalone swap outputs were viewed.

| Operation | Result | Elapsed | Provider calls |
|---|---|---|---|
| Starting frame: scene → identity → harmonizer | Completed | 62.9s | 2 |
| Repeat starting frame | Same SHA256, saved outputs reused | 0.30s | 0 |
| Standalone swap: identity → harmonizer | Completed | 25.5s | 1 |
| Repeat standalone swap | Same SHA256, saved outputs reused | 0.12s | 0 |

All three paid calls returned HTTP200. Provider-reported cost totals USD0.424130; no independent billing reconciliation performed. Request IDs:
- scene: `gen-1793597590-s7zJIDCgIO92Qd6xPY5a`
- starting-frame identity: `gen-1793597623-Ypa3RlwlWa6MMVA6hr0v`
- standalone identity: `gen-1793597653-pGdW9qQGJSB3TbPATIKB`

## Visual acceptance
- Starting frame retains purple shelves, keyboard, black outfit and broadly similar pose. Stage2 visibly changes the face toward the supplied identity; no numerical identity score or guarantee claimed.
- FAILED aspect ratio/composition: source720×1280 (9:16), all generated stages/finals928×1152. Head size/crop and scene framing change. Current payload builder validates aspectRatio but omits it from the outgoing request body (CODE CONFIRMED); provider output confirms the mismatch. Exact provider-side behavior beyond this omission is not inferred.
- FAILED complete text cleanup: the large caption is removed, but lettering persists on background objects. Some mouth/expression drift is visible between original, Stage1 and Stage2. Harmonizer adds visible grain; aesthetic acceptability is unapproved.
- FAILED standalone scene preservation: face-swap output replaces purple shelving/toys with the identity reference's neutral room/door/bed. The original caption remains, which alone is not a swap failure because this stage is not a text-removal operation. Room substitution is a clear role-separation failure despite the prompt instructing source preservation. Root cause of model noncompliance remains UNKNOWN.

## Artifacts and boundaries
All actual input receipts, stage PNGs, local operation ledgers and provider cost/request receipts: `.tmp/real-starting-frame-test-2026-11-02-inference/`. No further image requests or quality-chasing retries were made. Previous automated run: worker build PASS, 78 worker tests and 102 API/UI/UTF8 tests PASS. Those suites were not rerun after this read-only/provider test because no application code changed.

Preflight/procedure: prior mandatory repository context retained; context-memory and current incident ledger/protected contracts consulted; current provider prompt/helper and prior test source inspected. Incident UGC-VID-049 appended with visual failures and proposed regression assertions. Only this report, append-only incident documentation and local test artifacts changed in this check. Palette/layout UNCHANGED; browser mobile/desktop and production end-to-end NOT TESTED. Real-image success on one fixture does not establish general reliability.
