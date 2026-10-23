import type { RecreateFormat, RecreateReference } from "./recreate-types.ts";

export type ReferenceUploadBatch = {
  id: string; format: RecreateFormat; sequence: number;
  status: "staged" | "published"; referenceIds: readonly string[];
};

/** No wall clock or per-user seen state: a successfully published next batch retires New. */
export function applyReferenceUploadBatches(items: readonly RecreateReference[], batches: readonly ReferenceUploadBatch[], includeStaged = false): RecreateReference[] {
  const visible = new Map(items.filter(item => !item.archived).map(item => [item.id, item.format]));
  const eligible = batches.filter(batch => (batch.status === "published" || includeStaged) && batch.referenceIds.length > 0 &&
    batch.referenceIds.every(id => visible.get(id) === batch.format));
  const latest = new Map<RecreateFormat, ReferenceUploadBatch>();
  const membership = new Map<string, ReferenceUploadBatch>();
  for (const batch of eligible) {
    if (!Number.isSafeInteger(batch.sequence) || batch.sequence < 1) throw new Error("Invalid reference upload sequence.");
    if (eligible.some(other => other !== batch && other.format === batch.format && other.sequence === batch.sequence)) throw new Error("Duplicate reference upload sequence.");
    if (!latest.has(batch.format) || latest.get(batch.format)!.sequence < batch.sequence) latest.set(batch.format, batch);
    for (const id of batch.referenceIds) {
      if (membership.has(id)) throw new Error("A reference cannot be republished as a new upload.");
      membership.set(id, batch);
    }
  }
  return items.map(item => {
    const reference = { ...item };
    delete reference.uploadBatchId;
    delete reference.uploadBatchSequence;
    delete reference.isNew;
    const batch = membership.get(item.id);
    return batch ? { ...reference, uploadBatchId: batch.id, uploadBatchSequence: batch.sequence,
      ...(latest.get(item.format)?.id === batch.id ? { isNew: true as const } : {}) } : reference;
  });
}
