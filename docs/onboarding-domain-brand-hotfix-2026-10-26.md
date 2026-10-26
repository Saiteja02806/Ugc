# Onboarding domain-brand hotfix — 26 October 2026

## Scope and rollback boundary

Base is exact website production source adbfe49856f79d682fa7acc34aef281a32116296. Only the URL quality gate, website-analysis evidence handoff, setup validation, and their tests change. Domain-shaped brands are accepted only when visible scraped text supports the name. Request URLs, bare URLs, link destinations, email addresses, and lookalike domains do not supply evidence. Missing names, short summaries, empty audiences and generic app-store names remain rejected. Evidence is server-local and does not add schema/API fields. Previously accepted job-bound analyses resume without a second scrape or duplicate insertion. Existing draft/source/owner fencing remains intact.

No UI, auth, database migration, scheduling, provider prompt, provider model defaults or Carousel generation changes. Unrelated primary-worktree changes are outside this requested hotfix and preserved locally. Rollback website traffic to dpl_EQWnJEiXsvFEdWh9T4W2SoeRm5aq if live acceptance fails.

## Hook image compatibility

The historical failure used worker5f7b7747. Correction0f9f2eba already replaced the hardcoded non-v2 Nano Banana restriction with the explicit receipt model. Active worker45bf657be7624aa2b0de6f95f3d19cb049feddd0 has that correction and its worker tree matches the website base exactly. Read-only release guard confirms one100% traffic revision, verified baked/runtime identities and digest sha256:dee0eed824f9287f9939dee1564596a1ca97340ebc981b9a7ff174cfced784ea. No worker rebuild is needed for these website changes.

Regression UGC-VID-017 exercises v3 Gemini3Pro with the exact private1.7s source where available, or a public source under the same contract in public CI. Correct pixels reach the selected adapter; changed pixels and wrong models cannot submit. Legacy v1/v2 behavior remains covered. This verifies compatibility, not generated-pixel quality.

## Validation before staging

- New unit/orchestration checks:9/9 PASS, including repaired facts, unsupported evidence, required facts, persistence, saved-analysis recovery and source-revision fencing.
- Isolated onboarding/business-context/database suite:77/77 PASS, no skipped cases.
- Current-workspace Hook adapter/context suites:79/79 PASS, including historical private pixels.
- Isolated production-source targeted Hook suite:5/5 PASS, no skips, including model/hash rejection and legacy v1/v2 callers.
- Scoped ESLint PASS; isolated worker build PASS.
- Next typegen and TypeScript PASS. Initial fresh-checkout missing generated PageProps/image declarations were resolved by typegen.
- Local webpack production build blocked by ENOSPC/EPERM after disk filled, not accepted as a build pass. Removed only this task's generated .next directory, recovering726MB. Hosted production-environment staged build is required before promotion.

## Acceptance still required at this source receipt

Staged hosted build, production promotion, authenticated Cal.com retry, durable successful analysis/finalization/profile, rendered completed state and reload, negative/error/mobile states. No live success is claimed in this pre-release receipt. The user's existing failed job remains recoverable. No SQL was used to fabricate completion, no browser tokens were extracted and no authentication was bypassed.

## Source files

- lib/website-analysis/onboarding-quality.ts
- lib/website-analysis/process.ts
- lib/business-profiles/setup.ts
- lib/website-analysis/onboarding-quality.test.ts
- lib/business-profiles/onboarding-domain-brand.test.mjs
- worker/src/lib/gemini-image-curated.test.mjs

Related incidents: UGC-OPS-007 and UGC-VID-017. Root ledger keeps historical observations and will receive the actual deployment/acceptance result. No historical incident is closed by mocked tests alone.
