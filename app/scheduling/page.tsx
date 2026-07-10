import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { SchedulingWorkspace } from "@/components/scheduling/scheduling-workspace";

export const metadata: Metadata = {
  title: "Scheduling",
  description: "Plan and organize upcoming social posts.",
};

export default function SchedulingPage() {
  return (
    <AppShell activeKey="scheduling">
      <SchedulingWorkspace />
    </AppShell>
  );
}
