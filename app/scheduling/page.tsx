import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { SchedulingWorkspace } from "@/components/scheduling/scheduling-workspace";

export const metadata: Metadata = {
  title: "Instagram Content Calendar",
  description: "Plan, review, and publish upcoming Instagram content.",
};

export default function SchedulingPage() {
  return (
    <AppShell activeKey="scheduling">
      <SchedulingWorkspace />
    </AppShell>
  );
}
