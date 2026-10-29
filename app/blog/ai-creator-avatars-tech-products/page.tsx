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

const path = "/blog/ai-creator-avatars-tech-products";
const title = "AI Creator Avatars for Tech Products: Personas That Tech Audiences Trust";
const description = "How to choose and prompt AI creator avatars for software products: realistic developer and founder personas that build trust instead of looking like corporate stock footage.";
const datePublished = "2026-10-29";

const faqs = [
  {
    question: "Why do standard AI avatars look fake to technical audiences?",
    answer: "Most enterprise AI avatars are modeled on television news anchors or corporate presenters in formal attire against artificial backdrops. Software developers and founders instantly recognize this aesthetic as disingenuous corporate advertising.",
  },
  {
    question: "What makes an AI creator avatar effective for tech and software?",
    answer: "Casual natural settings (like a desk with multiple monitors, ambient room lighting, or casual attire), realistic facial micro-expressions, conversational voice pacing, and a visual appearance that mirrors the target user persona.",
  },
  {
    question: "Can I use multiple creator avatars across a single brand campaign?",
    answer: "Yes. Testing different creator demographics (e.g., a junior developer vs a senior engineering lead vs a product marketer) reveals which persona resonates best with specific customer segments.",
  },
  {
    question: "Does UGC Pilot allow selecting different creator avatars?",
    answer: "Yes. UGC Pilot features a library of realistic creator avatars tailored specifically for technical products, SaaS founders, and digital tools.",
  },
  {
    question: "Can I generate creator avatars through Claude or Codex MCP?",
    answer: "Yes. The hosted Streamable HTTP OAuth MCP server at https://mcp.getugcpilot.com/mcp includes tools to specify creator personas, styles, and scripts directly inside AI coding assistants.",
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

export default function AiCreatorAvatarsTechProductsPage() {
  return (
    <VideoMarketingPage
      eyebrow="Tech Creator Avatars"
      h1={title}
      lede="Software engineers and tech buyers have an aggressive radar for disingenuous corporate commercials. Here is how software teams configure and deploy AI creator avatars that feel like authentic peer recommendations."
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
          If an AI creator in a video looks like a 3D mannequin wearing an overly crisp business suit in front of a fake stock-photo office, technical buyers will scroll past in disgust. Developers, founders, and product managers despise traditional corporate advertising.
        </p>
        <p>
          To win attention on TikTok, Instagram Reels, and YouTube Shorts, you need <strong className="font-semibold text-foreground-strong">AI creator avatars that match your audience</strong>. With <ArticleLink href="/ai-ugc-video-generator">UGC Pilot</ArticleLink>, you can select and deploy relatable avatars who look and sound like real builders sharing an honest software discovery.
        </p>

        <ArticleH2>The 3 Tech Persona Archetypes</ArticleH2>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[500px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">Persona archetypes for tech and software video marketing</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold">Persona Archetype</th>
                <th scope="col" className="p-4 font-semibold">Visual Setting &amp; Styling</th>
                <th scope="col" className="p-4 font-semibold">Vocal Tone &amp; Pacing</th>
                <th scope="col" className="p-4 font-semibold">Best Suited For</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">The Indie Hacker</th>
                <td className="p-4 align-top">Home workstation, dual monitors, casual t-shirt or hoodie</td>
                <td className="p-4 align-top">Fast, candid, excited about saving hours of manual coding</td>
                <td className="p-4 align-top">DevTools, APIs, productivity utilities, micro-SaaS</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">The Growth Operator</th>
                <td className="p-4 align-top">Bright modern office, laptop setup, casual button-down</td>
                <td className="p-4 align-top">Practical, numbers-focused, impatient with manual workflows</td>
                <td className="p-4 align-top">CRM, marketing automation, analytics, sales tools</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">The Relatable Specialist</th>
                <td className="p-4 align-top">Clean domestic or co-working setting, warm natural lighting</td>
                <td className="p-4 align-top">Empathetic, calm, explaining how an app simplified their day</td>
                <td className="p-4 align-top">FinTech, HR tech, education, team collaboration apps</td>
              </tr>
            </tbody>
          </table>
        </div>

        <ArticleH2>Avoiding the &quot;Uncanny Valley&quot; Trap</ArticleH2>
        <p>
          Viewers reject synthetic avatars when micro-expressions look unnatural or robotic. Here is how to maintain realism when creating video hooks in UGC Pilot:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-foreground-strong">Keep Spoken Segments Short:</strong> Limit continuous avatar talking-head scenes to 3 to 4 seconds. Long 30-second unbroken AI monologues reveal synthetic artifacts.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Cut Early to Screen Evidence:</strong> Use the avatar strictly for the opening problem statement, then cut to your real software UI. Real screen recordings ground the entire video in authenticity.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Punctuate with Text Overlays:</strong> Bold animated captions keep viewer focus moving dynamically across the frame rather than staring statically at mouth pixels.
          </li>
        </ul>

        <ArticleH2>Real Public Video Examples</ArticleH2>
        <p>
          Inspect how real software creator personas look on live social feeds:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-foreground-strong">TikTok Creator Example:</strong> Watch <ArticleExternalLink href="https://www.tiktok.com/@clara_iamm/video/7699923510092631318">this creator hook</ArticleExternalLink> on @clara_iamm.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Instagram Reel Example:</strong> Inspect <ArticleExternalLink href="https://www.instagram.com/reel/DeqrNISlQ0Z/">this natural lighting creator reel</ArticleExternalLink>.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Browse Video Showcase:</strong> Explore our curated library of <ArticleLink href="/blog/ugc-video-generator-examples">UGC video generator examples</ArticleLink>.
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
                  Yes. Explore available styles in our{" "}
                  <ArticleLink href="/hookvideos">Hook Video Studio</ArticleLink>.
                </>
              ),
            },
            {
              question: faqs[4].question,
              answer: (
                <>
                  Yes. Discover all agent capabilities in our{" "}
                  <ArticleLink href="/docs/mcp-tools">multi-tool MCP documentation</ArticleLink>.
                </>
              ),
            },
          ]}
        />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/hookvideos", title: "Hook Video Studio", description: "Select creator personas and generate video hooks in minutes." },
          { href: "/ai-ugc-video-generator", title: "AI UGC Video Generator", description: "Create talking-head video hooks from your software brief." },
          { href: "/blog/talking-head-hook-generator-saas", title: "Talking Head Hook Generator for SaaS", description: "Stop the scroll in under 3 seconds." },
          { href: "/blog/how-to-choose-a-ugc-video-maker", title: "How to Choose a UGC Video Maker", description: "A 10-point checklist for output, avatar quality, and voice." },
          { href: "/mcp", title: "UGC Pilot MCP Server", description: "Generate creator videos directly from Claude and Codex." },
          { href: "/pricing", title: "Pricing & Plans", description: "Start creating tech creator videos with 2 free credits." },
        ]}
      />
    </VideoMarketingPage>
  );
}
