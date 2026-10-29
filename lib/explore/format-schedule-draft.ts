import { workflowSelectedAccountIds, workflowSelectedAccounts, workflowSelectedPlatforms, type WorkflowScheduleDraft } from "./workflow-scheduling-draft.ts";

export type FormatScheduleDraftScope = {
  environment: "live" | "preview";
  owner: string;
  format: "hook" | "wall_text" | "slideshow";
  output: { kind: "media_asset" | "library_item"; id: string } | null;
};

/** An unsent form is separate from the durable receipt of a confirmed post. */
export function formatScheduleDraftKey(scope: FormatScheduleDraftScope): string {
  return ["ugc-explore:schedule-draft:v1", scope.environment, scope.owner, scope.format,
    scope.output?.kind ?? "no-output", scope.output?.id ?? "no-output"].map(encodeURIComponent).join(":");
}

export function readFormatScheduleDraft(raw: string | null, key: string): WorkflowScheduleDraft | null {
  if (!raw || raw.length > 24_000) return null;
  try {
    const entry = JSON.parse(raw);
    const draft = entry?.draft;
    if (entry?.version !== 1 || entry.key !== key || !draft || typeof draft !== "object" ||
      typeof draft.caption !== "string" || draft.caption.length > 10_000 ||
      draft.captionInitialized !== undefined && typeof draft.captionInitialized !== "boolean" ||
      draft.publishMode !== undefined && !["now", "scheduled"].includes(draft.publishMode) ||
      draft.fiveMinutesFromSubmit !== undefined && typeof draft.fiveMinutesFromSubmit !== "boolean" ||
      typeof draft.date !== "string" || !/^(?:\d{4}-\d{2}-\d{2})?$/.test(draft.date) ||
      typeof draft.time !== "string" || !/^(?:[0-2]\d:[0-5]\d)?$/.test(draft.time) ||
      draft.time && Number(draft.time.slice(0, 2)) > 23 ||
      draft.timezone !== undefined && (typeof draft.timezone !== "string" || !draft.timezone || draft.timezone.length > 100) ||
      typeof draft.platform !== "string" || draft.platforms !== undefined && !Array.isArray(draft.platforms) ||
      draft.connectionIds !== undefined && (!draft.connectionIds || typeof draft.connectionIds !== "object" || Array.isArray(draft.connectionIds))) return null;
    const platforms = workflowSelectedPlatforms(draft);
    if (platforms.length > 3 || platforms.some(platform => !["instagram", "tiktok", "youtube"].includes(platform))) return null;
    if (draft.accountIds !== undefined && (!draft.accountIds || typeof draft.accountIds !== "object" || Array.isArray(draft.accountIds) ||
      Object.entries(draft.accountIds).some(([platform, ids]) => !platforms.includes(platform) || !Array.isArray(ids) || ids.length > 100 ||
        ids.some(id => typeof id !== "string" || !id.trim() || id.length > 128) || new Set(ids).size !== ids.length))) return null;
    const accounts = workflowSelectedAccounts(draft);
    if (Object.entries(accounts).some(([platform, id]) => !platforms.includes(platform) || typeof id !== "string" || id.length > 128)) return null;
    const connectionIds = Object.fromEntries(platforms.filter(platform => Object.hasOwn(accounts, platform)).map(platform => [platform, accounts[platform]]));
    if (draft.timezone !== undefined) new Intl.DateTimeFormat("en", { timeZone: draft.timezone });
    return { caption: draft.caption, ...(draft.publishMode !== undefined ? { publishMode: draft.publishMode } : {}), ...(draft.fiveMinutesFromSubmit ? { fiveMinutesFromSubmit: true } : {}), ...(draft.captionInitialized !== undefined ? { captionInitialized: draft.captionInitialized } : {}), date: draft.date, time: draft.time, platforms, connectionIds,
      platform: platforms[0] ?? "", connectionId: connectionIds[platforms[0]] ?? "", ...(draft.accountIds !== undefined ? { accountIds: workflowSelectedAccountIds(draft) } : {}), ...(draft.timezone !== undefined ? { timezone: draft.timezone } : {}) };
  } catch { return null; }
}

export function serializeFormatScheduleDraft(key: string, draft: WorkflowScheduleDraft): string | null {
  const raw = JSON.stringify({ version: 1, key, draft });
  const valid = readFormatScheduleDraft(raw, key);
  return valid ? JSON.stringify({ version: 1, key, draft: valid }) : null;
}
