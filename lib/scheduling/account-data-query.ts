import type { QueryClient } from "@tanstack/react-query";

import { getCurrentUserIdToken } from "../firebase/auth";
import type { SocialConnection, SocialPlatform } from "../social/types";
import {
  ACCOUNT_DATA_FRESH_TIME_MS,
  ACCOUNT_DATA_GC_TIME_MS,
  getAccountScheduleConfigQueryKey,
  getAccountSchedulesQueryKey,
  getAccountSocialConnectionsQueryKey,
} from "./account-data-query-cache";
import type { ScheduledPost } from "./types";

export {
  ACCOUNT_DATA_FRESH_TIME_MS,
  ACCOUNT_DATA_GC_TIME_MS,
  getAccountScheduleConfigQueryKey,
  getAccountSchedulesQueryKey,
  getAccountSocialConnectionsQueryKey,
} from "./account-data-query-cache";

export type AccountScheduleConfig = {
  calendarStartAt?: string;
  minimumRenderLeadMinutes?: number;
  minimumScheduleLeadMinutes?: number;
};

export type AccountSchedules = AccountScheduleConfig & {
  schedules: ScheduledPost[];
};

export type AccountDataLoadOptions = {
  errorMessage?: string;
  force?: boolean;
  token?: string;
};

export type SocialConnectionLoadOptions = AccountDataLoadOptions & {
  trace?: {
    callbackHost?: string;
    correlationId?: string;
    platform?: SocialPlatform;
  };
};

type ConnectionsResponse =
  | { connections: SocialConnection[]; ok: true }
  | { message?: string; ok?: false };

type SchedulesResponse =
  | (AccountSchedules & { ok: true })
  | { message?: string; ok?: false };

type ScheduleConfigResponse =
  | (AccountScheduleConfig & { ok: true })
  | { message?: string; ok?: false };

export class AccountDataAuthenticationUnavailableError extends Error {
  constructor() {
    super("Account authentication is unavailable.");
    this.name = "AccountDataAuthenticationUnavailableError";
  }
}

export async function loadAccountSocialConnections(
  queryClient: QueryClient,
  accountId: string,
  options: SocialConnectionLoadOptions = {},
) {
  return queryClient.fetchQuery({
    gcTime: ACCOUNT_DATA_GC_TIME_MS,
    queryFn: async ({ signal }) => {
      const token = options.token ?? await getCurrentUserIdToken();

      if (!token) {
        throw new AccountDataAuthenticationUnavailableError();
      }

      const response = await fetch("/api/social/connections", {
        cache: "no-store",
        headers: getConnectionHeaders(token, options.trace),
        signal,
      });
      const data = (await response.json().catch(() => null)) as
        | ConnectionsResponse
        | null;

      if (!response.ok || data?.ok !== true) {
        throw new Error(
          data?.ok === false && data.message
            ? data.message
            : options.errorMessage ?? "Could not load connected accounts.",
        );
      }

      return data.connections;
    },
    queryKey: getAccountSocialConnectionsQueryKey(accountId),
    retry: false,
    staleTime: options.force ? 0 : ACCOUNT_DATA_FRESH_TIME_MS,
  });
}

