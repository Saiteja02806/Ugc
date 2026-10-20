import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  CAROUSEL_HOOK_TEMPLATE_CATALOG_VERSION,
  CAROUSEL_HOOK_TEMPLATES,
  getCarouselHookTemplate,
  getCarouselHookTemplateFit,
  getCompatibleCarouselHookTemplates,
  resolveCarouselStructure1CombinedFormat,
} from "./hook-templates.ts";
import {
  CAROUSEL_CONTENT_GRAMMAR,
  getCarouselContentFormat,
} from "./content-grammar.ts";
import { selectCarouselExperimentBatch } from "./content-selector.ts";

test("keeps the supplied twenty hook structures as a versioned Slide 1 catalog", () => {
  assert.equal(CAROUSEL_HOOK_TEMPLATE_CATALOG_VERSION, "carousel-hook-templates-v1");
  assert.equal(CAROUSEL_HOOK_TEMPLATES.length, 20);
  assert.deepEqual(
    CAROUSEL_HOOK_TEMPLATES.map((template) => template.pattern),
    [
      "I finally cracked the code for {topic}",
      "{topic} advice you should really ignore",
      "You’re doing {topic} wrong (here’s how to fix it)",
      "If I had to start from scratch, here’s what I’d do about {topic}",
      "This is what I’d do if I wanted to improve {topic} fast",
      "Stop doing this if you want better {topic}",
      "3 things I wish I knew before trying {topic}",
      "This simple switch got me 10x better results with {topic}",
      "Here’s why your approach to {topic} isn’t working",
      "The real reason {topic}",
      "Steal this exact formula for {topic}",
      "I improved my {topic} in 30 days. Here’s how.",
      "This post format changed everything about how I do {topic}",
      "The hook that made me get noticed (and how to write yours)",
      "If you’re stuck on {topic}, read this",
      "Don’t do anything else before you try this with {topic}",
      "The strategy no one talks about for {topic} (but it works)",
      "I tried {topic} for 30 days. Here’s what happened.",
      "Here’s how I would improve {topic} if I only had 1 hour",
      "The thing holding you back with {topic} (and how to fix it)",
    ],
  );
});

test("selects only compatible optional patterns for Structure 1", () => {
  const assignments = selectCarouselExperimentBatch({
    batchSequence: 0,
    history: [],
    hookTemplateContext: "A practical marketing planning workspace for social content teams.",
    selectionKey: "profile-1",
    topicOptionCount: 6,
  });

  assert.equal(assignments.length, 5);
  for (const assignment of assignments) {
    assert.equal(
      assignment.hookTemplateId === null,
      assignment.hookTemplateVersion === null,
    );
    if (!assignment.hookTemplateId) continue;

    assert.equal(
      assignment.hookTemplateVersion,
      getCarouselHookTemplate(assignment.hookTemplateId!).version,
    );
    assert.ok(
      getCompatibleCarouselHookTemplates({
        contentFormatId: assignment.contentFormatId,
        contextText: "A practical marketing planning workspace for social content teams.",
        hookFamilyId: assignment.hookFamilyId,
      }).some((template) => template.id === assignment.hookTemplateId),
    );
  }
});

test("prefers narrow mappings and permits a no-template candidate pool", () => {
  const switchTemplate = getCarouselHookTemplate("simple_switch_10x");

  assert.equal(
    getCarouselHookTemplateFit(switchTemplate, "before_after"),
    "preferred",
  );
  assert.equal(
    getCarouselHookTemplateFit(switchTemplate, "comparison"),
    "adaptable",
  );
  assert.equal(getCarouselHookTemplateFit(switchTemplate, "list"), null);
  assert.deepEqual(
    getCompatibleCarouselHookTemplates({
      contentFormatId: "list",
      hookFamilyId: "surprise",
    }),
    [],
  );
});

test("keeps every effective format-family selection pool narrow", () => {
  for (const format of CAROUSEL_CONTENT_GRAMMAR.formats) {
    for (const hookFamilyId of format.compatibleHookFamilies) {
      const compatible = getCompatibleCarouselHookTemplates({
        contentFormatId: format.id,
        contextText: "Instagram content marketing for creators and campaign teams.",
        hookFamilyId,
      });
      const preferred = compatible.filter(
        (template) =>
          getCarouselHookTemplateFit(template, format.id) === "preferred",
      );
      const effective = preferred.length > 0 ? preferred : compatible;

      assert.ok(
        effective.length <= 6,
        `${format.id}/${hookFamilyId} exposes ${effective.length} templates`,
      );
    }
  }
});

