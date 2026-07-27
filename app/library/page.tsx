import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { LibraryWorkspace } from "@/components/library/library-workspace";
import type { LibraryTab } from "@/components/library/library-workspace";

export const metadata: Metadata = {
  title: "Content Library",
  description: "Manage reusable demo footage and saved slideshow assets.",
};

type LibraryPageProps = {
  searchParams: Promise<{
    tab?: string;
  }>;
};

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const { tab } = await searchParams;
  const initialTab: LibraryTab = tab === "content" ? "content" : "posts";

  return (
    <AppShell activeKey="library">
      <LibraryWorkspace initialTab={initialTab} />
    </AppShell>
  );
}
