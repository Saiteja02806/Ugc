# New UGC Pilot skills review — 9 October 2026

**Historical inventory:** the user subsequently renamed these sources and added two video-prompt skills. Use the [revised five-role review](plugin-skill-roles-review-2026-10-09.md) for the current files and intended routing. The evidence below records the earlier source snapshot.

The added material contains two creative skills and one transcription reference collection. Both skills can improve planning and copy, but neither is currently discoverable in the `ugc-pilot` package. Adding files to the parent `plugins` directory does not update installed clients, the downloadable ZIP, or the website's generation prompts.

This was a source and package review. No plugin source, installed configuration, MCP service, worker, production deployment, or downloadable package was changed. Signed-in host activation and finished media acceptance were not performed.

## Inventory and intended use

| Material | What it contributes | Current status |
| --- | --- | --- |
| `plugins/UGC_Hook_Intelligence_All_In_One.md` | `ugc-hook-intelligence`: screenshot transcription, original hook variants, creative mechanisms, evidence grounding, ranking, A/B hypotheses, and 3–5-second visual briefs | Valid name/description frontmatter, but wrong discoverable location and six missing linked files. Four reference sections are embedded in the document; schema/evaluation files are not supplied. |
| `plugins/ugc-native-slideshow-skill/ugc-native-slideshow/SKILL.md` | `ugc-native-slideshow`: social slide copy, content format versus presentation mode, one idea per slide, visual intents, product placement, typography guidance, and semantic JSON | Valid frontmatter and supporting files, but outside the installed package. Its 1,032-line main file does not link to its two supporting references. |
| `plugins/instagram_wall_of_text_transcriptions.md` | Source examples of dense, conversational Reel overlays, with uncertainty markers and creator attribution | Reference data, not a standalone skill: no frontmatter or executable workflow. Not linked or packaged by an existing skill. |
| `plugins/ugc-pilot/skills/` | Connection, media creation, and library management | Exactly three existing discoverable skills; the package remains version 0.1.1. |

The hook skill's evidence ladder, explicit uncertainty handling, original-copy requirement, and distinction between hypotheses and actual performance are useful. The slideshow skill's separation of meaning from layout and its per-slide visual matching are also useful. Preserve these principles while fixing integration.

## How activation should work

For ChatGPT/Codex, an installed skill's description tells the model when to consider it; the body contains the actual procedure. A clear description helps activation but is not a deterministic keyword rule or proof that a host selected it. Keep resources local and explain when to load them. [OpenAI skill authoring](https://developers.openai.com/plugins/build/skills)

