import type { Metadata } from "next";

import {
  FounderGuidePage,
  founderGuideOpenGraphImage,
  getFounderGuide,
} from "@/components/marketing/founder-guide-page";

const guide = getFounderGuide("social-media-marketing-for-saas");

export const metadata: Metadata = {
  title: "Social Media Marketing for SaaS: A Founder Guide",
  description: guide.description,
  alternates: { canonical: "/guides/social-media-marketing-for-saas" },
  openGraph: {
    title: "Social Media Marketing for SaaS | UGCPilot",
    description: guide.description,
    url: "/guides/social-media-marketing-for-saas",
    type: "article",
    images: [founderGuideOpenGraphImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Social Media Marketing for SaaS | UGCPilot",
    description: guide.description,
    images: [founderGuideOpenGraphImage],
  },
};

export default function SocialMediaMarketingForSaaSGuidePage() {
  return <FounderGuidePage guide={guide} />;
}
