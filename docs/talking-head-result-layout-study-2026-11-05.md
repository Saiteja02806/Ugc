# Talking Head generated-result layout study — 5 November 2026

Status: design comparison only. No application component, application stylesheet, handler, provider, persistence or scheduling change. No build/deployment.

## Confirmed current behavior

- `components/explore/workflow-preview-canvas.tsx` renders `Use video N` beneath each player. It marks selection with `aria-pressed` and a blue default variant, without changing its wording to Selected.
- `components/explore/hook-workflow-preview.tsx` independently renders `Continue` when a source exists. It calls `changeSection("edit")`, the visible Demo stage. Its wrapper around `selectResult` hides generation results immediately; the clips overview then becomes visible. Selection and next-stage navigation are distinct actions presented without enough explanation.
- `components/explore/workflow-generation-boundary.tsx` selects the first available result when there is no explicit saved/cleared selection. An explicit missing saved ID does not silently fall back. Preserve that exact-asset recovery behavior.
- `components/video/video-results.module.css` deliberately reserves 36cqw before the prompt in compact results although the visible portrait player is narrower. This explains the large empty horizontal span in the screenshot. That spacing was previously intentional; do not broadly change the shared stylesheet merely to implement a Talking Head study.
- The prompt bubble already supports expansion/collapse and copy. History opens an existing generated-asset picker. These are capabilities to retain, not reasons to add duplicate controls.

## What belongs after generation

1. A playable result with sound, seeking, correct aspect ratio and a recoverable media-loading failure. Review expression, voice, framing and timing before continuing.
2. Explicit selected-video identity. One result needs a Selected indication rather than another required selection click; a batch needs a clear per-version choice without leaving the comparison immediately.
3. One blue next-step action named **Continue to Demo**, close to the selected result. Explain that the demo is optional. Selection and continuing must not submit generation, rendering, scheduling or payment.
4. Model, measured/output duration, quality and ratio when verified on that output. Read saved result/job metadata, not the current editable form. Hide unavailable values rather than invent them.
5. Prompt disclosure and copy tied to the selected result; History/replacement through existing controls; retained source/identity/script/demo drafts.
6. Clear per-result generating/failed/unavailable states and existing recovery actions. A failed or missing result cannot be selected. An independently valid completed selected clip need not be blocked merely because another batch item is still pending or failed. No silent paid retries.
7. Editing, finishing and scheduling remain in their existing stages. Any optional raw download must be labelled as the talking-head clip, not a finished video with demo; existing media download behavior is not reimplemented in this study.

## Alternatives

| Option | Arrangement | Best use | Tradeoff |
| --- | --- | --- | --- |
| Review and continue | Portrait beside selected state, output details and a blue Continue to Demo; prompt collapsed below the review information | One completed clip; strongest explanation of what to do next | Multiple versions require switching the focused preview |
| Compare versions | Visible version cards with Selected/Select video; shared selected-result summary and Continue to Demo immediately below | Batches of 2–4 clips | More vertical space on narrow screens; a single clip does not need the full gallery treatment |
| Preview first | Centered player; selected state and Continue to Demo directly underneath; secondary details below | Preview emphasis, especially mobile | Less efficient desktop space use; batch comparison uses switches |

Recommendation, not an applied decision: Review and continue for one result; Compare versions for multiple results, sharing selection semantics, output metadata and the same named next-step action. User comparison is still needed. No claim of measured usability preference or conversion improvement.

## Isolated study and evidence

Interactive fragment: `C:/Users/chund/.codex/visualizations/2026/11/01/01a198d5-555a-7a43-8ecb-c10a2760a8d3/talking-head-result-options.html`.

Three host carousel variants; optional design controls switch 1/2/4 example results and Ready/Generating/Failed. Local selection and Continue demonstrate the selected ID reaching an example Demo destination. History uses an example local dialog; prompt expansion/copy is local. All previews are explicitly labelled **Preview still** and reuse the user's screenshot crop through CSS, not newly generated media. Multiple cards intentionally reuse that still; no quality comparison or provider output is fabricated. The form/sidebar and real media playback are outside this contained results study.

Test command: `node .tmp/test-talking-head-result-options.cjs` (isolated installed Chrome, no server, bundling or build). Controlled browser checks cover three variants × three viewport widths (1000/390/320) × three batch sizes × three result states. Assertions cover one primary action per view, eligible/disabled states, no horizontal page overflow, exact version2 selection, selected-version Demo destination and return. Additional keyboard tests exercise native disclosure, History opening/Escape and copy success/fallback. Results and 18 captures: `.tmp/talking-head-result-options/`. Desktop variants and mobile narrow layouts manually reviewed. An initial file-URL preview decoded UTF-8 as Windows-1252; corrected the test harness to load UTF-8 text and added a rendered-text assertion. This was a diagnostic harness issue, not an application encoding regression.

No claims of real generated playback, source audio, authenticated History, reload persistence, backend/job receipt acceptance, mixed-success batch admission, real rendering or scheduling. These require integration tests after a design is selected and implemented. No production application tests/types/build required or claimed for unchanged application code.

## Preflight / preservation / receipt

Sources inspected: AGENTS.md, EXPLORE_CONTEXT.md (including Continue/Demo and output-layout history), docs/ai-context/clear.md, docs/ai-context/nonnegotiables.md; context-memory, immutable-contracts, ui-clarity, regression-gate, frontend-design and visualize skills; relevant current components/handlers/CSS listed above and existing workflow selection/section tests. `tools/preflight.py` prerequisite discovery PASS; git status audited and unrelated work preserved.

Edit boundary: task-owned design fragment; this receipt; append-only incident in clear.md. Ignored diagnostic script/results/images under `.tmp/`. No runtime files changed. Rollback only these study files and this task's appended incident evidence, preserving append-only history.

Protected runtime generation/prompt/provider/billing/selection/recovery and schedule contracts: unchanged by this task's edit boundary; NOT freshly integration-tested. Existing dark palette is reproduced in the proposals. Existing application layout remains unchanged. New proposal layouts are locally tested, not an approved golden baseline.

Incident **UGC-UI-20261105-TALKING-HEAD-RESULT-ACTIONS** remains OPEN pending design selection, application implementation and authenticated integration/visual acceptance. Proposed regressions are listed in its ledger entry. No automatic recommendation was applied.

5 November 2026 — User selected Review and continue as the preferred direction and requested removal of Your talking-head clip and Review the expression, voice and framing. Removed exactly those two lines from that isolated variant. Metadata, selection, prompt and Continue to Demo unchanged. Repeated381 isolated browser assertions PASS; reviewed refreshed320px capture. Application implementation still pending; no build/deploy.

5 November 2026 — User explicitly requested removal of the standalone Video 1 selected label. Removed the shared standalone selected-result summary from the design study; exact underlying selection and Continue to Demo behavior remain unchanged. Batch card Selected indicators remain. Repeated381 isolated browser assertions PASS. No application/runtime change, build or deployment.
