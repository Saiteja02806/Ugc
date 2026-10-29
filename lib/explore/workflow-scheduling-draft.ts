import type { ScheduleCreateTargetInput } from "../scheduling/types.ts";

// Legacy single-platform fields remain readable by previews and older callers.
export type WorkflowScheduleDraft = {
  platform: string; caption: string; date: string; time: string; connectionId?: string; timezone?: string;
  platforms?: string[]; connectionIds?: Record<string, string>;
  /** Independent choices; legacy single-account drafts remain readable. */
  accountIds?: Record<string, string[]>;
  /** A deliberate blank must survive returning to a saved draft. */
  captionInitialized?: boolean;
  publishMode?: "now" | "scheduled";
  /** Unsent five-minute intent; the server resolves its lead at final submission. */
  fiveMinutesFromSubmit?: boolean;
};

export function workflowSelectedPlatforms(draft: WorkflowScheduleDraft): string[] {
  return [...new Set(draft.platforms ?? (draft.platform ? [draft.platform] : []))];
}

export function workflowSelectedAccounts(draft: WorkflowScheduleDraft): Record<string, string> {
  if (draft.accountIds) return Object.fromEntries(Object.entries(draft.accountIds).map(([platform, ids]) => [platform, ids[0] ?? ""]));
  return draft.connectionIds ?? (draft.platform && draft.connectionId ? { [draft.platform]: draft.connectionId } : {});
}

export function workflowSelectedAccountIds(draft: WorkflowScheduleDraft): Record<string, string[]> {
  return draft.accountIds ?? Object.fromEntries(Object.entries(workflowSelectedAccounts(draft)).map(([platform, id]) => [platform, id ? [id] : []]));
}

export function toggleWorkflowPlatform(draft: WorkflowScheduleDraft, platform: string): WorkflowScheduleDraft {
  const current = workflowSelectedPlatforms(draft);
  const platforms = current.includes(platform) ? current.filter(value => value !== platform) : [...current, platform];
  const connectionIds = Object.fromEntries(Object.entries(workflowSelectedAccounts(draft)).filter(([value]) => platforms.includes(value)));
  const accountIds = draft.accountIds ? Object.fromEntries(Object.entries(draft.accountIds).filter(([value]) => platforms.includes(value))) : undefined;
  return { ...draft, platforms, connectionIds, ...(accountIds ? { accountIds } : {}), platform: platforms[0] ?? "", connectionId: connectionIds[platforms[0]] ?? "" };
}

export function selectWorkflowAccount(draft: WorkflowScheduleDraft, platform: string, id: string): WorkflowScheduleDraft {
  if (!workflowSelectedPlatforms(draft).includes(platform)) return draft;
  const accounts = workflowSelectedAccountIds(draft), selected = accounts[platform] ?? [];
  const accountIds = { ...accounts, [platform]: selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id] };
  const connectionIds = Object.fromEntries(Object.entries(accountIds).map(([value, ids]) => [value, ids[0] ?? ""]));
  return { ...draft, accountIds, connectionIds, connectionId: connectionIds[draft.platform] ?? "" };
}

export function workflowAccountSelectionError(draft: WorkflowScheduleDraft): string | null {
  const platforms = workflowSelectedPlatforms(draft), accounts = workflowSelectedAccountIds(draft);
  if (!platforms.length) return "Choose where you want to post, then select your connected accounts.";
  if (platforms.length > 3 || platforms.some(platform => !["instagram", "youtube", "tiktok"].includes(platform))) return "Choose a supported posting platform.";
  if (platforms.some(platform => !accounts[platform]?.length)) return "Choose at least one connected account for each selected platform.";
  const ids = platforms.flatMap(platform => accounts[platform]);
  if (ids.length > 5) return "Schedule up to 5 accounts at a time. Deselect an account to continue.";
  if (ids.some(id => typeof id !== "string" || !id.trim()) || new Set(ids).size !== ids.length) return "Review your selected accounts before posting.";
  return null;
}

/** Each selected account gets an independent backend target. */
export function workflowScheduleTargets(draft: WorkflowScheduleDraft): ScheduleCreateTargetInput[] {
  const platforms = workflowSelectedPlatforms(draft);
  const accounts = workflowSelectedAccountIds(draft);
  if (workflowAccountSelectionError(draft)) return [];
  return platforms.flatMap(platform => accounts[platform].map(connectionId => ({ platform: platform as ScheduleCreateTargetInput["platform"], connectionId })));
}
