import type { Metadata } from "next";

import {
  AnalyticsDashboard,
  type AnalyticsRange,
} from "@/components/analytics/analytics-dashboard";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Analytics",
  description: "Understand which social posts and creative formats perform best.",
};

type AnalyticsPageProps = {
  searchParams: Promise<{
    range?: string | string[];
  }>;
};

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const params = await searchParams;
  const range = Array.isArray(params.range) ? params.range[0] : params.range;
  const initialRange: AnalyticsRange = isAnalyticsRange(range) ? range : "30d";

  return (
    <AppShell activeKey="analytics">
      <AnalyticsDashboard initialRange={initialRange} />
    </AppShell>
  );
}

function isAnalyticsRange(value: string | undefined): value is AnalyticsRange {
  return value === "7d" || value === "30d" || value === "90d";
}
