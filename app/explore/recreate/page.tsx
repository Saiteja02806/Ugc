import type { Metadata } from "next";

import { RecreateWorkspace } from "@/components/explore/recreate-workspace";
import { getLocalRecreateReferences } from "@/lib/explore/recreate-catalog";

export const metadata: Metadata = {
  title: "Recreate",
  description: "Use a reference creative as context for your next version.",
};

export default async function RecreatePage({ searchParams }: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const query = await searchParams;
  const localPreview = process.env.NODE_ENV === "development" && query.preview === "1";
  return <RecreateWorkspace previewReferences={localPreview ? getLocalRecreateReferences() : undefined} />;
}
