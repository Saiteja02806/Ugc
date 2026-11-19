import type { Metadata } from "next";

import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import {
  ArticleBody,
  ArticleH2,
  ArticleLink,
  FaqList,
} from "@/components/marketing/seo-article";
import { articleJsonLd, publicOrigin } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/aituber-alternative-for-saas";
const title = "AITuber Alternative for SaaS: Faceless Automation vs Product Video";
const description =
  "AITuber automates faceless channels and long-form video. Vidmake creates product-context UGC for SaaS. Public pricing checked 10 November 2026, plus which founder should pick which.";
const datePublished = "2026-11-10";

const faqs = [
  {
    question: "Is Vidmake an alternative to AITuber?",
    answer:
      "For short-form product content, yes. AITuber focuses on faceless channel automation, long-form video and broad AI templates. Vidmake focuses on product-context formats for SaaS teams with a review step.",
  },
  {
    question: "How much does AITuber cost?",
    answer:
      "AITuber's public pricing on 10 November 2026 starts at $39 a month (Creator, 2,500 credits, one autopilot channel), with Pro at $69, Studio at $129 and higher tiers up to $999. Check their pricing page before buying.",
  },
  {
    question: "Does AITuber publish automatically?",
    answer:
      "AITuber advertises one-click publishing and autopilot channels for YouTube, TikTok, Instagram, Facebook, Threads and X, with the number of autopilot channels depending on plan.",
  },
  {
    question: "Which is better for a SaaS product demo?",
    answer:
      "Vidmake, because the demonstration is the centre of the workflow: a real screen recording of the task, combined with an opening you review. AITuber is stronger for faceless, narration-led channels.",
  },
  {
    question: "Can a SaaS founder use both?",
    answer:
      "Yes. AITuber suits an educational faceless channel; Vidmake suits product-led social content with a real demonstration. They solve different distribution problems.",
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

export default function AituberAlternativePage() {
  return (
    <VideoMarketingPage
      eyebrow="AITuber comparison"
      h1={title}
      lede="AITuber sells a faceless channel that runs itself. Vidmake sells a product video you can defend. Both are useful; they answer different questions about what a SaaS founder actually needs to publish."
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          articleJsonLd({ path, headline: title, description, imagePath: `${path}/opengraph-image`, datePublished }),
          faqJsonLd(faqs),
        ],
      }}
    >
      <ArticleBody>
        <p><strong>Disclosure:</strong> Vidmake authors this page. AITuber details come from aituber.app on 10 November 2026. Verify current plans and platform support before purchase.</p>

        <ArticleH2>What AITuber says it does</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Faceless shorts, long-form video, music videos, avatar/UGC ads and text-to-video clips.</li>
          <li>1,300+ AI voices and 140+ languages (powered by ElevenLabs, per their site).</li>
          <li>One-click publishing to YouTube, TikTok, Instagram, Facebook, Threads and X.</li>
          <li>Autopilot channels that schedule and publish on your behalf.</li>
          <li><strong>Public pricing (10 Nov 2026):</strong> from $39 a month; 100 free credits to start.</li>
        </ul>

        <ArticleH2>What Vidmake does</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Product-context creation from your website and offer.</li>
          <li><ArticleLink href="/ai-ugc-video-generator">AI UGC video</ArticleLink>, <ArticleLink href="/guides/talking-head-with-saas-demo">talking-head plus demo</ArticleLink>, text-led video, slideshows and <ArticleLink href="/instagram-carousel-maker">carousels</ArticleLink>.</li>
          <li>A review step before download, so claims can be checked.</li>
          <li><strong>Pricing:</strong> paid plans at $29 / $49 / $99 a month with monthly credits.</li>
        </ul>

        <ArticleH2>The difference that matters</ArticleH2>
        <p>
          A faceless automation tool optimises for volume across a channel. A product video optimises for a specific
          claim being understood and believed. If your product is the subject, the second job is the one that converts,
          and it requires real demonstration footage rather than narration over stock visuals.
        </p>

        <ArticleH2>Side by side</ArticleH2>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[600px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">Publicly documented differences between AITuber and Vidmake</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold">Decision</th>
                <th scope="col" className="p-4 font-semibold">AITuber (public site)</th>
                <th scope="col" className="p-4 font-semibold">Vidmake</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Core promise</th><td className="p-4 align-top">A faceless channel on autopilot</td><td className="p-4 align-top">Product-context content with review</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Best formats</th><td className="p-4 align-top">Faceless narration, long-form, templates</td><td className="p-4 align-top">Hook, demo, text-led, slideshow, carousel</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Product proof</th><td className="p-4 align-top">Possible, but not the centre of the workflow</td><td className="p-4 align-top">Real screen recording is the centre</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Publishing</th><td className="p-4 align-top">One-click and autopilot channels</td><td className="p-4 align-top">Asset creation and download; verify scheduling support</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Entry price</th><td className="p-4 align-top">$39/mo</td><td className="p-4 align-top">Paid plans; $29/mo Starter</td></tr>
            </tbody>
          </table>
        </div>

        <ArticleH2>Choose AITuber if…</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>You want a faceless educational or entertainment channel.</li>
          <li>Long-form narration and multi-language voiceover are the priority.</li>
          <li>Autopilot publishing is the main draw.</li>
        </ul>

        <ArticleH2>Choose Vidmake if…</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>The content must show your actual product solving a task.</li>
          <li>You want a founder-led or demo-led format rather than faceless narration.</li>
          <li>You need an approval step before the asset leaves the studio.</li>
        </ul>

        <ArticleH2>How to test both in an hour</ArticleH2>
        <p>
          Give each tool the same brief: one customer question and one real product recording. Then compare whether the
          result proves the claim and how much editing was needed. The
          <ArticleLink href="/blog/ugc-creator-brief-template">brief template</ArticleLink> and the
          <ArticleLink href="/blog/ai-ugc-video-generator-free-trial">pre-purchase checklist</ArticleLink> make that comparison
          repeatable.
        </p>

        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/blog/ugcposter-alternative-for-saas", title: "UGCPoster alternative for SaaS", description: "Automation versus a product studio." },
          { href: "/blog/revid-alternative-for-saas", title: "Revid alternative for SaaS", description: "A broad creation-and-publishing comparison." },
          { href: "/blog/ai-product-demo-video-generator", title: "AI product demo generator", description: "Where generated footage stops." },
          { href: "/ai-ugc-video-generator", title: "AI UGC video generator", description: "The Vidmake workflow." },
          { href: "/pricing", title: "Pricing and plans", description: "Current plan details." },
          { href: "/blog/saas-video-ideas", title: "25 SaaS video ideas", description: "Ideas you can actually produce." },
        ]}
      />
    </VideoMarketingPage>
  );
}
