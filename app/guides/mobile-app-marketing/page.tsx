import type { Metadata } from "next";

import {
  FounderGuidePage,
  founderGuideOpenGraphImage,
  getFounderGuide,
} from "@/components/marketing/founder-guide-page";

const guide = getFounderGuide("mobile-app-marketing");

export const metadata: Metadata = {
  title: "Mobile App Marketing: A Founder Guide",
  description: guide.description,
  alternates: { canonical: "/guides/mobile-app-marketing" },
  openGraph: { title: "Mobile App Marketing: A Founder Guide | UGCPilot", description: guide.description, url: "/guides/mobile-app-marketing", type: "article", images: [founderGuideOpenGraphImage] },
  twitter: { card: "summary_large_image", title: "Mobile App Marketing: A Founder Guide | UGCPilot", description: guide.description, images: [founderGuideOpenGraphImage] },
};

export default function MobileAppMarketingGuidePage() { return <FounderGuidePage guide={guide} />; }
