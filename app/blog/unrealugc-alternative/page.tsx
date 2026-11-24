import type { Metadata } from "next";

import { ArticleBody, ArticleExternalLink, ArticleH2, ArticleLink, FaqList } from "@/components/marketing/seo-article";
import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/unrealugc-alternative";
const title = "UnrealUGC Alternative for App Ads";
const description = "An UnrealUGC alternative note based on their public pricing and MCP pages on 24 November 2026. Marketing multipliers on their homepage are not repeated as facts.";
const datePublished = "2026-11-24";
const faqs = [
  { question: "Are UnrealUGC's '10×' and cost-savings claims verified here?", answer: "No. Those lines appear on their homepage as marketing. This article does not repeat them as measurements." },
  { question: "What prices were on their pricing page?", answer: "On 24 November 2026 the pricing page listed Starter at $69 a month for 6,000 credits, Pro at $149 a month for 14,000 credits, and Agency at $349 a month. One-time packs started at $19. Their page also gave its own estimate of how many videos those credits cover. Confirm it before you buy." },
  { question: "Do both products have an MCP server?", answer: "UnrealUGC publishes an MCP page and says MCP access is included on plans. Vidmake's MCP server is documented at vidmake.io/mcp. This article does not compare their tool lists." },
];

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: { title, description, url: path, type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

export default function UnrealUgcAlternativePage() {
  return (
    <VideoMarketingPage
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          { ...articleJsonLd({ path, headline: title, description, imagePath: `${path}/opengraph-image`, datePublished }), "@type": "BlogPosting" },
          faqJsonLd(faqs),
          breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: "UnrealUGC alternative", path },
        ]),
        ],
      }}
      eyebrow="Comparison"
      h1="An UnrealUGC alternative, limited to their public pages"
      lede="UnrealUGC sells AI creator videos for ads. This page records the prices and product facts their own pages published on 24 November 2026, then describes Vidmake's review workflow. It does not pick a winner."
    >
      <ArticleBody>
        <ArticleH2>Prices their pricing page listed</ArticleH2>
        <p>
          The <ArticleExternalLink href="https://unrealugc.com/pricing">UnrealUGC pricing page</ArticleExternalLink> listed Starter at $69 a month with 6,000 credits, Pro at $149 a month with 14,000 credits, and Agency at $349 a month. It said one-time credit packs start at $19, and that monthly credits reset while top-up credits do not expire. The same page said a standard 10-second ad with audio is about 280 credits, and it printed its own estimate of how many videos those credits cover. Those estimates are theirs. This article does not redo the math.
        </p>
        <ArticleH2>What their homepage claims, and what this page skips</ArticleH2>
        <p>
          The <ArticleExternalLink href="https://unrealugc.com/">UnrealUGC homepage</ArticleExternalLink> advertises large cost and volume comparisons against hiring creators. Those are their claims. They are not measurements from Vidmake, so they are not repeated here as facts. Their pages also describe a library of AI creators; the count is not the same on every page, so check the page you are buying from.
        </p>
        <ArticleH2>MCP, without a feature contest</ArticleH2>
        <p>
          Their <ArticleExternalLink href="https://unrealugc.com/mcp">MCP page</ArticleExternalLink> says API, MCP, and webhook access are included, and it documents tools for starting a video, estimating cost, and checking credits. Vidmake documents its own server at the <ArticleLink href="/mcp">MCP page</ArticleLink>, for Claude, Codex, ChatGPT, and any other client that can call that remote URL. Read <ArticleLink href="/blog/ugc-video-mcp-server">how the Vidmake server is used</ArticleLink> before you connect one.
        </p>
        <ArticleH2>What you are comparing</ArticleH2>
        <p>The UnrealUGC public flow is pick a creator, write a script, and download an MP4. The Vidmake public flow for an app is a hook, text on screen, or a slideshow, with the product screen coming from your own recording, and a review before download. Neither description says the other product cannot show a screen. Make one clip of the same feature in each tool and keep the file you would actually post.</p>
        <p>Current Vidmake plan details stay on the <ArticleLink href="/pricing">pricing page</ArticleLink>. For another public-page comparison, see the <ArticleLink href="/blog/clipugc-alternative">ClipUGC alternative</ArticleLink>.</p>
        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/blog/clipugc-alternative", title: "ClipUGC alternative", description: "Pricing-page facts, including where their pages disagree." },
          { href: "/blog/best-ai-ugc-tools-for-app-marketing", title: "Tools for app marketing", description: "What to compare before you pick a product." },
          { href: "/blog/ugc-video-mcp-server", title: "UGC video MCP server", description: "What the Vidmake server does from a connected client." },
          { href: "/mcp", title: "Vidmake MCP", description: "The public connector page." },
          { href: "/explore/hook-video", title: "Hook video", description: "Review a short app video before you use it." },
          { href: "/pricing", title: "Pricing", description: "Current Vidmake plans." },
        ]}
      />
    </VideoMarketingPage>
  );
}
