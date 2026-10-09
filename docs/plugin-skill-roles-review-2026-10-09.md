# UGC Pilot creative skill roles — revised review, 9 October 2026

The [subsequent verification](plugin-skill-findings-verification-2026-10-09.md) distinguishes confirmed source gaps from recommendations: trigger overlap has not been proven to cause host misrouting, and the wall-video skill already defines exact-copy handoff rules that should be preserved and extended.

This review covers the renamed files and two newly added prompt skills. It supersedes the earlier two-skill inventory. The user's intended product is five creative workflows: hook copy, hook video prompts, wall-of-text copy, wall-of-text video prompts, and slideshow text. Prompt drafting is a useful deliverable in its own right; it does not require submitting a paid video generation.

No plugin instructions, package, installed settings, application planner, worker or deployment were changed. The review produced this document and static evidence only.

## Intended routing

| User request | Skill role | Supplied source | Output |
| --- | --- | --- | --- |
| “Give me text for a hook video based on my business.” | Hook copywriter | `UGC_HOOK_INTELLIGENCE.md` | Short original overlay hooks grounded in the business, audience and actual product features. |
| “Give me a prompt for hook video generation.” | Hook video director | `HOOK_VIDEO_GENERATION_SKILL.md` | A footage prompt with emotion, visible actions, camera, duration, continuity and audio instructions. |
| “Give me wall-of-text copy for my video.” | Wall-of-text copywriter | `WALLOFTEXT_GENERATION.md` | Original paragraph/list overlay copy based on the business and requested style. |
| “Give me a video prompt for this wall of text.” | Wall-of-text video director | `WALLOFTEXT_VIDEO_GENERATION.md` | A background-footage prompt and, when requested, a layout specification that preserves the supplied text. |
| “Write the text for a social slideshow.” | Slideshow copywriter | `SLIDESHOWS_TEXT_GENERATION_SKILL/ugc-native-slideshow/SKILL.md` | A coherent cover and slide sequence, separate text blocks and visual intents. |
| “Now generate the video using this prompt.” | Existing media executor | `ugc-pilot/skills/create-ugc-media/SKILL.md` | Entitlement/capability checks, a single supported generation request, job tracking and the actual returned result. |

The two video-director files already contain much of the right creative methodology. They need integration and boundary repairs, rather than being merged back into one general hook skill. The supplied wall-of-text generation file is still a transcription collection; renaming it has not added a writing workflow.

## Business context and handoffs

Use the user's provided brief or reusable context from the same conversation. When the user wants their connected UGC Pilot business context and tools are available, `get_saas_brand` supplies the product summary, audience, problem, promise, value propositions, differentiators, tone, claims to avoid and missing information. It requires `brand:read` and completed onboarding. Handle missing access or an incomplete brand profile honestly; accept a user brief rather than blocking every drafting request on sign-in. Ask one focused question only when essential information is absent.

Keep these concerns separate:

- **Format:** hook, wall of text or slideshow.
- **Deliverable:** copy, a video prompt, both, or an actual media generation.
- **Context:** business facts, audience, requested tone and supplied references.

The writing skill owns the words. A video-director skill owns the scene and movement. If the user provides or selects copy, pass the exact string to the director, including punctuation, emojis and deliberate line breaks. Changing the footage prompt must not silently rewrite the copy.

A combined request such as “write the wall of text and its video prompt” can run both creative steps in one response. It does not need a separate confirmation at every handoff. A prompt-only request should return a usable prompt, without automatically creating a video or spending generation credits. Only requested actual media creation uses the existing generation workflow.

For a wall-video prompt request without overlay text, the current director requires an upstream writer result and otherwise returns `needs_upstream_copy`. Clarify the intended behavior: use existing copy; invoke the wall writer for a combined request; or permit a footage-only prompt from a usable scene/context brief while stating that exact overlay fitting remains pending. Do not fabricate supposedly approved text or ask the user to repeat copy already available in the conversation.

## Changes needed

1. **Create the missing wall-of-text writer.** `WALLOFTEXT_GENERATION.md` has no skill frontmatter, business intake, generation procedure or output contract. Keep its creator transcriptions as a reference collection. Add a real `SKILL.md` for writing original business-relevant paragraphs, questions or stacked lists. It should preserve uncertainty in examples, avoid copying creator text as new business copy, and avoid inventing product features, outcomes or testimonials. Dense wall-of-text copy must have its own presentation rules; do not inherit the slideshow's no-paragraph rule or the short hook's 5–10-word target.

2. **Narrow overlapping triggers.** UGC Hook Intelligence currently activates for wall-of-text overlays and 3–5-second visual direction, and includes a full timestamped production step. Narrow its primary discovery description and default output to hook words, transcription, analysis and variants. Let the hook director own full footage prompts. Its optional overlay suggestion should reuse selected text, or call the hook writer for a requested combined output, rather than competing silently with that writer. Give each director an explicit “write a video generation prompt” trigger, distinct from “write text for my video.”

3. **Normalize names and package placement.** The human filenames are labels, not discovery IDs. `HOOK_VIDEO_GENERATION_SKILL.md` still defines the name `emotion-hook-director`; the wall director defines `wall-text-video-generation`; the slideshow defines `ugc-native-slideshow`. Preserve these valid IDs unless intentionally renaming them, and match each folder to its frontmatter name. Put all intended skill folders under `plugins/ugc-pilot/skills/`. A new writer could use `wall-text-generation` as its stable ID.

