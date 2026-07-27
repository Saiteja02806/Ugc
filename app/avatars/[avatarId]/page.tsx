import type { Metadata } from "next";

import { AvatarsWorkspace } from "@/components/avatars/avatars-workspace";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Influencer Editor",
  description: "Preview, trim, and choose an influencer video.",
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
