/** Route only verified Explore receipt jobs to the optional warm receiver.
 * All other rendering retains the existing launcher and execution slots. */
export function exploreInteractiveDispatchUrl(job: { jobType: string; projectId: string | null; userId: string | null; idempotencyKey: string | null; input: unknown }, env: Record<string, string | undefined>) {
  const configured = env.GCP_EXPLORE_FINISH_TASK_URL?.trim();
  if (!configured || !job.userId || job.jobType !== "render_demo_video" || job.projectId !== "explore") return null;
  const input = job.input && typeof job.input === "object" && !Array.isArray(job.input) ? job.input as Record<string, unknown> : null;
  if (!input || input.version !== 1 || input.interactiveFinishingVersion !== 1 || input.userId !== job.userId || typeof input.requestKey !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestKey) ||
      job.idempotencyKey !== `explore-finish:${input.requestKey}`) return null;
  const url = new URL(configured);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".run.app") || url.pathname !== "/tasks/jobs" || url.search || url.hash || url.username || url.password || url.port) {
    throw new Error("GCP_EXPLORE_FINISH_TASK_URL must be an authenticated Cloud Run /tasks/jobs endpoint.");
  }
  return url.toString();
}
