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

const path = "/blog/build-in-public-without-showing-face";
const title = "Building in Public on Short-Form Video Without Showing Your Face";
const description = "How technical founders and introverted developers build in public on TikTok and Instagram Reels using AI creator avatars, terminal recordings, and screen demos.";
const datePublished = "2026-10-30";

const faqs = [
  {
    question: "Can you successfully build in public without showing your face?",
    answer: "Yes. Many developers prefer to keep their identity private or avoid filming on camera. By using photorealistic AI creator avatars to deliver narrative hooks, paired with real software screen recordings, you get the high retention of human video without appearing on camera yourself.",
  },
  {
    question: "Why does faceless screen-only video struggle on social feeds?",
    answer: "Pure screen recordings without a human face or narrator feel like cold documentation, triggering high scroll-away rates in the first two seconds. Having an expressive creator avatar introduce the problem acts as a crucial pattern interrupt.",
  },
  {
    question: "How does Vidmake enable anonymous building in public?",
    answer: "Vidmake provides diverse, realistic creator avatars (including developers at desk setups) who speak your script lines with natural timing and lip-sync, which you then cut to your screen recordings.",
  },
  {
    question: "Can I automate faceless video generation with Claude or Codex?",
    answer: "Yes. Vidmake features a 78-tool Streamable HTTP OAuth MCP server at https://mcp.getugcpilot.com/mcp, letting technical founders trigger video rendering directly from AI coding environments.",
  },
  {
    question: "Is there a free trial to test this workflow?",
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

export default function BuildInPublicWithoutShowingFacePage() {
  return (
    <VideoMarketingPage
      eyebrow="Faceless SaaS Marketing"
      h1={title}
      lede="You want the viral distribution of TikTok and Instagram Reels, but you have zero desire to put your own face on camera. Here is how technical founders build in public anonymously using AI creator avatars and real software cutaways."
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
          &quot;Building in Public&quot; has been the dominant playbook for indie hackers on Twitter/X for years: sharing revenue screenshots, architectural decisions, and bug post-mortems.
        </p>
        <p>
          However, in 2026, text-based social reach on X and LinkedIn is increasingly saturated. The highest organic reach lives on <strong className="font-semibold text-foreground-strong">9:16 vertical video</strong>. Yet for many software engineers and solo builders, recording yourself on camera feels uncomfortable, exhausting, or incompatible with privacy.
        </p>
        <p>
          Fortunately, you don&apos;t have to become a traditional vlogger. With <ArticleLink href="/ai-ugc-video-generator">Vidmake</ArticleLink>, you can build in public on short-form video without ever appearing on camera.
        </p>

        <ArticleH2>The 3 Faceless Video Formats That Actually Convert</ArticleH2>

        <ArticleH3>Format 1: The AI Creator Avatar Proxy</ArticleH3>
        <p>
          Instead of recording yourself, select a photorealistic tech avatar from the <ArticleLink href="/hookvideos">Hook Video Studio</ArticleLink>. The avatar acts as your narrator, delivering your thoughts, customer problem hooks, or launch announcements. At second 3.0, the video cuts to your software screen recording.
        </p>

        <ArticleH3>Format 2: The Wall-of-Text POV Rant</ArticleH3>
        <p>
          Overlay high-contrast, relatable founder stories or technical rants on top of ambient coding or desk background video. Viewers pause to read the story, generating massive watch time that triggers recommendation algorithms.
        </p>

        <ArticleH3>Format 3: Terminal &amp; Code Walkthroughs (Micro-Demos)</ArticleH3>
        <p>
          Demonstrate a single CLI command, database query, or API call executing in under 10 seconds. Combine it with synchronized audio and bold captions to explain the developer benefit.
        </p>

        <ArticleH2>Anatomy of a High-Retention Faceless Video</ArticleH2>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[500px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">Structure of high-converting faceless software videos</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold">Video Beat</th>
                <th scope="col" className="p-4 font-semibold">Duration</th>
                <th scope="col" className="p-4 font-semibold">Visual Asset</th>
                <th scope="col" className="p-4 font-semibold">Voiceover / Audio</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">1. Pattern Interrupt</th>
                <td className="p-4 align-top">0:00 – 0:03</td>
                <td className="p-4 align-top">AI Creator Avatar delivering the hook</td>
                <td className="p-4 align-top">Visceral problem or contrarian statement</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">2. Software Demonstration</th>
                <td className="p-4 align-top">0:03 – 0:15</td>
                <td className="p-4 align-top">Zoomed screen capture of the software UI</td>
                <td className="p-4 align-top">Explaining how the problem is resolved</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">3. Outcome &amp; Next Step</th>
                <td className="p-4 align-top">0:15 – 0:20</td>
                <td className="p-4 align-top">Success state + clear on-screen CTA</td>
                <td className="p-4 align-top">Invitation to test the self-serve signup flow</td>
              </tr>
            </tbody>
          </table>
        </div>

        <ArticleH2>Why Faceless Creators Benefit from Multi-Slide Carousels</ArticleH2>
        <p>
          If you prefer written communication over speaking, multi-slide carousels are the ultimate companion format. With Vidmake&apos;s <ArticleLink href="/instagram-carousel-maker">Instagram Carousel Maker</ArticleLink>, you can turn technical architectural diagrams, feature comparisons, and build-in-public lessons into swipeable visual slides for Instagram and LinkedIn.
        </p>

        <ArticleH2>Real Public Examples</ArticleH2>
        <p>
          Inspect how creator avatars and product screen demos pair seamlessly in real public feeds:
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
            {
              question: faqs[3].question,
              answer: (
                <>
                  Yes. Learn more in our guide on{" "}
                  <ArticleLink href="/blog/ugc-videos-with-codex-mcp">generating videos with Codex MCP</ArticleLink>.
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
          { href: "/blog/ai-creator-avatars-tech-products", title: "AI Creator Avatars for Tech", description: "Personas that developers and software buyers trust." },
          { href: "/blog/saas-product-demo-video-generator", title: "SaaS Product Demo Video Generator", description: "Hook to software UI cutaway and vertical framing." },
          { href: "/mcp", title: "Vidmake MCP Server", description: "Connect Claude and Codex to automate video generation." },
          { href: "/pricing", title: "Pricing & Plans", description: "Explore the 7-day trial and monthly credit subscriptions." },
        ]}
      />
    </VideoMarketingPage>
  );
}