4. **Restore or remove missing resource promises.** The hook director references six absent observation/recipe/template/evaluation/example/schema files. Hook Intelligence references six absent paths, though four reference sections are embedded in its main file and can be extracted. The wall director references six absent audit/schema/fixture/example files. There are eighteen missing declared resource targets across these sources. Restore genuine supplied material where available; otherwise make the instructions self-contained and remove unsupported file dependencies. Do not invent historical audit logs or claim unprovided fixtures passed.

5. **Fix portable metadata and evidence wording.** The wall director puts `version: 2.1.0` directly in skill frontmatter, which the local Codex quick-validator does not accept. Move it to supported `metadata` when preparing the portable skill, keeping the package version in its manifests. This is a validator-specific compatibility finding, not a claim that every host rejects the field. Its description should state that it writes footage prompts and layout plans; “VIDEO-ONLY” alone could suggest rendered output. “Audited v2.1,” the 19/49-clip audit claims, and the unexplained `12/20` sample statistic cannot be independently verified from this folder because their supporting artifacts are absent.

6. **Make prompt outputs usable at both levels.** A model-agnostic creative prompt may exceed UGC Pilot's current tool limits, but an actual `generate_video` handoff must fit the 1,000-character prompt limit, whole-second 3–10-second duration, supported counts and at most one owned image reference. Preserve the required visual intent when compiling that handoff. The MCP input has no separate `negative_prompt`, `overlay_render_spec`, audio or resolution fields. Do not send the whole creative JSON as a tool payload or silently promise features outside the discovered contract. A prompt instruction such as “silent footage” is not evidence that a rendered output was inspected for silence.

7. **Keep layout planning distinct from finished composition.** The wall director correctly separates clean footage from exact text composition. Our current MCP does not expose that compositor. It can still deliver a useful prompt and layout plan. A finished wall-of-text video, however, needs an actual editing tool that accepts the owned footage and exact overlay text. Do not report clean footage as a completed text-overlay video. Likewise, slideshow text planning does not establish rendered carousel export. No new renderer is needed merely to deliver the user's requested text or prompt.

8. **Complete slideshow integration without changing automatic Carousel behavior.** Link its existing pattern library and output schema from the entrypoint, strengthen semantic validation, and define the currently enumerated `goal_based_routine` format. The earlier probes found that its schema accepts four malformed content cases, including a cover without a hook. Its flexible slide JSON remains different from the current worker's configured six-slide contract. Keep it as a draft workflow unless an explicit adapter is implemented and tested. Any change to Carousel architecture must follow `CAROUSEL_CONTEXT.md`; this review makes no such change.

9. **Update release inclusion and evaluations together.** Both the validator and ZIP builder currently allowlist only twelve files and the original three skills. Update both lists, synchronize the manifests, add the five creative roles to appropriate README/listing examples and use a new version for a private candidate. Preserve the released 0.1.1 package. Refresh installed clients before evaluating discovery; the MCP connection alone does not load these documents.

## Recommended discoverable layout

```text
plugins/ugc-pilot/skills/
  connect-ugc-pilot/SKILL.md
  create-ugc-media/SKILL.md
  manage-ugc-media/SKILL.md
  ugc-hook-intelligence/SKILL.md
  emotion-hook-director/SKILL.md
  wall-text-generation/SKILL.md
  wall-text-video-generation/SKILL.md
  ugc-native-slideshow/SKILL.md
```

Each skill should include only its real required references and schemas. The proposed wall writer is not yet implemented. Four creative source files have parseable name/description frontmatter; the wall-copy source does not.

## Activation and output checks for the candidate

Expected checks, not completed host evaluations:

| Scenario | Required behavior |
| --- | --- |
| “Give me five opening lines for my budgeting app.” | Hook writer; return grounded copy, no full video prompt or generation. |
| “Make a three-second surprised-creator video prompt.” | Hook director; concrete prompt, no paid tool call. |
| “Write a reflective wall of text for my business.” | Wall writer; suitable dense copy, not five disconnected short hooks. |
| “Use this exact paragraph for a walking-selfie video prompt.” | Wall director; reuse the paragraph unchanged and match camera/activity. |
| “Write both the hook text and its footage prompt.” | Hook writer then director within the same requested task. |
| “Use the copy we chose earlier.” | Reuse the selected copy; do not ask for it again or invent a replacement. |
| “Give me just the prompt.” | Prompt-only response when context is sufficient; no extra authored overlay or generation call. |
| Business context missing | Ask one useful question or return a clearly generic creative brief. |
| User changes the business | Use the new brief; do not reuse another brand's claims. |
| Dense 50-word overlay with a six-second clip | Preserve copy; distinguish reference-style playback from complete first-pass readability. |
| “Now generate this video.” | Check actual capabilities, costs, permissions and tool limits; retain request-ID/job rules. |
| “Debug my React hook” / “Write a landing page” | Do not select these creative skills from isolated keywords. |

Use both direct and indirect requests in fresh installed ChatGPT/Claude sessions. Check the selected skill and actual deliverable, not merely whether the reply sounds plausible. Automated filename/frontmatter checks cannot establish routing quality.

## Evidence and implementation order

The existing package validator and all six regression tests passed again. They cover the unchanged twelve-file package, not the new creative files. Static resource/frontmatter evidence is saved in [the revised evidence](plugin-skill-roles-evidence-2026-10-09.json). No signed-in activation, video generation, reference audit verification or production acceptance was performed.

Implement the missing writer and clarify the four existing creative roles first. Restore resources, validate schemas and include the skills in a new private package. Evaluate copy/prompt activation and exact text handoffs next. Test actual generation only for explicitly requested outputs, then consider the separate compositor or website integration. Public directory eligibility and publishing review remain separate from these drafting improvements.
