import type { Metadata } from "next";

import { LibraryWorkspace } from "@/components/library/library-workspace";

export const metadata: Metadata = {
  title: "Content Library",
  description: "Manage reusable demo footage for future posts.",
};

export default function LibraryPage() {
  return <LibraryWorkspace />;
}
