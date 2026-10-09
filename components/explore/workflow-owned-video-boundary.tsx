"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useWorkflowSourceVideo, type WorkflowVideoSelection } from "@/components/explore/use-workflow-source-video";

type Children = (selection: WorkflowVideoSelection) => ReactNode;
export function WorkflowOwnedVideoBoundary({ enabled, children }: { enabled: boolean; children: Children }) {
  return enabled ? <Account>{children}</Account> : <Selection enabled={false} ownerId={null}>{children}</Selection>;
}
function Account({ children }: { children: Children }) {
  const { user } = useAuth();
  return <Selection key={user?.uid ?? "signed-out"} enabled ownerId={user?.uid ?? null}>{children}</Selection>;
}
function Selection({ enabled, ownerId, children }: { enabled: boolean; ownerId: string | null; children: Children }) {
  return children(useWorkflowSourceVideo({ enabled, ownerId }));
}
