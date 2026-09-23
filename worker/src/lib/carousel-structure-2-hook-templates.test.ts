import assert from "node:assert/strict";
import test from "node:test";
import { CAROUSEL_STRUCTURE_2_FORMAT_IDS } from "./carousel-structure-2-formats.js";
import { resolveStructure2HookTemplate, selectStructure2HookTemplates, STRUCTURE_2_HOOK_TEMPLATE_POOLS, structure2HookGuidance } from "./carousel-structure-2-hook-templates.js";
import { buildCarouselStructure2BatchMessages, buildCarouselStructure2RepairMessages, buildCarouselStructure2StoryTextRepairMessages, type CarouselStructure2StoryPlan } from "./carousel-structure-2-story-plan.js";

test("all eight story formats have compatible choices from the shared catalog", () => {
  for (const storyFormatId of CAROUSEL_STRUCTURE_2_FORMAT_IDS) {
    for (const hookTemplateId of STRUCTURE_2_HOOK_TEMPLATE_POOLS[storyFormatId]) {
      assert.ok(resolveStructure2HookTemplate({ storyFormatId, hookTemplateId, hookTemplateVersion: 1 }).template);
    }
  }
});

test("selection is deterministic, rotates available patterns, and respects all modes", () => {
  const assignments = Array.from({ length: 5 }, (_, slotIndex) => ({ slotIndex, storyFormatId: "wrong_belief" as const }));
  const params = { batchId: "batch-a", mode: "enabled" as const, assignments };
  const selected = selectStructure2HookTemplates(params);
  assert.deepEqual(selected, selectStructure2HookTemplates({ ...params, assignments: [...assignments].reverse() }));
  assert.equal(new Set(selected.slice(0, 3).map(c => c.hook_template_id)).size, 3);
  assert.ok(selected.every(c => c.hook_template_id && c.hook_template_version === 1));
  for (const mode of ["off", "shadow"] as const) {
    const choices = selectStructure2HookTemplates({ ...params, mode });
    assert.ok(choices.every(c => c.hook_template_id === null && c.hook_template_version === null));
    assert.ok(choices.every(c => mode === "shadow" ? c.proposed_template_id : c.proposed_template_id === null));
  }
});

test("legacy, unknown, stale and incompatible optional assignments use native guidance", () => {
  for (const fields of [{}, { hookTemplateId: "missing", hookTemplateVersion: 1 },
    { hookTemplateId: "the_real_reason" }, { hookTemplateId: "the_real_reason", hookTemplateVersion: 99 },
    { hookTemplateId: "cracked_the_code", hookTemplateVersion: 1 }]) {
    const assignment = { storyFormatId: "wrong_belief" as const, ...fields };
    assert.equal(resolveStructure2HookTemplate(assignment).template, null);
    assert.match(structure2HookGuidance(assignment), /native/);
  }
});

test("initial, full repair and targeted cover repair retain the same template guidance", () => {
  const assignment = { slotIndex: 0, candidateIndex: 0, creativeSeed: "changing plans", emotion: "relief",
    storyFormatId: "wrong_belief" as const, hookTemplateId: "the_real_reason", hookTemplateVersion: 1 };
  const guidance = structure2HookGuidance(assignment);
  const issues = [{ code: "render_fit" as const, slideNumber: 1, message: "overflow" }];
  const plan = { slides: [{ slideNumber: 1, storyText: "Old cover", storyRole: "hook" }] } as unknown as CarouselStructure2StoryPlan;
  const initial = buildCarouselStructure2BatchMessages({ assignments: Array.from({ length: 5 }, (_, slotIndex) => ({ ...assignment, slotIndex, candidateIndex: slotIndex })), businessDescription: "Planner" });
  const full = buildCarouselStructure2RepairMessages({ assignment, businessDescription: "Planner", issues, rawPlan: {} });
  const targeted = buildCarouselStructure2StoryTextRepairMessages({ assignment, businessDescription: "Planner", issues, plan, repairAttempt: 1, repairAttemptLimit: 2 });
  assert.ok(initial[1]!.content.includes(JSON.stringify(guidance)));
  assert.ok(full[1]!.content.includes(guidance));
  assert.ok(targeted[1]!.content.includes(JSON.stringify(guidance)));
});
