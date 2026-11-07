# Explicit Gemini starting-frame identity route — 6 November 2026

Status: IMPLEMENTED and LOCALLY VERIFIED with mocked external operations. NOT DEPLOYED. Real output quality and hosted visual acceptance are NOT VERIFIED.

## Behavior

The existing Model dropdown offers **Gemini Omni · frame + identity photos** when a starting frame is selected in Hook, Text on screen and Talking Head. Selecting it explicitly sets `startingFrameMode: first_frame_with_identity` and model `google_omni`. It supports the approved frame plus up to five ordered identity photos. Selecting the existing Omni/Seedance/WAN options retains their existing ReAPI routes and does not delete photos.

The API validates the mode, model, frame provenance, photo ownership, roles, duplicates, count and existing duration/quality constraints before reservation. It freezes `provider: gemini` and the new mode in the job. The existing direct adapter sends the opening image as FIRST_FRAME/Image1 and the ordered identity photos as IMAGE_REF references. Existing sound processing remains intact. The image-generation stages and their prompts are untouched.

Submitted requests retain the route through recovery. The new unsent dropdown choice is frame-scoped component state and must be selected again after reloading the page. Existing saved photo selections are retained. Persisting that unsent preference remains OPEN.

## Scope and preservation

Application files changed in this continuation:

- components/video/video-generation-workspace.tsx
- components/explore/hook-workflow-preview.tsx
- components/explore/workflow-creation-form.tsx
- lib/explore/starting-frame-animation-input.ts
- lib/explore/workflow-generation-client.ts
- lib/ai-studio/video-generation-api.ts
- worker/src/lib/hook-starting-frame-video.ts
- worker/src/jobs/generate-hook-video.ts

Tests added/updated:

- scripts/explore-format-generation-ui.test.mjs
- scripts/starting-frame-animation-references.test.mjs
- scripts/workflow-generation-api-contract.test.mjs
- scripts/workflow-creation-form.test.mjs
- worker/src/jobs/generate-hook-video.test.mjs

Records changed: EXPLORE_CONTEXT.md, docs/ai-context/clear.md, docs/ai-context/nonnegotiables.md, this receipt and the global mistake ledger. Existing unrelated dirty work was preserved, including AGENTS.md and the prior photo restoration/popup fixes.

No CSS/layout, image-stage prompt, dependency, migration, deployment configuration or MCP changes. The only new UI choice is inside the existing model selector. Browser visual comparison remains NOT TESTED.

## Local evidence

Preflight: supplied AGENTS.md, project context and incident entries, protected contracts, global mistake ledger, ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-starting-frame, ugc-video-prompt, ugc-regression-gate, verify-feature-wiring, cross-feature-regression, and installed Next.js use-client guide. Context/ledger review in this continuation focused on the relevant recent entries. `python tools/preflight.py --repo . --task ...` passed read-only prerequisite checks.

Commands used:

```text
node --import ./scripts/next-server-only-test-loader.mjs --import ./scripts/worker-source-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --test scripts/explore-format-generation-ui.test.mjs scripts/workflow-generation-api-contract.test.mjs scripts/starting-frame-photo-carryover.test.mjs scripts/starting-frame-animation-references.test.mjs worker/src/lib/gemini-omni-video.test.mjs worker/src/jobs/generate-hook-video.test.mjs worker/src/jobs/generate-hook-video.reapi.test.mjs
```

189 passed, zero failures/skips. Log: .tmp/direct-identity-tests.log.

```text
node --import ./scripts/next-server-only-test-loader.mjs --import ./scripts/worker-source-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --test scripts/workflow-creation-form.test.mjs scripts/hook-workflow-preview.test.mjs scripts/workflow-generation-client.test.mjs worker/src/jobs/generate-hook-video.test.mjs
```

112 passed, zero failures/skips. Includes overlapping worker tests, so this is not 301 unique checks. Log: .tmp/direct-identity-siblings.log. This run includes the final worker missing-frame guard.

`node node_modules/typescript/bin/tsc --noEmit --incremental false` passed. Scoped ESLint on the eight application files passed. `git diff --check` passed.

| Boundary | Evidence/status |
| --- | --- |
| Hook/Text on screen actual component handlers | VERIFIED locally: explicit option enables valid frame/photos, switching back blocks without dropping photos, serialized mode and URLs match |
| Talking Head form | VERIFIED locally: existing selector explicitly sets/clears direct mode; sibling form tests pass |
| Talking Head real client → real API → job snapshot | VERIFIED locally: five exact ordered owned photos, separate frame, Gemini provider, explicit mode; foreign photo rejected before reservation |
| Worker routing | VERIFIED locally for all three workflows: exact frame/photo handoff, mismatched provider/model/mode rejected before reservation |
| Gemini request assembly | VERIFIED with mocked transport: FIRST_FRAME and IMAGE_REF roles, image bytes/order, token checking and recovery |
| Existing frame-only / voice / legacy recovery | Relevant local regression suites pass |
| Real provider/model quality | NOT TESTED; no external generation authorized or submitted |
| Hosted auth, configuration and visual interaction | NOT TESTED; no release performed |

These are layered local tests, not one real browser-to-Google generation.

Incident: UGC-VID-20261106-EXPLICIT-GEMINI-IDENTITY, linked to the prior raw-photo carryover and preserve-functionality records. Initial local test failures were corrected and recorded; history was retained.

## Release boundary

No build, push, deployment, MCP build, paid generation or private-image upload was performed. Before any eventual release, verify direct Gemini worker credentials/access and deploy compatible worker handling before enabling new admissions, especially for uploaded starting frames. Builds require separate explicit authorization. After release, verify all three authenticated workflows and review an authorized real video for identity, scene and timing. Rollback the explicit-option changes together without reverting the pre-existing popup/photo-restoration fixes or historical job support.


### Cross-workflow follow-up audit — 6 November 2026
Rechecked all starting-frame animation callers: Hook and Text on screen share VideoGenerationStudioPanel; Talking Head uses HookWorkflowPreview, WorkflowCreationForm and WorkflowGenerationBoundary. The latter submits through workflow-start, which forwards the unmodified request to the same video handler. Receipt creation retains complete validated inputs. The new mode and selected ordered photos are not stripped at these boundaries (source inspection). Phone and Slideshow do not use this starting-frame animation path; shared Phone form/client regressions remain covered.

Reran ten local test files together: 272 passed, zero failures/skips (.tmp/starting-frame-all-workflows-audit.log). Separately ran the local workflow-generation-atomic-api suite successfully (.tmp/starting-frame-batch-audit.log). These are mocked/local tests, not authenticated hosted or real generation tests. No application changes were needed in this audit. The direct option must be selected explicitly; ReAPI frame-only limits and separate voice-reference behavior remain. Unsent direct-route preference restoration remains OPEN. No builds, deployments or external generation calls.
