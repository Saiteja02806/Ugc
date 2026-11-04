"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { useExploreWorkflowPreload } from "@/components/explore/use-explore-workflow-preload";
import { getWorkspaceRouteConfig, isFocusedVideoWorkflowRoute } from "@/lib/navigation/workspace-route";

export function WorkspaceRouteBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const route = getWorkspaceRouteConfig(pathname);
  const preload = useExploreWorkflowPreload(pathname);
  // Also overlap catalog/composer loading with the profile gate on direct links.
  // AuthGuard still owns every access and onboarding decision below.
  useEffect(preload, [preload]);

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
        focusNavigation={isFocusedVideoWorkflowRoute(pathname)}
      >
        {children}
      </AppShell>
    </AuthGuard>
  );
}
