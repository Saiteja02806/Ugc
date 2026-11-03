# Starting-frame hairstyle option — local implementation

The existing collapsed disclosure is now **Background and appearance**. It contains three independent choices: use background, outfit or hairstyle from the first selected influencer photo. New preparations default all three to source/off. Hairstyle includes color, length, texture, parting and volume, adapted to the source head angle, lighting and occlusions. Supporting photos remain identity-only.

Selection changes persist and affect the next generation request; they do not edit old pixels or trigger generation. A changed role invalidates old result approval. Historical drafts/receipts without a hairstyle field retain their existing shape, input hashes, labels and prompts.

## Files changed for this implementation

- `components/explore/hook-starting-frame-workspace.tsx`: rename disclosure, add independent checkbox and explicit current-role patch, update source caption; guard anonymous temporary-photo IDs before mutating strict owned-asset drafts.
- `worker/src/lib/starting-frame-reference-options.ts`: optional backwards-compatible hairstyle contract, strict role validation/canonicalization and new-role instructions.
- `worker/src/lib/hook-keyframe-image-labels.ts`: concise explicit scene/main/support role labels only for new hairstyle-aware requests.
- `worker/src/lib/openrouter-gemini-image.ts`: cleanup preserves selected hairstyle as well as outfit/background; existing role helper reaches both image stages.
- `lib/explore/hook-keyframe-draft.ts`: new preparations explicitly default to all-source; reading old records does not inject a new field. Existing canonical input-key path carries the new optional field through persistence/approval.
- `scripts/hook-starting-frame-ui.test.mjs`: three controls, independent selection/deselection, restore, no automatic submission, temporary-photo crash guard; legacy fixture shapes explicitly omit new defaults.
- `lib/explore/hook-keyframe-draft.test.ts`: all eight role combinations, approved-frame invalidation and legacy absence restoration.
- `lib/explore/hook-keyframe-client.test.ts`: legacy V2 fixture explicitly omits new defaults instead of inheriting V4-only fields.
- `lib/explore/hook-keyframe-generation-api.test.mjs`: canonical fixture construction, eight combinations, hairstyle mutation rejected for an existing paid key and malformed role rejection.
- `lib/explore/starting-frame-appearance.test.ts`: legacy/new schema, malformed role values, one/five-photo Seedream prompt budgets and image-label authority.
- `worker/src/lib/openrouter-gemini-image.test.ts`: both-stage role instructions for all eight combinations and golden historical SHA256 regression.
- `EXPLORE_CONTEXT.md`, `docs/ai-context/nonnegotiables.md`, `docs/ai-context/clear.md`: authorized product contract and append-only UGC-UI-117/118 evidence.
- This receipt.

Existing unrelated worktree edits are preserved, including earlier changes in shared worker/test/context files. Rollback only these scoped hunks, not entire files. No dependencies, migrations, IAM, hosting or global palette/layout changes. No commit/push/deployment.

## Wiring and compatibility

The shared canonical role object already travels through draft input keys, owned API admission, durable receipts and immutable request identities. The optional hairstyle field is now retained by that contract rather than discarded. Stage1 scene preparation and Stage2 identity replacement both receive explicit role and text-cleanup instructions; the existing harmonizer processes their result. The exact source t=0, source camera/pose/light and existing identity-photo order remain unchanged.

Old two-role inputs retain their exact canonical serialization and instructions. Four pre-change SHA256 snapshots cover old canonical data, role instructions, image labels and identity-stage cleanup prompt. New explicit hairstyle fields create a different input identity, so a paid request cannot be reused after switching hairstyle.

The first verbose implementation exceeded Seedream's4000-character limit. New three-role instructions and labels were shortened without altering historical text; all eight combinations now fit the default prompt with one or five identity photos. User-added text still obeys the existing before-billing size limit; the limit was not raised or bypassed.

For a future release, deploy the compatible worker **before** the website/API/UI. The old worker validator accepts only two roles. No release was performed here.

## Local verification

- `npm run worker:build` — passed.
- Application tests through existing Next server-only/module-mock/type-transform runner: `lib/explore/starting-frame-appearance.test.ts`, `scripts/hook-starting-frame-ui.test.mjs`, `lib/explore/hook-keyframe-draft.test.ts`, `lib/explore/hook-keyframe-generation-api.test.mjs`, `lib/explore/hook-keyframe-client.test.ts`, `lib/explore/hook-keyframe-prompt-preview.test.ts`, `scripts/source-utf8.test.mjs` — **139 passed,0failed**.
- `node --test worker/dist/lib/openrouter-gemini-image.test.js worker/dist/lib/hook-keyframe-generation-contract.test.js` — **24 passed,0failed**.
- `npx tsc --noEmit` — passed after the final application change.
- Scoped ESLint — zero errors; one existing unused-variable warning in the API test fixture. Scoped `git diff --check` passed.
- Actual local Hook preview: new disclosure opened with three controls defaulting off. Desktop1440px and mobile390px screenshots captured; no page horizontal overflow. Mobile disclosure measured336.8px wide inside390px viewport; source frame was actually decoded. Screenshots visually inspected.

The anonymous browser preview cannot generate or load owned influencer photos. An attempted temporary local photo reproduced an existing `local:blob` versus UUID draft-validation crash. A narrow preview-only guard now preserves the draft and shows the existing sign-in notice, with an actual component-harness regression test. Authenticated upload code is unchanged. The post-guard full browser upload replay was not completed because local route compilation was slow; do not claim that specific browser replay passed.

Artifacts/logs: `.tmp/starting-frame-hair/application-final.log`, `worker-final.log`, `legacy-hashes.json`, `appearance-desktop.png`, `appearance-mobile-expanded.png`. The baseline hashes were captured from the pre-change compiled worker. There is no approved same-fixture pre-change screenshot for the new three-control UI; prior UI source/geometry and the user's supplied layout establish the change boundary, not pixel-perfect visual acceptance.

## Protected behavior status

| Contract | Result |
| --- | --- |
| Three independent choices; source/off defaults; collapsed disclosure | VERIFIED locally |
| Select/deselect, restore, no auto-submit and old approval invalidation | VERIFIED in actual component harness |
| API ownership/immutable request collision checks | VERIFIED with isolated provider/storage boundaries |
| Stage1/Stage2 role instructions and original t=0/cleanup | VERIFIED with local multimodal-request tests |
| Legacy two-role prompts/labels/canonical identity | VERIFIED byte-for-byte snapshots |
| Dark palette and underlying layout | No CSS/global styling changes; desktop/mobile render inspected |
| Real generated hairstyle/background/outfit fidelity | NOT VERIFIED; no paid model call |
| Authenticated hosted flow, scheduling and production acceptance | NOT TESTED; not deployed |

Preflight applied: repository AGENTS, relevant Explore/incident/protected history, Python preflight, and session-read ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-starting-frame, ugc-video-prompt and ugc-regression-gate procedures. Installed Next layouts/pages guide was read earlier in the session; no new route convention was introduced. This receipt does not claim a fresh full reread of all extensive historical context. UGC-UI-117 is locally implemented/verified; UGC-UI-118 has a local guard and component regression, with the noted browser replay limit.
