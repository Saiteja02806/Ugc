import type { Metadata } from "next";

import {
  SeoLandingPage,
  seoPageContent,
} from "@/components/marketing/seo-landing-page";

const content = seoPageContent.video;

export const metadata: Metadata = {
  title: "AI UGC Video Generator",
  description:
    "Create creator-style short videos from a clear prompt and optional reference media, then keep each result in your UGC Pilot content workflow.",
  alternates: { canonical: content.canonicalPath },
  openGraph: {
    title: "AI UGC Video Generator | UGCPilot",
    description:
      "Create creator-style short videos from a prompt and optional reference media in AI Studio.",
    url: content.canonicalPath,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "AI UGC Video Generator | UGCPilot",
    description:
      "Create creator-style short videos from a prompt and optional reference media in AI Studio.",
  },
};

export default function AiUgcVideoGeneratorPage() {
  return <SeoLandingPage content={content} />;
}
