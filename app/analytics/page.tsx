import type { Metadata } from "next";

import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Analytics",
  description:
    "Review real Instagram publishing activity and account readiness.",
};

export default function AnalyticsPage() {
  return (
    <AppShell activeKey="analytics">
      <AnalyticsDashboard />
    </AppShell>
  );
}
