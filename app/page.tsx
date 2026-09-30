import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  ArrowDown,
  CreditCard,
  ShieldCheck,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import landingLogo from "@/app/logo.png";
import { LandingAuthCta } from "@/components/marketing/landing-auth-actions";
import { LandingBottomCta } from "@/components/marketing/landing-bottom-cta";
import { LandingComparisonSection } from "@/components/marketing/landing-comparison-section";
import { LandingHeader } from "@/components/marketing/landing-header";
import { LandingHeroShowcase } from "@/components/marketing/landing-hero-showcase";
import { LandingMultiPlatformSection } from "@/components/marketing/landing-multi-platform-section";
import { LandingPlatformBadge } from "@/components/marketing/landing-platforms";
import { LandingSwipeDeck } from "@/components/marketing/landing-swipe-deck";
import { AUTH_SESSION_COOKIE_NAME } from "@/lib/firebase/auth-session";

const authHref = "/sign-in";

export const metadata: Metadata = {
  alternates: { canonical: "https://getugcpilot.com/" },
  title: {
    absolute: "UGCPilot — YouTube, TikTok & Instagram Content Workspace",
  },
  description:
    "Create video-first content and approved publishing workflows for YouTube, TikTok, and Instagram in one workspace.",
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
      "Check the media, text, caption, and account before anything moves to publishing.",
  },
  {
    step: "04",
    title: "Approve the schedule",
    description:
      "Choose the YouTube, TikTok, or Instagram destination and timing, then confirm the final publishing action.",
  },
];