export async function loadAccountSchedules(
  queryClient: QueryClient,
  accountId: string,
  options: AccountDataLoadOptions = {},
) {
  const schedules = await queryClient.fetchQuery({
    gcTime: ACCOUNT_DATA_GC_TIME_MS,
    queryFn: async ({ signal }) => {
      const token = options.token ?? await getCurrentUserIdToken();

      if (!token) {
        throw new AccountDataAuthenticationUnavailableError();
      }

      const response = await fetch("/api/schedules", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      const data = (await response.json().catch(() => null)) as
        | SchedulesResponse
        | null;

      if (!response.ok || data?.ok !== true) {
        throw new Error(
          data?.ok === false && data.message
            ? data.message
            : options.errorMessage ?? "Could not load schedules.",
        );
      }

      return {
        calendarStartAt: data.calendarStartAt,
        minimumRenderLeadMinutes: data.minimumRenderLeadMinutes,
        minimumScheduleLeadMinutes: data.minimumScheduleLeadMinutes,
        schedules: data.schedules,
      } satisfies AccountSchedules;
    },
    queryKey: getAccountSchedulesQueryKey(accountId),
    retry: false,
    staleTime: options.force ? 0 : ACCOUNT_DATA_FRESH_TIME_MS,
  });

  queryClient.setQueryData<AccountScheduleConfig>(
    getAccountScheduleConfigQueryKey(accountId),
    getScheduleConfig(schedules),
  );

  return schedules;
}

export async function loadAccountScheduleConfig(
  queryClient: QueryClient,
  accountId: string,
  options: AccountDataLoadOptions = {},
) {
  const schedules = queryClient.getQueryData<AccountSchedules>(
    getAccountSchedulesQueryKey(accountId),
  );
  const schedulesState = queryClient.getQueryState(
    getAccountSchedulesQueryKey(accountId),
  );

  if (
    !options.force &&
    schedules &&
    schedulesState &&
    !schedulesState.isInvalidated &&
    Date.now() - schedulesState.dataUpdatedAt < ACCOUNT_DATA_FRESH_TIME_MS
  ) {
    return getScheduleConfig(schedules);
  }

  return queryClient.fetchQuery({
    gcTime: ACCOUNT_DATA_GC_TIME_MS,
    queryFn: async ({ signal }) => {
      const token = options.token ?? await getCurrentUserIdToken();

      if (!token) {
        throw new AccountDataAuthenticationUnavailableError();
      }

      const response = await fetch("/api/schedules?configOnly=1", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      const data = (await response.json().catch(() => null)) as
        | ScheduleConfigResponse
        | null;

      if (!response.ok || data?.ok !== true) {
        throw new Error(
          data?.ok === false && data.message
            ? data.message
            : options.errorMessage ?? "Could not load scheduling settings.",
        );
      }

      return getScheduleConfig(data);
    },
    queryKey: getAccountScheduleConfigQueryKey(accountId),
    retry: false,
    staleTime: options.force ? 0 : ACCOUNT_DATA_FRESH_TIME_MS,
  });
}

export function upsertAccountSchedule(
  queryClient: QueryClient,
  accountId: string,
  schedule: ScheduledPost,
) {
  queryClient.setQueryData<AccountSchedules>(
    getAccountSchedulesQueryKey(accountId),
    (current) =>
      current
        ? {
            ...current,
            schedules: [
              schedule,
              ...current.schedules.filter(
                (candidate) => candidate.id !== schedule.id,
              ),
            ],
          }
        : current,
  );
}

export function invalidateAccountSchedules(
  queryClient: QueryClient,
  accountId: string,
) {
  return queryClient.invalidateQueries({
    exact: true,
    queryKey: getAccountSchedulesQueryKey(accountId),
  });
}

export function removeAccountSocialConnection(
  queryClient: QueryClient,
  accountId: string,
  connectionId: string,
) {
  queryClient.setQueryData<SocialConnection[]>(
    getAccountSocialConnectionsQueryKey(accountId),
    (current) => current?.filter((connection) => connection.id !== connectionId),
  );
}

function getConnectionHeaders(
  token: string,
  trace?: SocialConnectionLoadOptions["trace"],
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (trace?.correlationId) {
    headers["x-ugc-oauth-correlation-id"] = trace.correlationId;
  }

  if (trace?.callbackHost) {
    headers["x-ugc-oauth-callback-host"] = trace.callbackHost;
  }

  return headers;
}

function getScheduleConfig(
  data: AccountScheduleConfig,
): AccountScheduleConfig {
  return {
    calendarStartAt: data.calendarStartAt,
    minimumRenderLeadMinutes: data.minimumRenderLeadMinutes,
    minimumScheduleLeadMinutes: data.minimumScheduleLeadMinutes,
  };
}
