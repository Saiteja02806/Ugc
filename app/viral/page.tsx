import type { Metadata } from "next";

import { ViralWorkspace } from "@/components/viral/viral-workspace";

export const metadata: Metadata = {
  title: "Explore",
  description: "Browse direct Hook video references for your next video.",
};

export default function ExplorePage() {
  return <ViralWorkspace />;
}
