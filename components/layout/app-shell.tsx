import type { ReactNode } from "react";
import { WorkflowNavigationProvider } from "@/components/layout/workflow-navigation";

import {
  AppSidebar,
  type AppSidebarActiveKey,
} from "@/components/layout/app-sidebar";

export function AppShell({
  activeKey,
  children,
  defaultSidebarCollapsed = false,
  focusNavigation = false,
}: {
  activeKey: AppSidebarActiveKey;
  children: ReactNode;
  defaultSidebarCollapsed?: boolean;
  focusNavigation?: boolean;
}) {
  return (
    <WorkflowNavigationProvider enabled={focusNavigation}><main className="instagram-theme flex min-h-dvh flex-col overflow-x-clip bg-background text-foreground md:flex-row">
      <AppSidebar
        activeKey={activeKey}
        defaultCollapsed={defaultSidebarCollapsed}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </main></WorkflowNavigationProvider>
  );
}
