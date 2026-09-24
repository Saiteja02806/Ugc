"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { getWorkspaceRouteConfig } from "@/lib/navigation/workspace-route";

export function WorkspaceRouteBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const route = getWorkspaceRouteConfig(pathname);

  if (!route) {
    return children;
  }

  return (
    <AuthGuard
      requireAuthentication={route.access !== "none"}
      requireBusinessProfile={route.access === "profile"}
    >
      <AppShell
        activeKey={route.activeKey}
        defaultSidebarCollapsed={route.defaultSidebarCollapsed}
      >
        {children}
      </AppShell>
    </AuthGuard>
  );
}
