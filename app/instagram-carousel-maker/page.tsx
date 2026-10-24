import type { Metadata } from "next";

import {
  SeoLandingPage,
  seoPageContent,
} from "@/components/marketing/seo-landing-page";

const content = seoPageContent.carousel;

export const metadata: Metadata = {
  title: "Instagram Carousel Maker",
  description:
    "Create Instagram carousel posts from your business context. Plan the slides, review the complete post, and keep the approved version in your library.",
  alternates: { canonical: content.canonicalPath },
  openGraph: {
    title: "Instagram Carousel Maker | UGC Pilot",
    description:
      "Create Instagram carousel posts from your business context, then review the complete post and keep it in your library.",
    url: content.canonicalPath,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Instagram Carousel Maker | UGC Pilot",
    description:
      "Create Instagram carousel posts from your business context, then review the complete post and keep it in your library.",
  },
};

export default function InstagramCarouselMakerPage() {
  return <SeoLandingPage content={content} />;
}
