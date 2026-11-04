# Character request contract repair — 4 November 2026

Status: locally verified; deployed acceptance and generated-pixel fidelity NOT VERIFIED.

## Implemented scope

- Restored No accessories as the first/default card, empty accessory IDs for initial/reset state, and an empty randomizer outcome. Existing multi-selection, clearing and busy locks remain covered by actual component-handler tests.
- Moved the fourth character, Playful Mustache, to legacy lookup. Only Average, Bold and Extreme appear in the chooser/randomizer. Historical asset lookup remains available.
- Structured studio selections now validate actual current trait IDs against their own categories, reject unavailable characters, duplicate accessories and the UI-only none sentinel. Uploaded face IDs have an explicit format; their actual media is independently checked for ownership/readiness.
- The server compiles studio prompts from validated selections instead of trusting client prose. Compiler restrictions and additional negative instructions are included in the actual frozen job prompt. Requests without structured selections retain the existing free-text behavior, with supplied negative instructions appended once.
- Before reservation, studio references must match the full canonical count and order. Catalog IDs are derived from owner plus immutable source identity; ready owned media rows must match catalog project, source record, storage key and source hash. An uploaded face occupies the first slot and cannot be a catalog photo masquerading as an upload.
- Jobs retain the selection plus a versioned compiler receipt: positive prompt, effective negative instructions, ordered trait/role/asset bindings and catalog source hashes. Existing job prompt is the frozen complete provider input. Changed selections/restrictions conflict on reuse of the same idempotency key; exact retries recover admitted rows without rereading assets or reserving credits twice.
- Both ten-reference capacity and final merged prompt length (including restrictions and skills) are checked before credits. No reference-cap increase or provider/model change.

## Files changed in this task

Application: `lib/characters/influencer-registry.ts`, `lib/characters/schema.ts`, `lib/characters/generation-service.ts`, new `lib/characters/studio-selection.ts`.

Verification: `lib/characters/generation.test.mjs`, `lib/characters/studio-references.test.mjs`, `components/characters/influencer-studio.test.mjs`, new `lib/characters/studio-worker.test.mjs`, new `scripts/worker-source-test-loader.mjs`.

Documentation: this report, append-only `docs/ai-context/clear.md` and `EXPLORE_CONTEXT.md`.

Other pre-existing and concurrent worktree changes were preserved. No layout/CSS/component implementation, asset URL/bytes, database schema, dependency, auth, queue, credit RPC, worker runtime or deployment configuration changes in this task. Rollback boundary is these scoped additions/edits, preserving earlier user work; do not reset entire dirty files.

## Preflight receipt

Sources inspected: `AGENTS.md`, `EXPLORE_CONTEXT.md` (character history and current contracts), `docs/ai-context/clear.md` (linked incidents and repair history), `docs/ai-context/nonnegotiables.md`, `docs/character-request-contract-repair-2026-11-03.md`, current registry/compiler/workspace/schema/service/preparation/API/media-reader/worker and tests. Next guide: `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`.

Skill files read: `.agents/skills/ugc-context-memory/SKILL.md`, `ugc-immutable-contracts/SKILL.md`, `ugc-ui-clarity/SKILL.md`, `ugc-video-prompt/SKILL.md`, `ugc-regression-gate/SKILL.md`; Supabase skill inspected for existing owned-media access. No Supabase API/schema changes or live database writes.

`python tools/preflight.py --repo . --task "Restore no accessories default, hide fourth character, validate studio selections and forward negative prompts server-side without UI changes or builds"`: PASS.

## Non-build verification

1. `node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/characters/*.test.mjs lib/characters/*.test.ts components/characters/*.test.mjs`: **217/217 PASS**, no skips. Log `.tmp/character-thumbnails/repair-20261104-tests.log`.
2. `node --import ./scripts/worker-source-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --test worker/src/jobs/generate-character-image.test.mjs worker/src/jobs/generate-image.test.mjs`: **42/42 PASS**, no skips. Loader resolves current worker TypeScript instead of stale dist; emits no build files. Log `.tmp/character-thumbnails/repair-20261104-worker.log`.
3. `npx tsc --noEmit --incremental false`: PASS, exit 0; log `.tmp/character-thumbnails/repair-20261104-types.log`.
4. Scoped ESLint on all nine changed source/test/loader files: PASS, exit 0; log `.tmp/character-thumbnails/repair-20261104-lint.log`.
5. `git diff --check`: PASS.

New behavioral coverage includes every selection category, hidden/unknown/wrong-category options, duplicated/none accessories, missing/reordered/substituted/foreign/pending/stale-source references, custom face binding, overflow, exact 4,000/32,000 merged-prompt boundaries and one-character overflow, frozen receipt/replay/idempotency and server-selected prompt replacing stale client text. The current worker's Gemini OpenRouter adapter is exercised for Full and Half; exact prompt, semantic negative instructions and ordered reference image bytes are asserted. Network/provider/storage boundaries are stubbed; no paid requests occur.

## Protected behavior and limitations

- VERIFIED by component tests: default/clear/multiple accessories; Layers reveal/hidden selection/busy lock; Save before Download and existing callbacks; loading/error/session/history/upload contracts.
- VERIFIED by tests/source: backend thumbnails and original generation URLs remain distinct; legacy trait lookup remains; generic model routing and prompt handling; admission/retry ownership/credit contracts.
- VERIFIED by diff: no component layout, CSS, neighboring workflow implementation, scheduling or video source/identity timestamp changes in this patch. Their full browser navigation/runtime is NOT TESTED here.
- NOT VERIFIED: fresh desktop/mobile screenshot comparison, hosted loading latency, real production request persistence, hosted UI activation, real model visual fidelity. No build/dev server/browser bundling/push/deployment was authorized or performed. Existing screenshot harnesses bundle application code, so were not run under the no-build instruction.
- Historical jobs remain immutable. This does not retroactively modify already-admitted prompts. Semantic restrictions reaching a provider do not guarantee perfect adherence in generated pixels.

Incident: `UGC-GEN-20261104-CHARACTER-CONTRACT-RECURRENCE`, linked to the prior choice audit, accessory and hide-fourth incidents. Local repair evidence recorded; hosted acceptance remains pending.

## Requested independent rerun — 4 November 2026

Reran the two exact test commands above against current worktree: character217/217 and worker42/42 PASS, zero failures/skips, exit0. Fresh logs: `.tmp/character-thumbnails/retest-20261104-character.log` and `.tmp/character-thumbnails/retest-20261104-worker.log`. No application code changed in this rerun.

Real production-browser check: navigating to `https://www.getugcpilot.com/explore/build-character` redirected to `https://vidmake.io/explore/build-character?moved=1`, then `https://vidmake.io/sign-in`. Accessibility snapshot showed Welcome to Vidmake with Google/email sign-in controls. This browser has no authenticated session, so live character UI/generation was NOT TESTED. The local repair has not been deployed as part of this task; hosted acceptance cannot be inferred from local tests. No build/deployment/paid request started.
