"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { HookVideoBundle } from "@/components/marketing/hook-video-bundle";
import { useAuth } from "@/contexts/auth-context";
import { getWorkspaceRouteConfig, isFocusedVideoWorkflowRoute } from "@/lib/navigation/workspace-route";

export function WorkspaceRouteBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const route = getWorkspaceRouteConfig(pathname);
  const { user, loading } = useAuth();

  // This single anonymous offer does not change the access policy for Explore
  // APIs, signed-in creation/drafts, sibling routes or private reference sets.
  if (pathname.replace(/\/$/, "") === "/explore/hook-video" && !loading && !user) {
    return <HookVideoBundle />;
  }

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
