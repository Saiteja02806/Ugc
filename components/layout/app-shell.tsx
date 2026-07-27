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
    <main className="flex min-h-dvh flex-col overflow-x-clip bg-[#1F1F1F] text-[#F5F3F0] md:flex-row">
      <AppSidebar
        activeKey={activeKey}
        defaultCollapsed={defaultSidebarCollapsed}
      />
      {children}
    </main>
  );
}
