# Recent Hook Remix production audit — 24 October 2026

The reported failure is confirmed in a saved production request. The app had the correct business name, but v7 replaced a named tool with a generic category. The intended small edit is Claude → UGCPilot, preserving the rest of the source. A local v8 correction already addresses this distinction; it has not been deployed or verified with fresh provider output.

This audit made read-only receipt, database and deployment queries, ran local checks and wrote audit evidence. It did not change application code, production settings, saved remixes or business profiles. No new paid generation or deployment was submitted.

## Exact recent evidence

| Request | Source | Saved output | Finding |
| --- | --- | --- | --- |
| `32c168f2-30df-491a-a712-8a88cff56eef` — 24 Oct, 13:19 IST | POV: you finally understand<br>how to use Claude<br>for marketing | POV: you finally understand<br>how to use a marketing app<br>for marketing | Confirmed generic substitution. It loses the named product and produces repetitive wording. |
| `919ad968-f787-4f53-99f7-09697b8d8af0` — 24 Oct, 13:29 IST | Since when can WhatsApp<br>do THIS??!😭😭 | Since when can UGCPilot<br>do THIS??!😭😭 | This request does use the supplied brand. The inconsistency is not explained by missing business context. This observation concerns the name substitution, not whether an unseen demo supports every implied capability. |

Both saved inputs have model `gpt-5.6-luna`, prompt version 7, business profile version 2, empty additional instructions and identical saved business-context digests. Both include `businessName: UGCPilot` and the marketing-content product description. These are facts from the frozen server inputs, not assumptions about current Settings. The live brand-profile MCP endpoint lacked its brand-read scope, so the audit relies on the actual owned request context for this diagnosis.

Exact receipt/source/output evidence and the verified request metadata: [evidence JSON](hook-remix-recent-audit-evidence-2026-10-24.json). The source's `user-text` label does not prove someone changed it manually; the UI also passes unchanged source blocks through this path.

## Findings

1. **The prompt does not sufficiently distinguish a tool name from its category.** V7 asks for minimal word changes and discourages extra brand insertion. It permits noun-phrase substitution but does not explicitly say that replacing an existing named tool with the supplied business name is necessary rather than gratuitous promotion. The failed result is consistent with that ambiguity. The model's private reasoning and exact historical wire prompt were not recovered, so this is an evidence-backed contributing explanation, not proof of an internal decision process.
2. **This wording was generated before the UI applied it.** The malformed line is already in the immutable provider-result receipt. Both recent outputs survive the actual Apply function and JSON serialization unchanged in local checks. There is no evidence that the preview/editor replaced UGCPilot with marketing app in these cases. This does not claim visual acceptance of a hosted finished-video render.
3. **The earlier paid set did not cover the new failure.** The twelve earlier cases contain seven distinct source texts, none naming Claude or WhatsApp. The successful human-role correction for IT guy → marketing guy therefore did not establish correct named-product substitution. Treating those results as broad Remix qualification was too optimistic.
4. **Current validation cannot detect this semantic failure.** The saved bad result and the intended UGCPilot result both pass the same block-count/character-limit checks. Passing unit tests and valid JSON do not show that the brand choice or sentence meaning is right.
5. **The local correction and uploaded release differ.** Vercel's real-domain alias metadata, checked at 15:58 IST on 24 October, reports website deployment `dpl_5kXZzV6M1CkQv6xsGpqYJW1wbqXT` and MCP deployment `dpl_Hyt8aN1tsdQPG5pssDiapYd4XSpS`, both READY on commit `4d786d5c87508b3dab32a42f6d17535b32b3e733`. Source at that immutable commit selects Hook v7. The two live receipts corroborate v7 execution. The current worktree instead selects the uncommitted v8 named-tool prompt. The deployment check reads alias metadata and repository source; it is not remote server-file introspection.

## Intended correction and local state

```text
POV: you finally understand
how to use UGCPilot
for marketing
```

The existing local v8 prompt explicitly requires replacing an existing named tool with `businessContext.businessName`, using its exact spelling when the product fits the task. It disallows a vague marketing-app/tool category in that situation. Generic hooks do not receive forced brand insertion, human roles remain human, explicit no-brand instructions remain honored, and unsupported capabilities are still prohibited. It inherits the accepted minimal-edit v7 direction rather than rewriting the entire task.

No extra guidance is needed for this example: the user's intended edit and the saved business name are clear. The remaining question is whether the revised provider instruction reliably produces that edit across named-tool and human-role cases. That has not been demonstrated by a fresh paid comparison in this audit.

Existing receipts are deliberately immutable. Reading the same failed-quality v7 receipt after a future v8 release will return the same old wording; it does not silently regenerate or spend again. No saved result was changed during this audit.

## Checks and limits

- **34 focused local tests pass**, covering v8 request construction, the reported source/context, human-role instructions, original source preservation, output limits, history and old receipt recovery without a second provider call.
- The provider in these API tests is mocked. A test that supplies the desired UGCPilot output and then asserts acceptance is a contract check, not proof that the live model writes it. No new output-quality result is claimed.
- Two actual receipts pass Apply/serialization checks unchanged. Both the observed bad line and intended line pass the existing output validator. Checks and deployment metadata are recorded under `.tmp/hook-remix-oct24-audit-integrity.json` and `.tmp/hook-remix-production-audit-2026-10-24.json`.
- Before any claim of quality qualification, the evaluated cases should include named-tool replacements, human-role jokes and suitable generic hooks. Preserve these exact failure cases and distinguish prompt/provider evidence from mocked tests. No such paid round was submitted or queued here.

This audit covers the recent Remix changes and their release provenance. It does not approve unrelated font, analytics, video or starting-frame changes in the worktree. Production remains unchanged by this audit.
