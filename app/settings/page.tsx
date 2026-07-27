import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Manage your UGC Pilot account, Instagram publishing access, and privacy.",
};

export default function SettingsPage() {
  return (
    <AppShell activeKey="settings">
      <SettingsWorkspace />
    </AppShell>
  );
}
