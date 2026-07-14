import type { Metadata } from "next";

import { AvatarsWorkspace } from "@/components/avatars/avatars-workspace";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Influencers",
  description: "Choose and trim influencer videos for UGC generation.",
};

export default async function AvatarsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab = tab === "videos" || tab === "images" ? tab : "influencers";

  return (
    <AppShell activeKey="avatars">
      <AvatarsWorkspace initialTab={initialTab} />
    </AppShell>
  );
}
