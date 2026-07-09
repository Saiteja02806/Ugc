import type { Metadata } from "next";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { SchedulingWorkspace } from "@/components/scheduling/scheduling-workspace";

export const metadata: Metadata = {
  title: "Scheduling",
  description: "Plan and organize upcoming social posts.",
};

export default function SchedulingPage() {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
      <AppSidebar activeKey="scheduling" />
      <SchedulingWorkspace />
    </main>
  );
}
