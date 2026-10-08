import type { Metadata } from "next";
import { FormatWorkspace } from "@/components/explore/format-workspace";
import { getLocalRecreateReferences } from "@/lib/explore/recreate-catalog";
export const metadata: Metadata = { title: "Hook video", description: "Recreate a hook with video generation." };
export default async function HookVideoPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const query = await searchParams;
  const preview = process.env.NODE_ENV === "development" && query.preview === "1";
  return <FormatWorkspace format="hook" previewReferences={preview ? getLocalRecreateReferences() : undefined} finishingEnabled={process.env.EXPLORE_FINISHING_ENABLED === "true" && process.env.EXPLORE_FORMAT_EDITING_ENABLED === "true"} />;
}
