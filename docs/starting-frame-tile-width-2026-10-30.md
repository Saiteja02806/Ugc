# Starting-frame tile width fix

Cause: WorkflowCreationForm already lays out three reference tiles. The compact StartingFrameAnimationReferences inside the first tile reuses referenceGrid, which also defaults to three columns despite rendering only one item. Its width is therefore divided again, making the frame and Change label narrow. The stored image is not recompressed by this path.

Fix: scope a single-column override to `.classicReference [data-workflow-reference-grid][data-reference-columns="1"]`. Preserve the outer three tiles, original aspect ratio/object-fit, preview/removal/Change actions, source/identity selection and generation payload. Only one application CSS rule changed.

Files changed for this request: components/explore/workflow-creation.module.css; scripts/starting-frame-compact.browser.cjs; EXPLORE_CONTEXT.md; docs/ai-context/clear.md (UGC-UI-073); this receipt. Existing unrelated changes retained. Same-session mandatory context/immutable-contract/UI-clarity/regression procedures applied; read-only preflight PASS.

Verification: 32 starting-frame/creation tests PASS; TypeScript PASS. Isolated actual-component browser fixture at1280px and390px PASS: inner grid has one column, fills parent width, frame remains at least80px wide; Change opens full picker, multiselection, Done/reopen/Escape, model switch, stored-frame selection and preparation callbacks preserved. No provider calls. Initial sandbox browser launch failed; approved outside-sandbox run passed.

Screenshots in .tmp/starting-frame-compact/: before-1280.png, before-390.png, compact-1280.png, compact-390.png, plus chooser/influencer states. Before images recreate the old three-column rule in the same fixture. Screenshots reviewed at desktop/mobile; they are isolated component fixtures, not full authenticated application acceptance. Hosted acceptance NOT VERIFIED; no deployment. Rollback: remove the scoped single-column rule.
