# Slideshow clarification language and presentation — 30 October 2026

Status: **LOCALLY VERIFIED / NOT DEPLOYED**. Authenticated production and live model-output quality remain **NOT VERIFIED**.

## Request and evidence

The user supplied `codex-clipboard-3e48e6fb-f0d3-49ca-85b1-7e4d0459eddc.png`: an English clarification includes `背景`, a long paragraph and repeated next-step guidance. It says no face-reference uploads were provided while Upload A and Upload B are visible. The requested change is clear English guidance presented readably in the existing slideshow Create flow; genuine missing-reference clarifications must remain.

Code-confirmed gaps:

- The planner had no explicit English-only clarification instruction. Its raw strings were rendered directly; existing saved questions could retain mixed-language text indefinitely.
- Saved questions froze a source scope but no attachment IDs. Adding/removing/replacing uploads did not invalidate the diagnosis. Recovery could label a rejected prior saved input with the current composer's context.
- A clarification also populated the ordinary error banner with raw model prose, duplicating the persistent questions.

These are matching code paths, **not proof** of the precise original model input or attachment history. No production database lookup or saved private-input/model replay was performed. The screenshot's exact missing-face-photo diagnosis remains unverified.

## Implemented scope

1. New planning revision **4** requests concise, actionable English clarifications and treats the supplied upload inventory as authoritative for upload existence. It asks for a labelled image's role when genuinely unclear instead of claiming no uploads exist. Face-only instructions apply to source slides with a person, preserving text-only slides; unavailable targets and conflicting identities still clarify.
2. A shared mixed-script guard substitutes a clear English fallback when a question contains non-Latin letters. It does **not** pretend to translate the original diagnosis: the fallback asks which source slides/uploads to use and what should change. Ordinary English questions, including precise missing-slide guidance, remain intact; repeated fallback strings are deduplicated. New responses are guarded before persistence, without another model call. Old saved plans remain immutable and are guarded only at display.
3. A conditional rounded clarification panel provides a heading, truthful no-generation status, a bulleted list of questions and one next step. It replaces the existing paragraph block; it adds no permanent workflow control. Long words/questions wrap and the Generate action stays reachable.
4. New browser feedback includes ordered upload IDs from the exact input recorded by the submission protocol, including an explicitly recovered old request. A different source or uploaded selection shows “Your images have changed since this check” and asks the user to review/check again. It hides obsolete diagnoses rather than claiming they apply to the current images. Legacy feedback with unverifiable current uploads is also treated as stale.
5. Clarifications use the persistent panel only; they no longer duplicate raw model text in a transient error banner. Non-clarification failures retain the existing error path.

No automatic translation, provider retry, image generation, credit reservation change, database schema, model switch, dependency, worker, scheduler or deployment change. The user's authored prompt and requested on-slide text remain byte-for-byte untouched by the language guard, including deliberately requested non-English copy. Existing job/request IDs and duplicate-submission protection stay intact.

## Files changed by this task

- `components/explore/slideshow-clarification-notice.tsx` — new conditional presentation component.
- `components/workspace/ugc-chat-workspace.tsx` — exact checked-input snapshot, notice integration and removal of duplicate clarification error banner.
- `lib/explore/slideshow-generation-recovery.ts` — optional persisted upload IDs, parser/matching and English fallback.
- `lib/explore/slideshow-generation-recovery.test.ts` — malformed records, script fallback, exact English retention, changed/legacy upload context.
- `lib/explore/slideshow-request-plan.ts` — clarification-language/upload-inventory guidance.
- `lib/explore/slideshow-plan-service.ts` — revision4 and new-response guard.
- `lib/explore/slideshow-plan-service.test.mjs` — captured planner policy, fallback persistence, one model call, replay/idempotency and untouched exact slide copy.
- `scripts/slideshow-clarification.browser.cjs` — actual notice visual/interaction fixture and optional task-start before render.
- `scripts/slideshow-generation-recovery.browser.cjs` — actual panel/client integration with mixed-script response, saved upload IDs and changed-context reload checks.
- `EXPLORE_CONTEXT.md`, `CAROUSEL_CONTEXT.md`, `docs/ai-context/clear.md` — appended decision/verification.
- This report.

Existing unrelated working-tree changes were preserved. Rollback boundary is this task's notice, helper, planner revision/guidance, integration and tests; retain the earlier slideshow recovery and gallery rules.

## Preflight receipt

Read/consulted: root `AGENTS.md`; current/relevant slideshow planner/recovery and workflow decisions in `EXPLORE_CONTEXT.md`; manual Explore slideshow handoff/recovery entries in `CAROUSEL_CONTEXT.md`; incident history in `docs/ai-context/clear.md` (particularly UGC-UI-037 slideshow recovery, UGC-OPS-012 planner clarification and UGC-UI-003/004 no collateral redesign); complete current `docs/ai-context/nonnegotiables.md`.

