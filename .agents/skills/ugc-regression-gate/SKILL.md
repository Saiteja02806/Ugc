---
name: ugc-regression-gate
description: Mandatory UGCPilot change verification before declaring any AI IDE coding task done. Use after EVERY code edit to run lint/types/tests, compare approved UI screenshots, test negative/loading/refresh states, verify selected-video and timestamp contracts, and prove server-side scheduling where relevant. Record regressions in clear.md.
---

# UGCPilot Regression Gate

## Principle

**Compiles ≠ works. Frontend success ≠ published. Looks good in one screenshot ≠ responsive and stable.** Do not treat an absence of explicit user complaints as evidence that a change is safe.

## 1. Pre-change baseline (required)

- `git status --short`, targeted `git diff`, current tested commit/reference.
- Read relevant incidents in `clear.md` and actual `explore context.md`.
- Capture screenshots/video of current behavior for affected components where possible.
- Inspect existing tests and decide which tests can catch this exact past mistake.
- Determine intended baseline: **user's marked-up broken screenshots are evidence, not accepted 'golden' UI screenshots**.

## 2. Test layers after change

**Static:** existing lint, typecheck, unit test suite, build checks; do not fabricate command names — use repo's actual scripts.

**Behavioral:** assertions for exact requested state change, negative inputs, loading, timeout, invalid media, cancel/replace, reload, stale request and accessibility; preserve keyboard and touch behavior.

**Visual:** same browser, viewport, fonts, fixtures, target timezone and selected reference data; compare old approved baseline to new screenshot. Inspect unmasked changed regions manually. Repeat at mobile and desktop.

**Cross-feature:** navigate Create → Demo → Schedule → References → Your videos and back; verify shared state, scroll and CTA behavior are not broken.

**Generation:** correct source/identity separation; candidate frames with good/poor facial visibility; first vs mid source timestamps; prompt integration and generated video chronology.

**Scheduling:** real persisted target/job/queue; backend receipts; executing independent of browser; no duplicate publishing; 24-hour picker and timezone round-trip.

## 3. Required critical scenario examples

| Past incident | Regression assertion |
|---|---|
| UGC-UI-001 | Loaded frame has Change and NO extra always-visible Choose Photos tile |
| UGC-UI-002 | During restore, preview geometry remains stable and failure is recoverable |
| UGC-VID-001 | Occluded face triggers candidate search, not forced hidden face |
| UGC-VID-002 | Prompt includes selected source timestamp and motion post-anchor; no incorrect replay of pre-anchor events |
| UGC-SCH-001 | 24-hour picker exists and accepts 21:30 without losing intended clock time |
| UGC-SCH-002 | Schedule persists real targets, is executed by backend with browser closed, and handles redelivery safely |

## 4. Failure triage

If an unrelated feature changed, STOP, reduce patch scope, fix or roll back only the agent's own changes. Do not wipe user edits. If tests are blocked due to unavailable credentials/infrastructure, mark UNSAFE/UNVERIFIED for deployment, and state exact evidence still required. Do not green-light high-risk scheduling based solely on mocks.

## 5. Completion receipt template

```
Feature/task:
Preflight sources actually read:
Incident IDs handled:
Files changed:
Protected UI/feature contracts checked:
Tests: command / outcome / environment:
Before/after screenshots: paths and review outcome:
Generation output: source frame t=?, prompt version=?, clip QA=? (if applicable)
Scheduling evidence: schedule=?, targets=?, job=?, publish result=? (if applicable)
Regressions/new incidents:
Status: VERIFIED / PARTIALLY VERIFIED / BLOCKED
Unverified risks:
```

## 6. Update mistake memory

When a failure is discovered, log it in `clear.md` with source and test before continuing. Mark solved only on actual verification. Keep old failure notes visible so a new session sees them.
