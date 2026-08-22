import type { Metadata } from "next";

import { SchedulingWorkspace } from "@/components/scheduling/scheduling-workspace";

export const metadata: Metadata = {
  title: "Instagram Content Calendar",
  description: "Plan, review, and publish upcoming Instagram content.",
};

export default function SchedulingPage() {
  return <SchedulingWorkspace />;
}
