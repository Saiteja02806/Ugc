import type { Metadata } from "next";

import { ExploreWorkspace } from "@/components/explore/explore-workspace";

export const metadata: Metadata = {
  title: "Explore",
  description: "Choose a marketing workflow and make content for the format you need.",
};

export default async function ExplorePage({ searchParams }: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const query = await searchParams;
  return <ExploreWorkspace localPreview={process.env.NODE_ENV === "development" && query.preview === "1"} />;
}
