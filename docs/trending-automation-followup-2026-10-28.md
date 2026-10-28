# Trending automation follow-up — 28 October 2026

Status: local changes verified in focused checks; production acceptance OPEN. No deployment, migration, activation, regeneration or publishing mutation performed.

## Requested changes and implementation

- Automation workspace buttons and its dialogs use scoped pill corners. The shared Button component, neighboring workflows and existing Edit action are unchanged. Daily-count buttons also use pill corners. Browser screenshots exposed pre-existing mobile min-content clipping; a base single-column grid fixes that while preserving the desktop two-column rule.
- Structure 2 automation uses the newest active, ready, approved app screenshot from the source generation's business/category on its final CTA. Earlier proof/reflection slides do not take priority over the final CTA. Other backgrounds retain collection rotation; the screenshot does not consume a collection position. No active screenshot means the selected/default backgrounds remain. Lookup/render failure blocks preparation rather than silently replacing a requested screenshot. Structure 1 does not consult screenshot storage. Original generated slides and saved manual edits are not mutated.
- Snapshot JSON records the chosen `ctaScreenshotAssetId`, including read/reopen serialization. This is an optional field, with no database migration. App screenshots use the existing Settings/Trending upload system; no new upload control was added.
- Structure 1 planner v60 requests `slides.slide1` through `slides.slide6` with fixed per-position number/role schemas. The former array schema allowed six individually valid but repeated slide-5 variants. Decoder returns the existing normalized/persisted array shape. Legacy arrays remain strict: no renumbering, reordered content, rewritten claims or relaxed copy/fit/grounding validation.

## Production audit evidence — read only

Source: connected UGC Supabase project `kltxwijhluawgveykfbt`, aggregate SELECTs and inspection of one failed response's numbering only. No credentials, private copy or customer destinations are reproduced here. The initial audit crossed midnight locally; counts refer to the query windows at collection time, not an indefinitely current dashboard.

| Check | Observed result |
|---|---|
| Dedicated automation tables | Absent |
| Legacy fallback envelope | One configuration, status `draft` |
| Active automations | 0 |
| Schedules prefixed `auto-slot:` | 0 |
| Seven-day Carousel generations | 1,030 completed; 235 failed |
| Repeated-number failures | 36; inspected initial output numbered `1,5,5,5,5,6` |
| Other failures | Planner timeouts, role-image reservation timeout and rejected copy/fit/history constraints; separate causes, not fixed by numbering |
| Product screenshot inventory | 8 archived/inactive; no current active screenshot |
| Ordinary publication in later 48-hour query | 4 Instagram and 2 TikTok published targets, all 6 with non-null provider post IDs |
| Live unauthenticated Automation API | HTTP401 with sign-in-required response |

The draft is not an execution failure. There is no activated run to qualify. Existing ordinary publishing receipts do not prove this Automation workflow runs with a closed browser. Missing dedicated tables mean fallback storage is being used; its whole-envelope writes do not establish the dedicated schema's concurrency/uniqueness guarantees. Do not infer production readiness or auto-activate the draft from this audit.

The inspected local execution path is `replenishTrendingCarouselFeedPage` / `reconcileCompletedTrendingFeedForUser` → `sweepActiveSlideshowAutomationForUser` → `prepareUpcomingAutomationSlots` → exact-structure ready source → `prepareAutomationLibraryInput` → `saveGeneratedCarouselToLibrary` → `createUserSchedule` → `insertDirectScheduledPost` / `reconcileDirectScheduleHandoff` → existing scheduler and publish worker. There is no new browser timer. Local sweep tests confirm drafts/paused configurations do nothing, repeated sweeps retain one schedule, and pause during rendering prevents scheduling.

## Every file changed by this task

1. `components/trending/trending-slideshow-automation-workspace.tsx`
2. `lib/trending/slideshow-automation-render.ts`
3. `lib/trending/slideshow-automation-service.ts`
4. `lib/trending/slideshow-automation-contract.ts`
5. `lib/trending/slideshow-automation-service.test.mjs`
6. `worker/src/lib/carousel-llm-slide-plan.ts`
7. `worker/src/lib/carousel-counted-body-repair.ts`
8. `worker/src/lib/carousel-slide-positions.ts` (new)
9. `worker/src/lib/carousel-content-grammar.test.ts`
10. `scripts/trending-automation-ui.browser.cjs` (new)
11. `docs/ai-context/clear.md` (append only)
12. `CAROUSEL_CONTEXT.md` (append only)
13. This receipt.

All unrelated staged/unstaged work and six existing unmerged index paths are retained. No package, global styles, build configuration, database schema, IAM or deployment settings were changed. Rollback boundary is this task's diff in the files above, not the whole worktree. Before-source copies are in `.tmp/trending-followup/`.

## Preflight sources actually consulted

