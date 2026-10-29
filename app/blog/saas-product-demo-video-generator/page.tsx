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

const path = "/blog/saas-product-demo-video-generator";
const title = "SaaS Product Demo Video Generator: Hook to Software UI Cutaway";
const description = "How to turn complex software screen captures into viral 9:16 product demo videos: pairing AI creator hooks with authentic UI cutaways and readable mobile captions.";
const datePublished = "2026-10-29";

const faqs = [
  {
    question: "What is a SaaS product demo video generator?",
    answer: "A SaaS product demo video generator pairs an AI creator talking-head hook with authentic screen recordings of your software. Instead of boring viewers with a 5-minute webinar, it produces a fast-paced 15 to 30 second social video focused on one specific feature.",
  },
  {
    question: "How do I make a desktop software screen recording fit a vertical phone screen?",
    answer: "Focus the recording on one isolated component or click action rather than the entire browser window. Zoom into the active area (150% to 200%) and maintain large on-screen text so mobile viewers can read labels without squinting.",
  },
  {
    question: "Can an AI avatar speak my software demo script?",
    answer: "Yes. In UGC Pilot, you provide the hook script and feature explanation. The AI creator delivers the lines with natural timing and lip-sync, which you then cut to your screen recording.",
  },
  {
    question: "How many features should I show in one short demo video?",
    answer: "Exactly one. Trying to demonstrate an entire software dashboard in 20 seconds overwhelms the viewer. Each video should solve one specific micro-problem from click to resolution.",
  },
  {
    question: "Can I generate product demo video assets via API or MCP?",
    answer: "Yes. UGC Pilot provides a hosted Streamable HTTP OAuth MCP server at https://mcp.getugcpilot.com/mcp with 78 public tools for researching hooks, generating media, and managing video jobs directly inside Claude and Codex.",
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

export default function SaasProductDemoVideoGeneratorPage() {
  return (
    <VideoMarketingPage
      eyebrow="Product Demo Videos"
      h1={title}
      lede="Traditional 5-minute software demo webinars get skipped on TikTok and Instagram Reels. Here is how modern software teams use a SaaS product demo video generator to pair scroll-stopping creator hooks with crisp UI cutaways that convert."
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
          If you show a prospective buyer a 10-minute Loom recording of your SaaS product, 90% of them will drop off before you reach the core feature. On mobile social feeds, you have <strong className="font-semibold text-foreground-strong">three seconds</strong> to establish why your software matters before the viewer swipes away.
        </p>
        <p>
          A <strong className="font-semibold text-foreground-strong">SaaS product demo video generator</strong> bridges the gap between entertainment and product truth. With <ArticleLink href="/ai-ugc-video-generator">UGC Pilot</ArticleLink>, you pair an expressive AI creator hook with genuine software UI screen recordings to demonstrate immediate value.
        </p>

        <ArticleH2>The 3-Part Hook-to-Demo Formula</ArticleH2>
        <p>
          High-performing social demo videos follow a disciplined timeline:
        </p>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[500px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">Timeline structure for vertical SaaS product demo videos</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold">Timeline</th>
                <th scope="col" className="p-4 font-semibold">Screen Content</th>
                <th scope="col" className="p-4 font-semibold">Spoken Audio / Script</th>
                <th scope="col" className="p-4 font-semibold">Visual Transition</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">0:00 – 0:03</th>
                <td className="p-4 align-top">AI Creator Avatar looking into camera</td>
                <td className="p-4 align-top">Visceral customer problem or contrarian statement</td>
                <td className="p-4 align-top">Dynamic animated caption overlay</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">0:03 – 0:15</th>
                <td className="p-4 align-top">Real Software UI screen recording</td>
                <td className="p-4 align-top">Explaining the one-click resolution of that problem</td>
                <td className="p-4 align-top">Zoom into mouse cursor and immediate UI outcome</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">0:15 – 0:22</th>
                <td className="p-4 align-top">Final Result / Success state + CTA</td>
                <td className="p-4 align-top">Clear invitation to start a self-serve trial</td>
                <td className="p-4 align-top">Closing slide or brand card</td>
              </tr>
            </tbody>
          </table>
        </div>

        <ArticleH2>Screen Recording Rules for Vertical 9:16 Feeds</ArticleH2>
        <p>
          Most software was designed for wide 1920x1080 desktop monitors. When squeezed into a vertical 1080x1920 smartphone screen, entire menus become unreadable blurry lines.
        </p>
        <p>
          Follow these rules when capturing demo footage for short-form social video:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-foreground-strong">Crop to the Active Zone:</strong> Never capture your full browser chrome, bookmarks, or OS taskbar. Crop tightly around the single form, button, or graph being operated.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Hold the Final State:</strong> When your software completes an action (e.g., generating an invoice, deploying code, rendering an image), hold that screen static for at least 2 full seconds so the viewer can absorb the victory.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Enlarge Interface Typography:</strong> Bump your browser zoom level to 125% or 150% during screen capture so text labels remain crisp on small screens. For typography styling, check our guide on <ArticleLink href="/guides/readable-video-text">readable on-screen video text</ArticleLink>.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Sanitize Test Data:</strong> Ensure client names, test emails, and internal API keys are completely purged before recording. Review our <ArticleLink href="/guides/screen-recording-demo-privacy-checklist">screen recording privacy checklist</ArticleLink>.
          </li>
        </ul>

        <ArticleH2>Common Mistakes That Kill SaaS Demo Video Conversions</ArticleH2>
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            <strong className="font-semibold text-foreground-strong">The &quot;Feature Tour&quot; Trap:</strong> Walking through five different settings menus. Viewers don&apos;t care about your settings page; they care about the core problem solved.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">No Face Hook:</strong> Starting the video immediately on static software UI. Without an emotive creator hook in the first 2 seconds, 80% of viewers scroll past before seeing the software.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Unsubtitled Audio:</strong> Over 60% of social media users browse videos with sound off in public. Every spoken word must have large, synchronized captions.
          </li>
        </ol>

        <ArticleH2>Real Public Software Video Examples</ArticleH2>
        <p>
          See how high-retention software hooks and demos perform in real feeds:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-foreground-strong">Instagram Reel Demo:</strong> Watch <ArticleExternalLink href="https://www.instagram.com/reel/DeueoA-FcIT/">this high-retention vertical Reel</ArticleExternalLink> on Instagram.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">TikTok Creator Demo:</strong> Inspect <ArticleExternalLink href="https://www.tiktok.com/@clara_iamm/video/7699923510092631318">this TikTok creator software demonstration</ArticleExternalLink>.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Founder Video Case Study:</strong> Explore real software founder videos in our <ArticleLink href="/case-studies/ai-ugc-video-generator-saas-founders">SaaS founder video case study</ArticleLink>.
          </li>
        </ul>

        <FaqList
          items={[
            { question: faqs[0].question, answer: faqs[0].answer },
            { question: faqs[1].question, answer: faqs[1].answer },
            {
              question: faqs[2].question,
              answer: (
                <>
                  Yes. Learn more about creator persona selection in our{" "}
                  <ArticleLink href="/blog/how-to-choose-a-ugc-video-maker">UGC video maker checklist</ArticleLink>.
                </>
              ),
            },
            {
              question: faqs[3].question,
              answer: (
                <>
                  Focus on one action per video. Review our step-by-step{" "}
                  <ArticleLink href="/guides/saas-demo-video-script">SaaS demo video script template</ArticleLink>.
                </>
              ),
            },
            {
              question: faqs[4].question,
              answer: (
                <>
                  Yes. Explore the <ArticleLink href="/mcp">UGC Pilot MCP server</ArticleLink> and full{" "}
                  <ArticleLink href="/docs/mcp-tools">tool reference</ArticleLink>.
                </>
              ),
            },
          ]}
        />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/ai-ugc-video-generator", title: "AI UGC Video Generator", description: "Generate short-form video hooks from your software brief." },
          { href: "/blog/ai-video-generator-for-saas", title: "AI Video Generator for SaaS", description: "Turn product briefs into short videos with creator avatars." },
          { href: "/blog/ai-ugc-for-saas-startups", title: "AI UGC for SaaS Startups", description: "The early-stage founder acquisition playbook." },
          { href: "/guides/screen-recording-for-app-demo", title: "Recording App Demos for Vertical Video", description: "Framing, resolution, and mobile readability." },
          { href: "/guides/saas-demo-video-script", title: "SaaS Demo Video Script Template", description: "15 and 30-second scripts with software cutaways." },
          { href: "/pricing", title: "Pricing & Plans", description: "Start testing demo hooks with 2 free credits." },
        ]}
      />
    </VideoMarketingPage>
  );
}
