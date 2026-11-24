import type { Metadata } from "next";

import { ArticleBody, ArticleH2, ArticleLink, FaqList } from "@/components/marketing/seo-article";
import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/faceless-tiktok-content-for-apps";
const title = "Faceless TikTok Content for Apps";
const description = "Three faceless TikTok formats for an app: a slideshow, text on screen, and a screen recording with no person. The product UI still has to be real.";
const datePublished = "2026-11-24";
const faqs = [
  { question: "Is faceless the same as anonymous?", answer: "No. Faceless means you are not on camera. The app name, the screen, and the claims are still yours and still have to be true." },
  { question: "Can a generated person stand in for a customer?", answer: "Only if you do not present that person as a real customer. A fictional narrator and a testimonial are different things. Do not invent a user." },
  { question: "Which format needs the least filming?", answer: "A slideshow of screenshots you already have. Text on screen still needs a clip or images underneath. A screen recording needs the build." },
];

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: { title, description, url: path, type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

export default function FacelessAppTikTokPage() {
  return (
    <VideoMarketingPage
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          { ...articleJsonLd({ path, headline: title, description, imagePath: `${path}/opengraph-image`, datePublished }), "@type": "BlogPosting" },
          faqJsonLd(faqs),
          breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: "Faceless TikToks for apps", path },
        ]),
        ],
      }}
      eyebrow="Formats"
      h1="Faceless TikTok content for apps"
      lede="You can publish an app video without putting a person on camera. You cannot publish one without the product. Faceless is a format choice. The screen still has to come from the app."
    >
      <ArticleBody>
        <ArticleH2>Three formats that leave you off camera</ArticleH2>
        <p>A <ArticleLink href="/explore/slideshows">slideshow</ArticleLink> is screenshots and short captions. Use it when the feature is a single screen someone can read. The <ArticleLink href="/blog/tiktok-slideshows-for-app-installs">install slideshow</ArticleLink> is the version that ends on a real destination.</p>
        <p><ArticleLink href="/explore/wall-of-text">Text on screen</ArticleLink> puts the sentence over footage. The footage can be the screen recording. Read the <ArticleLink href="/blog/wall-of-text-video-maker">text on screen guide</ArticleLink> so the line is short enough to finish.</p>
        <p>A hook video can also be faceless when the reference is a screen and a hand, or the screen alone, and the line is voice or caption. Start in <ArticleLink href="/explore/hook-video">Hook video</ArticleLink> and reject any cut that adds a face you did not ask for.</p>
        <ArticleH2>What still needs a person</ArticleH2>
        <p>A founder story and a customer quote need a real speaker or a clearly fictional narrator. The <ArticleLink href="/blog/build-in-public-without-showing-face">build-in-public guide</ArticleLink> is about sharing the company without your face. It is a different job from showing the app UI.</p>
        <p>Hiring a creator is the path when you want a person who has used the product to say so. The <ArticleLink href="/blog/ugc-pilot-vs-hiring-ugc-creators">hiring comparison</ArticleLink> covers that tradeoff. This page does not add new prices to it.</p>
        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/blog/tiktok-slideshows-for-app-installs", title: "Slideshows for app installs", description: "A faceless deck that ends on a real link." },
          { href: "/blog/wall-of-text-video-maker", title: "Text on screen", description: "A sentence a viewer can finish reading." },
          { href: "/blog/build-in-public-without-showing-face", title: "Build in public", description: "Company updates without a face, which is a different job." },
          { href: "/blog/hook-formulas-for-app-tiktoks", title: "Hook formulas", description: "Openings you can put in a caption instead of on camera." },
          { href: "/explore/slideshows", title: "Slideshows", description: "Make the faceless deck." },
        ]}
      />
    </VideoMarketingPage>
  );
}
