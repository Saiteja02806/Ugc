import type { Metadata } from "next";
import { Suspense } from "react";

import { ExploreWorkspace } from "@/components/explore/explore-workspace";
import { ExplorePreviewEntry } from "@/components/explore/explore-preview-entry";

export const metadata: Metadata = {
  title: "Explore",
  description: "Choose a marketing workflow and make content for the format you need.",
};

export default function ExplorePage() {
  // Explore contains shared presentation only. Reading searchParams on the
  // server made every production return dynamically render this static menu.
  if (process.env.NODE_ENV === "development") {
    return <Suspense fallback={<ExploreWorkspace />}><ExplorePreviewEntry /></Suspense>;
  }
  return <ExploreWorkspace />;
}
