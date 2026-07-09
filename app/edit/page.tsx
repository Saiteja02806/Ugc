import type { Metadata } from "next";

import { EditLibraryWorkspace } from "@/components/edit/edit-library-workspace";
import { AppSidebar } from "@/components/layout/app-sidebar";

export const metadata: Metadata = {
  title: "Edit",
  description: "Choose a video to trim, overlay text, and prepare for scheduling.",
};

export default function EditPage() {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
      <AppSidebar activeKey="edit" />
      <EditLibraryWorkspace />
    </main>
  );
}
