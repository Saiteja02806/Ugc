import type { ReactNode } from "react";

import {
  AppSidebar,
  type AppSidebarActiveKey,
} from "@/components/layout/app-sidebar";
import { ProductUpdatesCorner } from "@/components/updates/product-updates-corner";
import { WorkspaceFooter } from "@/components/layout/workspace-footer";

export function AppShell({
  activeKey,
  children,
  defaultSidebarCollapsed = false,
}: {
  activeKey: AppSidebarActiveKey;
  children: ReactNode;
  defaultSidebarCollapsed?: boolean;
}) {
  return (
    <main className="instagram-theme flex min-h-dvh flex-col overflow-x-clip bg-background text-foreground md:flex-row">
      <AppSidebar
        activeKey={activeKey}
        defaultCollapsed={defaultSidebarCollapsed}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-w-0 flex-1">{children}</div>
        <WorkspaceFooter />
      </div>
      <ProductUpdatesCorner />
    </main>
  );
}