User-provided AGENTS.md and root file; relevant sections of CAROUSEL_CONTEXT.md, EXPLORE_CONTEXT.md and clear.md; nonnegotiables.md; scheduling-contract.md; prior `docs/trending-automation-gap-fixes-2026-10-27.md`; source/callers, SQL role reservation and existing tests; installed Next CSS guide. Skills read: ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-scheduling, ugc-regression-gate, ugc-video-prompt and Supabase skill. `tools/preflight.py` passed discoverable/readable prerequisites. Large histories were consulted by relevant sections; this receipt does not claim a full line-by-line history review. No missing-file exception or invented source was used.

Relevant preservation incidents include UGC-SCH-002/003/004/011, UGC-VID-009 and prior background/body-copy loss. UGC-TREND-001 was appended OPEN before implementation, with separate reported behavior, code/production observations and named regression scenarios. It remains OPEN for production acceptance.

## Verification

- `npm run worker:build`: PASS.
- App/database regression command: Node server-only loader + module mocks + transform types against slideshow-automation service/contract/UI/schema/database tests, reconciliation, schedule-time, schedule-atomic, product-asset editor and app-screenshot Settings contracts: **63/63 PASS**. `.tmp/trending-followup/final-verification.log`.
- Worker regression command: `node --test` on compiled Carousel content-grammar, counted-body, scoped-repair, Structure 2 render spec/render slide and Trending edit tests: **78/78 PASS**. `.tmp/trending-followup/worker-tests-final.log`. This includes the actual keyed schema, synthetic counted provider response decoding and retained negative content checks.
- `tsc --noEmit --incremental false`: PASS after fixing nullable category admission. `.tmp/trending-followup/types-final.log`.
- Scoped ESLint: zero errors. Planner-inclusive run reports one pre-existing unused `hasGenericCopy` warning; remaining changed files pass cleanly. `.tmp/trending-followup/lint-final.log`, `lint-final-scoped.log`.
- Actual Automation component browser harness, desktop1440×900/mobile390×900: PASS baseline and after; computed pill radii, draft-only mutations, empty-collection recovery, viewport bounds and failed-load state. Source authentication/accounts/API are fixtures; actual buttons, workspace, preview and time-picker components render. Initial sandbox Edge launch failed; outside-sandbox isolated run succeeded. No production browser profile or publishing capability is used.
- Before/after screenshots manually inspected: `.tmp/trending-followup/ui-before/content-1440.png`, `ui-after/content-1440.png`, `ui-before/appearance-390.png`, `ui-after/appearance-390.png`. Updated empty-collection recovery action is within viewport bounds. Existing top-step navigation remains horizontally scrollable on mobile. These are regression baselines, not a user-approved visual golden.
- Actual raster test verifies screenshot-colored pixels on CTA, CTA words retained, collection ordering for other slides, no educational screenshot and default fallback. Synthetic image artifact: `.tmp/trending-followup/cta-screenshot-fixture.webp`. It is not a real customer screenshot or provider generation.
- Production build: initial sandbox attempt failed with EPERM creating generated `.next/server/app/api/analytics/instagram`; an outside-sandbox retry is recorded separately. Final outcome is appended below.

Test counts from service-only reruns overlap the63-test set; do not add them again. No paid model request was made, so schema acceptance and generated quality on the real provider remain NOT VERIFIED.

## Protected behavior status and remaining gates

| Contract | Status |
|---|---|
| Scoped rounding, existing desktop layout, mobile recovery | VERIFIED in actual-component fixtures |
| Original slideshow/source text/order/manual edits | VERIFIED in service/render regressions |
| Screenshot scope/readiness and no-screenshot fallback | VERIFIED local tests + existing query contract; hosted screenshot output NOT TESTED |
| Structure 1 educational/copy/fit/history rules | VERIFIED local regression corpus |
| Pause, draft, duplicate sweep, local time and stored snapshot isolation | VERIFIED local service/database tests |
| Dedicated hosted tables/migration and fallback concurrency | NOT VERIFIED; dedicated tables absent |
| Closed-browser automated scheduling and provider delivery | NOT TESTED for this automation |
| Signed-in production UI acceptance | NOT TESTED; unauthenticated API only |
| All historical generation failures resolved | NOT VERIFIED; numbering schema corrected locally, timeouts and separate quality failures remain |

Release needs coordinated worker/website rollout, a decision on dedicated-table migration/fallback concurrency, and a controlled explicitly activated run with owned screenshots, saved schedule/targets/jobs and provider receipts. The user's draft was not activated. Do not treat a local build or the six ordinary publication receipts as end-to-end acceptance of this change.

### Final build outcome

PASS: outside-sandbox `node node_modules/next/dist/bin/next build --webpack` completed with exit0; compiled successfully, TypeScript completed and248/248static pages generated. Log `.tmp/trending-followup/build-unsandboxed.log`. This supersedes only the sandbox filesystem failure, not the remaining production acceptance gates. No build/deployment configuration was changed.
