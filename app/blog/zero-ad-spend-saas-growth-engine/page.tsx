import type { Metadata } from "next";

import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import {
  ArticleBody,
  ArticleExternalLink,
  ArticleH2,
  ArticleH3,
  ArticleLink,
  FaqList,
} from "@/components/marketing/seo-article";
import { articleJsonLd, publicOrigin } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/zero-ad-spend-saas-growth-engine";
const title = "The $0 Ad Spend SaaS Growth Engine: Reels, Shorts & TikTok for Indie Hackers";
const description = "How bootstrapped founders scale from $0 to $10k MRR without paying for ads: organic short-form video algorithms, content graphs, and creative testing systems.";
const datePublished = "2026-10-30";

const faqs = [
  {
    question: "Can an indie SaaS really grow to $10k MRR with $0 ad spend?",
    answer: "Yes. Many bootstrapped founders reach $10k MRR entirely on organic distribution. While traditional SEO takes 6 months to mature, short-form video algorithms evaluate each clip independently, providing immediate exposure to targeted software buyers.",
  },
  {
    question: "Why does organic video work better than organic Twitter/X or LinkedIn for new apps?",
    answer: "Social graphs on Twitter/X and LinkedIn restrict reach based on your current follower network. TikTok, Reels, and YouTube Shorts operate on content graphs, testing your video on users interested in developer tools and productivity regardless of follower counts.",
  },
  {
    question: "How many videos should an indie hacker post per week?",
    answer: "Aim for 3 to 5 videos per week. Consistency matters more than individual video perfection, as each post tests a different customer pain point and hook angle.",
  },
  {
    question: "How does Vidmake support a $0 ad spend strategy?",
    answer: "Vidmake generates high-converting AI creator hooks, software cutaway templates, and companion carousels from text briefs in minutes, eliminating the need to hire expensive creators or agencies.",
  },
  {
    question: "What is the cost of Vidmake?",
    answer: "Vidmake offers a 7-day free trial with 2 credits and no credit card required, followed by self-serve plans from $19/mo.",
  },
] as const;

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

