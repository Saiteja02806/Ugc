import type { Metadata } from "next";

import { AvatarsWorkspace } from "@/components/avatars/avatars-workspace";

export const metadata: Metadata = {
  title: "Source Video Editor",
  description: "Preview and trim a reusable source video.",
};

export default async function AvatarEditorPage({
  params,
}: PageProps<"/avatars/[avatarId]">) {
  const { avatarId } = await params;

  return <AvatarsWorkspace editorAvatarId={avatarId} />;
}
