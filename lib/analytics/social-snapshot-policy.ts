type Connection = { id: string; connectedAt: string; status: string; authorizationRevision?: string };
type SavedJob = { output: unknown; completedAt: string | null };

export function preserveSavedSocialAnalytics(previous: unknown, next: unknown) {
  const oldAccounts = (previous as { accounts?: unknown[] } | null)?.accounts;
  const newAccounts = (next as { accounts?: unknown[] } | null)?.accounts;
  if (!Array.isArray(oldAccounts) || !Array.isArray(newAccounts)) return next;
  return { ...(next as object), accounts: newAccounts.map((value) => {
    const account = value as { connectionId: string; status: string; lastSyncedAt: string | null; message?: string };
    if (account.status !== "error" || account.lastSyncedAt) return account;
    const saved = oldAccounts.find((item) => (item as { connectionId: string }).connectionId === account.connectionId);
    return saved ? { ...(saved as object), status: "error", message: account.message ?? "Refresh failed. Showing saved analytics." } : account;
  }) };
}

export function selectSocialSnapshot(jobs: SavedJob[], connections: Connection[]) {
  const chosen = new Map<string, { account: unknown; savedAt: number }>();
  for (const job of jobs) {
    const savedAt = Date.parse(job.completedAt ?? "");
    if (!Number.isFinite(savedAt) || !job.output || typeof job.output !== "object") continue;
    const output = job.output as { accounts?: unknown[] };
    if (!Array.isArray(output.accounts)) continue;
    for (const value of output.accounts) {
      if (!value || typeof value !== "object") continue;
      const account = value as { connectionId?: string; lastSyncedAt?: string; status?: string; authorizationRevision?: string };
      const connection = connections.find((c) => c.id === account.connectionId);
      if (!connection || connection.status !== "connected" || chosen.has(connection.id) ||
          (account.status && account.status !== "ready") ||
          (connection.authorizationRevision && account.authorizationRevision !== connection.authorizationRevision) ||
          !(Date.parse(account.lastSyncedAt ?? "") >= Date.parse(connection.connectedAt))) continue;
      chosen.set(connection.id, { account, savedAt });
    }
  }
  return chosen.size ? {
    data: { accounts: [...chosen.values()].map(value => value.account) },
    savedAt: chosen.size === connections.length ? Math.min(...[...chosen.values()].map(value => value.savedAt)) : 0,
  } : null;
}
