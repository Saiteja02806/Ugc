import type { Metadata } from "next";

import { ArticleBody, ArticleExternalLink, ArticleH2, ArticleLink, FaqList } from "@/components/marketing/seo-article";
import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/clipugc-alternative";
const title = "ClipUGC Alternative for App Videos";
const description = "A factual ClipUGC alternative check for app marketers: what ClipUGC's public pages said on 24 November 2026, where those pages disagree, and how Vidmake's review step differs.";
const datePublished = "2026-11-24";
const faqs = [
  { question: "Is this a test of ClipUGC's video quality?", answer: "No. This page only uses what ClipUGC published on its own site on 24 November 2026. It does not score their output." },
  { question: "Did the public prices match each other?", answer: "The Professional checkout listed $14.99 a month. The pricing page listed that same regular monthly price, plus a temporary discount. The checkout counted videos, and the pricing page counted credits. Check both on the day you buy." },
  { question: "Does Vidmake replace a creator marketplace?", answer: "No. Vidmake makes short videos you review: hook videos, text on screen, and slideshows. It is not a marketplace of human creators." },
];

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: { title, description, url: path, type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

export default function ClipUgcAlternativePage() {
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
          { name: "ClipUGC alternative", path },
        ]),
        ],
      }}
      eyebrow="Comparison"
      h1="A ClipUGC alternative, checked against their public pages"
      lede="ClipUGC describes itself as an AI UGC video generator for apps. This is a side-by-side of what their public pages said on 24 November 2026 and what Vidmake actually lets you review. It is not a quality ranking."
    >
      <ArticleBody>
        <ArticleH2>What their pages said that day</ArticleH2>
        <p>
          The <ArticleExternalLink href="https://clipugc.com/pricing">ClipUGC pricing page</ArticleExternalLink> described a free start, a Professional plan with a regular price of $14.99 a month, and a Business plan with a regular price of $49.99 a month. It also showed a temporary discount. A credit table on that page listed 2 credits for a photo, 13 credits for a 10-second video, and app footage as free to add.
        </p>
        <p>
          The <ArticleExternalLink href="https://clipugc.com/checkout/plan/professional-monthly">Professional monthly checkout</ArticleExternalLink> listed $14.99 and described the plan as 30 UGC videos a month. That is a different unit from the credit table. This article does not convert credits into videos, because the two pages do not do that the same way.
        </p>
        <ArticleH2>What this article will not claim</ArticleH2>
        <p>Their homepage marketing, watermarks, and feature lists can change, and on the day this was written some of those lists did not use the same words as the checkout. Nothing here says Vidmake is cheaper, faster, or higher quality. Current Vidmake plans are on the <ArticleLink href="/pricing">pricing page</ArticleLink>.</p>
        <ArticleH2>Where the products are aimed</ArticleH2>
        <p>The ClipUGC public pages center an AI influencer plus your app footage inside the video. The Vidmake public workflows are a hook video, text on screen, and a slideshow. You review the result before you download it. The screen in the video has to be a recording or screenshot you supply. Generated footage is not a substitute for a product UI you have not shipped.</p>
        <p>If you want the opening line before you film, use the <ArticleLink href="/tools/hook-generator">hook line generator</ArticleLink>. If you want the slideshow built around one app feature, read <ArticleLink href="/blog/tiktok-slideshow-maker-for-apps">TikTok slideshows for apps</ArticleLink>.</p>
        <ArticleH2>A fair way to choose</ArticleH2>
        <p>Open both price pages on the same day. Make one short video in each product that shows a real screen from your app. Keep the one you would post without adding a correction. That test answers more than a comparison article can.</p>
        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/blog/unrealugc-alternative", title: "UnrealUGC alternative", description: "What UnrealUGC's pricing page published, and what this article leaves out." },
          { href: "/blog/best-ai-ugc-tools-for-app-marketing", title: "AI UGC tools for app marketing", description: "A checklist for comparing tools without a fake ranking." },
          { href: "/blog/best-ai-ugc-tools-for-saas", title: "AI UGC tools for SaaS", description: "The buyer's guide for software products, which is a different job." },
          { href: "/blog/ugc-pilot-vs-hiring-ugc-creators", title: "Vidmake and hiring creators", description: "Cost and time tradeoffs without a new price claim." },
          { href: "/explore/hook-video", title: "Hook video", description: "Start from a reference opening and review the clip." },
          { href: "/pricing", title: "Pricing", description: "Current Vidmake plans." },
        ]}
      />
    </VideoMarketingPage>
  );
}
