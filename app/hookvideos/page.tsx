import type { Metadata } from "next";

import { TrendingAiHookBundle } from "@/components/trending/trending-ai-hook-bundle";

export const metadata: Metadata = {
  title: "Trending AI hook videos",
  description: "Browse and preview the UGC Pilot collection of AI-generated hook videos from Trending.",
  robots: { index: false, follow: false },
};

export default function HookVideosPage() {
  return <TrendingAiHookBundle />;
}
