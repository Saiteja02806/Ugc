import type { Metadata } from "next";

import { ExternalLiteEmbed } from "@/components/marketing/lite-embed";
import { YouTubeCard } from "@/components/marketing/youtube-card";
import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import {
  articleJsonLd,
  brandYouTubeVideos,
  instagramReelUrl,
  instagramReels,
  publicOrigin,
  tiktokVideoUrl,
  tiktokVideos,
  videoObjectJsonLd,
} from "@/lib/marketing/brand-videos";

const path = "/blog/ugc-video-generator-examples";
const title = "UGC video generator examples";
const h1 = "UGC video generator examples from real brand videos";
const description = "Real UGC Pilot videos from the Teja Chundu YouTube channel, with Instagram reels and TikTok videos on accounts named Clara. Titles come from the public posts.";

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

const youtube = [brandYouTubeVideos.founderShort, brandYouTubeVideos.toolVideo, brandYouTubeVideos.strugglingShort];

export default function UgcVideoExamplesPage() {
  return (
    <VideoMarketingPage
      eyebrow="Examples"
      h1={h1}
      lede="These UGC video generator examples were made with UGC Pilot, a UGC video AI generator for short founder videos. Each YouTube card uses the title, author, and thumbnail returned by YouTube. Play stays unloaded until you choose it."
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          articleJsonLd({ path, headline: h1, description, imagePath: `${path}/opengraph-image` }),
          ...youtube.map(videoObjectJsonLd),
        ],
      }}
    >
      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1100px]">
          <h2 className="text-3xl font-semibold tracking-[-0.035em] text-foreground-strong">YouTube</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">The team refers to creator styles in this work as Mira, Julia, and Clara. The public YouTube titles do not name the avatar in the file, so the notes stay with the title and the channel.</p>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {youtube.map((video) => (
              <YouTubeCard key={video.id} video={video} />
            ))}
          </div>
        </div>
      </section>
      <section className="border-t border-border bg-card-muted/40 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1100px]">
          <h2 className="text-3xl font-semibold tracking-[-0.035em] text-foreground-strong">Instagram reels</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Four reels from the owner. The embed loads only after you ask for it. The link opens the reel on Instagram if you would rather leave this page.</p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {instagramReels.map((code) => (
              <article key={code} className="space-y-3">
                <ExternalLiteEmbed title="Instagram reel" embedUrl={`https://www.instagram.com/reel/${code}/embed`} width={9} height={16} />
                <a href={instagramReelUrl(code)} className="inline-flex text-sm font-semibold text-primary" rel="noopener noreferrer" target="_blank">
                  Open reel {code}
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="border-t border-border px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1100px]">
          <h2 className="text-3xl font-semibold tracking-[-0.035em] text-foreground-strong">TikTok videos on Clara accounts</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">These three files are on @clara_iami and @clara_iamm. The handle is taken from the video URL. TikTok&apos;s oEmbed response did not include a title or thumbnail, so those fields are left off the page.</p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tiktokVideos.map((video) => (
              <article key={video.id} className="space-y-3">
                <ExternalLiteEmbed title={video.handle} embedUrl={`https://www.tiktok.com/embed/v2/${video.id}`} width={9} height={16} />
                <a href={tiktokVideoUrl(video)} className="inline-flex text-sm font-semibold text-primary" rel="noopener noreferrer" target="_blank">
                  Open {video.handle} on TikTok
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>
      <VideoRelatedLinks
        links={[
          { href: "/case-studies/ai-ugc-video-generator-saas-founders", title: "Founder video case study", description: "The two YouTube videos featured for the AI UGC video generator query." },
          { href: "/guides/how-to-create-ugc-videos-with-ai", title: "Create a UGC video", description: "Steps from a brief to a downloaded file, with one example embed." },
          { href: "/ai-ugc-video-generator", title: "AI UGC video generator", description: "Make a short video from a prompt and optional reference media." },
          { href: "/guides", title: "Founder guides", description: "Practical guides for the message and the review." },
        ]}
      />
    </VideoMarketingPage>
  );
}
