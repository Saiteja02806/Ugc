# Stage 2 identity / shared-negative prompt experiment — 4 November 2026

Status: controlled real provider test completed; identity requirement FAILED in all four reviewed samples. No application prompt change adopted.

## Result

| Variant | Difference | Calls completed | Primary face fidelity |
|---|---|---:|---|
| A | Existing stage2 prompt unchanged | 2/2 | 0/2 acceptable in qualitative review |
| B | Only uncanny valley, doll, distorted anatomy, bad eyes removed from negative constraints | 2/2 | 0/2 acceptable in qualitative review |

No clear benefit from the proposed negative-term removal appeared. This does not prove these terms have zero effect; it shows their removal alone did not fix the selected scene/identity case in this small sample. Both B samples generated heavier facial hair than the sparse moustache/chin-patch pattern of the primary reference. A1 also has broad stubbled features; A2 is closer to the already-generated scene interpretation. Full outputs and original-resolution crops were viewed for all four. Hair/eye colour, bare ears/no visible accessories, red jacket, full-body shoes and room remain visible. Changed expression or the selected hair/eye/skin overrides are not, by themselves, treated as identity failures.

Several outputs visually resemble features of the haircut-reference face. This is evidence to investigate reference-role leakage, not a controlled causal proof: the full haircut portrait was supplied in both arms, and the old scene also contains a different face. An earlier scene+identity-only job already had partial identity fidelity, so hair-reference leakage cannot explain all historical misses. No dedicated identity metric was used and no numeric biometric-confidence claim is made.

## Fixed inputs and procedure

- Same exact previously saved scene from source application job eb15d5d4-5e0d-4548-aecc-a8b4c4b358ce, primary Extreme JPEG, Textured Crop JPEG. No scene rerun, crop, face mask, changed image order, harmonizer or seed change between arms.
- Existing source function generateOpenRouterGeminiImage and its actual OpenRouter payload builder, model google/gemini-3-pro-image, image-only output, 9:16, 2K; no seed or temperature supplied. Provider reported Google for all four responses.
- Preregistered sequential order A1, B1, B2, A2. Four attempts, four successful outputs, zero retries, four distinct provider request IDs/output hashes. Two repetitions per arm are exploratory and cannot establish population failure rate or individual negative-term causality.
- Positive text identical. Exact reference hashes, prompt hashes and serialized request body hashes asserted before each provider submission; returned images decoded and dimension/hash checked. Output 1536x2752 for all four. No missing-image or local encoding mismatch found.
- All selected traits, original background, actual three stage2 images, full prompts and settings were shown before submission. Full frozen record [character-stage2-prompt-test-inputs-2026-11-04.md](C:/Users/chund/OneDrive/Desktop/UGC/docs/character-stage2-prompt-test-inputs-2026-11-04.md).
- Direct provider diagnostics isolate stage2; these are not new application generation jobs, credit deductions, gallery outputs or hosted browser acceptance. Application billing/jobs were not mutated. Reported aggregate provider usage cost 0.58016; per-request usage preserved. Credentials loaded in memory from the existing worker binding, never printed or saved.

## Provider receipts

| Run | Provider request ID | Elapsed seconds | Reported cost |
|---|---|---:|---:|
| A1 | gen-1793742693-fqJkx2kJCqBcBvebfZQZ | 43.146 | 0.145420 |
| B1 | gen-1793742735-md1XLVHuwKcC8XnDeTm1 | 44.981 | 0.143598 |
| B2 | gen-1793742780-BTeaoqNgIdKxtIvc5Mn0 | 37.428 | 0.143646 |
| A2 | gen-1793742819-dtGiYJQLP5WFwawbjSAF | 46.054 | 0.147496 |

Calls ran 4 November 2026 approximately 03:21:24–03:24:16 IST. Inputs and all results retained under .tmp/character-stage2-prompt-ab-20261104: manifest.json, prompt-A.txt, prompt-B.txt, A1/B1/B2/A2.json and .png, summary.json, comparison.png, full-frame preview JPGs and crops. Images in the comparison are resized inspection crops, not altered generation inputs.

![All results and both face-containing references](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-stage2-prompt-ab-20261104/comparison.png)

## Verification and scope receipt

Preflight: context-memory, immutable-contracts, video-prompt, regression-gate skills read; nonnegotiables, relevant Explore/incident history, previous exact-input/recheck report, current provider/pipeline sources and tests inspected. Read-only preflight PASS. Existing dirty worktree preserved. No new application-code edits were necessary for this experiment; no claim of a new complete read of the very large historical context files.

- Frozen request checks / script syntax / results integrity: PASS.
- Prompt and trait contract tests: 4/4 PASS.
- Existing provider implementation tests: 18/18 PASS.
- Actual provider requests: 4/4 completed; primary identity visual acceptance: FAILED 4/4.
- UI, worker/job routing, catalog, application prompts, billing and other workflow implementations unchanged by this task: VERIFIED by edit scope. Fresh production browser/mobile/cross-feature checks NOT TESTED, no new UI baseline comparison needed for a diagnostic-only task.
- No build, development server, push, deployment, new dependency or schema change.

Tracked files created/updated: docs/character-stage2-prompt-test-inputs-2026-11-04.md, this report, append-only docs/ai-context/clear.md and EXPLORE_CONTEXT.md. Ignored diagnostics are confined to the directory above; preserve these receipts and do not rerun completed IDs. No application-code rollback needed.

Incident UGC-GEN-20261104-CHARACTER-IDENTITY-STAGES remains OPEN, linked CHARACTER-STAGE2-TRAITS / CHARACTER-VISUAL-ADHERENCE. The negative-prompt hypothesis is not validated as a repair. The next controlled factor should isolate the visible face in the haircut reference (or remove it with a documented hair-only input) while keeping the scene/prompt constant; if failures persist, test scene-face anchoring separately. Those experiments have not been performed or presented as a solved identity pipeline.
