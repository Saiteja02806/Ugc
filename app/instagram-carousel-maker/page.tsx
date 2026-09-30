import type { Metadata } from "next";

import {
  SeoLandingPage,
  seoPageContent,
} from "@/components/marketing/seo-landing-page";

const content = seoPageContent.carousel;

export const metadata: Metadata = {
  title: "Instagram Carousel Maker",
  description:
    "Turn your business context into a complete Instagram carousel, review it, and schedule it for a connected Instagram account with UGCPilot.",
  alternates: { canonical: content.canonicalPath },
  openGraph: {
    title: "Instagram Carousel Maker | UGCPilot",
    description:
      "Create, review, and schedule Instagram carousels from your business context.",
    url: content.canonicalPath,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Instagram Carousel Maker | UGCPilot",
    description:
      "Create, review, and schedule Instagram carousels from your business context.",
  },
};

export default function InstagramCarouselMakerPage() {
  return <SeoLandingPage content={content} />;
}
