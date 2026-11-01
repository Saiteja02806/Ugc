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

const path = "/blog/market-side-project-30-minutes-a-week";
const title = "How to Market a Side Project in 30 Minutes a Week: The Indie Video Routine";
const description = "The ultra-lean marketing routine for side project builders: batch 5 short-form videos and a carousel in under 30 minutes a week using AI creator automation.";
const datePublished = "2026-10-30";

const faqs = [
  {
    question: "Can I realistically market a side project in only 30 minutes a week?",
    answer: "Yes, when you decouple content ideation from video filming. By using AI creator avatars to deliver 3-second hook variations and pairing them with a single 12-second screen demo, solo builders can batch a week of video content in one sitting.",
  },
  {
    question: "What is the biggest mistake side project builders make in marketing?",
    answer: "Spending 20 hours coding features nobody asked for, and spending 0 minutes distributing the product. Marketing should be treated as a weekly recurring task like database backups or code deploys.",
  },
  {
    question: "How does Vidmake make batching video content fast?",
    answer: "Vidmake saves your business context and website URL once. You simply select hook angles, render photorealistic creator clips in minutes, and download the finished MP4s ready for scheduling or posting.",
  },
  {
    question: "Can I automate this routine via AI agent tools?",
    answer: "Yes. Vidmake features a hosted Streamable HTTP OAuth MCP server at https://mcp.getugcpilot.com/mcp, allowing developers to trigger video generation directly from Claude Desktop or Codex CLI.",
  },
  {
    question: "How much does Vidmake cost for a side project?",
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

export default function MarketSideProject30MinutesAWeekPage() {
  return (
    <VideoMarketingPage
      eyebrow="Side Project Marketing"
      h1={title}
      lede="You have a full-time job, family commitments, and only a few hours of free time on weekends. Here is how side project builders run a high-performing video marketing routine in under 30 minutes a week."
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
          The hardest part of building a software side project is not the code—it is the <strong className="font-semibold text-foreground-strong">time deficit</strong>. If you work a 40-hour engineering job, you might only have 5 to 8 hours a week to dedicate to your side project.
        </p>
        <p>
          Spending 4 of those precious hours filming yourself on camera, editing captions in timeline software, and designing graphics means product progress slows to a crawl. But if you ignore marketing completely, your side project remains an invisible graveyard.
        </p>
        <p>
          Here is the systematic 30-minute weekly video routine that side project founders use with <ArticleLink href="/ai-ugc-video-generator">Vidmake</ArticleLink>.
        </p>

        <ArticleH2>The &quot;1 Demo, 5 Hooks&quot; Time Multiplication Hack</ArticleH2>
        <p>
          The secret to producing a week of video content in 30 minutes is <strong className="font-semibold text-foreground-strong">creative decoupling</strong>:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Do not film 5 different video demonstrations.</strong> That takes hours of setup.
          </li>
          <li>
            <strong>Record ONE clean 12-second software screen demo.</strong> Show your application executing its core value in three clicks.
          </li>
          <li>
            <strong>Generate 5 different 3-second creator hooks in Vidmake.</strong> Each hook attacks the customer problem from a different emotional angle (contrarian, curiosity, speed, cost).
          </li>
        </ul>
        <p>
          By pairing your single 12-second software screen demo with 5 distinct AI creator hooks, you have created 5 completely fresh video ads in under 15 minutes.
        </p>

        <ArticleH2>The 30-Minute Sunday Execution Schedule</ArticleH2>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[500px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">30-minute weekly execution breakdown for side project marketing</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold">Time Allocation</th>
                <th scope="col" className="p-4 font-semibold">Action Step</th>
                <th scope="col" className="p-4 font-semibold">Deliverable Produced</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Minutes 0–8</th>
                <td className="p-4 align-top">Select 3 hooks from the free hook library</td>
                <td className="p-4 align-top">3 tested opening hook lines</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Minutes 8–15</th>
                <td className="p-4 align-top">Record one 12-second zoomed UI screen capture</td>
                <td className="p-4 align-top">Core software proof clip</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Minutes 15–25</th>
                <td className="p-4 align-top">Render creator hooks in Vidmake &amp; pair with demo</td>
                <td className="p-4 align-top">3 to 5 finished MP4 vertical videos</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Minutes 25–30</th>
                <td className="p-4 align-top">Generate one companion carousel for Instagram/LinkedIn</td>
                <td className="p-4 align-top">1 multi-slide educational carousel deck</td>
              </tr>
            </tbody>
          </table>
        </div>

        <ArticleH2>Repurposing into Carousels in 5 Minutes</ArticleH2>
        <p>
          Don&apos;t leave your script as video-only. With Vidmake&apos;s <ArticleLink href="/instagram-carousel-maker">Instagram Carousel Maker</ArticleLink>, you can paste your hook and feature breakdown to generate a clean, multi-slide educational carousel. Carousels drive high save rates on LinkedIn and Instagram, compounding organic impressions throughout the week while you are at your day job.
        </p>

        <ArticleH2>Automate with Claude &amp; Codex MCP</ArticleH2>
        <p>
          If you already spend your evening coding in Claude Desktop or Codex CLI, you don&apos;t even need to open a web browser. With Vidmake&apos;s <ArticleLink href="/mcp">Model Context Protocol (MCP) server</ArticleLink>, you can trigger video rendering directly from a prompt:
        </p>
        <pre className="overflow-x-auto rounded-xl bg-card-muted p-4 text-xs font-mono text-foreground-strong">
          <code>codex mcp add ugc-pilot --url https://mcp.getugcpilot.com/mcp</code>
        </pre>
        <p>
          Explore our guide on <ArticleLink href="/blog/ugc-videos-with-codex-mcp">generating videos with Codex MCP</ArticleLink> for full terminal workflows.
        </p>

        <ArticleH2>Real Public Video Examples</ArticleH2>
        <p>
          Inspect how lean video hooks look on active social feeds:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-foreground-strong">TikTok Creator Demo:</strong> Watch <ArticleExternalLink href="https://www.tiktok.com/@clara_iamm/video/7699105939034574102">this feature demonstration</ArticleExternalLink> on @clara_iamm.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Instagram Reel Demo:</strong> Inspect <ArticleExternalLink href="https://www.instagram.com/reel/DeqrNISlQ0Z/">this natural lighting creator reel</ArticleExternalLink>.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Hook Library:</strong> Browse <ArticleLink href="/free-hook-lines">110 free hook lines</ArticleLink> for side project inspiration.
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
                  Yes. Learn more in our <ArticleLink href="/docs/mcp-tools">78-tool MCP documentation</ArticleLink>.
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
          { href: "/blog/build-in-public-without-showing-face", title: "Build in Public Without Showing Face", description: "Scale video marketing anonymously with AI avatars." },
          { href: "/instagram-carousel-maker", title: "Instagram Carousel Maker", description: "Create high-converting multi-slide educational carousels." },
          { href: "/free-hook-lines", title: "110 Free Hook Lines", description: "Tested opening hooks for short-form software ads." },
          { href: "/pricing", title: "Pricing & Plans", description: "Explore the 7-day trial and monthly credit subscriptions." },
        ]}
      />
    </VideoMarketingPage>
  );
}
