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

const path = "/blog/how-to-make-ugc-ads-for-saas";
const title = "How to Make UGC Ads for SaaS: Scripts, Avatars & UI Cutaways";
const description = "The step-by-step tutorial on making UGC video ads for SaaS: write high-converting scripts, generate photorealistic AI creator avatars, and cut to software demos.";
const datePublished = "2026-10-29";

const faqs = [
  {
    question: "How do UGC video ads perform for SaaS compared to static image ads?",
    answer: "UGC video ads typically generate 2x to 4x higher click-through rates and significantly lower cost-per-acquisition (CPA) on TikTok, Instagram, and YouTube. Viewers perceive creator-style videos as authentic peer recommendations rather than sponsored pitches.",
  },
  {
    question: "Do I need to hire human UGC creators to run SaaS video ads?",
    answer: "No. While real customer testimonials remain valuable, early ad testing is much faster with AI UGC tools like UGC Pilot. You can generate and test 10 creator hook variations in the time it takes to negotiate a contract with a single human creator.",
  },
  {
    question: "How do I upload generated ads to Meta and TikTok Ads Manager?",
    answer: "After reviewing your video in UGC Pilot, download the finished MP4 file directly from your library. You can then upload it straight into Meta Ads Manager, TikTok Ads Manager, or Google Ads.",
  },
  {
    question: "Do I need to disclose that the avatar is AI-generated in my ads?",
    answer: "Yes. Both TikTok and Meta require advertisers to label synthetic or digitally altered media that depicts realistic people. Check the 'AI-generated content' toggle in the respective ad manager during campaign creation.",
  },
  {
    question: "What is the best script length for a SaaS UGC ad?",
    answer: "Between 15 and 25 seconds. Opening with a 3-second hook, followed by a 12-second software proof cutaway, and ending with a 4-second call to action drives the highest completion and conversion rates.",
  },
] as const;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: {
    type: "article",
    url: new URL(path, publicOrigin).href,
    siteName: "UGC Pilot",
    title,
    description,
  },
  twitter: { card: "summary_large_image", title, description },
};

