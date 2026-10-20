import assert from "node:assert/strict";
import test from "node:test";
import { resolveStructure2BatchHooks } from "./carousel-structure-2-hook-resolution.js";
import type { CarouselGenerationRow, CarouselExperimentBatchRow } from "../types.js";

test("direct and takeover batches resolve once, reload durable decisions and preserve legacy/off/shadow", async () => {
  for (const structure_resolution_mode of ["requested", "planning_fallback"] as const) {
    for (const mode of ["enabled", "shadow", "off", null] as const) {
      const batch = { id: "batch", structure_id: "structure_2", business_profile_id: "profile", business_profile_version: 1,
        structure_resolution_mode, hook_template_mode_snapshot: mode, structure_2_hook_templates_resolved_at: null } as CarouselExperimentBatchRow;
      const generations = Array.from({ length: 5 }, (_, index) => ({ id: `generation-${index}`, structure_id: "structure_2",
        carousel_experiment_batch_id: batch.id, carousel_experiment_assignment_id: `assignment-${index}`,
        business_profile_id: "profile", business_profile_version: 1, content_format_id: "wrong_belief",
        content_plan_item_id: `item-${index}`, hook_template_id: null, hook_template_version: null } as CarouselGenerationRow));
      let writes = 0;
      let historyReads = 0;
      const store: Parameters<typeof resolveStructure2BatchHooks>[0]["store"] = {
        getCarouselExperimentBatch: async () => batch,
        getCarouselGeneration: async id => generations.find(g => g.id === id) ?? null,
        listRecentStructure2HookTemplateIds: async () => { historyReads++; return []; },
        resolveCarouselStructure2Hooks: async (_id, _mode, choices) => {
          writes++;
          for (const choice of choices as Array<{ slot_index: number; hook_template_id: string | null; hook_template_version: number | null }>) {
            Object.assign(generations[choice.slot_index]!, { hook_template_id: choice.hook_template_id, hook_template_version: choice.hook_template_version });
          }
          batch.structure_2_hook_templates_resolved_at = "2026-09-23T00:00:00Z";
        },
      };
      const input = { experimentBatchId: batch.id, generations, store };
      const first = await resolveStructure2BatchHooks(input);
      assert.ok(first.every(g => mode === "enabled" ? g.hook_template_id !== null : g.hook_template_id === null));
      const saved = structuredClone(first);
      assert.deepEqual(await resolveStructure2BatchHooks(input), saved);
      assert.equal(writes, mode === null ? 0 : 1);
      assert.equal(historyReads, mode === "enabled" || mode === "shadow" ? 1 : 0);
    }
  }
});
