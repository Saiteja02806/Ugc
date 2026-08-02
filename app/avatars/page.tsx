import type { Metadata } from "next";

import { AvatarsWorkspace } from "@/components/avatars/avatars-workspace";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Creative Assets",
  description: "Manage reusable videos and images for Instagram content.",
};

export default async function AvatarsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab =
    tab === "images" || tab === "saved" ? tab : "videos";

  return (
    <AppShell activeKey="avatars">
      <AvatarsWorkspace initialTab={initialTab} />
    </AppShell>
  );
}
