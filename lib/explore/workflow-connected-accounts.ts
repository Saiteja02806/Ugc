import { getConnectionPublishingBlockMessage } from "../scheduling/social-connection-policy";
import { isSocialPlatform, type SocialConnection } from "../social/types";

export type WorkflowConnectedAccount = Pick<SocialConnection,
  "id" | "platform" | "platformAccountName" | "platformAccountUsername" | "status" | "scopes" | "supportsBackgroundRefresh"
>;

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const optionalLabel = (value: unknown) => value === null || (typeof value === "string" && value.length <= 512);
const statuses = new Set(["connected", "error", "expired", "permission_missing", "revoked"]);

/** Display fields only; do not retain credentials or arbitrary server properties. */
export function parseWorkflowConnectedAccounts(value: unknown): WorkflowConnectedAccount[] {
  if (!record(value) || value.ok !== true || !Array.isArray(value.connections) || value.connections.length > 1000) {
    throw new Error("Could not load connected accounts. Refresh and try again.");
  }
  const accounts = value.connections.map((item) => {
    if (!record(item) || typeof item.id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(item.id) ||
      typeof item.platform !== "string" || !isSocialPlatform(item.platform) ||
      typeof item.status !== "string" || !statuses.has(item.status) ||
      !optionalLabel(item.platformAccountName) || !optionalLabel(item.platformAccountUsername) ||
      !Array.isArray(item.scopes) || item.scopes.length > 100 || item.scopes.some((scope) => typeof scope !== "string" || scope.length > 512) ||
      typeof item.supportsBackgroundRefresh !== "boolean") {
      throw new Error("Could not confirm your connected accounts. Refresh and try again.");
    }
    return {
      id: item.id, platform: item.platform,
      platformAccountName: item.platformAccountName as string | null,
      platformAccountUsername: item.platformAccountUsername as string | null,
      status: item.status as WorkflowConnectedAccount["status"],
      scopes: item.scopes as string[], supportsBackgroundRefresh: item.supportsBackgroundRefresh,
    };
  });
  if (new Set(accounts.map((item) => item.id)).size !== accounts.length) throw new Error("Could not confirm your connected accounts. Refresh and try again.");
  return accounts;
}

export function workflowAccountLabel(account: WorkflowConnectedAccount) {
  const username = account.platformAccountUsername?.trim();
  return username ? `@${username.replace(/^@+/, "")}` : account.platformAccountName?.trim() || "Connected account";
}

export function workflowAccountBlock(account: WorkflowConnectedAccount) {
  return getConnectionPublishingBlockMessage(account);
}

/** Suggest only an unambiguous, publishable destination for a selected platform. */
export function findWorkflowSingleAccountSelection(
  accounts: WorkflowConnectedAccount[],
  platforms: string[],
  selectedIds: Record<string, string>,
  handledPlatforms: ReadonlySet<string>,
): { platform: string; id: string } | null {
  for (const platform of platforms) {
    if (selectedIds[platform] || handledPlatforms.has(platform)) continue;
    const eligible = accounts.filter(account => account.platform === platform && !workflowAccountBlock(account));
    if (eligible.length === 1) return { platform, id: eligible[0].id };
  }
  return null;
}

export async function loadWorkflowConnectedAccounts(dependencies: {
  getOwnerToken: () => Promise<string | null>;
  fetch: typeof fetch;
  assertActive: () => void;
}, signal?: AbortSignal) {
  dependencies.assertActive();
  const token = await dependencies.getOwnerToken();
  dependencies.assertActive();
  if (!token) throw new Error("Sign in to view your connected accounts.");
  const response = await dependencies.fetch("/api/social/connections", {
    method: "GET", cache: "no-store", headers: { Authorization: `Bearer ${token}` }, signal,
  });
  const value: unknown = await response.json().catch(() => null);
  dependencies.assertActive();
  if (!response.ok) throw new Error("Could not load connected accounts. Refresh and try again.");
  return parseWorkflowConnectedAccounts(value);
}
