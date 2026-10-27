# One-time historical UI-mistake import from original explore context.md

**Goal:** Populate `docs/ai-context/clear.md` with ALL distinct mistakes actually described in the existing project history. The starter file contains only the visible incidents from the current conversation.

Instructions to Codex:

1. Find and read the REAL `explore context.md` fully. Do not manufacture an alternative or summarize from memory alone.
2. Extract every explicit UI regression, misunderstanding, UX constraint, layout breakage or broken interaction described there. Include generation / scheduling failures when they are tied to user-facing workflows.
3. For each candidate, compare against the 2026-10-25 initial incidents in `clear.md`. If already described, append a source link/evidence under the existing incident instead of creating duplicates.
4. Otherwise assign a unique UGC-UI/VID/SCH incident ID, mark status `HISTORICAL / OPEN / NEEDS CONFIRMATION`, and note the exact file section where it came from.
5. Separate user-reported symptoms from confirmed code-level causes. Do not invent current implementation state, dates or severity.
6. Add a concrete test that would catch each mistake. Preserve every previous entry in both files.
7. Report counts: historical complaints found, distinct incidents added, duplicates cross-linked, unclear complaints needing clarification.
8. Add new issues incrementally on every subsequent user correction.

Do NOT edit application code during the historical import. Run code fixes in separate scoped tasks.
