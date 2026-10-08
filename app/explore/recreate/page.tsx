import type { Metadata } from "next";

import { redirect } from "next/navigation";
import { isExploreUuid } from "@/worker/src/lib/explore-finishing-contract";

export const metadata: Metadata = {
  title: "Recreate",
  description: "Use a reference creative as context for your next version.",
};

export default async function RecreatePage({ searchParams }: {
  searchParams: Promise<{ preview?: string; refType?: string; refId?: string; sourceUrl?: string; exploreRecreate?: string; imageJob?: string; videoJob?: string }>;
}) {
  const query = await searchParams;
  const destination = query.refType === "hook" ? "/explore/hook-video" : query.refType === "wall_text" ? "/explore/wall-of-text" : "/explore/slideshows";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (typeof value === "string" && value.length <= 2048) params.set(key, value);
  // Jobs created before the split have no format tag. Keep their original
  // recovery path in Studio instead of dropping them from a scoped workflow.
  if (isExploreUuid(query.videoJob) || isExploreUuid(query.imageJob)) {
    params.set("mode", isExploreUuid(query.videoJob) ? "videos" : "images");
    redirect(`/ai-studio?${params}`);
  }
  redirect(`${destination}${params.size ? `?${params}` : ""}`);
}
