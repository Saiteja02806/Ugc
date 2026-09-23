import type { CarouselGenerationRow, Json } from "../types.js";
import type { SupabaseJobStore } from "./supabase.js";
import { resolveCarouselStructure2FormatId } from "./carousel-structure-2-formats.js";
import { selectStructure2HookTemplates } from "./carousel-structure-2-hook-templates.js";

type HookStore = Pick<SupabaseJobStore, "getCarouselExperimentBatch" | "getCarouselGeneration" | "resolveCarouselStructure2Hooks" | "listRecentStructure2HookTemplateIds">;

// Both direct Structure 2 and Structure 1 takeover call this after final formats
// are known. Persistence wins over proposals on retry or duplicate delivery.
export async function resolveStructure2BatchHooks(params: {
  experimentBatchId: string; generations: readonly CarouselGenerationRow[]; store: HookStore;
}) {
  const batch = await params.store.getCarouselExperimentBatch(params.experimentBatchId);
  if (!batch || batch.structure_id !== "structure_2") throw new Error("Missing Structure 2 batch identity.");
  if (!batch.structure_2_hook_templates_resolved_at && batch.hook_template_mode_snapshot) {
    const choices = selectStructure2HookTemplates({
      batchId: batch.id, mode: batch.hook_template_mode_snapshot,
      recentTemplateIds: batch.hook_template_mode_snapshot === "off" ? [] :
        await params.store.listRecentStructure2HookTemplateIds(batch.business_profile_id, batch.id),
      assignments: params.generations.map((generation, slotIndex) => {
        const storyFormatId = resolveCarouselStructure2FormatId(generation.content_format_id ?? generation.content_assigned_format_id);
        if (!storyFormatId) throw new Error("Invalid Structure 2 hook format.");
        return { slotIndex, storyFormatId };
      }),
    });
    await params.store.resolveCarouselStructure2Hooks(batch.id, batch.hook_template_mode_snapshot, choices as unknown as Json);
  }
  return Promise.all(params.generations.map(async (generation) => {
    const stored = await params.store.getCarouselGeneration(generation.id);
    if (!stored || stored.carousel_experiment_batch_id !== batch.id || stored.structure_id !== "structure_2" ||
      stored.business_profile_id !== batch.business_profile_id || stored.business_profile_version !== batch.business_profile_version ||
      (stored.content_format_id ?? stored.content_assigned_format_id) !== (generation.content_format_id ?? generation.content_assigned_format_id) ||
      stored.carousel_experiment_assignment_id !== generation.carousel_experiment_assignment_id || stored.content_plan_item_id !== generation.content_plan_item_id) {
      throw new Error("Structure 2 hook identity changed.");
    }
    return stored;
  }));
}
