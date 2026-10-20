import type { Metadata } from "next";

import {
  SeoLandingPage,
  seoPageContent,
} from "@/components/marketing/seo-landing-page";

const content = seoPageContent.carousel;

export const metadata: Metadata = {
  title: "Instagram Carousel Maker",
  description:
    "Create Instagram carousel posts from your business context. Plan the slides, review the complete post, and schedule it with UGC Pilot.",
  alternates: { canonical: content.canonicalPath },
  openGraph: {
    title: "Instagram Carousel Maker | UGC Pilot",
    description:
      "Create Instagram carousel posts from your business context, then review and schedule the complete post.",
    url: content.canonicalPath,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Instagram Carousel Maker | UGC Pilot",
    description:
      "Create Instagram carousel posts from your business context, then review and schedule the complete post.",
  },
};

export default function InstagramCarouselMakerPage() {
  return <SeoLandingPage content={content} />;
}
