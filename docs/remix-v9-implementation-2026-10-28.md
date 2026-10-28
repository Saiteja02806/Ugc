# Source-relative Hook Remix version 9

Implemented locally for manual Remix and automatic Hook text. Not deployed. No provider calls, production database writes, new dependencies or migrations in this implementation task.

## Behavior

New Hook requests share the exact base instructions from the approved five-call second pilot: KEEP suitable hooks and generic reactions unchanged; make only necessary named-tool edits; adapt mismatched situations and unsupported claims while preserving the reaction, question or payoff. Short stays short; long may stay long. This is not a universal two-line restriction. Unsupported personal results must not become another invented result or a feature label.

The shared browser-independent policy is version 9. Manual Remix passes the saved business context to its builder; automatic preparation freezes that same builder/version and context in the existing job plan. No extra model calls or retries are added. Model settings, quotas and opt-in reviewer flag remain unchanged.

Each source block gets a character budget equal to its original Unicode character count, capped by existing per-block limits. Explicit English named-tool slots can add only the positive character difference for an exact longer business name. This generalizes the pilot's two-character Claude-to-UGCPilot allowance; unsupported or unrecognized name slots get no automatic extra allowance. Existing structural and total safety limits still apply. Per-block ceilings prevent one short block borrowing space from a long neighbor. Prompt asks to preserve word count, natural wording and useful line breaks; these semantic goals are not falsely represented as deterministic guarantees.

Both new manual results and version-9 automatic results reject over-length output without truncation or automatic paid retry. Old automatic plans retain their old validation policy. Existing manual receipts are read before current generation logic and retain their exact saved text. User-authored editor changes and saved empty drafts remain protected by the existing persistence rules.

The optional calibrated reviewer is version 3. It receives the same budgets and KEEP/adapt policy. It accepts omission of an obsolete named tool during a grounded situation rewrite only with a passing brand review and explicit removed-name evidence (empty replacement name), rather than forcing an irrelevant brand into the sentence. Older review callers retain version-2 checks by default. Source identity, user no-brand preference, human roles, unsupported quantity/history checks and unchanged-keep-output checks remain enforced. Semantic relevance still depends on model review; the code does not pretend it can establish business relevance from length alone.

Wall, slideshow and Talking Head text prompts are unchanged. No UI, font, video prompt, scheduling, billing, API schema or source catalogue changes.

## Files changed

1. `worker/src/lib/hook-remix-source-relative.ts` (new shared policy/budgets)
2. `worker/src/lib/hook-remix-source-relative.test.ts` (new)
3. `lib/explore/hook-remix-brand-prompt.ts`
4. `lib/explore/hook-remix-brand-prompt.test.ts`
5. `lib/explore/hook-remix-quality-policy.ts`
6. `lib/explore/hook-remix-quality.ts`
7. `lib/explore/hook-remix-quality.test.ts`
8. `lib/explore/remix-text-api.ts`
9. `lib/explore/remix-text-api.test.mjs`
10. `lib/explore/automatic-hook-text-plan.ts`
11. `lib/explore/automatic-hook-text-plan.test.mjs`
12. `worker/src/lib/automatic-hook-text.ts`
13. `worker/src/lib/automatic-hook-text.test.ts`
14. `EXPLORE_CONTEXT.md` (append)
15. `docs/ai-context/clear.md` (append UGC-VID-023-REMIX)
16. This receipt.

Preserve unrelated shared-worktree changes. Rollback only this patch's hunks and new files, never reset whole files or rewrite saved requests. Old paid pilot scripts remain historical research inputs; they are not production entry points.

## Verification

77 focused tests PASS across 12 files: brand prompt, reviewer acceptance, evaluation, source handling, actual manual API harness, text edits/drafts, automatic plan, worker text execution, source-relative policy, automatic editor/database and Remix database contracts. Command and logs are under `outputs/remix-v9-implementation-20261028/` (`focused-tests.log`). Providers, billing/auth/database in API harnesses are mocked; no external calls were made.

New checks prove manual and automatic callers compile identical v9 policy; automatic preflight freezes that policy; old v8 plan replay does not refresh it; generic text stays byte-identical when returned; named-brand allowance; Unicode/per-block limits; manual overflow becomes terminal and cannot call the model twice; worker overflow becomes terminal with one call; obsolete-tool evidence cannot be invented; reviewer-v2 behavior stays available; historical manual v7 receipt text remains unchanged. Existing editor tests cover saved/manual/empty edits taking precedence over automatic text and request/owner boundaries.

TypeScript, scoped ESLint, worker TypeScript build and scoped diff check PASS. The first run caught one stale v8 prompt assertion and a mock result longer than a newly short user-written source; those fixtures were updated to test the v9 behavior. One newly added character-count expectation was corrected from 16 to the actual 17; no limit check was weakened.

Broader run: 77 PASS / 2 FAIL. The failures are outside this patch: `scripts/hook-remix-emoji-render.test.mjs` expects Poppins but receives the current Proxima Nova default; `scripts/remix-text-catalog.test.mjs` expects equal catalogue/inventory counts but gets 283 versus 302. An isolation import hook forbids every changed runtime module: both tests reproduce the same failures without importing any of them (`unrelated-baseline.log`). Neither failure was hidden or counted as passing. They remain release checks to resolve separately; this patch is not a full-release green light.

