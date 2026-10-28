# AI influencer prompt Skills — 27 October 2026

Implemented locally; not deployed. Multi-select and full merged Copy follow the user's stated defaults.

## Behavior and boundary

- Config-driven Skills pill after Model / Ratio / Count. Seed: Realistic Skin with the exact supplied instruction. Popover rows toggle independently; selected chips near the prompt remove individual presets. Only this seed is exposed; multi-select is verified with an additional fixture-only preset.
- Textarea, two-line result cards, native prompt tooltip and History display authored text. Applied skill names appear separately. Copy uses the complete frozen prompt.
- Client sends authored prompt plus optional ordered skillIds. Authenticated server validates IDs, duplicates and combined prompt length before reservation, then merges once and stores a presentation snapshot in existing job JSON. All five existing provider paths receive the merged prompt.
- Retries reuse admitted jobs and snapshots. No-selection fingerprints and prompt behavior retain compatibility. Skill ID/instruction pairs are immutable; revised wording needs a new ID. Never strip suffixes from old prompts to guess metadata.
- Selection is draft-local and follows the existing prompt's session/account reset. Pending requests preserve selected IDs across refresh. Closing or removing a draft chip cannot rewrite a prior generation's prompt.
- No dependencies, migrations, database queries, auth/ownership rules, pricing, worker runtime, scheduling or deployment settings changed. Original horizontal rail, enlargement, reference selection and workspace-only removal remain in place. Rollback only these task changes; preserve prior layout work and all unrelated worktree changes/conflicts.

## Files changed by this feature

- lib/characters/prompt-skills.ts (new config, composition and snapshot reader)
- lib/characters/prompt-skills.test.ts (new composition/validation/snapshot tests)
- lib/characters/schema.ts (optional skill IDs and composed limits)
- lib/characters/generation-service.ts (fingerprint and immutable job prompt/snapshot)
- lib/characters/generation-api.ts (owner-scoped status presentation)
- lib/characters/identity-service.ts (owned History presentation)
- lib/characters/types.ts (optional presentation metadata)
- lib/characters/result-groups.ts (batch presentation from saved metadata)
- lib/characters/generation.test.mjs
- lib/characters/history.test.mjs
- lib/characters/client-session.test.ts
- components/characters/character-workspace.tsx (selector/chips, submission, raw preview/full Copy)
- components/characters/character-workspace.module.css (scoped pills, popover and fixed result metadata space)
- components/characters/character-history.tsx (authored text and skill names)
- components/characters/use-character-builder.ts (History metadata handoff)
- components/characters/character-reference.test.mjs
- scripts/character-reference.browser.cjs
- worker/src/jobs/generate-image.test.mjs (provider-boundary test only)
- EXPLORE_CONTEXT.md, docs/ai-context/nonnegotiables.md, docs/ai-context/clear.md
- This receipt

## Preflight and review

Read AGENTS.md, nonnegotiables, context-memory / immutable-contracts / UI-clarity / video-prompt / regression-gate skills; relevant Explore/incident and prior influencer records; installed Next.js CSS/client-component guidance. Long context/ledger command output was truncated; no claim of exhaustive historical inspection. Preflight script prerequisites PASS. Reviewed optional job metadata against existing reservation SQL validation and worker prompt parsing; current contracts permit the additive job JSON. No source-video/starting-frame/publishing changes. Read React best-practices for the two modified TSX components and checked state derivation, functional updates, accessible names/checkbox state, scoped styling and no additional effects/network fetching. Supabase guidance consulted for the existing job storage boundary; no database mutation performed during verification.

## Checks and evidence

- VERIFIED locally: 93 tests via node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test components/characters/character-reference.test.mjs lib/characters/prompt-skills.test.ts lib/characters/generation.test.mjs lib/characters/history.test.mjs lib/characters/identity.test.ts lib/characters/identity-routes.test.mjs lib/characters/result-groups.test.ts lib/characters/client-session.test.ts.
- VERIFIED locally: 2 tests via node --experimental-test-module-mocks --experimental-transform-types --test --test-name-pattern="influencer (jobs send|skill instructions)" worker/src/jobs/generate-image.test.mjs. Executes existing compiled worker with mocked provider/storage boundaries. All five adapters preserve exact merged text, without presentation metadata added to it. Worker source unchanged; no fresh paid provider acceptance.
- VERIFIED: npx tsc --noEmit --incremental false; scoped ESLint across modified application/test files; scoped git diff --check (line-ending warnings only).
- VERIFIED locally: node scripts/character-reference.browser.cjs at1100x900,390x844 and touch. Skills toggle/chip removal, count, raw draft/result/tooltip, complete clipboard, History after reload, no horizontal page overflow; existing rail height/pending/completion/lightbox/uploads/mixed references/downloads/idle/recovery checks pass. Uses real components and builder with substituted auth/API/media. Browser fixture simulates skill composition; separate actual server and worker tests establish those boundaries.
- Before: .tmp/influencer-skills-baseline/rail-desktop.png and rail-mobile.png. Observed local baseline, not a user-approved golden.
- After: .tmp/character-reference-browser/skills-picker-desktop.png, skills-selected-desktop.png, skills-picker-mobile.png, skills-result-mobile.png, skills-history-mobile.png. Desktop/mobile screenshots manually inspected; final screenshots disable CSS animations for stable capture.
- Initial harness failure retained its earlier clipboard-error stub and sampled metadata before result arrival. Restored native clipboard and added explicit new-result wait; complete rerun PASS. No corresponding application bug claimed.
- Incident: UGC-UI-041-INFLUENCER follow-up documents regression coverage; this is a new feature request, not a newly reported defect.
- NOT TESTED: neighboring production Create/Demo/Schedule flows, real hosted reservation JSON persistence and authenticated hosted integrations.
- NOT VERIFIED: production acceptance and actual image realism. No deployment, paid model call or full production build. Existing browser profile is unavailable for hosted acceptance in this session; full app worktree contains unrelated merge conflicts. Local tests do not establish production readiness.