const productFooterLinks = [
  { label: "Multi-platform publishing", href: "#multi-platform" },
  { label: "Try UGCPilot", href: "/try-ugcpilot" },
  { label: "Founder marketing guides", href: "/guides" },
  { label: "Instagram carousel maker", href: "/instagram-carousel-maker" },
  { label: "AI UGC video generator", href: "/ai-ugc-video-generator" },
  { label: "Workflow", href: "#workflow" },
  {
    label: "Dating swipe demo",
    href: "/tinder",
  },
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

export default async function Home() {
  const initialHasSession =
    (await cookies()).get(AUTH_SESSION_COOKIE_NAME)?.value === "1";

  return (
    <main className="instagram-theme min-h-screen overflow-x-hidden bg-background text-foreground">
      <a href="#landing-content" className="sr-only rounded-control bg-card px-4 py-3 text-sm font-semibold text-foreground-strong focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:outline-2 focus:outline-focus">
        Skip to content
      </a>
      <LandingHeader initialHasSession={initialHasSession} />

      <section className="relative z-0 px-4 pb-0 pt-24 sm:px-6 sm:pb-0 sm:pt-32 lg:px-8 lg:pb-0 lg:pt-36">
        <div className="relative mx-auto flex max-w-[1200px] flex-col items-center gap-8 sm:gap-12 lg:gap-16">
          <div className="w-full max-w-[1200px] text-center">
            <LandingPlatformBadge />

            <h1 id="landing-content" tabIndex={-1} className="mx-auto max-w-[1200px] scroll-mt-24 text-balance text-[clamp(2.25rem,5.28vw,4.8rem)] font-semibold leading-[1.08] tracking-[-0.055em] text-foreground-strong sm:leading-[0.94]">
              <span className="block lg:whitespace-nowrap">
                Stop guessing!{" "}
                <span className="relative inline-block">
                  Start posting
                  <svg
                    viewBox="0 0 320 20"
                    preserveAspectRatio="none"
                    className="pointer-events-none absolute -bottom-[0.12em] left-[1%] h-[0.18em] w-[99%] overflow-visible"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 12C75 4 203 3.5 316 10"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="3.4"
                    />
                  </svg>
                </span>
                <svg
                  viewBox="0 0 52 86"
                  className="ml-[0.18em] inline-block h-[0.82em] w-[0.5em] -translate-y-[0.04em] overflow-visible"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M31 2 5 45h18L18 84l29-48H29L31 2Z"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </span>
              <span className="mt-3 block lg:whitespace-nowrap sm:mt-4">
                Your next post is{" "}
                <span className="relative inline-block px-[0.06em]">
                  ready to go
                  <svg
                    viewBox="0 0 520 130"
                    preserveAspectRatio="none"
                    className="pointer-events-none absolute -left-[0.08em] -top-[0.14em] h-[1.29em] w-[108%] overflow-visible"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M24 20C104 7 401 7 486 20C503 23 512 40 514 64C516 89 510 108 489 112C378 124 127 123 25 112C9 109 4 88 6 64C7 39 10 24 24 20Z"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="3.2"
                    />
                  </svg>
                </span>
              </span>
            </h1>

            <p className="mx-auto mt-7 max-w-[740px] text-pretty text-base leading-7 text-muted sm:text-lg sm:leading-8">
              Create content for your business. Review it, choose your accounts,
              and schedule to Instagram, TikTok, and YouTube from one workspace.
            </p>

            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:mt-8 sm:flex-row sm:gap-5">
              <LandingAuthCta
                className="group inline-flex h-12 w-full max-w-[220px] items-center justify-center rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto sm:max-w-none sm:px-7"
                initialHasSession={initialHasSession}
              />
              <a href="#multi-platform" className="inline-flex min-h-11 items-center gap-2 rounded-control px-2 text-sm font-medium text-muted transition-colors hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                See one-click publishing
                <ArrowDown className="size-4" aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="w-full">
            <LandingHeroShowcase />
          </div>
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
              Pick a workflow. Keep the final publishing decision human.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <MarketingPathCard
              href="/instagram-carousel-maker"
              title="Instagram carousel maker"
              description="Turn one business idea into a complete carousel, review it, and prepare it for Instagram."
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
              <span>2-minute setup</span>
            </span>
            <span className="hidden sm:inline text-border-strong">•</span>
            <span className="flex items-center gap-1.5">
              <CreditCard className="size-4 text-primary" aria-hidden="true" />
              <span>No credit card required</span>
            </span>
            <span className="hidden sm:inline text-border-strong">•</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-emerald-500" aria-hidden="true" />
              <span>100% human approval</span>
            </span>
          </div>

          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary">
              One social workflow
            </p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.035em] text-foreground-strong sm:text-5xl">
              Keep the creative and the publishing decision together.
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

      {/* Section 3: Interactive Swipe Decision Feed */}
      <LandingSwipeDeck />

      {/* Section 4: Why UGCPilot Comparison Matrix */}
      <LandingComparisonSection />

      <LandingMultiPlatformSection />

      {/* Closing call to action */}
      <LandingBottomCta initialHasSession={initialHasSession} />

      <footer className="border-t border-border bg-card px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-[1200px] gap-10 md:grid-cols-[1.25fr_0.75fr_0.75fr_0.75fr]">
          <div>
            <div className="flex items-center gap-3">
              <Image
                src={landingLogo}
                alt=""
                sizes="36px"
                className="size-9 rounded-md object-contain"
              />
              <div>
                <p className="font-semibold text-foreground-strong">UGCPilot</p>
                <p className="mt-0.5 text-xs text-muted">
                  YouTube, TikTok & Instagram content workspace
                </p>
              </div>
            </div>
            <p className="mt-5 max-w-sm text-sm leading-6 text-muted">
              Create, review, and schedule content for YouTube, TikTok, and
              Instagram from your own business context and approved media.
            </p>
          </div>

          <FooterColumn title="Product" links={productFooterLinks} />
          <FooterColumn title="Support" links={supportFooterLinks} />
          <FooterColumn title="Legal" links={legalFooterLinks} />
        </div>

        <div className="mx-auto mt-10 flex max-w-[1200px] flex-col gap-3 border-t border-border pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} UGCPilot. All rights reserved.</p>
          <p>YouTube, TikTok, and Instagram are trademarks of their respective owners.</p>
        </div>
      </footer>
    </main>
  );
}

function MarketingPathCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[22px] border border-border bg-card p-6 shadow-card transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-floating focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <p className="text-lg font-semibold text-foreground-strong">{title}</p>
      <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
      <span className="mt-6 inline-flex items-center text-sm font-semibold text-primary transition-transform group-hover:translate-x-0.5">
        Explore workflow <span className="ml-2" aria-hidden="true">→</span>
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