Existing paid outputs replayed offline: the runtime base instructions exactly equal the tested second pilot; all five outputs pass actual worker validation and editable-overlay creation. At 1080x1920 with existing default text styling/layout, source to output calculated line counts are: unrelated 2 to 2; related 3 to 3; generic 1 to 1; unsupported 1 to 1; long 6 to 5. This is actual local layout calculation, not fresh browser video rendering or provider export. Text is preserved exactly in editable overlays. Evidence: `paid-output-runtime-replay.json`.

The prior paid pilot improved wording but still removed “finally” unnecessarily in the long hook and produced a restrained question for the earnings claim. This implementation does not claim perfect semantic preservation. No additional paid test or reviewer result is claimed; reviewer-v3 model behavior is locally contract-tested only.

## Preflight and deployment limits

Used context-memory, immutable-contracts, regression-gate and Hook Intelligence skills; inspected provided/root AGENTS, protected nonnegotiables, relevant Explore/incident history, actual callers, schemas, worker and tests, plus frozen pilot prompts/results. Repository preflight PASS. Large historical context was inspected by relevant sections, not fully reread; no complete historical reread is claimed. No Next API/framework behavior changes were needed.

VERIFIED locally: shared policy/version, budgets, actual caller payloads, source/identity boundaries, old receipt recovery, no retry, manual edit preservation and text layout replay. NOT VERIFIED: authenticated deployed manual/automatic flow, fresh production-generated copy, real exported video and semantic generalization across the full library. No new UI means no before/after UI redesign is claimed.

Hold deployment: resolve or explicitly disposition the two broader failures and review the exact combined release state. Deploy the compatible generation worker before the server that freezes v9 plans, then verify both new-request paths and old receipt recovery on the real domain. Retain the user's pre-deployment notification requirement; no flags were enabled and no live prompts changed in this task.

## 28 October follow-up: verification corrections; deployment prohibited

User explicitly requested continuing local work without deployment. No push, deployment, production database write, provider request, or remote settings change was performed.

Scope this follow-up: three local verification files plus this receipt, EXPLORE_CONTEXT.md and append-only clear.md. No application runtime or UI changed in this follow-up. Existing v9 implementation above remains local for both manual Remix and automatic Hook text.

- scripts/hook-remix-emoji-render.test.mjs: new captions expect the approved Proxima Nova A Semibold (proximanovaa/600). Added explicit saved-Poppins/700 recovery check; no existing saved edit is migrated.
- scripts/explore-reference-text-inventory.mjs: include published October Hook releases, published Wall-money references and published slideshow additions using existing storage identities. Staged sources remain excluded by default. Missing19 =9Hook +6Wall +4slideshow; inventory now equals302 runtime references including archived Hooks. Production catalogue data is untouched.
- scripts/remix-text-catalog.test.mjs: verify exact reference ID sets as well as count, slide keys and fingerprints. Once count was repaired, test exposed intentionally retained transcripts for retired Wall08/09. The 22October Explore decision explicitly preserves them while removing the references. Test now binds only these two historical IDs to exact immutable hashes, requires their transcripts remain present, and requires lookup to reject both. All other transcript rows retain strict runtime resolution checks. No permissive unknown-record skip.

Checks rerun:77focused tests PASS (focused-recheck.log);3render/catalogue checks PASS (corrected-broad-checks.log); TypeScript PASS (types-recheck.log); worker TypeScript build PASS (worker-build-recheck.log); scoped runtime/script ESLint PASS (lint-recheck.log and fix-lint.log); scoped git diff --check PASS (line-ending notices only). Commands match the original focused suite above and node --test for the two corrected script files through the existing Next test loader. No full unrelated-worktree suite or website production build claimed.

Real FFmpeg exports cover four cross/tick pairs in clip and final-composition paths; decoded pixels verify white caption/red cross/green tick and no caption bleed into demo. Export crop manually inspected: .tmp/hook-remix-emoji-k29c1a/corrected-caption.png. Existing saved font/weight preserved, text recovery exact, source file bytes unchanged. Synthetic local media, not a fresh provider video or live editor acceptance.

Preflight: repository preflight PASS; context-memory, immutable-contracts and regression-gate read; relevant Explore font/retirement/Remix sections, incident follow-ups, protected nonnegotiables, runtime inventory callers and test diffs inspected. Historical context files were inspected by relevant sections rather than completely reread. No framework API change or deployment configuration change.

Incident UGC-VID-023-REMIX append records findings/evidence. VERIFIED locally: both caller policies, frozen old receipts/plans, saved/user edits, budget/no-retry behavior, render/font preservation and exact inventory. NOT TESTED here: fresh model semantics, live authenticated manual/automatic flows, live deployment. Scheduling/UI/starting-frame behavior unchanged by this patch; no cross-feature hosted acceptance claimed. Rollback boundary is these three scripts and follow-up documentation only; preserve the dirty shared worktree. Deployment remains on hold at user's request even though these two local blockers are resolved.
