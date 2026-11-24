import type { Metadata } from "next";

import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import { ArticleBody, ArticleH2, ArticleLink, FaqList } from "@/components/marketing/seo-article";
import { articleJsonLd, breadcrumbJsonLd, publicOrigin } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/app-marketing-videos-for-saas";
const title = "App Marketing Videos for SaaS: Which Format to Make First";
const description =
  "Choose app marketing videos for a SaaS product: hook, text on screen, slideshow, or a real demo, and match each format to one verified feature.";
const datePublished = "2026-11-23";

const faqs = [
  {
    question: "What counts as an app marketing video for SaaS?",
    answer:
      "A short video whose job is to explain one product behavior to a person who might use it. A hook, a text-on-screen story, a slideshow, and a screen recording can all be that video. A logo sting is not.",
  },
  {
    question: "Which format should a small team make first?",
    answer:
      "The one that matches the feature. If the viewer must see a control, record the screen and put a short hook in front of it. If the point is a situation they recognize, start with text on screen. If they need to pause on a screenshot, make a slideshow.",
  },
  {
    question: "Can one video cover the whole product?",
    answer:
      "Not usefully, at the length people watch. Make a series: one feature, one video, one next step. Link the series from the same profile instead of stacking features inside the first three seconds.",
  },
  {
    question: "Do these videos post themselves?",
    answer:
      "No. You review and download the file, then publish it from the account you manage. A connected scheduling flow is separate, and it still needs a real target before anything is published.",
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

export default function AppMarketingVideosForSaasPage() {
  return (
    <VideoMarketingPage
      eyebrow="SaaS video"
      h1={title}
      lede="A SaaS app does not need a video for every screen. It needs a small set of videos that each make one behavior obvious, and a way to tell which format that behavior belongs in."
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          { ...articleJsonLd({ path, headline: title, description, imagePath: `${path}/opengraph-image`, datePublished }), "@type": "BlogPosting" },
          faqJsonLd(faqs),
          breadcrumbJsonLd([
            { name: "Vidmake", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: "App marketing videos for SaaS", path },
          ]),
        ],
      }}
    >
      <ArticleBody>
        <ArticleH2>List features you can show</ArticleH2>
        <p>
          Write three features a teammate can find in the product this week. For each one, note the screen, the action, and the result a recording would show. Drop anything that depends on a metric you have not measured or a customer you cannot name. The <ArticleLink href="/blog/ai-video-generator-for-saas">AI video generator for SaaS</ArticleLink> article is about turning a brief into a clip. This page is the choice of format before that brief.
        </p>

        <ArticleH2>Match the format to the proof</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-foreground-strong">Hook video,</strong> when the first seconds are a reaction or a situation and a recording can follow. Make it in <ArticleLink href="/explore/hook-video">Hook video</ArticleLink>.</li>
          <li><strong className="text-foreground-strong">Text on screen,</strong> when the words carry the story and the background only has to stay readable. Make it in <ArticleLink href="/explore/wall-of-text">Text on screen</ArticleLink>. People also search for this as a wall-of-text video.</li>
          <li><strong className="text-foreground-strong">Slideshow,</strong> when the viewer should stop on a screenshot. Make it in <ArticleLink href="/explore/slideshows">Slideshows</ArticleLink>.</li>
          <li><strong className="text-foreground-strong">Product demo,</strong> when the video is mostly the real interface. Start from the <ArticleLink href="/guides/product-demo-to-short-video">demo guide</ArticleLink> and keep generated footage out of the UI.</li>
        </ul>
        <p>
          The <ArticleLink href="/blog/saas-video-ideas">SaaS video ideas</ArticleLink> list is a menu of jobs. Pick one row, then use the format above. Do not try to film the list.
        </p>

        <ArticleH2>A first week that stays honest</ArticleH2>
        <ol className="list-decimal space-y-3 pl-5">
          <li>Record one screen for the feature you can explain in a sentence.</li>
          <li>Write one opening that names the task, using the <ArticleLink href="/blog/tiktok-hook-generator">hook workflow</ArticleLink> if you need three options.</li>
          <li>Make one companion in another format only if it teaches something the first video cannot. A slideshow of the same screenshot is enough. A second hook that repeats the same sentence is not.</li>
          <li>Review both files on a phone. If a stranger cannot name the feature, the video is not ready to post.</li>
        </ol>
        <p>
          App teams selling to consumers can follow the <ArticleLink href="/blog/ugc-ads-for-mobile-apps">UGC ads for mobile apps</ArticleLink> page for the ad-account version of the same split. The proof rule does not change because the buyer is a company.
        </p>

        <ArticleH2>What not to put in the series</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>A generated interface presented as the product.</li>
          <li>A customer quote you wrote.</li>
          <li>A view, revenue, or time-saved number you do not have a source for.</li>
          <li>A promise that the format itself will grow the account.</li>
        </ul>
        <p>
          Paid plans start at $29 a month. See <ArticleLink href="/pricing">pricing</ArticleLink>. When the first video is a hook, <ArticleLink href="/explore/hook-video">start in Hook video</ArticleLink>.
        </p>

        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/explore/hook-video", title: "Hook video", description: "The opening plus your own message." },
          { href: "/explore/wall-of-text", title: "Text on screen", description: "A written story over a readable background." },
          { href: "/explore/slideshows", title: "Slideshows", description: "A swipe deck for one feature." },
          { href: "/blog/ai-video-generator-for-saas", title: "AI video for SaaS", description: "From a product brief to a short video." },
          { href: "/blog/ugc-ads-for-mobile-apps", title: "UGC ads for apps", description: "The ad version of one feature and a real screen." },
          { href: "/blog/saas-video-ideas", title: "25 SaaS video ideas", description: "Jobs you can assign to a format." },
        ]}
      />
    </VideoMarketingPage>
  );
}