export default function HowToMakeUgcAdsForSaasPage() {
  return (
    <VideoMarketingPage
      eyebrow="SaaS UGC Ads"
      h1={title}
      lede="Software founders often waste thousands of dollars running polished, corporate video ads that get ignored. Here is the step-by-step guide to writing, generating, and launching high-converting UGC video ads for software using AI creator avatars and real UI cutaways."
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
          If you open TikTok Ads Manager or Meta Ads Manager and upload a slick corporate video with stock animation, your cost-per-click will be painfully high. In 2026, user feeds are dominated by raw, authentic creator videos.
        </p>
        <p>
          For SaaS companies, <strong className="font-semibold text-foreground-strong">UGC (User-Generated Content) style ads</strong> out-convert traditional corporate commercials because they look native to the platform. By following this guide, you can build and launch a full battery of SaaS UGC ads in an afternoon with <ArticleLink href="/ai-ugc-video-generator">UGC Pilot</ArticleLink>.
        </p>

        <ArticleH2>The 5-Step SaaS UGC Ad Production Workflow</ArticleH2>

        <ArticleH3>Step 1: Write a Two-Part Script</ArticleH3>
        <p>
          Every successful software ad has two halves: the emotional hook and the logical proof. Use our <ArticleLink href="/blog/ugc-ad-script-templates">UGC ad script templates</ArticleLink> to draft a 20-second outline:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-foreground-strong">Hook (Seconds 0–3):</strong> Spoken by the creator avatar addressing a specific bottleneck (&quot;Why are you still manually formatting reports?&quot;).
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Cutaway Proof (Seconds 3–18):</strong> Screen recording showing your software executing the feature in three clicks.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">CTA (Seconds 18–22):</strong> Direct call to action to start a free trial or install the app.
          </li>
        </ul>

        <ArticleH3>Step 2: Generate the Creator Avatar in UGC Pilot</ArticleH3>
        <p>
          Open the <ArticleLink href="/hookvideos">Hook Video Studio</ArticleLink>. Select a persona that matches your target customer (e.g., an indie developer or marketing specialist) and input your hook line. UGC Pilot renders the avatar with realistic facial motion, natural lip-sync, and high-energy delivery.
        </p>

        <ArticleH3>Step 3: Capture Clean Screen Demo Footage</ArticleH3>
        <p>
          Record your software performing the exact action mentioned in the hook. Zoom your browser to 125% to keep UI text readable on mobile phones. For capture best practices, follow our guide on <ArticleLink href="/guides/screen-recording-for-app-demo">recording app demos for vertical video</ArticleLink>.
        </p>

        <ArticleH3>Step 4: Review Captions and Audio Balance</ArticleH3>
        <p>
          Over half of all social ad impressions happen with sound muted. Ensure your on-screen captions are large, high-contrast, and positioned away from platform UI buttons (like TikTok&apos;s right-hand like/share icons).
        </p>

        <ArticleH3>Step 5: Export and Launch in Ad Managers</ArticleH3>
        <p>
          Download your high-definition MP4 from your UGC Pilot library. In TikTok Ads Manager or Meta Ads Manager:
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Select the <strong>9:16 vertical placement</strong> (TikTok feed, Instagram Reels, Facebook Reels).</li>
          <li>Turn on the <strong>AI-generated media disclosure</strong> toggle as required by platform policies.</li>
          <li>Set up 3 to 5 ad variations in the same ad set to test different hook openings against the same audience.</li>
        </ol>

        <ArticleH2>How to Run Creative Iteration Without Re-recording Demos</ArticleH2>
        <p>
          The secret to scaling paid SaaS ads profitably is <strong className="font-semibold text-foreground-strong">creative testing velocity</strong>. When an ad fatigues after two weeks, you don&apos;t need to re-record your software screen demo:
        </p>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[500px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">A/B creative testing matrix for SaaS video ads</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold">Variant</th>
                <th scope="col" className="p-4 font-semibold">Hook Element Changed</th>
                <th scope="col" className="p-4 font-semibold">Demo Footage</th>
                <th scope="col" className="p-4 font-semibold">Test Objective</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Ad A</th>
                <td className="p-4 align-top">Contrarian statement (&quot;Stop doing X&quot;)</td>
                <td className="p-4 align-top">Core 12s software cutaway</td>
                <td className="p-4 align-top">Baseline retention test</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Ad B</th>
                <td className="p-4 align-top">Question hook (&quot;Are you struggling with Y?&quot;)</td>
                <td className="p-4 align-top">Identical 12s software cutaway</td>
                <td className="p-4 align-top">Test empathy vs contrarianism</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Ad C</th>
                <td className="p-4 align-top">Speed hook (&quot;How to finish Z in 10 seconds&quot;)</td>
                <td className="p-4 align-top">Identical 12s software cutaway</td>
                <td className="p-4 align-top">Test velocity and utility angle</td>
              </tr>
            </tbody>
          </table>
        </div>

        <ArticleH2>Real Public Examples of Creator Video Ads</ArticleH2>
        <p>
          Inspect how real vertical creator videos engage audiences on public channels:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-foreground-strong">TikTok Creator Ad Format:</strong> Watch <ArticleExternalLink href="https://www.tiktok.com/@clara_iamm/video/7699923510092631318">this TikTok video example</ArticleExternalLink> on @clara_iamm.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Instagram Reel Ad Format:</strong> Inspect <ArticleExternalLink href="https://www.instagram.com/reel/DeW8kYYN_lz/">this vertical creator reel</ArticleExternalLink>.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">TikTok Ads Deep Dive:</strong> Read our full breakdown of <ArticleLink href="/blog/ai-ugc-for-tiktok-ads">AI UGC for TikTok Ads</ArticleLink>.
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
                  Aim for 15 to 25 seconds. Learn more about script pacing in our{" "}
                  <ArticleLink href="/guides/saas-demo-video-script">SaaS demo video script template</ArticleLink>.
                </>
              ),
            },
          ]}
        />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/ai-ugc-video-generator", title: "AI UGC Video Generator", description: "Create short-form creator hooks from your software brief." },
          { href: "/blog/ai-ugc-for-tiktok-ads", title: "AI UGC for TikTok Ads", description: "The complete guide to briefs, captions, and variants." },
          { href: "/blog/talking-head-hook-generator-saas", title: "Talking Head Hook Generator for SaaS", description: "Stop the scroll in under 3 seconds." },
          { href: "/blog/saas-product-demo-video-generator", title: "SaaS Product Demo Video Generator", description: "Hook to software UI cutaway and vertical framing." },
          { href: "/free-hook-lines", title: "110 Free Hook Lines", description: "Tested opening hooks for short-form software ads." },
          { href: "/pricing", title: "Pricing & Plans", description: "Explore the 7-day trial and monthly credit subscriptions." },
        ]}
      />
    </VideoMarketingPage>
  );
}