test("builds one combined format while changing only Slide 1 guidance", () => {
  const baseFormat = getCarouselContentFormat("mistakes");
  const hookTemplate = getCarouselHookTemplate("doing_it_wrong");
  const combined = resolveCarouselStructure1CombinedFormat({
    contentFormatId: "mistakes",
    hookFamilyId: "problem_recognition",
    hookTemplateId: hookTemplate.id,
    hookTemplateVersion: hookTemplate.version,
  });

  assert.equal(combined.combinedFormatId, "mistakes__doing_it_wrong");
  assert.equal(combined.hookTemplateFit, "preferred");
  assert.notEqual(
    combined.format.slides[0]!.instruction,
    baseFormat.slides[0]!.instruction,
  );
  assert.match(combined.format.slides[0]!.instruction, /You’re doing \{topic\} wrong/);
  assert.deepEqual(combined.format.slides.slice(1), baseFormat.slides.slice(1));
});

test("falls back to the native format for every optional-template defect", () => {
  const baseFormat = getCarouselContentFormat("comparison");
  const scenarios = [
    {
      expectedReason: "not_assigned",
      hookTemplateId: null,
      hookTemplateVersion: null,
    },
    {
      expectedReason: "incomplete_assignment",
      hookTemplateId: null,
      hookTemplateVersion: 1,
    },
    {
      expectedReason: "unknown_template",
      hookTemplateId: "misspelled_template",
      hookTemplateVersion: 1,
    },
    {
      expectedReason: "version_mismatch",
      hookTemplateId: "simple_switch_10x",
      hookTemplateVersion: 999,
    },
    {
      expectedReason: "format_mismatch",
      hookTemplateId: "steal_this_formula",
      hookTemplateVersion: 1,
    },
  ] as const;

  for (const scenario of scenarios) {
    const combined = resolveCarouselStructure1CombinedFormat({
      contentFormatId: "comparison",
      hookFamilyId: "curiosity",
      hookTemplateId: scenario.hookTemplateId,
      hookTemplateVersion: scenario.hookTemplateVersion,
    });

    assert.equal(combined.combinedFormatId, "comparison__native");
    assert.equal(combined.fallbackReason, scenario.expectedReason);
    assert.equal(combined.hookTemplate, null);
    assert.deepEqual(combined.format, baseFormat);
  }
});

test("can disable optional template selection without changing base assignments", () => {
  const assignments = selectCarouselExperimentBatch({
    batchSequence: 0,
    history: [],
    hookTemplateContext: "Instagram content marketing for creators.",
    hookTemplatesEnabled: false,
    selectionKey: "profile-off",
    topicOptionCount: 6,
  });

  assert.equal(assignments.length, 5);
  assert.ok(assignments.every((assignment) => assignment.hookTemplateId === null));
  assert.ok(
    assignments.every((assignment) => assignment.hookTemplateVersion === null),
  );
});

test("keeps the copywriting-only hook pattern out of unrelated business contexts", () => {
  const unrelated = getCompatibleCarouselHookTemplates({
    contentFormatId: "how_to",
    contextText: "A neighborhood bakery offering sourdough and pastries.",
    hookFamilyId: "curiosity",
  });
  const relevant = getCompatibleCarouselHookTemplates({
    contentFormatId: "how_to",
    contextText: "Instagram content marketing and copywriting for creators.",
    hookFamilyId: "curiosity",
  });

  assert.ok(
    !unrelated.some((template) => template.id === "hook_that_got_me_noticed"),
  );
  assert.ok(
    relevant.some((template) => template.id === "hook_that_got_me_noticed"),
  );
});

test("persists templates additively and clears them during Structure 2 takeover", () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/20260910150000_add_carousel_hook_template_assignments.sql",
    ),
    "utf8",
  );

  assert.match(migration, /add column hook_template_id text/i);
  assert.match(migration, /add column hook_template_version integer/i);
  assert.match(
    migration,
    /take_over_carousel_experiment_batch_with_structure_2[\s\S]*hook_template_id = null[\s\S]*structure_id = 'structure_2'/i,
  );
});

test("clears abandoned hook-template attribution in the Structure 1 worker", () => {
  const workerSource = readFileSync(
    resolve(process.cwd(), "worker/src/lib/carousel-generate.ts"),
    "utf8",
  );

  assert.match(
    workerSource,
    /const abandonedHookTemplate\s*=\s*contentPlan\.validationResult\.hookTemplateFallbackUsed/,
  );
  assert.match(
    workerSource,
    /hook_template_id:\s*abandonedHookTemplate\s*\?\s*null\s*:\s*generation\.hook_template_id/,
  );
  assert.match(
    workerSource,
    /updateCarouselExperimentAssignment\([\s\S]*?hook_template_id:\s*null,[\s\S]*?hook_template_version:\s*null/,
  );
});

test("requires an explicit rollout mode before enabling templates", () => {
  const runtimeSource = readFileSync(
    resolve(process.cwd(), "lib/carousel/hook-template-runtime.ts"),
    "utf8",
  );

  assert.match(
    runtimeSource,
    /value === "enabled" \|\| value === "shadow" \? value : "off"/,
  );
});
