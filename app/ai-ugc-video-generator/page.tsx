import type { Metadata } from "next";

import {
  SeoLandingPage,
  seoPageContent,
} from "@/components/marketing/seo-landing-page";

const content = seoPageContent.video;

export const metadata: Metadata = {
  title: "AI UGC Video Generator",
  description:
    "Create short-form video from a clear prompt and optional reference media, then keep the result in your UGCPilot content workflow.",
  alternates: { canonical: content.canonicalPath },
  openGraph: {
    title: "AI UGC Video Generator | UGCPilot",
    description:
      "Create short-form video from a prompt and reference media in AI Studio.",
    url: content.canonicalPath,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "AI UGC Video Generator | UGCPilot",
    description:
      "Create short-form video from a prompt and reference media in AI Studio.",
  },
};

export default function AiUgcVideoGeneratorPage() {
  return <SeoLandingPage content={content} />;
}
