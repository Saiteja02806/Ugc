import type { Metadata } from "next";

import { YouTubeCard } from "@/components/marketing/youtube-card";
import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import { articleJsonLd, brandYouTubeVideos, publicOrigin, videoObjectJsonLd } from "@/lib/marketing/brand-videos";

const path = "/case-studies/ai-ugc-video-generator-saas-founders";
const title = "AI UGC video generator for SaaS founders";
const h1 = "AI UGC video generator for the founder videos we made";
const description = "Two founder videos UGC Pilot made for its own brand on the Teja Chundu YouTube channel, including the Short the owner features first.";

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

export default function FounderVideoCaseStudyPage() {
  const featured = [brandYouTubeVideos.founderShort, brandYouTubeVideos.toolVideo];

  return (
    <VideoMarketingPage
      eyebrow="Case study"
      h1={h1}
      lede="UGC Pilot used its own AI UGC video generator to make a small founder series, then put the files on the Teja Chundu YouTube channel. This page shows two of those videos and the public titles YouTube returns. It does not include view counts or a script we did not verify."
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          articleJsonLd({ path, headline: h1, description, imagePath: `${path}/opengraph-image` }),
          ...featured.map(videoObjectJsonLd),
        ],
      }}
    >
      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-[1100px] gap-6 lg:grid-cols-2">
          {featured.map((video) => (
            <YouTubeCard key={video.id} video={video} />
          ))}
        </div>
      </section>
      <section className="border-t border-border bg-card-muted/40 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[800px]">
          <h2 className="text-3xl font-semibold tracking-[-0.035em] text-foreground-strong">How this series was made</h2>
          <div className="mt-6 space-y-4 text-base leading-7 text-muted">
            <p>The videos are brand files from UGC Pilot, uploaded to the owner&apos;s YouTube channel @Teja.Chundu. The first Short is the one the owner asked us to feature. The second is a horizontal video whose public title is about a founders&apos; marketing problem and a tool.</p>
            <p>The repeatable part is the studio workflow, not a hidden prompt. Start with one audience and one message, generate a short creator-style video, watch it, and download the version you approve. A generated clip can invent a product screen, so a real recording still has to carry any claim about what the product does.</p>
            <p>The same channel has a third Short, and there are Instagram reels and TikTok videos on accounts named Clara. Those files are collected on the examples page. Avatar names the team uses include Mira, Julia, and Clara. The YouTube titles do not name which avatar is in each file, so this page does not assign one.</p>
          </div>
        </div>
      </section>
      <VideoRelatedLinks
        links={[
          { href: "/blog/ugc-video-generator-examples", title: "UGC video generator examples", description: "The rest of the YouTube files, plus the Instagram reels and Clara TikTok videos." },
          { href: "/guides/how-to-create-ugc-videos-with-ai", title: "How to create UGC videos with AI", description: "The brief, review, and download steps, with one example video." },
          { href: "/ai-ugc-video-generator", title: "AI UGC video generator", description: "The studio workflow for a focused prompt and optional reference media." },
          { href: "/mcp/claude", title: "Claude connector", description: "Ask Claude to create the video through the hosted MCP server." },
          { href: "/guides", title: "Founder guides", description: "Message, format, and review routines around the product." },
        ]}
      />
    </VideoMarketingPage>
  );
}
