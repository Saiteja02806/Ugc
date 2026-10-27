---
name: ugc-context-memory
description: Mandatory UGCPilot preflight and mistake-memory maintenance. Use before EVERY code task or when a user reports any past or new UI, video-generation, prompt, or scheduling mistake. Read the real explore context.md, clear.md, and protected contracts; record new incidents without deleting history.
---

# UGCPilot Context and Mistake Memory

## Trigger

ALWAYS before any code edit, even if the request seems unrelated to UI. Also trigger the moment the user reports a bug, expresses dissatisfaction with an implementation, or refers to a repeated mistake. This workflow exists to prevent the model from losing previous constraints across sessions.

## Mandatory sources — read, do not merely mention

1. Identify repository root. Locate the REAL project file called `explore context.md` (case/path may vary). Search via `rg --files -g '*explore*context*.md'` or targeted filename checks. Read it fully, including relevant historical entries. Do not create a fabricated replacement. If the file is absent or inaccessible, stop code edits and report that the context source is missing. Do not guess its past mistakes.
2. Read `docs/ai-context/clear.md` fully. This is the durable mistake ledger and is append-only.
3. Read `docs/ai-context/nonnegotiables.md` and task-specific contracts, and the root `AGENTS.md`.
4. Inspect the working tree: `git status --short` and existing diffs. Never discard user changes.
5. Run `python tools/preflight.py --repo . --task "<request>"` if available; manual equivalent otherwise.

## Convert context to actionable constraints

Create a **Preflight Context Receipt** in the task plan containing:
- Paths actually read, not just expected.
- Relevant existing incident IDs and key historical lessons.
- Which user expectations are explicitly preserved.
- Open uncertainties and missing sources.
- Skill routing (`ugc-ui-clarity`, `ugc-starting-frame`, etc.).

If explore context contradicts newer user requests, explicitly describe the conflict; newer explicit current requirements control when they are clear, with protected contracts updated through a reviewed change.

## Record every mistake durably

For each NEW user-reported problem:
1. Immediately append an entry to `clear.md` with a unique ID (prefix UGC-UI, UGC-VID, UGC-SCH, etc.), date, affected feature, screenshot/log references, and **observed vs expected** behavior.
2. Label the claim `SCREENSHOT OBSERVED`, `USER REPORTED`, `CODE CONFIRMED`, or `UNVERIFIED` appropriately. An honest record beats a guessed root cause.
3. Set `Status: OPEN` and `Root cause: UNKNOWN` until there is concrete file/log evidence.
4. Include a named regression test that would prevent recurrence.
5. Append an entry for repeated occurrences linked to the original; do not erase prior entries.
6. On verified fix, update status with exact evidence, tests, and commit hash when available.

**Do not turn a complaint into a broad code rewrite.** The ledger records problems; it is not blanket permission to edit adjacent features.

## First-install historical backfill (one-time, then incremental)

The starter `clear.md` contains only mistakes documented in this conversation, not every historical project mistake. On the FIRST run with the real repository:

1. Read the entire original `explore context.md`, including repeated reports scattered across different features.
2. Build an inventory of each **distinct UI mistake** (and relevant video-generation/schedule regressions) with exact existing source headings, lines or text references.
3. Compare against `clear.md` IDs. Avoid duplicating equivalent entries; link repeated occurrences explicitly.
4. Append any missing historical incidents to `clear.md`, labeling them `HISTORICAL, UNVERIFIED` unless independently reproduced. Preserve source date or mark it unknown.
5. Give each an expected behavior and a future regression test; leave root cause UNKNOWN until repo code proves it.
6. Report count imported, count already covered and entries that were too ambiguous to classify. Do not delete or shorten `explore context.md`.

On subsequent tasks, read both documents and repeat an incremental comparison when new mistakes were added to either.

## Start and end checks

At BEGINNING of task, read sources and disclose a short preflight receipt; at END, mention incident changes and whether every relevant mistake has a regression test. If unavailable, mark as blocked/unverified.

## Exact example

User: "Why is Choose Photos still showing under the frame?"

- Read explore-context and `clear.md` and find UGC-UI-001.
- Inspect actual render conditions, identify duplicate affordance.
- Plan minimal fix only in affected component.
- Verify loaded, restoring, replacing and canceling states.
- Preserve UGC-UI-001 history; mark fixed only after screenshot and interaction tests pass.

## Failure conditions — STOP / report

- Explores context file missing and no user-approved exception.
- No relevant repo access but agent claims to have read it.
- Existing uncommitted changes would be overwritten.
- User reported issue omitted from `clear.md` after a code change.
