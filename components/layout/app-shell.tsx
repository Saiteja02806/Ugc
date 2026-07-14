import type { ReactNode } from "react";

import {
  AppSidebar,
  type AppSidebarActiveKey,
} from "@/components/layout/app-sidebar";

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
    <main className="flex min-h-dvh flex-col overflow-x-clip bg-background text-foreground md:flex-row">
      <AppSidebar
        activeKey={activeKey}
        defaultCollapsed={defaultSidebarCollapsed}
      />
      {children}
    </main>
  );
}
