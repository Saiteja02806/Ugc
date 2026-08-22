import type { Metadata } from "next";

import { AvatarsWorkspace } from "@/components/avatars/avatars-workspace";

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

  return <AvatarsWorkspace initialTab={initialTab} />;
}