Skills actually read: `.agents/skills/ugc-context-memory/SKILL.md`, `ugc-immutable-contracts/SKILL.md`, `ugc-ui-clarity/SKILL.md`, `ugc-video-prompt/SKILL.md`, `ugc-regression-gate/SKILL.md`. Installed Next.js server/client-component guide was consulted before edits.

Ran `python tools/preflight.py --repo . --task 'Show clear English slideshow clarification messages, prevent mixed-script feedback and distinguish stale attachment checks without changing generation admission'` — prerequisites discoverable/readable. Inspected git status, target source/callers, saved feedback/parser, submission protocol, planner, compiler, API clarification gate and existing tests before edits. Added **UGC-UI-075-SLIDESHOW** OPEN before implementation.

## Verification

**208/208 focused tests PASS**:

```powershell
node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/explore/slideshow-generation-recovery.test.ts lib/explore/slideshow-plan-service.test.mjs lib/explore/slideshow-request-plan.test.ts lib/explore/slideshow-generation-groups.test.ts lib/explore/slideshow-composer-draft.test.ts lib/ai-studio/image-generation-api.test.mjs lib/ai-studio/image-history.test.ts lib/ai-studio/pending-generation.test.ts scripts/slideshow-click-actions.test.mjs scripts/explore-slideshow-editor.test.mjs scripts/explore-slideshow-actions.test.mjs scripts/explore-format-source-workspace.test.mjs
```

- `npx tsc --noEmit --incremental false`: final PASS. Initial run failed because a generated `.next/types/.../route.ts` disappeared during file discovery; rerun passed without application/type changes to address it.
- Scoped `npx eslint` over all changed application/library/test/script files: PASS.
- Task-scoped `git diff --check`: PASS.
- `node scripts/slideshow-clarification.browser.cjs`: PASS actual notice at1366/390/320px; mixed-script fallback, precise English missing-slide message, changed-image stale state, no old missing-upload diagnosis, save/reload/remount, long questions/no overflow, reachable Generate and explicit action only. No API or model calls.
- `node scripts/slideshow-generation-recovery.browser.cjs`: PASS actual image panel and job/media/pending-request clients against local fixture APIs; mixed-script API questions display English fallback, changed upload IDs trigger stale message after reload, account isolation, completion while away, explicit draft choice, lost-acknowledgement GET recovery, no duplicate generation POST, acceptance clears old feedback, scoped New session.
- The planner service/model responses are mocked in tests. Test asserts one call, unchanged exact non-English on-slide wording, schema/credit gate and retained ambiguity checks. It does not establish fresh real-model understanding or image quality.

Visuals captured with identical local fixture data and reviewed:

- `.tmp/slideshow-clarification-20261030/before-390.png`
- `.tmp/slideshow-clarification-20261030/after-390.png`
- `.tmp/slideshow-clarification-20261030/after-1366.png`
- Matching before/after320px and before1366px screenshots also saved.

The before notice is extracted from the task-start panel capture. The after notice is the actual new component; host shell, prompt input, upload labels, model selector and generation footer are fixture scaffolding with Arial and existing app tokens. This is not an approved full-app golden baseline or signed-in production acceptance.

Live browser: navigating to `https://www.getugcpilot.com/explore/slideshows` on30October returned the Slideshows page followed by “Opening sign in...”. No signed-in session was available. No production changes or paid operations occurred. No build/deploy run for this scoped UI/helper/prompt-only change.

## Protected behavior receipt

| Behavior | Status |
|---|---|
| English clarification display, readable headings/list/next step | VERIFIED locally |
| Requested multilingual slide copy and authored prompt unchanged | VERIFIED in service-boundary tests |
| Real ambiguity remains blocked before credits/jobs | VERIFIED in API/service tests; live provider NOT TESTED |
| Changed attachments cannot inherit old current-image diagnosis | VERIFIED locally, including reload |
| Owner isolation and malformed persisted feedback | VERIFIED locally |
| Uncertain request, GET-first recovery, no duplicate automatic POST | VERIFIED locally |
| Existing slideshow save/edit/reorder/recovery and neighboring workflow source behavior | VERIFIED in focused regression tests |
| Scheduling/timezone/worker execution | Unchanged by source scope; live NOT TESTED |
| Screenshot-specific original missing-upload cause | NOT VERIFIED beyond matching code gaps |
| Full production UX, live planner quality and generated images | NOT VERIFIED / NOT DEPLOYED |

Incident **UGC-UI-075-SLIDESHOW** is locally corrected with the evidence above; production acceptance remains OPEN.
