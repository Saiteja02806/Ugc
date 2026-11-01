import type { Metadata } from "next";

import { SettingsWorkspace } from "@/components/settings/settings-workspace";

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Manage your Vidmake account, plan, screenshots, connected accounts, preferences, and privacy.",
};

export default function SettingsPage() {
  return <SettingsWorkspace />;
}
