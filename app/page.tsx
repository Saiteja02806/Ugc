import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  CreditCard,
  ShieldCheck,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { ProductLogoMark } from "@/components/brand/product-logo";
import { LandingAuthCta } from "@/components/marketing/landing-auth-actions";
import { LandingBottomCta } from "@/components/marketing/landing-bottom-cta";
import { LandingComparisonSection } from "@/components/marketing/landing-comparison-section";
import { LandingHeader } from "@/components/marketing/landing-header";
import { LandingHeroShowcase } from "@/components/marketing/landing-hero-showcase";
import { LandingSwipeDeck } from "@/components/marketing/landing-swipe-deck";
import { AUTH_SESSION_COOKIE_NAME } from "@/lib/firebase/auth-session";

const authHref = "/sign-in";

export const metadata: Metadata = {
  title: {
    absolute: "UGCPilot — Instagram Marketing Workspace",
  },
  description:
    "Create Instagram Reel hooks, text-led videos, slideshow posts, and approved publishing workflows in one workspace.",
};

const workflowSteps = [
  {
    step: "01",
    title: "Set your Instagram context",
    description:
      "Add your website and business details so creative work starts from your actual offer.",
  },
  {
    step: "02",
    title: "Choose a format",
    description:
      "Work on a Reel hook, a text-led video, or an Instagram carousel from the same workspace.",
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
      "Choose the Instagram account and timing, then confirm the final publishing action.",
  },
];

const productFooterLinks = [
  { label: "Instagram formats", href: "#formats" },
  { label: "Workflow", href: "#workflow" },
  { label: "Pricing", href: "/pricing" },
  { label: "Sign in", href: authHref },
];

const supportFooterLinks = [
  { label: "Contact", href: "/contact" },
  { label: "System status", href: "/status" },
  { label: "Help", href: "/contact" },
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
      <LandingHeader initialHasSession={initialHasSession} />

      <section className="relative z-0 px-4 pb-0 pt-24 sm:px-6 sm:pb-0 sm:pt-32 lg:px-8 lg:pb-0 lg:pt-36">
        <div className="relative mx-auto flex max-w-[1200px] flex-col items-center gap-8 sm:gap-12 lg:gap-16">
          <div className="w-full max-w-[1200px] text-center">
            {/* Announcement Pill Badge */}
            <div className="mb-5 inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-0.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold leading-4 text-foreground shadow-sm sm:mb-6 sm:px-4 sm:text-xs">
              <span className="text-primary font-semibold">Instagram-First</span>
              <span className="text-border-strong">•</span>
              <span className="min-w-0 text-muted">The All-in-One Content Workspace</span>
            </div>

            <h1 className="mx-auto max-w-[1200px] text-[clamp(2.25rem,5.28vw,4.8rem)] font-semibold leading-[0.94] tracking-[-0.055em] text-foreground-strong">
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

            <p className="mx-auto mt-7 max-w-[860px] text-base leading-7 text-muted sm:text-lg sm:leading-8">
              Turn proven Instagram formats into ready-to-publish content for
              your business. Review, edit, and publish slideshows, Reel hooks,
              and text-led videos designed to earn more attention and drive
              action.
            </p>

            <div className="mt-7 flex justify-center sm:mt-8">
              <LandingAuthCta
                className="group inline-flex h-12 w-full max-w-[220px] items-center justify-center rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto sm:max-w-none sm:px-7"
                initialHasSession={initialHasSession}
              />
            </div>
          </div>

          <div className="w-full">
            <LandingHeroShowcase />
          </div>
        </div>
      </section>

      {/* Section 2: One Instagram Workflow (Connected 4-card container) */}
      <section
        id="workflow"
        className="relative z-10 -mt-3 sm:-mt-4 lg:-mt-5 border-t border-border bg-background px-4 pt-8 pb-16 sm:px-6 sm:pt-10 sm:pb-20 lg:px-8 lg:pt-12 lg:pb-24 shadow-[0_-12px_32px_rgba(0,0,0,0.04)]"
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
              One Instagram workflow
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

      {/* Section 5: Connect Multiple Instagram Accounts (Connect -> Post Flow) */}
      <LandingBottomCta initialHasSession={initialHasSession} />

      <footer className="border-t border-border bg-card px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-[1200px] gap-10 md:grid-cols-[1.25fr_0.75fr_0.75fr_0.75fr]">
          <div>
            <div className="flex items-center gap-3">
              <ProductLogoMark
                className="size-9 rounded-control bg-primary p-2"
                imageClassName="brightness-0 invert"
                sizes="36px"
              />
              <div>
                <p className="font-semibold text-foreground-strong">UGCPilot</p>
                <p className="mt-0.5 text-xs text-muted">
                  Instagram marketing workspace
                </p>
              </div>
            </div>
            <p className="mt-5 max-w-sm text-sm leading-6 text-muted">
              Create, review, and schedule Instagram content from your own
              business context and approved media.
            </p>
          </div>

          <FooterColumn title="Product" links={productFooterLinks} />
          <FooterColumn title="Support" links={supportFooterLinks} />
          <FooterColumn title="Legal" links={legalFooterLinks} />
        </div>

        <div className="mx-auto mt-10 flex max-w-[1200px] flex-col gap-3 border-t border-border pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} UGCPilot. All rights reserved.</p>
          <p>Instagram is a trademark of Meta Platforms, Inc.</p>
        </div>
      </footer>
    </main>
  );
}

type FooterColumnProps = {
  links: Array<{ href: string; label: string }>;
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
            className="rounded-control transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
