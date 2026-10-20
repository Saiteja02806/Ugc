"use client";

import { useSearchParams } from "next/navigation";
import { ExploreWorkspace } from "@/components/explore/explore-workspace";

/** Development-only URL handling keeps the production Explore route static. */
export function ExplorePreviewEntry() {
  const params = useSearchParams();
  return <ExploreWorkspace localPreview={process.env.NODE_ENV === "development" && params.get("preview") === "1"} />;
}
