import { AppSidebar } from "@/components/layout/app-sidebar";
import { TrendingWorkspace } from "@/components/trending/trending-workspace";

export default function DashboardPage() {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
      <AppSidebar activeKey="trending" />
      <TrendingWorkspace />
    </main>
  );
}
