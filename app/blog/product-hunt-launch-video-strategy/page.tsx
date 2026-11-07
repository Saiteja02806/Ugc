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

const path = "/blog/product-hunt-launch-video-strategy";
const title = "Product Hunt Launch Day: The Short-Form Video Pre-Launch Playbook";
const description = "How software founders use TikTok, Reels, and teaser video hooks to build launch momentum, drive upvotes, and convert Product Hunt traffic into paying SaaS subscribers.";
const datePublished = "2026-10-30";

const faqs = [
  {
    question: "Do I need a video for my Product Hunt launch?",
    answer: "Yes. Listings with an engaging video demo receive significantly higher engagement, longer page dwell time, and higher upvote conversion rates than listings featuring only static screenshots.",
  },
  {
    question: "How long should a Product Hunt demo video be?",
    answer: "Keep your main launch video between 30 and 60 seconds. Viewers on launch day are browsing through dozens of products; they want to see the core value proposition and UI proof immediately without long intro logos.",
  },
  {
    question: "How do short-form social videos help before launch day?",
    answer: "Posting 5 to 10 creator video hooks on TikTok and Reels in the 14 days leading up to launch builds a waitlist of engaged users who will support your launch within the first four hours of going live.",
  },
  {
    question: "Can Vidmake generate teaser videos for Product Hunt?",
    answer: "Yes. Vidmake lets you turn your product brief into high-energy creator hooks and demo cutaways, which you can use directly on your Product Hunt gallery and across social media teaser campaigns.",
  },
  {
    question: "Can I orchestrate launch assets via Claude or Codex MCP?",
    answer: "Yes. Vidmake features a 105-tool Model Context Protocol (MCP) server at https://vidmake.io/mcp for generating hooks, videos, and carousels directly from AI prompts.",
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

export default function ProductHuntLaunchVideoStrategyPage() {
  return (
    <VideoMarketingPage
      eyebrow="Product Launch Strategy"
      h1={title}
      lede="Launching on Product Hunt without an audience is a recipe for finishing in 15th place. Here is how founders use short-form video hooks to build pre-launch waitlists and drive maximum momentum on launch day."
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
          Every tech founder dreams of finishing in the top 3 on <strong className="font-semibold text-foreground-strong">Product Hunt</strong> on launch day. But in 2026, the leaderboard is intensely competitive. Launching &quot;cold&quot;—without an existing audience ready to upvote and comment at 12:01 AM PST—almost always results in getting buried below funded startups.
        </p>
        <p>
          The founders who consistently win Product of the Day don&apos;t wait until launch morning to promote their product. They spend the two weeks prior building pre-launch momentum on TikTok, Instagram Reels, and X using short-form video hooks.
        </p>
        <p>
          Here is the step-by-step pre-launch video strategy powered by <ArticleLink href="/ai-ugc-video-generator">Vidmake</ArticleLink>.
        </p>

        <ArticleH2>The 14-Day Pre-Launch Video Timeline</ArticleH2>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[500px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">14-day pre-launch video timeline for Product Hunt</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold">Phase</th>
                <th scope="col" className="p-4 font-semibold">Timeline</th>
                <th scope="col" className="p-4 font-semibold">Content Strategy</th>
                <th scope="col" className="p-4 font-semibold">Primary Goal</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">1. Problem Testing</th>
                <td className="p-4 align-top">Day -14 to Day -10</td>
                <td className="p-4 align-top">Test 5 different hook lines highlighting the core pain point</td>
                <td className="p-4 align-top">Discover which customer frustration gets the highest engagement</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">2. Waitlist Building</th>
                <td className="p-4 align-top">Day -10 to Day -3</td>
                <td className="p-4 align-top">Post 10-second micro-demos with a &quot;Join the launch waitlist&quot; CTA</td>
                <td className="p-4 align-top">Collect 200+ email subscribers who want early access</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">3. Countdown &amp; Teaser</th>
                <td className="p-4 align-top">Day -2 to Day -1</td>
                <td className="p-4 align-top">Creator avatar teaser reel announcing the exact launch date</td>
                <td className="p-4 align-top">Build anticipation and prime supporters for launch hour</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">4. Launch Day Blitz</th>
                <td className="p-4 align-top">Day 0 (Launch Day)</td>
                <td className="p-4 align-top">Publish launch video, carousel breakdown, and behind-the-scenes post</td>
                <td className="p-4 align-top">Drive external traffic to your Product Hunt listing page</td>
              </tr>
            </tbody>
          </table>
        </div>

        <ArticleH2>The 45-Second Product Hunt Gallery Video Formula</ArticleH2>
        <p>
          Product Hunt lets you add a video to your media gallery. Avoid 3-minute corporate webinars. Structure your 45-second video like this:
        </p>
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            <strong className="font-semibold text-foreground-strong">Seconds 0–5 (The Problem Hook):</strong> Creator avatar names the exact developer/operator bottleneck. Check our <ArticleLink href="/free-hook-lines">110 free hook lines</ArticleLink>.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Seconds 5–25 (The Core Software Feature):</strong> Crisp, zoomed screen capture showing the solution in action. No fluff, no slides.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Seconds 25–35 (The Differentiator):</strong> Explain why your tool is faster, cheaper, or simpler than legacy tools.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Seconds 35–45 (The Founder Ask):</strong> Call to action inviting hunters to try the free trial and share their honest feedback in the comments.
          </li>
        </ol>

        <ArticleH2>Repurposing Launch Assets with the Carousel Maker</ArticleH2>
        <p>
          Don&apos;t limit your launch to a single video. On launch day, crosspost an educational multi-slide deck to LinkedIn and Instagram using the <ArticleLink href="/instagram-carousel-maker">Instagram Carousel Maker</ArticleLink>. Carousels frequently get reshared by tech leaders and influencers, bringing an extra wave of supporters to your Product Hunt page.
        </p>

        <ArticleH2>Real Public Video Examples</ArticleH2>
        <p>
          Inspect how real software products demonstrate feature value:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-foreground-strong">TikTok Creator Demo:</strong> Watch <ArticleExternalLink href="https://www.tiktok.com/@clara_iamm/video/7699923510092631318">this high-energy software demonstration</ArticleExternalLink> on @clara_iamm.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Instagram Reel Demo:</strong> Inspect <ArticleExternalLink href="https://www.instagram.com/reel/DeueoA-FcIT/">this vertical creator reel</ArticleExternalLink>.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Demo Video Guide:</strong> Read our guide on <ArticleLink href="/blog/saas-product-demo-video-generator">SaaS product demo video generators</ArticleLink>.
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
                  Yes. Learn more in our breakdown of{" "}
                  <ArticleLink href="/blog/ai-ugc-for-saas-startups">AI UGC for SaaS Startups</ArticleLink>.
                </>
              ),
            },
            {
              question: faqs[4].question,
              answer: (
                <>
                  Yes. Explore the <ArticleLink href="/mcp">Vidmake MCP server</ArticleLink> and full{" "}
                  <ArticleLink href="/docs/mcp-tools">tool reference</ArticleLink>.
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
          { href: "/blog/saas-product-demo-video-generator", title: "SaaS Product Demo Video Generator", description: "Hook to software UI cutaway and vertical framing." },
          { href: "/instagram-carousel-maker", title: "Instagram Carousel Maker", description: "Create high-converting multi-slide educational carousels." },
          { href: "/free-hook-lines", title: "110 Free Hook Lines", description: "Tested opening hooks for software demos and creator videos." },
          { href: "/pricing", title: "Pricing & Plans", description: "Explore the 7-day trial and monthly credit subscriptions." },
        ]}
      />
    </VideoMarketingPage>
  );
}
