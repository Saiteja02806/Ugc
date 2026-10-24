import type { Metadata } from "next";

import {
  SeoLandingPage,
  seoPageContent,
} from "@/components/marketing/seo-landing-page";

const content = seoPageContent.video;

export const metadata: Metadata = {
  title: "AI UGC Video Generator for SaaS & Apps | UGC Pilot",
  description:
    "Create creator-style AI UGC video concepts for a SaaS product or mobile app with a focused prompt and optional reference media. Review each result in UGC Pilot.",
  alternates: { canonical: content.canonicalPath },
  openGraph: {
    title: "AI UGC Video Generator for SaaS & Apps | UGC Pilot",
    description:
      "Create creator-style AI UGC video concepts for a SaaS product or mobile app with a focused prompt and optional reference media.",
    url: content.canonicalPath,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "AI UGC Video Generator for SaaS & Apps | UGC Pilot",
    description:
      "Create creator-style AI UGC video concepts for a SaaS product or mobile app with a focused prompt and optional reference media.",
  },
};

export default function AiUgcVideoGeneratorPage() {
  return <SeoLandingPage content={content} />;
}
