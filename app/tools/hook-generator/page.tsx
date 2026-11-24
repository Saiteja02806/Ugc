import type { Metadata } from "next";

import { HookGeneratorForm } from "@/app/tools/hook-generator/hook-generator-form";
import { JsonLd } from "@/components/marketing/json-ld";
import { LandingHeader } from "@/components/marketing/landing-header";
import { MarketingResourceLinks } from "@/components/marketing/marketing-resource-links";
import { ArticleBody, ArticleH2, ArticleLink } from "@/components/marketing/seo-article";
import { breadcrumbJsonLd } from "@/lib/marketing/brand-videos";
import { publicOrigin } from "@/lib/marketing/public-origin";

const path = "/tools/hook-generator";
const datePublished = "2026-11-24";
const title = "Free TikTok Hook Line Generator";
const description = "Write three TikTok opening lines from your app's real task. No signup. The lines are templates you review, not generated predictions.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: { title, description, url: path, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
  {
    "@type": "SoftwareApplication",
    name: "Vidmake TikTok hook line generator",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${publicOrigin}${path}`,
    description,
    datePublished,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@type": "Organization", name: "Vidmake", url: publicOrigin },
  },
  breadcrumbJsonLd([
    { name: "Vidmake", path: "/" },
    { name: "Free tools", path: "/free-tools" },
    { name: "Hook line generator", path },
  ]),
  ],
};

export default function HookGeneratorPage() {
  return (
    <main className="instagram-theme min-h-screen overflow-x-hidden bg-background text-foreground">
      <JsonLd data={jsonLd} />
      <LandingHeader initialHasSession={false} />
      <section className="relative overflow-hidden px-4 pb-12 pt-28 sm:px-6 sm:pt-36 lg:px-8">
        <div className="mx-auto max-w-[760px]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Free tool</p>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.05em] text-foreground-strong sm:text-5xl">TikTok hook line generator</h1>
          <p className="mt-5 text-base leading-7 text-muted sm:text-lg">Type the task your app helps with. You get three opening lines in a pattern you can film. Nothing is saved, and there is no account step.</p>
          <HookGeneratorForm />
        </div>
      </section>
      <ArticleBody>
        <ArticleH2>What to do with a line</ArticleH2>
        <p>Say it once, then cut to the screen that proves it. If the line mentions a result your product does not show, rewrite the line. A hook is the first sentence of a video you can finish, not a promise by itself.</p>
        <p>When a line is worth filming, open <ArticleLink href="/explore/hook-video">Hook video</ArticleLink> and review the clip before you download it. For more patterns, read <ArticleLink href="/blog/hook-formulas-for-app-tiktoks">hook formulas for app TikToks</ArticleLink> and the <ArticleLink href="/blog/ugc-hooks">hook examples</ArticleLink>.</p>
      </ArticleBody>
      <MarketingResourceLinks />
    </main>
  );
}
