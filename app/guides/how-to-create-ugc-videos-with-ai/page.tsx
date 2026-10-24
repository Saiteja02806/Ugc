import type { Metadata } from "next";
import Link from "next/link";

import { YouTubeCard } from "@/components/marketing/youtube-card";
import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import { articleJsonLd, brandYouTubeVideos, publicOrigin, videoObjectJsonLd } from "@/lib/marketing/brand-videos";

const path = "/guides/how-to-create-ugc-videos-with-ai";
const title = "How to create UGC videos with AI";
const h1 = "How to create UGC videos with an AI video creator";
const description = "Brief, generate, review, and download an AI UGC video. One example comes from the Teja Chundu channel, with links to AI Studio and the Claude connector.";

const steps = [
  {
    name: "Name one audience and one message",
    text: "Write who the video is for and the single point they should understand. Leave product claims you cannot show out of the brief.",
  },
  {
    name: "Open the UGC video creator",
    text: "Use AI Studio on the AI UGC video generator page, or connect Claude and ask it to use the UGC Pilot MCP server.",
  },
  {
    name: "Add a reference only when you have one",
    text: "A compatible image or video reference can set the visual context. Skip it when you do not have media you are allowed to use.",
  },
  {
    name: "Generate, then review the file",
    text: "Watch the result. Reject footage that invents a product screen, a logo, or a customer outcome. A real recording has to carry proof of a feature.",
  },
  {
    name: "Download the version you approve",
    text: "Keep the approved file and check the text and framing on a phone before you share it from the channel you already manage.",
  },
];

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

export default function HowToCreateUgcVideosPage() {
  const example = brandYouTubeVideos.founderShort;

  return (
    <VideoMarketingPage
      eyebrow="UGC video creator"
      h1={h1}
      lede="A UGC video creator turns a short brief into creator-style footage you can review and download. The video below is one file from UGC Pilot's own founder series. It shows the kind of output, not a recording of these exact steps."
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          articleJsonLd({ path, headline: h1, description, imagePath: `${path}/opengraph-image` }),
          {
            "@type": "HowTo",
            name: h1,
            description,
            step: steps.map((step, index) => ({
              "@type": "HowToStep",
              position: index + 1,
              name: step.name,
              text: step.text,
              url: `${new URL(path, publicOrigin).href}#step-${index + 1}`,
            })),
          },
          videoObjectJsonLd(example),
        ],
      }}
    >
      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-[1100px] items-start gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <YouTubeCard video={example} />
          <ol className="space-y-4">
            {steps.map((step, index) => (
              <li key={step.name} id={`step-${index + 1}`} className="scroll-mt-28 rounded-[22px] border border-border bg-card p-5">
                <p className="font-mono text-xs font-bold text-primary">{String(index + 1).padStart(2, "0")}</p>
                <h2 className="mt-3 text-lg font-semibold text-foreground-strong">{step.name}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
        <p className="mx-auto mt-8 max-w-[1100px] text-sm leading-6 text-muted">
          Start in the <Link href="/ai-ugc-video-generator" className="font-semibold text-primary">AI UGC video generator</Link>
          {" "}or connect <Link href="/mcp/claude" className="font-semibold text-primary">Claude</Link> and ask for a connection check before the first generation.
        </p>
      </section>
      <VideoRelatedLinks
        links={[
          { href: "/ai-ugc-video-generator", title: "AI UGC video generator", description: "The studio page for a focused prompt and optional reference media." },
          { href: "/mcp/claude", title: "UGC video MCP server for Claude", description: "Custom connector steps, OAuth, and the hosted server URL." },
          { href: "/case-studies/ai-ugc-video-generator-saas-founders", title: "Founder video case study", description: "Two videos from the same brand series, with the public YouTube titles." },
          { href: "/blog/ugc-video-generator-examples", title: "More examples", description: "The third Short, Instagram reels, and Clara TikTok videos." },
          { href: "/guides", title: "All founder guides", description: "The rest of the guide library." },
        ]}
      />
    </VideoMarketingPage>
  );
}
