import type { Metadata } from "next";

import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import { ArticleBody, ArticleH2, ArticleH3, ArticleLink, FaqList } from "@/components/marketing/seo-article";
import { articleJsonLd, breadcrumbJsonLd, publicOrigin } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/tiktok-slideshow-maker-for-apps";
const title = "TikTok Slideshow Maker for Apps: A Swipe Deck That Shows the Product";
const description =
  "Use a TikTok slideshow maker for an app: one feature per deck, a first slide that names the task, real screenshots, and a review before you export.";
const datePublished = "2026-11-23";

const faqs = [
  {
    question: "What is a TikTok slideshow for an app?",
    answer:
      "A photo post made of slides the viewer swipes. For an app, the deck should explain one feature with readable text and screenshots from the real product, not a montage of every screen.",
  },
  {
    question: "How is this different from a general slideshow?",
    answer:
      "A general slideshow can be a story or a list. An app slideshow still has to show the product. At least one slide should be a screenshot a person could find in the app.",
  },
  {
    question: "Can I generate the screenshots?",
    answer:
      "Generate the layout and the words if you want. Do not generate a fake interface and present it as the app. Use a screenshot from the build you intend to ship.",
  },
  {
    question: "Where do I make the deck in Vidmake?",
    answer:
      "Open Slideshows in Explore. You can recreate a slideshow structure one image at a time, review the sequence, and download the version you approve. Posting to TikTok is a separate step.",
  },
];

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: {
    type: "article",
    url: new URL(path, publicOrigin).href,
    siteName: "Vidmake",
    title,
    description,
  },
  twitter: { card: "summary_large_image", title, description },
};

export default function TikTokSlideshowMakerForAppsPage() {
  return (
    <VideoMarketingPage
      eyebrow="App slideshows"
      h1={title}
      lede="A slideshow for an app is a short explanation the viewer controls. Each swipe should answer the question the previous slide raised, and one of those slides should be the actual product."
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          { ...articleJsonLd({ path, headline: title, description, imagePath: `${path}/opengraph-image`, datePublished }), "@type": "BlogPosting" },
          faqJsonLd(faqs),
          breadcrumbJsonLd([
            { name: "Vidmake", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: "TikTok slideshow maker for apps", path },
          ]),
        ],
      }}
    >
      <ArticleBody>
        <ArticleH2>Decide the one feature before you design a slide</ArticleH2>
        <p>
          Name the feature in a single sentence a teammate can check against the app: &quot;A call note includes a next-step section.&quot; If you cannot point at that sentence in the product, the deck is not ready. The <ArticleLink href="/blog/tiktok-slideshow-maker">TikTok slideshow maker guide</ArticleLink> covers slide count and the five-part structure. This page is the app-specific version of that job.
        </p>

        <ArticleH2>A five-slide app deck</ArticleH2>
        <ol className="list-decimal space-y-3 pl-5">
          <li><strong className="text-foreground-strong">Task:</strong> the moment, with no brand name required.</li>
          <li><strong className="text-foreground-strong">Friction:</strong> what goes wrong when the task stays manual.</li>
          <li><strong className="text-foreground-strong">Screen:</strong> a real screenshot of the feature, cropped so the control is readable.</li>
          <li><strong className="text-foreground-strong">Action:</strong> the tap or the path, in the same words the interface uses.</li>
          <li><strong className="text-foreground-strong">Limit:</strong> what the feature does not do, if people often assume more.</li>
        </ol>
        <p>
          Five slides is a planning default, not a performance claim. Use fewer when the feature is one control. The measured sample in the <ArticleLink href="/blog/tiktok-slideshow-view-data">slideshow data study</ArticleLink> is a curated set, not a rule for how many slides an app deck needs.
        </p>

        <ArticleH2>Make the screenshot do the proving</ArticleH2>
        <ArticleH3>Crop for a phone, not a desktop review</ArticleH3>
        <p>
          A full window at desktop size becomes unreadable as a vertical slide. Crop to the control and its label. Hide names, messages, and account details. The <ArticleLink href="/guides/readable-video-text">readable text guide</ArticleLink> applies to type you add on top of the screenshot.
        </p>
        <ArticleH3>Match the words to the pixels</ArticleH3>
        <p>
          If the slide says &quot;next step,&quot; the screenshot should show a next step. Do not describe an integration, a reminder, or a time saved unless that behavior is in the build and visible or separately documented.
        </p>

        <ArticleH2>When a slideshow is the wrong format</ArticleH2>
        <p>
          Use a slideshow when the viewer should pause on a screen. Use a <ArticleLink href="/blog/hook-video-maker">hook video</ArticleLink> when the opening needs a person or a reaction. Use <ArticleLink href="/blog/wall-of-text-video-maker">text on screen</ArticleLink> when the story is a paragraph, not a sequence of screens. The <ArticleLink href="/guides/saas-slideshow-story-vs-tutorial">story versus tutorial guide</ArticleLink> helps you choose.
        </p>

        <ArticleH2>Review the deck as a swipe, then export</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Slide one makes sense with no other context.</li>
          <li>Each slide makes the next swipe necessary.</li>
          <li>The product slide is a real screenshot.</li>
          <li>No claim appears that the screenshots do not support.</li>
          <li>You can read every line at phone size in a couple of seconds.</li>
        </ul>
        <p>
          <ArticleLink href="/explore/slideshows">Open Slideshows</ArticleLink> to build the sequence and review it before you download. TikTok photo posts and Instagram carousels have different format requirements, so check the destination before you export. Paid plans start at $29 a month; see <ArticleLink href="/pricing">pricing</ArticleLink>.
        </p>

        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/explore/slideshows", title: "Slideshows", description: "Build and review the deck in Explore." },
          { href: "/blog/tiktok-slideshow-maker", title: "TikTok slideshow maker", description: "Slide count, structure, and a general review step." },
          { href: "/blog/ugc-ads-for-mobile-apps", title: "UGC ads for mobile apps", description: "When the same feature should be a video ad." },
          { href: "/guides/saas-carousel-feature-story", title: "Carousel feature story", description: "Structure a deck around one feature." },
          { href: "/instagram-carousel-maker", title: "Carousel maker", description: "The Instagram carousel workflow." },
          { href: "/guides/app-store-preview-vs-social-video", title: "Store preview vs social", description: "Keep the store asset separate from the post." },
        ]}
      />
    </VideoMarketingPage>
  );
}
