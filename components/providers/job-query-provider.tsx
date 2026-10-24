"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { subscribeConnectionChanges } from "@/lib/social/connection-cache-events";

import { useAuth } from "@/contexts/auth-context";
import { AccountTimeZoneProvider } from "./account-timezone-provider";

export function JobQueryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  return (
    <AccountQueryClientProvider key={user?.uid ?? "signed-out"}>
      {children}
    </AccountQueryClientProvider>
  );
}

function AccountQueryClientProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: 60 * 60 * 1_000,
            refetchOnReconnect: true,
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 30 * 60 * 1_000,
          },
        },
      }),
  );

  const ownerId = user?.uid;
  useEffect(() => ownerId ? subscribeConnectionChanges(queryClient, ownerId) : undefined, [queryClient, ownerId]);

  return (
    <QueryClientProvider client={queryClient}>
      <AccountTimeZoneProvider>{children}</AccountTimeZoneProvider>
    </QueryClientProvider>
  );
}
