# Eye colour authority and accessory isolation — 4 November 2026

**Requested checks pass in one real post-fix image:** pale blue/blue-grey irises and no visible accessories. This is a single visual canary, not a guarantee of model adherence. Extreme character/moustache fidelity remains incomplete.

## Minimal repair

- Removed dark-eye colour/shape instructions from the Indian and Middle Eastern ethnicity snippets; independent eye selections now remain authoritative.
- Compiler explicitly requires the selected colour in both irises, overriding all reference-photo iris colours. Eye-shape photos supply eyelid geometry only.
- No accessories now explicitly requests bare natural earlobes and excludes earrings/jewellery even when present in other references. Nonempty accessory selections use an allowlist instruction without the bare-ear prohibition.
- Reference-order guidance restricts accessory copying to selected accessories and reiterates eye-colour precedence.
- New jobs record compilerVersion 2. Previously admitted job prompts/receipts remain frozen.

Application files changed in this task: `lib/characters/influencer-registry.ts`, `lib/characters/master-prompt-compiler.ts`, `lib/characters/studio-references.ts`, `lib/characters/generation-service.ts`.

Tests changed: new `lib/characters/trait-authority.test.mjs`, `lib/characters/generation.test.mjs`, `lib/characters/studio-references.test.mjs`. The latter uses a valid ten-reference accessory fixture instead of selecting every accessory at once, which the existing capacity guard rejects. It retains the 4,000-character conservative assertion for that valid fixture.

Documentation changed: this receipt, append-only `docs/ai-context/clear.md` and `EXPLORE_CONTEXT.md`. Existing concurrent/unrelated worktree changes preserved. No UI implementation/CSS/labels, image bytes/URLs, reference order/capacity, dependencies, database schema, worker runtime, billing policy or deployment configuration changed. Rollback only these scoped additions; do not reset whole dirty files.

## Preflight and protected contracts

Inspected `AGENTS.md`, `docs/ai-context/nonnegotiables.md`, character entries in `EXPLORE_CONTEXT.md` and `docs/ai-context/clear.md`, prior real-output audit, registry/compiler/reference/admission callers, tests and saved real-test harness. Read required `ugc-context-memory`, `ugc-immutable-contracts`, `ugc-video-prompt` and `ugc-regression-gate` SKILL.md files and installed Next use-client guide. Read-only preflight command PASS for this exact request.

VERIFIED by diff/tests: UI implementation and CSS unchanged; no-accessory default/reset and selected-accessory interactions, hidden fourth character/legacy lookup, Full/Half framing, owned-reference validation, prompt/credit limits and frozen retry behavior retained. No video/source timestamp or scheduling changes.

Fresh browser UI/navigation/mobile screenshot comparison NOT TESTED: no build or browser bundle permitted. Production browser still requires sign-in, and this task does not deploy the repaired frontend/server.

## Non-build checks

- Character/component suite: **219/219 PASS**, zero failures/skips. Command: `node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/characters/*.test.mjs lib/characters/*.test.ts components/characters/*.test.mjs`.
- Current-source worker image suites: **42/42 PASS**. Command: `node --import ./scripts/worker-source-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --test worker/src/jobs/generate-character-image.test.mjs worker/src/jobs/generate-image.test.mjs`.
- `npx tsc --noEmit --incremental false`: PASS, exit 0.
- Scoped ESLint of the seven changed source/test files: PASS, exit 0.
- `git diff --check`: PASS.
- Logs: `.tmp/character-thumbnails/authority-20261104-{tests,worker,types,lint}.log`.

New assertions cover every ethnicity × eye-colour pairing (6×8), absence of demographic dark-eye overrides, exact selected iris-colour precedence, bare ears with none, and preservation of each explicit accessory choice. Admission test asserts compiler revision 2.

## Real verification, not a mocked provider

Connected account was re-verified with profile and entitlement reads. One requested image submitted through the repaired local application service to live storage, credit reservation, Cloud Tasks, deployed Gemini/OpenRouter worker and saved output. No replacement generator, second paid attempt, builds, bundling, dev server, push or deployment.

- Job: `844fc959-4b49-4887-a53e-7bfcc6963977`; asset: `82aac232-02b2-498e-a399-95e678f9a3d9`.
- Client request ID: `c54e76c9-ef02-40d9-ac51-a181a607cd54`.
- Same complete UI selection as failed job `f352b17c-7be8-4b8c-b512-0070efe1aaf8`, same nine prepared asset IDs, same downloaded JPEG SHA-256 values. No reference image was altered.
- Prompt length 3,783 characters, compilerVersion 2. Full stored selection equals request. Actual job prompt equals output prompt/effectivePrompt, and reconstructed full-prompt/ordered-reference worker fingerprint matches production provider-operation fingerprint.
- One provider operation, output persisted; one **1-credit committed** reservation, balance **714 → 713**.
- Admitted **4 November 2026 01:40:57.331 IST**, completed **01:41:39.874 IST**; **42.543 seconds**.
- Final 720×1280 image and original 1536×2752 provider image downloaded. Original-resolution face and wrist crops inspected separately; deliverable image unmodified.

| Check | Actual visual result |
|---|---|
| Ice Blue eyes | PASS in this sample: both irises visibly pale blue/blue-grey rather than brown. |
| No accessories | PASS in this sample: both ears bare; no visible earring, necklace, glasses, headphones, headband, hat or bracelet. Dark wrist region inspected: jacket lining/skin, not a visible watch. |
| Full body | PASS: head through both shoes visible. |
| Platinum textured crop | PASS broadly. |
| Red leather jacket and denim | PASS broadly. |
| Bedroom | PASS: floral bed, lavender accent and chair at side. |
| Extreme identity/moustache | PARTIAL: face remains an interpretation and moustache absent/greatly reduced. Do not claim complete identity fidelity. |

The new prompt plus sampling variation produced a passing result for the two requested checks. This does not isolate the causal effect of each prompt change or establish a statistical success rate. Exact age, physical height and ethnicity cannot be verified from one rendered image. Browser click-through and deployed repair availability remain NOT VERIFIED.

Private ignored evidence: `.tmp/character-authority-20261104/{run.mjs,receipt.json,prompt.txt,output.png,provider-source.png,face-inspection.png,wrist-inspection.png,ref-1.jpg…ref-9.jpg}`. No credentials/tokens stored in receipts. Incident `UGC-GEN-20261104-CHARACTER-VISUAL-ADHERENCE`: requested eye/accessory subissues locally repaired and one real visual pass; broader identity/repeated hosted acceptance remains OPEN.
