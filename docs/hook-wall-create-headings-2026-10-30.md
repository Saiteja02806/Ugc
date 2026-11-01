# Hook and Wall Create headings

Requested: hide only the redundant Hook video / Wall of text heading above the source tabs. Implemented with the existing hideHeading prop on FormatWorkspace's WorkflowVideoSourceSection. The h2 remains screen-reader-only; no new CSS or shared component changes.

Files changed: components/explore/format-workspace.tsx (one prop), EXPLORE_CONTEXT.md, docs/ai-context/clear.md (UGC-UI-071), and this receipt. Existing unrelated work preserved.

Same-session context-memory, immutable-contracts, UI-clarity and regression-gate procedures applied. Read-only preflight PASS. Existing workflow-source-video-ui suite: six tests PASS, including hidden heading accessibility, source choices, failure recovery and Create/Edit/Schedule controls. Diff inspection confirms only the heading presentation changed; provider requests, prompts, drafts and generation behavior unchanged. Browser desktop/mobile screenshots and deployed acceptance NOT TESTED. No provider calls or deployment. Rollback: remove the added hideHeading prop.
