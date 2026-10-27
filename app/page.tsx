import type { Metadata } from "next";
import {
  ArrowDown,
  CreditCard,
  ShieldCheck,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { JsonLd } from "@/components/marketing/json-ld";
import { LandingAuthCta } from "@/components/marketing/landing-auth-actions";
import { LandingBottomCta } from "@/components/marketing/landing-bottom-cta";
import { LandingComparisonSection } from "@/components/marketing/landing-comparison-section";
import { LandingHeader } from "@/components/marketing/landing-header";
import { LandingLogo } from "@/components/marketing/landing-logo";
import { LandingHeroGallery } from "@/components/marketing/landing-hero-gallery";
import { LandingMultiPlatformSection } from "@/components/marketing/landing-multi-platform-section";
import { LandingPlatformBadge } from "@/components/marketing/landing-platforms";
import { LandingContentShowcase } from "@/components/marketing/landing-content-showcase";
import { homepageJsonLd } from "@/lib/marketing/mcp-public";

const authHref = "/sign-in";
const homepageTitle = "UGC Pilot — AI UGC Video & Content Studio";
const homepageDescription =
  "Create UGC video ideas, visuals, and short videos with AI. Review, organize, and keep every finished asset in your UGC Pilot library.";

export const metadata: Metadata = {
  alternates: { canonical: "https://getugcpilot.com/" },
  title: {
    absolute: homepageTitle,
  },
  description: homepageDescription,
  openGraph: {
    type: "website",
    url: "https://getugcpilot.com/",
    siteName: "UGC Pilot",
    title: homepageTitle,
    description: homepageDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: homepageTitle,
    description: homepageDescription,
  },
};

const workflowSteps = [
  {
    step: "01",
    title: "Set your social context",
    description:
      "Add your website and business details so creative work starts from your actual offer.",
  },
  {
    step: "02",
    title: "Choose a format",
    description:
      "Work on a hook video, a text-led video, or a slideshow from the same workspace.",
  },
  {
    step: "03",
    title: "Review the creative",
    description:
      "Check the media, text, and caption before you export the finished asset.",
  },
  {
    step: "04",
    title: "Save the finished asset",
    description:
      "Keep the reviewed video, carousel, or slideshow in your library so you can download the version you approved.",
  },
];

const productFooterLinks = [
  { label: "MCP server", href: "/mcp" },
  { label: "Connect your AI", href: "/connect-ai" },
  { label: "MCP tool reference", href: "/docs/mcp-tools" },
  { label: "Creative workflow", href: "#workflow" },
  { label: "Try UGC Pilot", href: "/try-ugcpilot" },
  { label: "Founder marketing guides", href: "/guides" },
  { label: "The Reaction Hook Library", href: "/free-hook-lines" },
  { label: "Instagram carousel maker", href: "/instagram-carousel-maker" },
  { label: "AI UGC video generator", href: "/ai-ugc-video-generator" },
  { label: "Founder video case study", href: "/case-studies/ai-ugc-video-generator-saas-founders" },
  { label: "UGC video examples", href: "/blog/ugc-video-generator-examples" },
  { label: "Pricing", href: "/pricing" },
  { label: "Sign in", href: authHref },
];

const supportFooterLinks = [
  { label: "Contact", href: "/contact" },
  { label: "System status", href: "/status" },
  { label: "Help", href: "/contact" },
  {
    label: "Read the founder's post on X",
    href: "https://x.com/Teja_chundu/status/2102059335430099267",
    external: true,
  },
];

const legalFooterLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Data Deletion", href: "/data-deletion" },
  { label: "Acceptable Use Policy", href: "/acceptable-use" },
  { label: "Cookie Policy", href: "/cookies" },
];

