# Vercel Build Cost Audit — <date>

**Scope:** team <...>; repo <...>; 7-day window <...>; 30-day window <...>
**Coverage:** projects <n> / <n>, deployments <n>; billing access complete / partial / none.

## Executive summary
- Screenshot/actual Build CPU Minutes charges: $___ of total $___; on-demand charges: $___; timeframe ___.
- Root cause(s), confidence, and what needs further verification.

## Topology
| Project | Repo/root | Prod branch | Domain/role | Needed? | Verified? |
|---|---|---|---|---|---|

## Findings
| Severity | Finding | Evidence (log/URL/file) | Confidence | CPU minutes / dollars | Safe change | Risk / rollback |
|---|---|---|---|---|---|---|

## Prioritized plan
1. **Without code changes** — action, expected behavior, how to verify, restore plan.
2. **Code/config changes** — tiny scoped patch, tests, predicted impact.
3. **Requires approval** — Vercel setting, production implications, how to undo.

## Quantified savings (if evidence exists)
- Baseline: ___ CPU minutes across ___ deployments; per-project breakdown ___ .
- Proposed change: avoid ___ unnecessary deployments * ___ measured CPU minutes each = ___ CPU minutes; at verified $___/CPU-minute = $___ (assumptions ___).
- If insufficient evidence: **savings cannot yet be reliably quantified.**

## Validation
- Local: ___
- Preview QA: ___
- Production smoke tests: ___
- One-week / one-month follow-up: ___

## Missing evidence
- ___
