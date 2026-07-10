import type { Metadata } from "next";

import { DemosWorkspace } from "@/components/demos/demos-workspace";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Demos",
  description: "Upload and manage product demo videos.",
};

export default function DemosPage() {
  return (
    <AppShell activeKey="demos">
      <DemosWorkspace />
    </AppShell>
  );
}
