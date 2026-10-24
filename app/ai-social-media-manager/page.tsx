import type { Metadata } from "next";

import {
  SeoLandingPage,
  seoPageContent,
} from "@/components/marketing/seo-landing-page";

const content = seoPageContent.manager;

export const metadata: Metadata = {
  title: "AI Social Media Manager",
  description:
    "Bring business context, content formats, and review together in one focused creative workflow.",
  alternates: { canonical: content.canonicalPath },
  robots: { index: false, follow: true },
  openGraph: {
    title: "AI Social Media Manager | UGCPilot",
    description:
      "A focused workflow for business-aware content creation and review.",
    url: content.canonicalPath,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "AI Social Media Manager | UGCPilot",
    description:
      "A focused workflow for business-aware content creation and review.",
  },
};

export default function AiSocialMediaManagerPage() {
  return <SeoLandingPage content={content} />;
}
