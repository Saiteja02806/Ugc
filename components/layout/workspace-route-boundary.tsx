"use client";

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useEffect, type ReactNode } from "react";

import { AuthGuard } from "@/components/auth/auth-guard";
import { useAuth } from "@/contexts/auth-context";
import { publicReferenceWorkflow } from "@/lib/explore/public-reference-preview";
import { AppShell } from "@/components/layout/app-shell";
import { useExploreWorkflowPreload } from "@/components/explore/use-explore-workflow-preload";
import { getWorkspaceRouteConfig, isFocusedVideoWorkflowRoute } from "@/lib/navigation/workspace-route";

const PublicReferenceGallery = dynamic(() => import("@/components/explore/public-reference-gallery").then(loaded => loaded.PublicReferenceGallery));

export function WorkspaceRouteBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const publicWorkflow = publicReferenceWorkflow(pathname);
  const guestPreview = !loading && !user && publicWorkflow !== null;
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
      requireAuthentication={!guestPreview && route.access !== "none"}
      requireBusinessProfile={!guestPreview && route.access === "profile"}
    >
      <AppShell
        activeKey={route.activeKey}
        defaultSidebarCollapsed={route.defaultSidebarCollapsed}
        guestWorkflow={guestPreview}
        focusNavigation={isFocusedVideoWorkflowRoute(pathname)}
      >
        {guestPreview ? <PublicReferenceGallery key={publicWorkflow} workflow={publicWorkflow} /> : children}
      </AppShell>
    </AuthGuard>
  );
}
