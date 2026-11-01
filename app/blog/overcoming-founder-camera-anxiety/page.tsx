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

const path = "/blog/overcoming-founder-camera-anxiety";
const title = "Overcoming Founder Camera Anxiety: Scaling Video Marketing Anonymously";
const description = "Why you don't need to be an extroverted influencer to market your software: how technical founders scale short-form video using AI creator avatars and screen demos.";
const datePublished = "2026-10-30";

const faqs = [
  {
    question: "Do founders need to appear on camera to succeed on social video?",
    answer: "No. While founder-led video works well for extroverted founders, thousands of successful software companies market their products using AI creator avatars, text-led POV videos, and focused product screen recordings.",
  },
  {
    question: "What causes camera anxiety in technical founders?",
    answer: "Fear of appearing inauthentic, perfectionism around retakes, self-consciousness about speaking pacing, and frustration with the time required to set up studio lighting and video gear.",
  },
  {
    question: "How does Vidmake solve camera anxiety?",
    answer: "Vidmake provides photorealistic AI creator avatars who deliver your script lines with natural confidence, high energy, and perfect lip-sync, eliminating the need to record yourself on camera.",
  },
  {
    question: "Does an AI creator avatar convert as well as a real founder?",
    answer: "In top-of-funnel paid and organic social video, yes. Viewers on TikTok and Reels care primarily about whether the problem hook is relatable and whether the product proof is compelling, not the legal identity of the actor.",
  },
  {
    question: "Can I try this workflow for free?",
    answer: "Yes. Vidmake offers a 7-day free trial with 2 credits and no credit card required, followed by self-serve plans from $19/mo.",
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

export default function OvercomingFounderCameraAnxietyPage() {
  return (
    <VideoMarketingPage
      eyebrow="Founder Psychology"
      h1={title}
      lede="You know video marketing drives signups, but every time you try recording yourself, you do twelve takes, cringe at the playback, and delete the footage. Here is how technical founders market their products without camera friction."
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
          Ask any software engineer or technical founder about video marketing, and you will hear a familiar story:
        </p>
        <p>
          <em>&quot;I bought a high-end microphone and a ring light. I sat in front of the camera, tried to record a 30-second script, stumbled on my words, hated how my voice sounded, spent two hours editing, and never posted it.&quot;</em>
        </p>
        <p>
          <strong className="font-semibold text-foreground-strong">Camera anxiety and perfectionism</strong> are the number one reasons technical founders fail to market their software on social media. They try to become charismatic lifestyle influencers overnight instead of playing to their strengths.
        </p>
        <p>
          With <ArticleLink href="/ai-ugc-video-generator">Vidmake</ArticleLink>, you can separate the role of <strong className="font-semibold text-foreground-strong">the architect</strong> (writing the problem statement and software demo) from <strong className="font-semibold text-foreground-strong">the presenter</strong> (the on-camera creator avatar).
        </p>

        <ArticleH2>The 3 Root Causes of Founder Camera Friction</ArticleH2>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[500px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">Why software founders experience camera friction and how AI tools solve it</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold">Camera Hurdle</th>
                <th scope="col" className="p-4 font-semibold">Traditional Frustration</th>
                <th scope="col" className="p-4 font-semibold">The AI Creator Solution</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">1. Perfectionism &amp; Retakes</th>
                <td className="p-4 align-top">Spending 45 minutes doing 15 takes for a 15-second video</td>
                <td className="p-4 align-top">Type the script once; avatar renders with perfect timing in 2 minutes</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">2. Studio Setup Exhaustion</th>
                <td className="p-4 align-top">Setting up ring lights, adjusting framing, audio checks</td>
                <td className="p-4 align-top">Zero physical hardware required; runs in browser or via MCP</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">3. Public Visibility &amp; Privacy</th>
                <td className="p-4 align-top">Fear of family/colleagues judging amateur videos</td>
                <td className="p-4 align-top">Photorealistic creator avatars represent your brand anonymously</td>
              </tr>
            </tbody>
          </table>
        </div>

        <ArticleH2>How to Build a High-Performing Anonymous Brand</ArticleH2>
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            <strong className="font-semibold text-foreground-strong">Select a Relatable Tech Persona:</strong> In the <ArticleLink href="/hookvideos">Hook Video Studio</ArticleLink>, choose a creator persona that matches your customer&apos;s peers (e.g. an engineer in a home office or a growth operator).
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Write the Hook in Your Natural Voice:</strong> Write the exact words you would use when explaining a bug or shortcut to a developer friend. Avoid corporate buzzwords.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Cut to the Screen Demo:</strong> Let your product be the star of the video. The avatar introduces the pain for 3 seconds, and your screen recording demonstrates the solution.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Repurpose into Carousels:</strong> Convert your script into an educational slide deck using the <ArticleLink href="/instagram-carousel-maker">Instagram Carousel Maker</ArticleLink> for LinkedIn and Instagram.
          </li>
        </ol>

        <ArticleH2>Real Public Examples</ArticleH2>
        <p>
          Inspect how creator avatars and software demos look on active social channels:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-foreground-strong">TikTok Creator Demo:</strong> Watch <ArticleExternalLink href="https://www.tiktok.com/@clara_iamm/video/7699105939034574102">this feature demonstration</ArticleExternalLink> on @clara_iamm.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Instagram Reel Demo:</strong> Inspect <ArticleExternalLink href="https://www.instagram.com/reel/DeqrNISlQ0Z/">this natural lighting creator reel</ArticleExternalLink>.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Avatar Quality Guide:</strong> Read our breakdown of <ArticleLink href="/blog/ai-creator-avatars-tech-products">AI creator avatars for tech products</ArticleLink>.
          </li>
        </ul>

        <FaqList
          items={[
            { question: faqs[0].question, answer: faqs[0].answer },
            { question: faqs[1].question, answer: faqs[1].answer },
            { question: faqs[2].question, answer: faqs[2].answer },
            { question: faqs[3].question, answer: faqs[3].answer },
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
          { href: "/blog/build-in-public-without-showing-face", title: "Build in Public Without Showing Face", description: "Scale video marketing anonymously with AI avatars." },
          { href: "/blog/from-zero-to-1k-mrr-tiktok", title: "From $0 to $1k MRR on TikTok", description: "The solo SaaS founder acquisition blueprint." },
          { href: "/blog/market-side-project-30-minutes-a-week", title: "Market a Side Project in 30 Minutes", description: "The ultra-lean video routine for busy engineers." },
          { href: "/free-hook-lines", title: "110 Free Hook Lines", description: "Tested opening hooks for short-form software ads." },
          { href: "/pricing", title: "Pricing & Plans", description: "Explore the 7-day trial and monthly credit subscriptions." },
        ]}
      />
    </VideoMarketingPage>
  );
}
