export type TrendingPreparationState = "preparing" | "queued" | "generating" | "finalizing" | "failed";

export function getTrendingPreparationState(jobs: readonly { status: string }[]): TrendingPreparationState {
  if (jobs.some((job) => ["processing", "rendering", "waiting_external_service", "uploading_output"].includes(job.status))) return "generating";
  if (jobs.some((job) => ["queued", "created"].includes(job.status))) return "queued";
  if (jobs.some((job) => ["failed", "stalled", "cancelled"].includes(job.status))) return "failed";
  return jobs.length > 0 ? "finalizing" : "preparing";
}

export function getTrendingPreparationCopy(state: TrendingPreparationState = "preparing") {
  switch (state) {
    case "queued": return { title: "Waiting in queue", description: "Your slideshow request is queued. Generation will start when the worker is available." };
    case "generating": return { title: "Generating your slideshows", description: "Your slideshows are being written, checked, and rendered. Completed content will appear here automatically." };
    case "finalizing": return { title: "Preparing your feed", description: "Generation has finished. We are checking which slideshows are ready to show." };
    case "failed": return { title: "Slideshow generation failed", description: "The background job could not finish. We are checking recovery for your missing content." };
    default: return { title: "Preparing your request", description: "We are checking your remaining slideshow slots and preparing the background work." };
  }
}
