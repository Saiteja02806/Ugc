# Talking Head generation animation — 14 October 2026

The Talking Head + Demo creation preview previously displayed only a status sentence while video generation was running. AI Studio already rendered an animated video-shaped card. The separate Explore preview had never included that card.

Extracted AI Studio's existing dimmed-reference preview and spinner into `components/video/video-generation-placeholder.tsx`. Both AI Studio and the shared Talking Head/phone creation canvas now use that component. Text-only generation shows the same card without a reference image.

The connected controller exposes the number of unfinished outputs and a preview of the clicked aspect ratio/reference. It captures those settings when the user clicks Generate. Preparation, saved-request recovery, active generation and finished-media loading use appropriate labels. Completed outputs remain available while other outputs are pending; failed/cancelled outputs stop contributing placeholders. Errors remain visible alongside any successful outputs.

The spinner has a polite accessible status and respects reduced-motion settings. No percentage or completion estimate is invented. This visual does not submit or retry generation and does not display a dummy playable video.

## Validation

- 143 focused regressions passed across creation/composition, generation/recovery, existing AI Studio presentation, failed-provider output, and reference controls.
- Full application TypeScript, scoped ESLint and whitespace checks passed.
- Real browser checks passed at 1280×900 and 390×844 for portrait, landscape, two pending videos and text-only states. Verified the frame's aspect ratio, no horizontal overflow, active spinner animation and reduced-motion behavior; no browser errors.
- Browser preview renders the actual shared components with controlled state. It has no account/provider requests and spends no AI credits. This is local visual verification, not production acceptance.

Evidence is under `.tmp/talking-head-generation-animation-20261014/`, including desktop/mobile screenshots and browser measurements. The local preview is an isolated result-pane demonstration; it does not reproduce the full authenticated workflow.

The changes are local and require a website deployment to become active. No worker or database change is needed for this animation. Production verification must use the deployed domain and a real pending job before claiming live acceptance.
