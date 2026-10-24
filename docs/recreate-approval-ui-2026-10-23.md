# Hook Recreate approval UI

Implemented locally in the active recreation overlay. A fixed header/footer
surround one scrolling content region. Approval remains visible at either end
of that region, including before an image exists (disabled). Cards select a
variation without approving it; Use selected frame verifies and approves the
selected receipt through the existing admission path. Changed inputs and motion
limitations still block approval. No generation automatically follows selection.

Generation settings groups the labeled image model, variations and total/unit
cost. After results, Generate more is secondary and keeps its total cost adjacent.
Larger previews have explicit Selected labels and independent enlarge buttons.
Mobile uses two columns, wrapped footer buttons and safe-area padding. Completed
results reveal themselves inside the content scroller without moving the footer.

Validation: 44 component/navigation/composer checks pass; full application
TypeScript, scoped ESLint and whitespace checks pass. The actual preparation
component/styles/dialog browser fixture passes at 1440x900, 1280x720, 390x844 and
320x568. Each viewport checks four results, selection followed by approval,
enlargement/Escape, no horizontal overflow and footer visibility at both scroll
ends. Desktop and mobile screenshots were inspected. The face chooser, auth,
source/image results and final video form are isolated sample boundaries, so the
fixture does not qualify provider output fidelity or authenticated production.

Reproduce: `node scripts/hook-recreate-layout.browser.cjs`.
Review captures: `outputs/hook-recreate-ui-2026-10-23/`.
No paid generation, deployment, worker, schema or production-data change.
