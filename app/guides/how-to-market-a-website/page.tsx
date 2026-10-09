import type { Metadata } from "next";

import {
  FounderGuidePage,
  founderGuideOpenGraphImage,
  getFounderGuide,
} from "@/components/marketing/founder-guide-page";

const guide = getFounderGuide("how-to-market-a-website");

export const metadata: Metadata = {
  title: "How to Market a Website: A Founder Guide",
  description: guide.description,
  alternates: { canonical: "/guides/how-to-market-a-website" },
  openGraph: { title: "How to Market a Website: A Founder Guide | UGCPilot", description: guide.description, url: "/guides/how-to-market-a-website", type: "article", images: [founderGuideOpenGraphImage] },
  twitter: { card: "summary_large_image", title: "How to Market a Website: A Founder Guide | UGCPilot", description: guide.description, images: [founderGuideOpenGraphImage] },
};

export default function HowToMarketAWebsiteGuidePage() { return <FounderGuidePage guide={guide} />; }