export default function ZeroAdSpendSaasGrowthEnginePage() {
  return (
    <VideoMarketingPage
      eyebrow="Zero Ad Spend Growth"
      h1={title}
      lede="When you are bootstrapped, spending $50 on Facebook ads to acquire a $19/month customer is financial suicide. Here is how indie hackers build a compounding $0 ad spend acquisition engine on TikTok, Reels, and Shorts."
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          articleJsonLd({ path, headline: title, description, imagePath: `${path}/opengraph-image`, datePublished }),
          faqJsonLd(faqs),
        ],
      }}
    >
      <ArticleBody>
        <p>
          Venture-backed startups can afford to burn hundreds of thousands of dollars on paid Google and Meta ads with negative payback periods. Bootstrapped indie hackers cannot. If your customer acquisition cost (CAC) exceeds your first month&apos;s revenue, your startup runs out of cash.
        </p>
        <p>
          The most sustainable way to scale a bootstrapped software product to <strong className="font-semibold text-foreground-strong">$10k MRR</strong> in 2026 is through organic short-form video. By understanding the math behind modern recommendation algorithms, you can turn free social traffic into paying subscribers with <ArticleLink href="/ai-ugc-video-generator">Vidmake</ArticleLink>.
        </p>

        <ArticleH2>The 3 Pillars of the Zero Ad Spend Engine</ArticleH2>

        <ArticleH3>1. The Content Graph Flywheel</ArticleH3>
        <p>
          Unlike search engines where you must wait months for backlinks to build domain authority, short-form video feeds evaluate content instantly. If a video achieves high 3-second retention and completion rates, TikTok and Instagram push it to tens of thousands of targeted users for free.
        </p>

        <ArticleH3>2. Empathy Hooks Over Feature Tours</ArticleH3>
        <p>
          Viewers do not care about your technical stack or database speed. They care about their own lost time, wasted money, or frustrating daily bottlenecks. Opening with an expressive AI creator hook that names their exact frustration stops the thumb. Check our guide on <ArticleLink href="/blog/talking-head-hook-generator-saas">talking-head hook generators for SaaS</ArticleLink>.
        </p>

        <ArticleH3>3. Authentic Visual Proof</ArticleH3>
        <p>
          Once you hook the viewer, immediately transition into real software UI screen recordings. Demonstrating how your product solves the problem in 10 seconds builds instant credibility without expensive video effects.
        </p>

        <ArticleH2>Organic Platform Comparison for Bootstrapped SaaS</ArticleH2>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[500px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">Platform strengths for zero ad spend SaaS acquisition</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold">Social Channel</th>
                <th scope="col" className="p-4 font-semibold">Discovery Speed</th>
                <th scope="col" className="p-4 font-semibold">Audience Mindset</th>
                <th scope="col" className="p-4 font-semibold">Role in the Funnel</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">TikTok</th>
                <td className="p-4 align-top">Instant (within 24 hours)</td>
                <td className="p-4 align-top">Casual, curious, looking for shortcuts</td>
                <td className="p-4 align-top">Top-of-funnel viral hook discovery</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Instagram Reels</th>
                <td className="p-4 align-top">Fast (1 to 3 days)</td>
                <td className="p-4 align-top">Higher business buyer intent; profile visits</td>
                <td className="p-4 align-top">Direct bio clicks &amp; carousel saves</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">YouTube Shorts</th>
                <td className="p-4 align-top">Steady &amp; evergreen (weeks to months)</td>
                <td className="p-4 align-top">High-intent search query matching</td>
                <td className="p-4 align-top">Compounding organic search traffic</td>
              </tr>
            </tbody>
          </table>
        </div>

        <ArticleH2>Compounding Traffic with Educational Carousels</ArticleH2>
        <p>
          Video gets the initial view, but multi-slide carousels get the bookmarks and shares. With Vidmake&apos;s <ArticleLink href="/instagram-carousel-maker">Instagram Carousel Maker</ArticleLink>, you can repurpose winning video scripts into swipeable 5-slide decks for Instagram and LinkedIn. Technical founders use carousels to break down workflows, comparisons, and feature checklists.
        </p>

        <ArticleH2>Real Public Examples</ArticleH2>
        <p>
          Inspect how real software founders balance video production on public feeds:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-foreground-strong">TikTok Creator Example:</strong> Watch <ArticleExternalLink href="https://www.tiktok.com/@clara_iamm/video/7699923510092631318">this TikTok creator hook</ArticleExternalLink> on @clara_iamm.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Instagram Reel Example:</strong> Inspect <ArticleExternalLink href="https://www.instagram.com/reel/DeueoA-FcIT/">this vertical creator reel</ArticleExternalLink>.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Startup Playbook:</strong> Read our complete guide on <ArticleLink href="/blog/ai-ugc-for-saas-startups">AI UGC for SaaS Startups</ArticleLink>.
          </li>
        </ul>

        <FaqList
          items={[
            { question: faqs[0].question, answer: faqs[0].answer },
            { question: faqs[1].question, answer: faqs[1].answer },
            { question: faqs[2].question, answer: faqs[2].answer },
            {
              question: faqs[3].question,
              answer: (
                <>
                  Yes. Learn more in our <ArticleLink href="/blog/short-form-video-marketing-saas">short-form video marketing playbook</ArticleLink>.
                </>
              ),
            },
            {
              question: faqs[4].question,
              answer: (
                <>
                  Start with our 7-day trial. View full details on{" "}
                  <ArticleLink href="/pricing">pricing</ArticleLink>.
                </>
              ),
            },
          ]}
        />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/ai-ugc-video-generator", title: "AI UGC Video Generator", description: "Generate short-form creator hooks from your software brief." },
          { href: "/blog/from-zero-to-1k-mrr-tiktok", title: "From $0 to $1k MRR on TikTok", description: "The solo SaaS founder acquisition blueprint." },
          { href: "/blog/market-side-project-30-minutes-a-week", title: "Market a Side Project in 30 Minutes", description: "The ultra-lean video routine for busy engineers." },
          { href: "/instagram-carousel-maker", title: "Instagram Carousel Maker", description: "Create high-converting multi-slide educational carousels." },
          { href: "/free-hook-lines", title: "110 Free Hook Lines", description: "Tested opening hooks for short-form software ads." },
          { href: "/pricing", title: "Pricing & Plans", description: "Explore the 7-day trial and monthly credit subscriptions." },
        ]}
      />
    </VideoMarketingPage>
  );
}
