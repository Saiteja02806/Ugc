---
name: ugc-immutable-contracts
description: Strict UGCPilot hard-protection skill. Use BEFORE EVERY code edit, especially a Codex request that might change working layouts, existing controls, prompt wiring, identity reference selection, scheduling execution, or shared components. Establish a minimal-diff change contract and block unapproved changes to protected behaviors.
---

# UGCPilot Protected Contracts / No-Surprise Changes

This is a procedural gate, not a magic guarantee. Verify against tests and diffs. A specific explicit user instruction can authorize a previously prohibited change, but only after consequences are made clear and contracts updated.

## Before edit

1. Read the real `explore context.md`, the entire `clear.md`, `nonnegotiables.md`, and relevant feature contract.
2. Inspect git status, recent relevant commits, current component API, caller graph, store persistence, backend side effects and existing tests.
3. Define the **edit boundary**: target files/functions and exact behavior intended. Identify any shared component callers potentially impacted.
4. Write a protected list for THIS patch (e.g., Schedule picker stays intact when fixing Starting Frame).
5. Decide evidence to collect to prove each protected behavior remains intact.

## Hard guardrails

- Do not remove/replace/move a component merely because a different implementation is simpler.
- Do not add a new always-visible control if a current button can open the required selection dialog.
- Do not alter API payload shapes, database schemas, social account ID mapping, auth boundaries or queue semantics as a side effect.
- Do not change loaded/empty/loading semantics of sibling tabs.
- Do not edit generation prompt templates without checking every upstream input and downstream consumer.
- Do not conflate source video starting time with a selected mid-video anchor timestamp.
- Do not silently change India wall-clock scheduling semantics or replace interactive 24-hour selector with a basic input.
- Do not commit broken/absent tests or claim 'implemented' when browser or backend checks were skipped.
- Do not revert uncommitted user work. No bulk autoformat on unrelated files.

## Allowed change categories

1. **Exact change:** minimal, requested behavior with explicit tests.
2. **Necessary support change:** related type/state/API improvement required for exact change, documented with justification and integration test.
3. **Unrequested change:** blocked by default; do not include it.

If multiple changes seem tightly coupled, separate commits and tests or propose a planned multi-phase migration. If a protected contract conflicts with the user's new explicit requirement, report the conflict and obtain clarification/approval as appropriate instead of burying it in code.

## Diff audit

Before handing off, inspect changed files plus git diff of surrounding components. Compare affected user flows and ensure no unexpected UI additions/removals. Read `ugc-regression-gate` for executable verification. Report protected components with status `VERIFIED` / `NOT TESTED` / `FAILED` — no general statement such as 'everything is fine'.

## Stop conditions

- Missing mandatory context unless user explicitly waives it.
- Only way to implement would replace a protected UX contract without authorization.
- Shared component has unreviewed consumers likely to regress.
- No environment to prove a change to a high-risk external publishing workflow; keep status `NOT VERIFIED` and do not claim production-ready.
