import type { Metadata } from "next";

import { InstagramAnalyticsWorkspace } from "@/components/analytics/instagram-analytics-workspace";

export const metadata: Metadata = {
  title: "Analytics",
  description:
    "Review publishing performance, account readiness, and content activity.",
};

export default function AnalyticsPage() {
  return <InstagramAnalyticsWorkspace />;
}
