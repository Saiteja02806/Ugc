# AI Character and Text on screen wiring audit

5 November 2026 · Current source · Explore

## AI Character

After an uncertain response, the builder retained the original generation request. The studio could still block its only action using the new credit quote or run current look preparation before reaching that saved request. A local component fixture reproduced the zero-credit disable. The existing button now says **Retry previous request** while a request is pending and sends the saved request directly. The service reuses existing batch IDs before checking credits. If the earlier request never reached the service, the explicit retry still goes through normal new admission using the original request.

| Boundary | Evidence |
| --- | --- |
| Trait selection, upload and submit | **VERIFIED locally.** Current workspace handlers prepare ordered owned trait IDs. Tests cover selection, batch size, upload failure, fresh affordability and the exact saved request after a selection change and exhausted credits. |
| Admission, durable input and replay | **VERIFIED with synthetic infrastructure.** The real service checks owner/source-bound asset IDs and positions, rejects stale or foreign references, freezes prompts/settings and reuses the original jobs and single reservation with access denied on replay. |
| Worker and result | **VERIFIED with synthetic storage and provider output.** Current version 4 receives every selected reference in the scene stage. Identity receives the exact scene bytes and first identity reference only. Real local harmonization supplies the final object. Deleting that synthetic final object and rerunning the same job recovers it from saved stages with no additional provider calls. Owned status, save and History selection were checked separately. |
| Authenticated browser and visual fidelity | **NOT TESTED in this audit.** Exercise lost acknowledgement and reload on an authorized hosted session. For output, compare the scene and identity stages against disclosed inputs. The previous v4 trial recorded partial identity and cropped feet, so visual acceptance stays open. |

## Text on screen

| Boundary | Evidence |
| --- | --- |
| Recreate, source and identity selections | **VERIFIED locally.** Component and admission tests cover A-to-B and clear, an owned upload versus a gallery source, Sound off and explicit Sound on, selected model/settings, approved opening and retained ordered photos. The current ReAPI literal-opening routes reject extra identity photos before charging while the UI retains them. |
| Generation and background prompt | **VERIFIED with synthetic infrastructure.** Current API and worker/adapter suites exercise owned inputs, versioned starting-frame provenance, footage-only instructions and ReAPI request shaping. Provider output was not requested. |
| Manual Remix, editor and recovery | **VERIFIED locally with synthetic services.** Source-bound manual Remix uses the current reference and editable layers. Existing edits and explicit empty drafts survive late recovery. The catalog suite checks all 97 active layout entries. Automatic text remains gated on client and server and was exercised with fixtures. |
| Export | **VERIFIED with real local FFmpeg.** Synthetic A/B/clear exports retained all three seconds of the source. Decoded opening, middle and ending frames show the earlier caption, replacement caption and cleared state as requested. Audio samples confirm the chosen repeating soundtrack and its absence after clearing. Source bytes stayed identical. |
| Schedule and hosted behavior | **Locally verified** for the pending composition snapshot and worker contracts. **NOT TESTED** for authenticated hosted selection, a live generated background/Remix, hosted export, or publication. Observe one authorized owned request through stored worker output and final preview to close hosted acceptance. |

## Checks and scope

- Read AGENTS, the global mistake ledger, relevant Explore and project incident sections under the approved reading exception, full protected contracts, both wiring skills and their evidence references, project context/immutable/UI/prompt/regression procedures, and the local Next client boundary guide. Ran read-only `python tools/preflight.py`.
- Ran five non-build `node --test` groups with the app and worker source loaders. Character and image worker 293 passed. Video admission, worker, automatic overlay and photo carryover 102 passed. Explore UI, editor, Remix and catalog 282 passed. Finishing, schedule and layout 73 passed. Starting-frame and ReAPI adapter 66 passed. Total 816 passed with zero skips in the final runs.
- App and worker TypeScript no-emit checks passed. Scoped ESLint had zero errors and seven existing warnings. The stale shared private-media mock was repaired so the Character worker test could load. Desktop and mobile browser visuals were not exercised.
- Application changes are limited to `components/characters/character-workspace.tsx` and `components/characters/influencer-customizer-dock.tsx`. Regression evidence lives in `components/characters/character-reference.test.mjs`, `lib/characters/generation.test.mjs`, `lib/characters/studio-worker.test.mjs`, and `scripts/explore-finishing-single-pass.test.mjs`. The local correction can be reverted independently of job data.
- Recorded UGC-UI-20261105-CHARACTER-PENDING-RECOVERY in `docs/ai-context/clear.md`, with a related entry in the global mistake ledger. Updated `EXPLORE_CONTEXT.md` for the recovery behavior. No worker, model, storage schema, provider, scheduling or Text on screen application changes were needed for this patch.
- Build, deploy, paid generation, publishing and production changes were outside this audit.
