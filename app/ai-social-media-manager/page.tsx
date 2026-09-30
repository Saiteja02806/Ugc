import type { Metadata } from "next";

import {
  SeoLandingPage,
  seoPageContent,
} from "@/components/marketing/seo-landing-page";

const content = seoPageContent.manager;

export const metadata: Metadata = {
  title: "AI Social Media Manager",
  description:
    "Bring business context, content formats, review, and publishing decisions together in one focused social content workflow.",
  alternates: { canonical: content.canonicalPath },
  openGraph: {
    title: "AI Social Media Manager | UGCPilot",
    description:
      "A focused workflow for business-aware content creation, review, and publishing decisions.",
    url: content.canonicalPath,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "AI Social Media Manager | UGCPilot",
    description:
      "A focused workflow for business-aware content creation, review, and publishing decisions.",
  },
};

export default function AiSocialMediaManagerPage() {
  return <SeoLandingPage content={content} />;
}
