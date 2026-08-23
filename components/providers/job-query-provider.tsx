"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { useAuth } from "@/contexts/auth-context";

export function JobQueryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  return (
    <AccountQueryClientProvider key={user?.uid ?? "signed-out"}>
      {children}
    </AccountQueryClientProvider>
  );
}

function AccountQueryClientProvider({ children }: { children: ReactNode }) {
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

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
