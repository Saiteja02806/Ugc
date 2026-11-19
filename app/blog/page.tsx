import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/marketing/json-ld";
import { LandingHeader } from "@/components/marketing/landing-header";
import { publicOrigin } from "@/lib/marketing/public-origin";

const path = "/blog";
const title = "SaaS Video & UGC Marketing Blog";
const description =
  "Practical guides for SaaS founders: UGC ads, product demos, hooks, talking heads, slideshows and carousels, plus fair comparisons and original data.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: {
    type: "website",
    url: new URL(path, publicOrigin).href,
    siteName: "Vidmake",
    title,
    description,
  },
  twitter: { card: "summary_large_image", title, description },
};

const clusters = [
  {
    title: "Start here",
    blurb: "Strategy, routines and the decisions before you make anything.",
    posts: [
      { slug: "ai-content-creation-tools-small-teams", title: "AI UGC content creator for SaaS", blurb: "How a lean team turns product knowledge into short-form video." },
      { slug: "ai-ugc-video-generator-how-it-works", title: "How an AI UGC video generator works", blurb: "What the tool does, and where you still need real footage." },
      { slug: "how-to-choose-a-ugc-video-maker", title: "How to choose a UGC video maker", blurb: "A ten-point checklist for evaluating any tool." },
      { slug: "short-form-video-marketing-saas", title: "Short-form video marketing for SaaS", blurb: "A playbook for TikTok, Reels and Shorts." },
      { slug: "saas-video-ideas", title: "25 SaaS video ideas", blurb: "Grouped by intent, with production notes." },
      { slug: "instagram-reels-ideas-for-saas", title: "20 Instagram Reels ideas", blurb: "Ideas with opening lines for SaaS teams." },
      { slug: "zero-ad-spend-saas-growth-engine", title: "The $0 ad-spend growth engine", blurb: "Organic short-form for bootstrapped founders." },
      { slug: "from-zero-to-1k-mrr-tiktok", title: "From $0 to $1k MRR on TikTok", blurb: "An acquisition blueprint for solo founders." },
      { slug: "market-side-project-30-minutes-a-week", title: "Market a side project in 30 minutes", blurb: "A weekly routine that fits around the build." },
      { slug: "product-hunt-launch-video-strategy", title: "Product Hunt launch video strategy", blurb: "Pre-launch and launch-day video assets." },
      { slug: "build-in-public-without-showing-face", title: "Build in public without showing your face", blurb: "Creator-style content without being on camera." },
      { slug: "overcoming-founder-camera-anxiety", title: "Overcoming founder camera anxiety", blurb: "Scale video without becoming an influencer." },
    ],
  },
  {
    title: "Formats",
    blurb: "One format at a time: hook, talking head, demo, slideshow, carousel.",
    posts: [
      { slug: "ugc-hooks", title: "UGC hooks that stop the scroll", blurb: "Twenty real examples grouped by type." },
      { slug: "ugc-ad-script-templates", title: "UGC ad script templates", blurb: "Eight fill-in-the-blank structures." },
      { slug: "ugc-creator-brief-template", title: "UGC creator brief template", blurb: "The eight fields that prevent a bad video." },
      { slug: "talking-head-hook-generator-saas", title: "Talking head hook generator", blurb: "Stop the scroll in three seconds." },
      { slug: "ai-talking-head-video-generator", title: "AI talking head quality checklist", blurb: "Identity, lip-sync, framing and truthfulness." },
      { slug: "ai-influencer-video-generator", title: "AI influencer video generator", blurb: "Reusable identity without the drift." },
      { slug: "reaction-video-for-saas", title: "Reaction video for SaaS", blurb: "Turn a first look into a hook." },
      { slug: "problem-solution-video-ad-for-saas", title: "Problem-solution video ad", blurb: "A 25-second structure for SaaS." },
      { slug: "founder-story-video-for-saas", title: "Founder story video", blurb: "One scene that earns trust." },
      { slug: "saas-product-demo-video-generator", title: "SaaS product demo video generator", blurb: "Hook to real software UI cutaway." },
      { slug: "ai-product-demo-video-generator", title: "AI product demo: what it can show", blurb: "Where generated footage stops and proof starts." },
      { slug: "ai-video-generator-for-mobile-apps", title: "AI video for mobile apps", blurb: "Store preview versus social video." },
      { slug: "ai-creator-avatars-tech-products", title: "AI creator avatars for tech products", blurb: "Personas that tech audiences trust." },
      { slug: "tiktok-slideshow-maker", title: "TikTok slideshow maker", blurb: "Build a carousel people swipe through." },
      { slug: "tiktok-slideshow-view-data", title: "TikTok slideshow data study", blurb: "28 verified posts and 234M views." },
    ],
  },
  {
    title: "Ads and testing",
    blurb: "What to change between variants, and what must stay real.",
    posts: [
      { slug: "ai-ugc-ads-for-saas", title: "AI UGC ads for SaaS", blurb: "A four-variant testing plan." },
      { slug: "ai-ugc-for-tiktok-ads", title: "AI UGC for TikTok ads", blurb: "Briefs, hooks, captions and disclosure." },
      { slug: "how-to-make-ugc-ads-for-saas", title: "How to make UGC ads for SaaS", blurb: "Scripts, avatars and UI cutaways." },
      { slug: "ugc-ads-without-creators", title: "UGC ads without creators", blurb: "Three production routes and their trade-offs." },
      { slug: "ugc-pilot-vs-hiring-ugc-creators", title: "Vidmake vs hiring creators", blurb: "Cost, speed and quality compared fairly." },
      { slug: "cost-of-ugc-video-for-saas", title: "Cost of UGC video for SaaS", blurb: "Creators, agencies and AI compared." },
      { slug: "ugc-agency-vs-ai-ugc-software", title: "UGC agency vs AI software", blurb: "Retainers versus self-serve production." },
      { slug: "ai-ugc-for-saas-startups", title: "AI UGC for SaaS startups", blurb: "An early-stage acquisition playbook." },
    ],
  },
  {
    title: "Tool comparisons",
    blurb: "Public facts, dated and disclosed. Check prices before you buy.",
    posts: [
      { slug: "best-ai-ugc-tools-for-saas", title: "Best AI UGC tools for SaaS", blurb: "A buyer's guide across the category." },
      { slug: "revid-alternative-for-saas", title: "Revid alternative for SaaS", blurb: "A broad video engine versus a product studio." },
      { slug: "postjet-alternative-for-saas", title: "Postjet alternative for SaaS", blurb: "Swipe-approved posts versus reviewed assets." },
      { slug: "ugcposter-alternative-for-saas", title: "UGCPoster alternative for SaaS", blurb: "Clip automation versus content creation." },
      { slug: "aituber-alternative-for-saas", title: "AITuber alternative for SaaS", blurb: "Faceless automation versus product video." },
      { slug: "arcads-alternative-for-saas", title: "Arcads alternative for SaaS", blurb: "E-commerce ads versus software demos." },
      { slug: "billo-alternative-for-saas", title: "Billo alternative for SaaS", blurb: "Creator marketplaces versus AI studios." },
      { slug: "creatify-alternative-for-saas", title: "Creatify alternative for SaaS", blurb: "Ad automation versus product context." },
      { slug: "makeugc-alternative-for-b2b-saas", title: "MakeUGC alternative for B2B SaaS", blurb: "Studio quality versus script automation." },
      { slug: "heygen-alternative-for-ugc-hooks", title: "HeyGen alternative for UGC hooks", blurb: "Corporate presenters versus social hooks." },
      { slug: "trend-io-alternative-for-saas", title: "Trend.io alternative for SaaS", blurb: "Influencer networks versus AI UGC." },
      { slug: "synthesia-vs-ai-ugc-saas", title: "Synthesia vs AI UGC", blurb: "Training video versus growth marketing." },
      { slug: "capcut-vs-saas-ugc-generator", title: "CapCut vs a SaaS UGC generator", blurb: "Timeline editing versus a guided studio." },
    ],
  },
  {
    title: "Product and AI workflows",
    blurb: "How the product works, what it costs and how to run it from an AI agent.",
    posts: [
      { slug: "ai-ugc-video-generator-free-trial", title: "AI UGC pre-purchase checklist", blurb: "Five tests before you pay." },
      { slug: "ai-ugc-video-maker-software", title: "AI UGC video maker for software", blurb: "Turn features into short clips." },
      { slug: "ai-video-generator-for-saas", title: "AI video generator for SaaS", blurb: "From product brief to short video." },
      { slug: "ugc-video-generator-examples", title: "UGC video generator examples", blurb: "Real public outputs across formats." },
      { slug: "ugc-ads-with-claude-mcp", title: "UGC ads with Claude via MCP", blurb: "Run the workflow from a chat." },
      { slug: "ugc-videos-with-codex-mcp", title: "UGC videos with Codex via MCP", blurb: "Run the workflow from a terminal." },
    ],
  },
];

