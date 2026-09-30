import type { Metadata } from "next";

import {
  FounderGuidePage,
  founderGuideOpenGraphImage,
  getFounderGuide,
} from "@/components/marketing/founder-guide-page";

const guide = getFounderGuide("marketing-for-startups");

export const metadata: Metadata = {
  title: "Marketing for Startups: A Practical Founder Guide",
  description: guide.description,
  alternates: { canonical: "/guides/marketing-for-startups" },
  openGraph: { title: "Marketing for Startups: A Practical Founder Guide | UGCPilot", description: guide.description, url: "/guides/marketing-for-startups", type: "article", images: [founderGuideOpenGraphImage] },
  twitter: { card: "summary_large_image", title: "Marketing for Startups: A Practical Founder Guide | UGCPilot", description: guide.description, images: [founderGuideOpenGraphImage] },
};

export default function MarketingForStartupsGuidePage() { return <FounderGuidePage guide={guide} />; }
