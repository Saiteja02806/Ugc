"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { getBrowserTimeZone } from "@/lib/scheduling/account-timezone";
import { validateTimeZone } from "@/lib/scheduling/schedule-time";

const AccountTimeZoneContext = createContext<string | null>(null);

export function AccountTimeZoneProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [timezone] = useState(getBrowserTimeZone);
  const query = useQuery({
    queryKey: ["account-timezone", user?.uid ?? "signed-out"],
    enabled: Boolean(user?.emailVerified),
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const token = await getCurrentUserIdToken(user?.uid);
      if (!token) throw new Error("Sign in to load your time zone.");
      const response = await fetch("/api/account/timezone", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ timezone }),
        signal,
      });
      const data = await response.json() as { ok?: boolean; timezone?: string };
      if (!response.ok || !data.ok || typeof data.timezone !== "string") throw new Error("Could not load your time zone.");
      return validateTimeZone(data.timezone);
    },
  });
  return <AccountTimeZoneContext.Provider value={query.data ?? timezone}>{children}</AccountTimeZoneContext.Provider>;
}

export function useAccountTimeZone() {
  return useContext(AccountTimeZoneContext) ?? getBrowserTimeZone();
}
