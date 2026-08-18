import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { ViralWorkspace } from "@/components/viral/viral-workspace";

export const metadata: Metadata = {
  title: "Explore",
};

export default function ViralPage() {
  return (
    <AppShell activeKey="viral">
      <ViralWorkspace />
    </AppShell>
  );
}
