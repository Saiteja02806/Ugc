# Verification of proposed plugin changes — 9 October 2026

The requested check was performed before implementation. The files were reread, the resource-path audit rerun, both package inclusion lists inspected, and the existing validator and six regression tests rerun. No plugin source, installed configuration, downloadable ZIP or production service was changed.

The original list mixed confirmed integration gaps with recommendations. It should not be interpreted as six demonstrated runtime failures.

| Proposed change | Verified status | Direct evidence and qualification |
| --- | --- | --- |
| Build the wall-of-text writer | Confirmed missing workflow | `plugins/WALLOFTEXT_GENERATION.md` starts with a transcription heading and accuracy note, has no YAML skill metadata, and contains creator examples rather than a business-context generation procedure. It remains useful reference material. The filename does not make it an installed writing skill. |
| Reduce trigger overlap | Confirmed overlap; recommended refinement | `UGC_HOOK_INTELLIGENCE.md` explicitly includes wall-of-text overlays and visual direction in its description/activation rules. `HOOK_VIDEO_GENERATION_SKILL.md` also activates for hook prompts and emotional direction. The overlap is visible, but no host activation experiment has established an actual wrong selection. It is not proof that routing is currently broken. |
| Repair supporting resources | Confirmed missing declared paths | The current audit found six absent paths in each of the hook director, Hook Intelligence and wall-video director: eighteen declared targets in total. Four of Hook Intelligence's references are embedded in the main document. Extract those sections instead of inventing replacements. Some remaining dependencies can be removed when the entrypoint already contains sufficient guidance. Missing historical audit artifacts must not be fabricated. |
| Package all five creative skills | Confirmed inclusion gap | `plugins/ugc-pilot/skills/` contains exactly three original skills. Both `scripts/validate-ugc-pilot-plugin.mjs` and `scripts/build-ugc-pilot-plugin.py` include twelve fixed files and no new creative skill. The validator rejects unexpected package files. Dropping Markdown into the parent `plugins` directory does not include it in the current release. |
| Define handoffs and preserve copy | Partially already implemented; extend integration | `WALLOFTEXT_VIDEO_GENERATION.md:16` gives copy ownership to the upstream writer; line 18 declares lossless text pass-through; line 37 requires upstream copy and says not to make users repeat it. It already defines these invariants. What remains is the missing wall writer, package integration and consistent selection of the requested deliverable. No new orchestration service is automatically required: installed skills can guide the host's model through combined drafting requests. |
| Test prompt versus generation activation | Verification requirement, not demonstrated defect | Existing tests validate the original package, not new skill selection. No signed-in ChatGPT/Claude activation test was performed. The existing `create-ugc-media` workflow remains responsible for requested paid generation. A prompt-only workflow can operate without sending a generation request. |

## Repeated checks

- `node .tmp/review-plugin-skill-roles-v2.cjs`: confirmed the same five source roles, three packaged skills and eighteen absent declared paths. Its evidence is in [the current role audit](plugin-skill-roles-evidence-2026-10-09.json).
- `node scripts/validate-ugc-pilot-plugin.mjs`: passed for the current twelve-file version 0.1.1 package. It still reports the known missing submission demo recording.
- `node --test scripts/validate-ugc-pilot-plugin.test.mjs`: six passed, zero failed.
- Workspace searches found none of the new source names in the application, worker or existing integration scripts. A similarly named `worker/src/lib/trending-hook-patterns.ts` is a separate module; it does not satisfy the missing `references/hook-patterns.md` path.

These results establish the present source/package state. They do not certify future edits, historical reference audits, installed model behavior or platform review acceptance.

## What can be handled without manual coding

The agent can write the wall-copy entrypoint using the user's defined role, retain the supplied corpus, narrow descriptions, extract embedded references, remove unnecessary broken references, add real schemas/evaluation cases, package the five roles, synchronize versioned manifests, and run local validation and regression checks. Historical observations or performance evidence should be retained only when their actual source artifacts are available; optional unsupported claims can be removed without needing the user to reconstruct them.

Use a separate private candidate version. Preserve the original supplied documents and the released 0.1.1 ZIP, keep the current MCP endpoint and account boundaries, and avoid changing backend APIs, billing, worker execution or automatic Carousel rendering for this drafting integration. New tests should verify resource completeness, package contents, exact-copy handoffs and absence of generation calls during text/prompt requests. After local checks, test fresh installed sessions before releasing to customers.

No editing method establishes zero regression risk in advance. This scope and sequence keep the current release available and make any candidate problems reviewable before rollout.

## What requires the user

No manual code edits are necessary. Authenticated acceptance requires the user's ChatGPT/Claude sign-in and OAuth consent in the clients; those sessions were previously deferred. The agent can drive available checks once authenticated sessions exist, but cannot bypass account sign-in. Original clip-audit files are needed only if their historical evidence claims are to remain; they are not necessary to author a truthful self-contained prompt skill. Any public directory application retains its separate eligibility and owner-attestation requirements, outside this verification request.

Implementation has not started: this report fulfills the user's request to check the findings first.
