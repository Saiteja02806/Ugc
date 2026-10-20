# Section workspace for Talking Head + Demo

**Updated implementation:** The later existing-header and compact-reference direction is implemented and verified in [Workflow frontend implementation](design/workflow-ui-implementation-2026-10-10.md). The description below records the earlier proposal: its separate stage navigation and expandable reference/settings groups are superseded.

The approved direction gives the active workflow section the main workspace,
with three labelled stages: Create, Edit & add demo, and Schedule. The first
implementation applies to Talking Head + Demo and its shared phone composer.
The phone workflow remains hidden from Explore. Other format workflows retain
their current layouts for comparison before a broader rollout.

Create places instructions before optional references. References and video
settings use native expandable groups with visible attachment/settings summaries.
Edit keeps subtitle styles and examples inside an expandable appearance group
with the selected style and position visible in its summary.
An empty preview is hidden by default and can be opened explicitly. Generation
progress, failures, results, and selected uploads reveal the preview automatically.
Edit and Schedule always retain their preview. Available width determines whether
controls and preview appear alongside each other or in a single column.

The stages use the existing mounted tab panels. Instructions, media selection,
generation settings, edit options, and scheduling drafts keep their existing
owners and survive navigation. Tab orientation follows the visible layout so
keyboard arrows move in the expected direction. Generated clips and saved edits
offer explicit Continue actions. Authentication, generation, rendering, account
selection, scheduling, and credit checks keep their existing implementations.

Validation: TypeScript and scoped ESLint pass, along with all 267 workflow
unit/contract tests. Local desktop and mobile checks confirm no horizontal
overflow, layout-appropriate keyboard navigation, preserved instructions and
caption drafts, and expandable previews. Final authenticated acceptance requires the production
domain after this change is deployed; the current production browser session
stops at sign-in.
