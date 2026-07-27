import type { Metadata } from "next";

import { AvatarsWorkspace } from "@/components/avatars/avatars-workspace";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Source Video Editor",
  description: "Preview and trim a reusable source video.",
};

export default async function AvatarEditorPage({
  params,
}: PageProps<"/avatars/[avatarId]">) {
  const { avatarId } = await params;

  return (
    <AppShell activeKey="avatars">
      <AvatarsWorkspace editorAvatarId={avatarId} />
    </AppShell>
  );
}
