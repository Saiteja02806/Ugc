import type { Metadata } from "next";

import { ArticleBody, ArticleH2, ArticleH3, ArticleLink, FaqList } from "@/components/marketing/seo-article";
import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/hook-formulas-for-app-tiktoks";
const title = "Hook Formulas for App and SaaS TikToks";
const description = "Four hook formulas for an app or SaaS TikTok, with original examples you can film. The examples are templates, not proof that a line has performed.";
const datePublished = "2026-11-24";
const faqs = [
  { question: "Are these lines proven to go viral?", answer: "No. They are structures with made-up examples for a receipt app. A line is useful only if your product can show the thing it says." },
  { question: "Where are the longer example lists?", answer: "The hook examples article groups twenty lines by type. The TikTok hook generator article is the filming workflow. This page is the formula." },
  { question: "Can I generate a first draft from my own task?", answer: "Yes. The hook line generator fills the same patterns with the task you type. It does not call a model and it does not store the line." },
];

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: { title, description, url: path, type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

export default function HookFormulasPage() {
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
          { name: "Hook formulas", path },
        ]),
        ],
      }}
      eyebrow="Hooks"
      h1="Viral hook formulas for app and SaaS TikToks"
      lede="A formula is a shape for the first sentence. It is not a promise that the video will travel. The examples below use a fictional receipt app called North so you can see the shape without borrowing a real brand's claim."
    >
      <ArticleBody>
        <ArticleH2>Four shapes you can film</ArticleH2>
        <ArticleH3>Situation</ArticleH3>
        <p>“I opened North to split a dinner receipt, and the first screen was the people, not a settings menu.” Film the screen that sentence names. If your app opens on a dashboard, do not say it opens on the people.</p>
        <ArticleH3>Contrast</ArticleH3>
        <p>“I used to split the receipt in a notes app. In North the last unpaid person is still on the screen.” The contrast has to be two ways you have actually used. Do not invent the old way.</p>
        <ArticleH3>Show the action</ArticleH3>
        <p>“Watch the tap that marks one person paid.” No slogan in front of it. The hook is the action. This is the right shape when the UI is clearer than the sentence.</p>
        <ArticleH3>Question</ArticleH3>
        <p>“Which part of splitting a bill do you redo every time?” Ask a question the next two seconds answer on screen. A question with no demo is a stall.</p>
        <ArticleH2>How to use them this week</ArticleH2>
        <p>Write one line per shape for the same feature. Read them aloud. Keep the two you can finish without adding a feature you have not shipped. Draft the wording in the <ArticleLink href="/tools/hook-generator">hook line generator</ArticleLink>, then film it as a <ArticleLink href="/explore/hook-video">hook video</ArticleLink>.</p>
        <p>The <ArticleLink href="/blog/ugc-hooks">hook examples</ArticleLink> are a longer list by type. The <ArticleLink href="/blog/tiktok-hook-generator">TikTok hook generator guide</ArticleLink> is the review workflow. Use those when you already know the shape.</p>
        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/tools/hook-generator", title: "Hook line generator", description: "Fill these patterns with your own task." },
          { href: "/blog/tiktok-hook-generator", title: "TikTok hook generator", description: "How to test the first three seconds." },
          { href: "/blog/ugc-hooks", title: "UGC hook examples", description: "Twenty examples grouped by type." },
          { href: "/blog/repurpose-ugc-video-into-hooks", title: "One video, more hooks", description: "Change the opening and keep the same proof." },
          { href: "/explore/hook-video", title: "Hook video", description: "Film the line you kept." },
        ]}
      />
    </VideoMarketingPage>
  );
}
