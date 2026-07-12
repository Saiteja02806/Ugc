import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { LibraryWorkspace } from "@/components/library/library-workspace";

export const metadata: Metadata = {
  title: "Library",
  description: "Manage saved content and uploaded posts.",
};

type LibraryPageProps = {
  searchParams: Promise<{
    tab?: string;
  }>;
};

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const { tab } = await searchParams;
  const initialTab = tab === "content" ? "content" : "posts";

  return (
    <AppShell activeKey="library">
      <LibraryWorkspace initialTab={initialTab} />
    </AppShell>
  );
}
