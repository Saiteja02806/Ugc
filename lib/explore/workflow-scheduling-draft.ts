import type { ScheduleCreateTargetInput } from "../scheduling/types.ts";

// Legacy single-platform fields remain readable by previews and older callers.
export type WorkflowScheduleDraft = {
  platform: string; caption: string; date: string; time: string; connectionId?: string;
  platforms?: string[]; connectionIds?: Record<string, string>;
};

export function workflowSelectedPlatforms(draft: WorkflowScheduleDraft): string[] {
  return [...new Set(draft.platforms ?? (draft.platform ? [draft.platform] : []))];
}

export function workflowSelectedAccounts(draft: WorkflowScheduleDraft): Record<string, string> {
  return draft.connectionIds ?? (draft.platform && draft.connectionId ? { [draft.platform]: draft.connectionId } : {});
}

export function toggleWorkflowPlatform(draft: WorkflowScheduleDraft, platform: string): WorkflowScheduleDraft {
  const current = workflowSelectedPlatforms(draft);
  const platforms = current.includes(platform) ? current.filter(value => value !== platform) : [...current, platform];
  const connectionIds = Object.fromEntries(Object.entries(workflowSelectedAccounts(draft)).filter(([value]) => platforms.includes(value)));
  return { ...draft, platforms, connectionIds, platform: platforms[0] ?? "", connectionId: connectionIds[platforms[0]] ?? "" };
}

export function selectWorkflowAccount(draft: WorkflowScheduleDraft, platform: string, id: string): WorkflowScheduleDraft {
  if (!workflowSelectedPlatforms(draft).includes(platform)) return draft;
  const connectionIds = { ...workflowSelectedAccounts(draft), [platform]: id };
  return { ...draft, connectionIds, connectionId: connectionIds[draft.platform] ?? "" };
}

/** Each selected platform must have its own resolved account choice. */
export function workflowScheduleTargets(draft: WorkflowScheduleDraft): ScheduleCreateTargetInput[] {
  const platforms = workflowSelectedPlatforms(draft);
  const accounts = workflowSelectedAccounts(draft);
  if (!platforms.length || platforms.length > 3 || platforms.some(platform => !["instagram", "youtube", "tiktok"].includes(platform) || !accounts[platform]) || new Set(platforms.map(platform => accounts[platform])).size !== platforms.length) return [];
  return platforms.map(platform => ({ platform: platform as ScheduleCreateTargetInput["platform"], connectionId: accounts[platform] }));
}
