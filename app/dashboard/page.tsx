import { AppShell } from "@/components/layout/app-shell";
import { TrendingWorkspace } from "@/components/trending/trending-workspace";

export default function DashboardPage() {
  return (
    <AppShell activeKey="trending">
      <TrendingWorkspace />
    </AppShell>
  );
}
