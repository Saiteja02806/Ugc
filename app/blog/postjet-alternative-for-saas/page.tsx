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

const path = "/blog/postjet-alternative-for-saas";
const title = "Postjet Alternative for SaaS: Autopilot Posts vs a Review-First Studio";
const description =
  "Postjet vs Vidmake for SaaS and app teams: verified public pricing from 8 November 2026, how each workflow handles hooks, slideshows, publishing and approval, and which team should pick which.";
const datePublished = "2026-11-08";

const faqs = [
  {
    question: "Is Vidmake an alternative to Postjet?",
    answer:
      "For creating short-form posts from your product context, yes. The workflows differ: Postjet emphasises swiped approval of scheduled posts across brands, while Vidmake emphasises format-specific creation and review before download.",
  },
  {
    question: "How much does Postjet cost?",
    answer:
      "Postjet's public pricing on 8 November 2026 lists a free tier with 10 posts, Starter at $19 a month (about 60 posts), Growth at $49 (about 200), Pro at $99 (about 500) and Ultra at $199 (unlimited). Yearly billing is discounted. Check their pricing page before buying.",
  },
  {
    question: "Does Postjet publish directly to TikTok?",
    answer:
      "Postjet's site states that Instagram, Facebook and YouTube publish on schedule, while TikTok posts arrive in the TikTok inbox ready for a sound. Treat the TikTok step as a handoff you still complete.",
  },
  {
    question: "How much does Vidmake cost?",
    answer:
      "Vidmake has a seven-day trial with 20 daily content pieces and no credit card. Paid plans start at $29 a month (Starter, 200 AI credits), $49 (Growth, 600 credits) and $99 (Startup, 1,200 credits).",
  },
  {
    question: "Which is better for a founder who hates posting manually?",
    answer:
      "Postjet's automation and swipe-to-approve flow is built for that routine. Vidmake is stronger when the job is creating and reviewing a specific product video and you plan the publishing step separately.",
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

export default function PostjetAlternativePage() {
  return (
    <VideoMarketingPage
      eyebrow="Postjet comparison"
      h1={title}
      lede="Postjet sells a weekly posting routine you approve with swipes. Vidmake sells a reviewed creative asset. Both are legitimate choices; the right one depends on whether your bottleneck is content production or posting discipline."
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          articleJsonLd({ path, headline: title, description, imagePath: `${path}/opengraph-image`, datePublished }),
          faqJsonLd(faqs),
        ],
      }}
    >
      <ArticleBody>
        <p><strong>Disclosure:</strong> Vidmake authors this page. Postjet details come from postjet.io on 8 November 2026. Prices and platform behaviour change; verify before purchase.</p>

        <ArticleH2>What Postjet says it does</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-foreground-strong">Brand brief from your website:</strong> products, audience, tone and angles.</li>
          <li><strong className="text-foreground-strong">20 formats:</strong> slideshows, Wall of Text, listicles, Hook + Demo, green-screen variants, AI presenters and more.</li>
          <li><strong className="text-foreground-strong">Jet mode:</strong> swipe to keep or skip finished posts; the deck learns your preferences.</li>
          <li><strong className="text-foreground-strong">Real UGC hooks:</strong> licensed clips of real creators, matched to each post.</li>
          <li><strong className="text-foreground-strong">Publishing:</strong> Instagram, Facebook and YouTube on schedule; TikTok posts land in the TikTok inbox.</li>
          <li><strong className="text-foreground-strong">Automations:</strong> daily drafts for 3–28 day runs on higher plans.</li>
          <li><strong className="text-foreground-strong">Public pricing (8 Nov 2026):</strong> free 10 posts; Starter $19/mo (~60 posts); Growth $49 (~200); Pro $99 (~500); Ultra $199 (unlimited).</li>
        </ul>

        <ArticleH2>What Vidmake does</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-foreground-strong">Context-first creation:</strong> the work starts from your website and business details.</li>
          <li><strong className="text-foreground-strong">Focused formats:</strong> hook video, talking-head plus demo, text-led video, slideshows and carousels.</li>
          <li><strong className="text-foreground-strong">Review before download:</strong> inspect the finished asset and keep the version you approve.</li>
          <li><strong className="text-foreground-strong">Pricing:</strong> 7-day trial with 20 daily content pieces; Starter $29 (200 credits), Growth $49 (600), Startup $99 (1,200).</li>
          <li><strong className="text-foreground-strong">Honest boundary:</strong> generated footage cannot prove a product feature; real demos stay real.</li>
        </ul>

        <ArticleH2>At a glance</ArticleH2>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[620px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">Publicly documented differences between Postjet and Vidmake</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold">Decision</th>
                <th scope="col" className="p-4 font-semibold">Postjet (public site)</th>
                <th scope="col" className="p-4 font-semibold">Vidmake</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Core promise</th><td className="p-4 align-top">A week of posts, approved fast</td><td className="p-4 align-top">A reviewed creative asset</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Approval model</th><td className="p-4 align-top">Swipe keep/skip (Jet mode)</td><td className="p-4 align-top">Inspect the finished asset before download</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Formats</th><td className="p-4 align-top">20 formats</td><td className="p-4 align-top">Focused UGC formats for products</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Hooks</th><td className="p-4 align-top">Licensed clips of real creators</td><td className="p-4 align-top">Generated or reference-guided opening</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">TikTok</th><td className="p-4 align-top">Inbox handoff (per site)</td><td className="p-4 align-top">Asset export; scheduling support depends on connected platform</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Entry price</th><td className="p-4 align-top">Free 10 posts; $19/mo Starter</td><td className="p-4 align-top">7-day trial; $29/mo Starter</td></tr>
            </tbody>
          </table>
        </div>

        <ArticleH2>Choose Postjet if…</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>The bottleneck is posting consistently across several brands.</li>
          <li>You prefer approving a batch with swipes over reviewing one asset in depth.</li>
          <li>Licensed real-creator hooks fit your category better than generated presenters.</li>
        </ul>

        <ArticleH2>Choose Vidmake if…</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>The content has to explain a software workflow accurately.</li>
          <li>You want to direct one format at a time and approve the exact claims.</li>
          <li>You do not need an autopilot; you need a good asset and a review trail.</li>
        </ul>

        <ArticleH2>Two fair tests</ArticleH2>
        <ol className="list-decimal space-y-3 pl-5">
          <li><strong className="text-foreground-strong">The same brief in both.</strong> One customer question, one product action, same permitted media.</li>
          <li><strong>Count the approval steps.</strong> Swiping a batch and inspecting a claim are different kinds of work; pick the one your team will actually do.</li>
        </ol>
        <p>
          If your demonstration needs a real recording, start with the
          <ArticleLink href="/guides/screen-recording-for-app-demo">app recording guide</ArticleLink>; if you are testing
          several openings, the <ArticleLink href="/blog/ugc-creator-brief-template">creator brief template</ArticleLink>
          keeps the comparison fair.
        </p>

        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/blog/revid-alternative-for-saas", title: "Revid alternative for SaaS", description: "Compare a broad creation-and-publishing engine with a review-first studio." },
          { href: "/blog/ugc-creator-brief-template", title: "UGC creator brief template", description: "Give both tools the same fair brief." },
          { href: "/pricing", title: "Vidmake pricing", description: "Current trial, credits and plan details." },
          { href: "/instagram-carousel-maker", title: "Carousel maker", description: "Create and review a complete slide sequence." },
          { href: "/blog/tiktok-slideshow-view-data", title: "TikTok slideshow data", description: "What 28 verified posts show about slide counts." },
          { href: "/ai-ugc-video-generator", title: "AI UGC video generator", description: "The Vidmake workflow this page compares." },
        ]}
      />
    </VideoMarketingPage>
  );
}
