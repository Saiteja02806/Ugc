import type { RecreateFormat } from "./recreate-types.ts";

export type ReferenceUploadFormat = RecreateFormat | "talking_head";

export type ReferenceUploadBatch = {
  id: string; format: ReferenceUploadFormat; sequence: number;
  status: "staged" | "published"; referenceIds: readonly string[];
};

type ReferenceUploadItem = {
  id: string; format: ReferenceUploadFormat; archived?: true;
  uploadBatchId?: string; uploadBatchSequence?: number; isNew?: true;
};

type MarkedReferenceUpload<T> = Omit<T, "uploadBatchId" | "uploadBatchSequence" | "isNew"> & {
  uploadBatchId?: string; uploadBatchSequence?: number; isNew?: true;
};

/** No wall clock or per-user seen state: a successfully published next batch retires New. */
export function applyReferenceUploadBatches<T extends ReferenceUploadItem>(items: readonly T[], batches: readonly ReferenceUploadBatch[], includeStaged = false): MarkedReferenceUpload<T>[] {
  const visible = new Map(items.filter(item => !item.archived).map(item => [item.id, item.format]));
  const eligible = batches.filter(batch => (batch.status === "published" || includeStaged) && batch.referenceIds.length > 0 &&
    batch.referenceIds.every(id => visible.get(id) === batch.format));
  const latest = new Map<ReferenceUploadFormat, ReferenceUploadBatch>();
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
