import type { Metadata } from "next";

import {
  FounderGuidePage,
  founderGuideOpenGraphImage,
  getFounderGuide,
} from "@/components/marketing/founder-guide-page";

const guide = getFounderGuide("saas-marketing");

export const metadata: Metadata = {
  title: "SaaS Marketing: A Practical Founder Guide",
  description: guide.description,
  alternates: { canonical: "/guides/saas-marketing" },
  openGraph: { title: "SaaS Marketing: A Practical Founder Guide | UGCPilot", description: guide.description, url: "/guides/saas-marketing", type: "article", images: [founderGuideOpenGraphImage] },
  twitter: { card: "summary_large_image", title: "SaaS Marketing: A Practical Founder Guide | UGCPilot", description: guide.description, images: [founderGuideOpenGraphImage] },
};

export default function SaaSMarketingGuidePage() { return <FounderGuidePage guide={guide} />; }