export default function Home() {
  // Shared, prerendered HTML. The auth actions reconcile the browser session
  // after hydration, including email-verification and signed-in destinations.
  const initialHasSession = false;

  return (
    <main className="instagram-theme min-h-screen overflow-x-hidden bg-background text-foreground">
      <JsonLd data={homepageJsonLd(homepageDescription)} />
      <a href="#landing-content" className="sr-only rounded-control bg-card px-4 py-3 text-sm font-semibold text-foreground-strong focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:outline-2 focus:outline-focus">
        Skip to content
      </a>
      <LandingHeader initialHasSession={initialHasSession} />

      <section className="relative isolate z-0 overflow-hidden px-4 pb-10 pt-24 sm:px-6 sm:pb-12 sm:pt-32 lg:px-8 lg:pb-14 lg:pt-36">
        <div className="relative mx-auto flex max-w-[1200px] flex-col items-center gap-8 sm:gap-10 lg:gap-12">
          <div className="w-full max-w-[1200px] text-center">
            <LandingPlatformBadge />

            <h1 id="landing-content" tabIndex={-1} className="mx-auto max-w-[1200px] scroll-mt-24 text-balance text-[clamp(2.25rem,5.28vw,4.8rem)] font-semibold leading-[1.08] tracking-[-0.055em] text-foreground-strong sm:leading-[0.94]">
              <span className="block lg:whitespace-nowrap">
                Find viral content.
              </span>
              <span className="mt-3 block lg:whitespace-nowrap sm:mt-4">
                Recreate for yours
              </span>
            </h1>

            <p className="mx-auto mt-7 max-w-[740px] text-pretty text-base leading-7 text-muted sm:text-lg sm:leading-8">
              Create an AI creator for your SaaS, make videos that show what
              it does, and review every asset in one studio.
            </p>

            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:mt-8 sm:flex-row sm:gap-5">
              <LandingAuthCta
                className="group inline-flex h-12 w-full max-w-[220px] items-center justify-center rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto sm:max-w-none sm:px-7"
                initialHasSession={initialHasSession}
              />
              <a href="#workflow" className="inline-flex min-h-11 items-center gap-2 rounded-control px-2 text-sm font-medium text-muted transition-colors hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                See how it works
                <ArrowDown className="size-4" aria-hidden="true" />
              </a>
            </div>
          </div>

          <LandingHeroGallery />
        </div>
      </section>

      <section
        id="solutions"
        className="border-t border-border bg-card-muted/45 px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
      >
        <div className="mx-auto max-w-[1200px]">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary">Start with the work in front of you</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.035em] text-foreground-strong sm:text-5xl">
              Pick a workflow. Keep the final creative decision human.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MarketingPathCard
              href="/instagram-carousel-maker"
              title="Instagram carousel maker"
              description="Turn one business idea into a complete carousel and review every slide in your library."
            />
            <MarketingPathCard
              href="/ai-ugc-video-generator"
              title="AI UGC video generator"
              description="Create a short-form video from a focused prompt and reference media in AI Studio."
            />
            <MarketingPathCard
              href="/guides"
              title="Founder marketing guides"
              description="Build a clear message and content routine for the website or app you are bringing to market."
            />
            <MarketingPathCard
              href="/mcp"
              title="MCP server for agents"
              description="Connect Claude, Codex, or ChatGPT and create images, short videos, and edits from the conversation."
            />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <MarketingPathCard
              href="/case-studies/ai-ugc-video-generator-saas-founders"
              title="Founder video case study"
              description="Two public videos UGC Pilot made for its own brand on the Teja Chundu YouTube channel."
              cta="Watch the videos"
            />
            <MarketingPathCard
              href="/blog/ugc-video-generator-examples"
              title="UGC video examples"
              description="YouTube files from that series, Instagram reels, and TikTok videos on accounts named Clara."
              cta="Open the gallery"
            />
            <MarketingPathCard
              href="/guides/how-to-create-ugc-videos-with-ai"
              title="Create a UGC video"
              description="A short guide from the brief to the downloaded file, with one example video."
              cta="Read the guide"
            />
          </div>
        </div>
      </section>

      {/* Section 2: One Social Workflow (Connected 4-card container) */}
      <section
        id="workflow"
        className="relative z-10 scroll-mt-24 border-t border-border bg-background px-4 pt-8 pb-16 sm:px-6 sm:pt-10 sm:pb-20 lg:px-8 lg:pt-12 lg:pb-24"
      >
        <div className="mx-auto max-w-[1200px]">
          {/* Trust Badges sitting cleanly below the cutline centered */}
          <div className="mb-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 text-xs sm:text-sm font-medium text-muted text-center">
            <span className="flex items-center gap-1.5">
              <Zap className="size-4 text-amber-500" aria-hidden="true" />
              <span>Start with your business context</span>
            </span>
            <span className="hidden sm:inline text-border-strong">•</span>
            <span className="flex items-center gap-1.5">
              <CreditCard className="size-4 text-primary" aria-hidden="true" />
              <span>No credit card required</span>
            </span>
            <span className="hidden sm:inline text-border-strong">•</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-emerald-500" aria-hidden="true" />
              <span>Review before you export</span>
            </span>
          </div>

          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary">
              One social workflow
            </p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.035em] text-foreground-strong sm:text-5xl">
              Keep the brief and the finished asset together.
            </h2>
          </div>

          <div className="mt-12 overflow-hidden rounded-[24px] border border-border bg-card shadow-card">
            <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
              {workflowSteps.map((item) => (
                <div key={item.step} className="flex flex-col justify-between p-6 sm:p-8">
                  <div>
                    <span className="font-mono text-xs font-bold text-primary">
                      {item.step}
                    </span>
                    <h3 className="mt-4 text-lg font-semibold leading-snug text-foreground-strong">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Passive slideshow example */}
      <LandingContentShowcase />

      {/* Section 4: Why UGCPilot Comparison Matrix */}
      <LandingComparisonSection />

      <LandingMultiPlatformSection />

      {/* Closing call to action */}
      <LandingBottomCta initialHasSession={initialHasSession} />

      <footer className="border-t border-border bg-card px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-[1200px] gap-10 md:grid-cols-[1.25fr_0.75fr_0.75fr_0.75fr]">
          <div>
            <div className="flex items-center gap-2">
              <LandingLogo />
              <div>
                <p className="font-semibold text-foreground-strong">UGCPilot</p>
                <p className="mt-0.5 text-xs text-muted">
                  AI UGC video &amp; content studio
                </p>
              </div>
            </div>
            <p className="mt-5 max-w-sm text-sm leading-6 text-muted">
              Create and review AI UGC videos, carousels, and edits from your
              own business context.
            </p>
          </div>

          <FooterColumn title="Product" links={productFooterLinks} />
          <FooterColumn title="Support" links={supportFooterLinks} />
          <FooterColumn title="Legal" links={legalFooterLinks} />
        </div>

        <div className="mx-auto mt-10 flex max-w-[1200px] flex-col gap-3 border-t border-border pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} UGCPilot. All rights reserved.</p>
          <p>Third-party names are trademarks of their owners.</p>
        </div>
      </footer>
    </main>
  );
}

function MarketingPathCard({
  href,
  title,
  description,
  cta = "Explore workflow",
}: {
  href: string;
  title: string;
  description: string;
  cta?: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[22px] border border-border bg-card p-6 shadow-card transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-floating focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <p className="text-lg font-semibold text-foreground-strong">{title}</p>
      <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
      <span className="mt-6 inline-flex items-center text-sm font-semibold text-primary transition-transform group-hover:translate-x-0.5">
        {cta} <span className="ml-2" aria-hidden="true">→</span>
      </span>
    </Link>
  );
}

type FooterColumnProps = {
  links: Array<{ external?: boolean; href: string; label: string }>;
  title: string;
};

function FooterColumn({ links, title }: FooterColumnProps) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground-strong">{title}</h2>
      <nav className="mt-4 flex flex-col gap-3 text-sm text-muted">
        {links.map((link) => (
          <Link
            key={`${title}-${link.label}`}
            href={link.href}
            target={link.external ? "_blank" : undefined}
            rel={link.external ? "noopener noreferrer" : undefined}
            className="rounded-control transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