Claude Code also uses descriptions for relevant automatic selection and supports explicit invocation of installed plugin skills as `/plugin-name:skill-name`. After integration, examples would be `/ugc-pilot:ugc-hook-intelligence` and `/ugc-pilot:ugc-native-slideshow`; these commands are not currently installed by this review. [Claude Code skills](https://code.claude.com/docs/en/skills)

Connecting the MCP endpoint alone exposes tools; it does not install these Markdown workflows. A plugin update must include the skills, and the client must load that update. The current session's advertised UGC Pilot skills also contains only the original three workflows.

The website and worker are a separate integration. Searches in `app`, `lib`, `worker`, `scripts`, and `docs` found no references to the new skill names or source documents before this report. Use an explicit, versioned planner integration if these instructions should affect website output. Do not assume a filesystem folder acts as an application intent router.

## Proposed trigger map

These are expected routes for future evaluation, not observed model activation results.

| User request | Lead skill / supporting skill | Expected outcome and boundary |
| --- | --- | --- |
| “Write ten TikTok hooks for my time-planning app.” | Hook intelligence | Original hook candidates grounded in supplied product facts; no paid generation. |
| “My opening is boring; make people want to see the demo.” | Hook intelligence | Rewrite first-frame copy and propose a proof/demo beat. |
| “Read every hook in these screenshots, including emojis.” | Hook intelligence | Transcribe visible text, preserve uncertainty and requested repetitions; do not substitute stored examples for the actual images. |
| “Compare these two Reel openings.” | Hook intelligence | Explain differences and test hypotheses; do not invent retention statistics or declare a measured winner. |
| “Write only hooks, no explanations.” | Hook intelligence | Paste-ready hooks only. |
| “Create a six-slide Instagram carousel about planning my week.” | Native slideshow | A cover, semantic slide copy and visual intents; a copy plan rather than a finished rendered carousel. |
| “This slide is a wall of words; split it into readable beats.” | Native slideshow | One main idea with suitable supporting blocks. |
| “Turn this app brief into a creator-style carousel with a strong opening.” | Native slideshow; hook intelligence only if needed | Slideshow owns sequencing and body copy; hook skill assists the opening without applying Reel timing limits to every slide. |
| “Write dense wall-of-text overlay copy for this Reel.” | Hook intelligence for its existing scope; explicit wall-text workflow if expanded | Use transcription patterns as inspiration and tailor density to reading time. Do not use the slideshow's no-paragraph rule on this format. |
| “Write a silent three-second visual hook.” | Hook intelligence | Timed creative brief and separate overlay specification; no generated footage unless requested. |
| “Generate the video for the hook we selected.” | Create media; hook brief as input | Check capabilities, entitlement/cost, duration, and references; submit once and retrieve the actual clip. A typography brief does not establish that captions were composited. |
| “Generate one product image.” | Create media | Existing image workflow, without mandatory hook or slideshow planning. |
| “Check my credits; do not create anything.” | Connect UGC Pilot | Read-only profile, entitlement and capability checks. |
| “Show my images” / “Check the job we started.” | Manage media | Read the library or existing job; no fresh generation charge. |
| “Render and download the finished carousel.” | Native slideshow for planning, then a capability check | Explain the current MCP rendering gap. Do not invent `generate_carousel`, an export tool, or a finished URL. |
| “Schedule this on Instagram.” | No supported publishing workflow in this MCP beta | Explain the boundary; website scheduling does not imply plugin scheduling support. |
| “Debug my React hook” / “Make a PowerPoint pitch deck” / “Improve my SEO.” | Neither new UGC skill | Avoid false activation from the words “hook,” “slides,” or generic marketing intent. |
| “Make this better.” with no supplied content | Clarify the intended deliverable | Ask one focused question rather than selecting a random creative workflow. |

Select the deliverable first, then use only the needed skills. Planning, rewriting, transcription and review must not silently become paid media generation. Actual generation should retain the existing cost, ownership, scope, request-ID and job-retrieval rules.

## Changes needed before integration

1. **Package and discover the skills.** Add `skills/ugc-hook-intelligence/SKILL.md` and `skills/ugc-native-slideshow/SKILL.md` under `plugins/ugc-pilot`. Preserve the supplied originals while preparing normalized copies. Update both allowlists: `scripts/validate-ugc-pilot-plugin.mjs` and `scripts/build-ugc-pilot-plugin.py`. The validator currently rejects unexpected files and the builder includes only twelve fixed paths, so copying folders alone is insufficient. Use a new package version and synchronize compatibility manifests; keep the released 0.1.1 ZIP unchanged.

2. **Repair hook resources.** Extract the embedded library, pattern catalog, production instructions and examples into their named reference files. Supply an actual `schemas/hook-output.schema.json` and `evals/cases.json`, or remove those promises until implemented. The supplied structured-output notes are not a schema or an evaluation suite. Six unique local link targets currently do not exist.

3. **Make slideshow resources usable.** Add explicit links to `references/output-schema.json` and `references/pattern-library.md`, with rules for JSON output versus copy examples. Keep the main workflow concise and move detailed examples/layout guidance into references. Define `goal_based_routine` or omit it until defined, and make the required text fields for each presentation mode unambiguous.

4. **Strengthen slideshow validation.** Require nonempty visible copy, a first cover with a hook, compatible role/mode combinations and mode-specific content. A `routine_explanation` needs its exercise name, reason and cue; a numbered shift needs its visible statement and appropriate supporting copy. Apply count and sequence rules according to the requested mode and the actual renderer contract. Raw JSON shape alone cannot establish readability or truthful claims.

5. **Add grounding to slideshow copy.** Carry over the hook skill's product-fact and evidence rules. First-person transformations, results, and health/fitness examples must not become fabricated testimony or unsupported explanations. Label examples as illustrative and use only confirmed product features. Explicit user instructions take precedence over presentation defaults.

6. **Define planning versus production.** The current twelve MCP tools provide account/brand reads, library operations, uploads/deletion, image/video generation and job reads. They do not render carousels, composite hook text, measure retention, or publish posts. Both new skills should accurately promise planning/review. Only hand off to `create-ugc-media` when actual supported image/clip generation is requested; overlays and carousel exports require a separately implemented tool contract.

7. **Keep the existing Carousel contract intact.** The supplied slideshow schema uses `format`, `presentation_mode`, `body_1`, `body_2`, `why` and `cue`. The current Structure 2 worker uses a six-slide plan with configured `storyRole`, `storyText`, optional `headline`, `visualContext`, product eligibility, and optional CTA restricted to Slide 6. Its renderer supports square and 4:5 assets, whereas the new guidance gives 1080×1920 examples and variable counts. This JSON is not a drop-in worker payload. Create an explicit adapter for supported semantics, or keep the skill as an independent draft mode. Preserve existing layout, fit, sourcing, ownership and delivery checks. Any actual product/architecture change needs a `CAROUSEL_CONTEXT.md` update and separate validation.

8. **Treat transcription collections as source material.** Link selected relevant patterns rather than loading all relationship/lifestyle examples for every SaaS request. Preserve `[unclear]` markers and provenance; these collections do not demonstrate conversion, original-image accuracy or clinical validity. Do not make the reference file into an automatically activated workflow merely because it is Markdown. An optional separate wall-text skill should be added only with its own clearly specified input, output, density and tool boundaries.

Suggested descriptions for the integrated creative skills:

- Hook: “Draft, rewrite, compare, or transcribe hooks for TikTok, Instagram Reels, Shorts and SaaS demo openings. Use for first-frame overlay copy, opening 3–5-second creative briefs, screenshot hook extraction and A/B hypotheses. Produces copy and creative direction; use the media skill for requested generation.”
- Slideshow: “Plan, rewrite or review native social carousel and slideshow copy. Use for slide sequencing, one-idea text blocks, visual intents, product placement and semantic slide JSON. Produces a draft plan; does not render, export or publish slides.”

These proposed descriptions still need positive, indirect and negative activation evaluation in each installed host.

## Verification and safe sequence

- Existing source package validation passed: version 0.1.1, twelve package files, twelve MCP tools, and the known missing demo-recording field.
- All six existing package regression tests passed. They do not cover the new materials, which sit outside the package.
- New-material probes confirmed neither creative skill is in the current discoverable package and identified all six missing hook links.
- The supplied slideshow schema accepted four invalid semantic examples: cover without a hook; no cover and no visible text; numbered shift without copy; and routine without exercise/reason/cue. It accepted a simple valid draft and correctly rejected an unknown format. These probes use Ajv 6 for the schema's draft-07-compatible keywords; they are local validation evidence, not a full draft-2020 runtime certification.
- No signed-in host activation, real rendered output, deployment or paid generation was performed.

Evidence: [static probes](plugin-new-skills-evidence-2026-10-09.json).

Integrate the two planning skills first, repair links and schemas, update package inclusion and tests, then create a new private package. Check direct requests, indirect requests, missing inputs and unrelated prompts against the trigger table in fresh host sessions. Verify that drafting consumes no generation credits. Test an explicitly requested creative-to-media handoff separately. Only then consider a website planner adapter or new rendering/export tools; do not alter the live automatic Carousel pipeline as part of a skill-copy operation. Existing public-directory eligibility and submission gates remain separate.
