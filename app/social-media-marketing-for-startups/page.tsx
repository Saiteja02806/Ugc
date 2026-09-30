import type { Metadata } from "next";

import {
  SeoLandingPage,
  seoPageContent,
} from "@/components/marketing/seo-landing-page";

const content = seoPageContent.startups;

export const metadata: Metadata = {
  title: "Social Media Marketing for Startups",
  description:
    "Build a sustainable social content routine for your startup with videos, text-led posts, and carousels that your team reviews before publishing.",
  alternates: { canonical: content.canonicalPath },
  openGraph: {
    title: "Social Media Marketing for Startups | UGCPilot",
    description:
      "A practical social content routine for founders and lean marketing teams.",
    url: content.canonicalPath,
    type: "article",
  },
  twitter: {
    card: "summary",
    title: "Social Media Marketing for Startups | UGCPilot",
    description:
      "A practical social content routine for founders and lean marketing teams.",
  },
};

export default function SocialMediaMarketingForStartupsPage() {
  return <SeoLandingPage content={content} />;
}
