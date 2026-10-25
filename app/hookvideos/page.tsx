import type { Metadata } from "next";
import Link from "next/link";
import { VolumeX } from "lucide-react";

import { TrendingAiHookBundle } from "@/components/trending/trending-ai-hook-bundle";
import bundle from "@/lib/trending/ai-hook-bundle.json";
import { publicOrigin } from "@/lib/marketing/public-pages";

const path = "/hookvideos";
const title = "Hook Videos: Preview AI UGC Opening Clips";
const description = "Browse 128 silent AI hook videos from UGC Pilot. Filter by reaction, preview an opening clip, and see how a first shot can stop the scroll.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: {
    type: "website",
    url: new URL(path, publicOrigin).href,
    siteName: "UGC Pilot",
    title,
    description,
  },
  twitter: { card: "summary_large_image", title, description },
};

export default function HookVideosPage() {
  return (
    <TrendingAiHookBundle
      intro={
        <>
          <p className="mb-3 text-sm font-medium text-primary">The Trending collection</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">A hook for every reaction.</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
            {bundle.videos.length} AI-generated hook videos from UGC Pilot’s Trending library. Browse reactions and preview a clip for your next video.
          </p>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <VolumeX className="size-4" aria-hidden="true" />
            Silent opening clips · Add your own text, music and demo
          </p>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
            Study the opening, then read <Link href="/blog/ugc-hooks" className="font-semibold text-primary">20 UGC hooks by type</Link> or the <Link href="/guides" className="font-semibold text-primary">founder guides</Link>.
          </p>
        </>
      }
    />
  );
}
