"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { preloadExploreWorkflow } from "@/lib/explore/workflow-preload";

function loadComposer(workflow: "slideshow" | "hook" | "wall_text") {
  return workflow === "slideshow"
    ? import("@/components/workspace/ugc-chat-workspace")
    : import("@/components/video/video-generation-workspace");
}

export function useExploreWorkflowPreload(destination: string | null, localPreview = false) {
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();
  return useCallback(() => {
    if (process.env.NODE_ENV === "development" && new URLSearchParams(window.location.search).get("preview") === "1") return;
    void preloadExploreWorkflow({ destination, localPreview, loading, user, queryClient, loadComposer });
  }, [destination, localPreview, loading, user, queryClient]);
}
