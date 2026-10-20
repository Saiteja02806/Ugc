import type { CharacterJobReceipt, CharacterJobStatusResponse } from "./types";

/** Keep each submitted prompt beside its own batch, even when prompts repeat. */
export function characterResultGroups(receipts: readonly CharacterJobReceipt[], statuses: readonly CharacterJobStatusResponse["job"][] = []) {
  const jobs = new Map(statuses.map(job => [job.id, job]));
  const groups = new Map<string, { id: string; prompt: string | null; items: { receipt: CharacterJobReceipt; index: number }[] }>();
  receipts.forEach((receipt, index) => {
    const job = jobs.get(receipt.jobId);
    const id = job?.batchId || receipt.jobId;
    const group = groups.get(id) ?? { id, prompt: job?.prompt || null, items: [] };
    if (!group.prompt && job?.prompt) group.prompt = job.prompt;
    group.items.push({ receipt, index });
    groups.set(id, group);
  });
  return [...groups.values()];
}
