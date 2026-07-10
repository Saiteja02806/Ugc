import type { Metadata } from "next";

import { AvatarsWorkspace } from "@/components/avatars/avatars-workspace";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Avatars",
  description: "Choose and trim avatar videos for UGC generation.",
};

export default function AvatarsPage() {
  return (
    <AppShell activeKey="avatars">
      <AvatarsWorkspace />
    </AppShell>
  );
}
