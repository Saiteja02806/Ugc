import type { Metadata } from "next";

import {
  FounderGuidePage,
  founderGuideOpenGraphImage,
  getFounderGuide,
} from "@/components/marketing/founder-guide-page";

const guide = getFounderGuide("saas-content-marketing");

export const metadata: Metadata = {
  title: "SaaS Content Marketing: A Founder Guide",
  description: guide.description,
  alternates: { canonical: "/guides/saas-content-marketing" },
  openGraph: { title: "SaaS Content Marketing: A Founder Guide | UGCPilot", description: guide.description, url: "/guides/saas-content-marketing", type: "article", images: [founderGuideOpenGraphImage] },
  twitter: { card: "summary_large_image", title: "SaaS Content Marketing: A Founder Guide | UGCPilot", description: guide.description, images: [founderGuideOpenGraphImage] },
};

export default function SaaSContentMarketingGuidePage() { return <FounderGuidePage guide={guide} />; }