export default function BlogIndexPage() {
  const itemList = clusters.flatMap((cluster) => cluster.posts);
  return (
    <main className="instagram-theme min-h-screen overflow-x-hidden bg-background text-foreground">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "CollectionPage",
              name: title,
              description,
              url: `${publicOrigin}${path}`,
              mainEntity: {
                "@type": "ItemList",
                numberOfItems: itemList.length,
                itemListElement: itemList.map((post, index) => ({
                  "@type": "ListItem",
                  position: index + 1,
                  name: post.title,
                  url: `${publicOrigin}/blog/${post.slug}`,
                })),
              },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Vidmake", item: publicOrigin },
                { "@type": "ListItem", position: 2, name: "Blog", item: `${publicOrigin}${path}` },
              ],
            },
          ],
        }}
      />
      <LandingHeader initialHasSession={false} />
      <section className="relative overflow-hidden px-4 pb-14 pt-28 sm:px-6 sm:pt-36 lg:px-8">
        <div className="mx-auto max-w-[1100px]">
          <p className="inline-flex rounded-full border border-primary/35 bg-primary/[0.08] px-3 py-1.5 text-xs font-semibold text-primary">
            Vidmake blog
          </p>
          <h1 className="mt-6 max-w-3xl text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-foreground-strong sm:text-5xl">
            Practical video and content guides for SaaS founders.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
            Every article is grouped by the job it does. Start with a format, a comparison or an original data study, then
            work through the guide that matches your next video.
          </p>
        </div>
      </section>

      {clusters.map((cluster, clusterIndex) => (
        <section key={cluster.title} className={clusterIndex % 2 === 0 ? "border-y border-border bg-card-muted/40 px-4 py-14 sm:px-6 lg:px-8" : "px-4 py-14 sm:px-6 lg:px-8"}>
          <div className="mx-auto max-w-[1100px]">
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-foreground-strong sm:text-3xl">{cluster.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{cluster.blurb}</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cluster.posts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="rounded-[22px] border border-border bg-card p-5 transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <p className="font-semibold text-foreground-strong">{post.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted">{post.blurb}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1100px] rounded-[26px] border border-primary/30 bg-[linear-gradient(130deg,rgba(255,107,69,0.16),rgba(255,107,69,0.04)_60%,rgba(255,255,255,0.02))] px-6 py-10 sm:px-10">
          <h2 className="text-2xl font-semibold text-foreground-strong sm:text-3xl">Ready to make the next one?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
            Read the guide, then start from your business context in the studio. Paid plans start at $29 a month
            with monthly AI credits.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
            <Link href="/ai-ugc-video-generator" className="rounded-full bg-primary px-5 py-2.5 text-primary-foreground hover:bg-primary-hover">AI UGC video generator</Link>
            <Link href="/instagram-carousel-maker" className="rounded-full border border-border bg-card px-5 py-2.5 text-foreground-strong hover:border-primary/60">Carousel maker</Link>
            <Link href="/pricing" className="rounded-full border border-border bg-card px-5 py-2.5 text-foreground-strong hover:border-primary/60">Pricing</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
