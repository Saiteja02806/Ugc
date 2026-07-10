import type { Metadata } from "next";

import { EditLibraryWorkspace } from "@/components/edit/edit-library-workspace";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Edit",
  description: "Choose a video to trim, overlay text, and prepare for scheduling.",
};

export default function EditPage() {
  return (
    <AppShell activeKey="edit">
      <EditLibraryWorkspace />
    </AppShell>
  );
}
