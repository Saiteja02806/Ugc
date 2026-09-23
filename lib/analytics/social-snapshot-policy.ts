type Connection = { id: string; connectedAt: string; status: string };
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
  for (const job of jobs) {
    const savedAt = Date.parse(job.completedAt ?? "");
    if (!Number.isFinite(savedAt) || !job.output || typeof job.output !== "object") continue;
    const output = job.output as { accounts?: unknown[] };
    if (!Array.isArray(output.accounts)) continue;
    const accounts = output.accounts.filter((value) => {
      if (!value || typeof value !== "object") return false;
      const account = value as { connectionId?: string; lastSyncedAt?: string };
      const connection = connections.find((c) => c.id === account.connectionId);
      // A reconnect/disconnect invalidates old permissions and cached data.
      return connection?.status === "connected" &&
        Date.parse(account.lastSyncedAt ?? "") >= Date.parse(connection.connectedAt);
    });
    if (accounts.length > 0) {
      return { data: { accounts }, savedAt: accounts.length === connections.length ? savedAt : 0 };
    }
  }
  return null;
}
