import type { CharacterJobReceipt, CharacterJobStatusResponse } from "./types.ts";

export function characterBatchProgress(receipts: readonly CharacterJobReceipt[], statuses: readonly CharacterJobStatusResponse["job"][] = []) {
  const jobs = receipts.map(receipt => statuses.find(job => job.id === receipt.jobId));
  const created = jobs.filter(job => job?.status === "completed" && job.output).length;
  const unavailable = jobs.filter(job => job?.status === "failed" || job?.status === "cancelled").length;
  const pending = receipts.length - created - unavailable;
  const progress = `${created} of ${receipts.length} image${receipts.length === 1 ? "" : "s"} created`;
  const message = unavailable
    ? `${progress} · ${unavailable} image${unavailable === 1 ? "" : "s"} could not be created${pending ? ` · ${pending} still processing` : ""}.`
    : pending ? `${progress} · ${pending} still processing.`
    : `${progress}. Select an image to save it to My influencers.`;
  return { created, unavailable, pending, message };
}
