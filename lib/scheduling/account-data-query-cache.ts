export const ACCOUNT_DATA_FRESH_TIME_MS = 15 * 1_000;
export const ACCOUNT_DATA_GC_TIME_MS = 30 * 60 * 1_000;

export function getAccountSocialConnectionsQueryKey(accountId: string) {
  return ["account", accountId, "social-connections"] as const;
}

export function getAccountSchedulesQueryKey(accountId: string) {
  return ["account", accountId, "schedules"] as const;
}

export function getAccountScheduleConfigQueryKey(accountId: string) {
  return ["account", accountId, "schedule-config"] as const;
}
