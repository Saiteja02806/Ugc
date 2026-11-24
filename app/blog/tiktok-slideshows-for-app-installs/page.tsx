import type { Metadata } from "next";

import { ArticleBody, ArticleH2, ArticleH3, ArticleLink, FaqList } from "@/components/marketing/seo-article";
import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/tiktok-slideshows-for-app-installs";
const title = "TikTok Slideshows for App Installs";
const description = "How to build a TikTok slideshow that points at an app install: one feature, real screenshots, and a last slide that matches a link you actually have.";
const datePublished = "2026-11-24";
const faqs = [
  { question: "Does a slideshow create installs by itself?", answer: "No. A slideshow can show a feature and point to a store or site link. Installs depend on the store page, the product, and whether the person wanted that feature." },
  { question: "What belongs on the last slide?", answer: "The name of the app and the place you actually send people. If the link is not live, do not tell them to tap it." },
  { question: "How is this different from the slideshow maker guide?", answer: "That guide is about building the deck. This one is about the install path: the feature, the screenshot, and the destination." },
];

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: { title, description, url: path, type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

export default function SlideshowsForInstallsPage() {
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
          { name: "Slideshows for app installs", path },
        ]),
        ],
      }}
      eyebrow="Slideshows"
      h1="How to make TikTok slideshows that can point to an app install"
      lede="A slideshow does not manufacture installs. It can make one feature obvious and send a person who wants that feature to a link you control. The deck fails when the last slide promises a store page you do not have."
    >
      <ArticleBody>
        <ArticleH2>One feature, four slides</ArticleH2>
        <ArticleH3>1. The task, not the brand</ArticleH3>
        <p>The first slide names the job. “Split a receipt” is a task. “A new way to manage life” is not. People swipe when they recognize the job.</p>
        <ArticleH3>2. The screen</ArticleH3>
        <p>The second slide is a screenshot from the build you are promoting. Crop it so the control you mean is readable on a phone. Do not redraw the interface.</p>
        <ArticleH3>3. The single action</ArticleH3>
        <p>The third slide is the tap or the result, still from that same build. One action. A second feature belongs in a second slideshow.</p>
        <ArticleH3>4. The destination</ArticleH3>
        <p>The last slide names the app and the destination: the store listing, the site, or the waitlist that exists today. Match the caption link to that slide. If you only have a homepage, say homepage.</p>
        <ArticleH2>What to leave out</ArticleH2>
        <p>Leave out install counts, star ratings, and “everyone is switching” unless you are looking at the source while you write. Leave out a face if you do not want to be on camera. A faceless deck is a slideshow or <ArticleLink href="/blog/faceless-tiktok-content-for-apps">text on screen</ArticleLink>, not a fake customer.</p>
        <p>Build the deck in <ArticleLink href="/explore/slideshows">Slideshows</ArticleLink>. The earlier <ArticleLink href="/blog/tiktok-slideshow-maker-for-apps">slideshow maker guide</ArticleLink> covers pacing and captions. This page only covers the path from the feature to the link.</p>
        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/blog/tiktok-slideshow-maker-for-apps", title: "Slideshow maker for apps", description: "How to build the deck around one feature." },
          { href: "/blog/tiktok-slideshow-maker", title: "TikTok slideshow maker", description: "The general slideshow workflow." },
          { href: "/blog/faceless-tiktok-content-for-apps", title: "Faceless TikToks for apps", description: "Formats that do not need a person on camera." },
          { href: "/explore/slideshows", title: "Slideshows", description: "Make the deck and review it." },
          { href: "/blog/ugc-ads-for-mobile-apps", title: "UGC ads for mobile apps", description: "When the same feature should be a video instead." },
        ]}
      />
    </VideoMarketingPage>
  );
}
