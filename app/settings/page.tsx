import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";

export const metadata: Metadata = {
  title: "Profile & Settings",
  description: "Manage account access, data controls, and sign-out for UGC Pilot.",
};

export default function SettingsPage() {
  return (
    <AppShell activeKey="settings">
      <SettingsWorkspace />
    </AppShell>
  );
}
