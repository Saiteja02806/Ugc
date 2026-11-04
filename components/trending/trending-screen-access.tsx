"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { WorkspaceContentLoading } from "@/components/layout/workspace-content-loading";
import { canViewTrendingScreen } from "@/lib/trending/screen-access";

const TrendingWorkspace = dynamic(
  () => import("./trending-workspace").then(module => module.TrendingWorkspace),
  { loading: () => <WorkspaceContentLoading label="Loading Trending" /> },
);

export function TrendingScreenAccess() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = canViewTrendingScreen(user);

  useEffect(() => {
    if (!loading && !allowed) router.replace("/explore");
  }, [allowed, loading, router]);

  if (loading || !allowed) return <WorkspaceContentLoading label="Loading" />;
  return <TrendingWorkspace />;
}
