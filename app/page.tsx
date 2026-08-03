import type { Metadata } from "next";
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronRight,
  Clapperboard,
  Images,
  LayoutGrid,
  ScanText,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";

import { ProductLogoMark } from "@/components/brand/product-logo";
import { LandingHeader } from "@/components/marketing/landing-header";
import { cn } from "@/lib/utils";

const authHref = "/sign-in";

export const metadata: Metadata = {
  title: {
    absolute: "UGCPilot — Instagram Marketing Workspace",
  },
  description:
    "Create Instagram Reel hooks, text-led videos, carousel posts, and approved publishing workflows in one workspace.",
};

const formatCards = [
  {
    title: "Reel hooks",
    description:
      "Browse approved hook footage and develop openings around your own business profile.",
    icon: Sparkles,
  },
  {
    title: "Wall-of-text Reels",
    description:
      "Turn your own script and media into text-led videos built for fast Instagram viewing.",
    icon: ScanText,
  },
  {
    title: "Carousel posts",
    description:
      "Build swipeable visual stories, review every slide, and keep the full post together.",
    icon: Images,
  },
  {
    title: "Instagram scheduling",
    description:
      "Connect an Instagram professional account and approve each post before it is scheduled.",
    icon: CalendarClock,
  },
];

const workflowSteps = [
  {
    title: "Set your Instagram context",
    description:
      "Add your website and business details so creative work starts from your actual offer.",
  },
  {
    title: "Choose a format",
    description:
      "Work on a Reel hook, a text-led video, or an Instagram carousel from the same workspace.",
  },
  {
    title: "Review the creative",
    description:
      "Check the media, text, caption, and account before anything moves to publishing.",
  },
  {
    title: "Approve the schedule",
    description:
      "Choose the Instagram account and timing, then confirm the final publishing action.",
  },
];

const controlPoints = [
  "Your own business profile grounds the creative",
  "Your approved media fills every content slot",
  "Your team reviews captions and publishing details",
  "Your Instagram account stays under your control",
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

export default function Home() {
  return (
    <main className="instagram-theme min-h-screen overflow-x-hidden bg-background text-foreground">
      <LandingHeader />

      <section className="relative px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32 lg:px-8 lg:pb-24 lg:pt-36">
        <div className="relative mx-auto flex max-w-[1200px] flex-col items-center gap-12 lg:gap-16">
          <div className="hero-rise w-full max-w-[1200px] text-center">
            <h1 className="mx-auto max-w-[1200px] text-[clamp(2rem,5.28vw,4.8rem)] font-semibold leading-[0.94] tracking-[-0.055em] text-foreground-strong">
              <span className="block lg:whitespace-nowrap">
                Stop guessing. Start posting.
              </span>
              <span className="mt-1 block lg:whitespace-nowrap sm:mt-2">
                Your next post is{" "}
                <span className="relative inline-block">
                  ready to go.
                  <svg
                    viewBox="0 0 320 18"
                    preserveAspectRatio="none"
                    className="pointer-events-none absolute -bottom-[0.16em] left-[4%] h-[0.18em] w-[92%] overflow-visible opacity-90"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient
                        id="ready-underline-gradient"
                        x1="0"
                        y1="9"
                        x2="320"
                        y2="9"
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop stopColor="var(--instagram-orange)" />
                        <stop offset="0.52" stopColor="var(--instagram-rose)" />
                        <stop offset="1" stopColor="var(--instagram-violet)" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M4 10.8C76 4.1 188 4.5 316 8.7"
                      fill="none"
                      stroke="url(#ready-underline-gradient)"
                      strokeWidth="3.6"
                      strokeLinecap="round"
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

            <div className="mt-8 flex justify-center">
              <Link
                href={authHref}
                className="group inline-flex h-12 items-center justify-center rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Start creating
                <ArrowRight
                  className="ml-2 size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </div>

            <p className="mt-5 flex items-center justify-center gap-2 text-sm leading-6 text-muted">
              <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
              Nothing is published until you review and approve it.
            </p>
          </div>

          <div className="hero-rise hero-rise-delay-1 w-full">
            <InstagramWorkspacePreview />
          </div>
        </div>
      </section>

      <section
        id="formats"
        className="border-y border-border bg-card-muted px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
      >
        <div className="mx-auto max-w-[1200px]">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-sm font-semibold text-primary">
                Instagram formats
              </p>
              <h2 className="mt-3 max-w-xl text-3xl font-semibold leading-tight tracking-[-0.035em] text-foreground-strong sm:text-5xl">
                A workspace shaped around how Instagram content is made.
              </h2>
            </div>
            <p className="max-w-2xl text-base leading-7 text-muted lg:justify-self-end">
              Each area has one clear job: find the opening, build the creative,
              review the post, and move it to an approved Instagram schedule.
            </p>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            <ApprovedHookShelf />
            <TextReelBuilder />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {formatCards.map((format) => {
              const Icon = format.icon;

              return (
                <article
                  key={format.title}
                  className="rounded-card border border-border bg-card p-5 shadow-card"
                >
                  <span className="flex size-10 items-center justify-center rounded-control bg-selected text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-foreground-strong">
                    {format.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {format.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="workflow"
        className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
      >
        <div className="mx-auto max-w-[1200px]">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary">
              One Instagram workflow
            </p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.035em] text-foreground-strong sm:text-5xl">
              Keep the creative and the publishing decision together.
            </h2>
          </div>

          <ol className="mt-12 grid overflow-hidden rounded-[var(--radius-panel)] border border-border bg-card md:grid-cols-2 lg:grid-cols-4">
            {workflowSteps.map((step, index) => (
              <li
                key={step.title}
                className="relative border-b border-border p-6 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0"
              >
                <span className="font-mono text-xs font-semibold text-primary">
                  0{index + 1}
                </span>
                <h3 className="mt-8 text-xl font-semibold leading-tight text-foreground-strong">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-y border-border bg-card px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <span className="flex size-12 items-center justify-center rounded-card bg-[linear-gradient(135deg,var(--instagram-orange),var(--instagram-rose),var(--instagram-violet))] text-white">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </span>
            <h2 className="mt-6 max-w-xl text-3xl font-semibold leading-tight tracking-[-0.035em] text-foreground-strong sm:text-5xl">
              Your Instagram account. Your approval.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted">
              UGCPilot organizes the work around your own profile, media, and
              connected Instagram account. Publishing stays a deliberate final
              step.
            </p>
          </div>

          <div className="rounded-[var(--radius-panel)] border border-border bg-card-muted p-3">
            <div className="rounded-card border border-border bg-card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4 border-b border-border pb-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-control bg-[linear-gradient(135deg,var(--instagram-orange),var(--instagram-rose),var(--instagram-violet))]">
                    <CalendarClock
                      className="size-5 text-white"
                      aria-hidden="true"
                    />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground-strong">
                      Instagram publishing review
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      Required before scheduling
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-primary/25 bg-selected px-3 py-1 text-xs font-semibold text-primary">
                  Approval step
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {controlPoints.map((point) => (
                  <div
                    key={point}
                    className="flex gap-3 rounded-control border border-border bg-card-muted p-4"
                  >
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <p className="text-sm leading-6 text-foreground">{point}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto overflow-hidden rounded-[var(--radius-panel)] border border-border bg-card shadow-card">
          <div className="grid max-w-[1200px] lg:grid-cols-[1fr_0.72fr]">
            <div className="p-7 sm:p-10 lg:p-14">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-control bg-[linear-gradient(135deg,var(--instagram-orange),var(--instagram-rose),var(--instagram-violet))]">
                  <LayoutGrid
                    className="size-5 text-white"
                    aria-hidden="true"
                  />
                </span>
                <p className="text-sm font-semibold text-primary">
                  Instagram-first by design
                </p>
              </div>
              <h2 className="mt-7 max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.035em] text-foreground-strong sm:text-5xl">
                Build the next post in a workspace that speaks Instagram.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted">
                Start with your real business details and approved media. Move
                from the creative idea to a reviewed schedule without changing
                tools.
              </p>
              <Link
                href={authHref}
                className="group mt-8 inline-flex h-12 items-center justify-center rounded-control bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                Start creating
                <ArrowRight
                  className="ml-2 size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </div>

            <div className="relative min-h-[320px] overflow-hidden border-t border-border bg-card-muted lg:border-l lg:border-t-0">
              <div
                className="absolute inset-0 opacity-70"
                style={{
                  background:
                    "radial-gradient(circle at 22% 20%, color-mix(in srgb, var(--instagram-orange) 55%, transparent), transparent 32%), radial-gradient(circle at 70% 44%, color-mix(in srgb, var(--instagram-rose) 60%, transparent), transparent 38%), radial-gradient(circle at 56% 95%, color-mix(in srgb, var(--instagram-violet) 58%, transparent), transparent 38%)",
                }}
                aria-hidden="true"
              />
              <div className="absolute inset-6 flex items-center justify-center rounded-[var(--radius-panel)] border border-border bg-card/80 p-6 shadow-card backdrop-blur-xl sm:inset-10">
                <div className="text-center">
                  <ProductLogoMark
                    className="mx-auto size-16 rounded-[18px] bg-card p-4 shadow-card ring-1 ring-inset ring-border"
                    sizes="64px"
                  />
                  <p className="mt-5 text-lg font-semibold text-foreground-strong">
                    Reels · Carousels · Scheduling
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    One focused Instagram workflow
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

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

function InstagramWorkspacePreview() {
  return (
    <div className="relative mx-auto max-w-[920px]">
      <div className="relative overflow-hidden rounded-[24px] border border-border-strong bg-card p-2 shadow-floating">
        <div className="rounded-[18px] border border-border bg-card">
          <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3.5 sm:px-5">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-[10px] border border-border bg-card-muted">
                <LayoutGrid
                  className="size-5 text-muted"
                  aria-hidden="true"
                />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground-strong">
                  Instagram content workspace
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  Approved media only
                </p>
              </div>
            </div>
            <span className="hidden rounded-full border border-border bg-card-muted px-3 py-1 text-[11px] font-medium text-muted sm:inline">
              Draft
            </span>
          </div>

          <div className="grid gap-3 p-3 sm:grid-cols-[0.72fr_1.28fr] sm:p-4">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-1">
              <PreviewMode
                active
                icon={Clapperboard}
                label="Reel hooks"
              />
              <PreviewMode icon={ScanText} label="Wall of text" />
              <PreviewMode icon={LayoutGrid} label="Carousels" />
            </div>

            <div className="rounded-[16px] border border-border bg-card-muted p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-foreground-strong">
                    Reel hook library
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    Filled from your approved video source
                  </p>
                </div>
                <WandSparkles className="size-4 text-accent-pink" aria-hidden="true" />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2.5">
                {[0, 1, 2].map((slot) => (
                  <div
                    key={slot}
                    className="relative aspect-[9/14] overflow-hidden rounded-[12px] border border-dashed border-border-strong bg-[linear-gradient(155deg,var(--card),var(--surface-subtle))]"
                  >
                    <div className="absolute inset-x-2 top-2 flex items-center justify-between">
                      <span className="h-1.5 w-8 rounded-full bg-border" />
                      <span className="size-4 rounded-full border border-border" />
                    </div>
                    <div className="absolute inset-x-2 bottom-2 grid gap-1.5">
                      <span className="h-1.5 w-full rounded-full bg-border-strong" />
                      <span className="h-1.5 w-3/4 rounded-full bg-border" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 rounded-[10px] border border-border bg-card px-3 py-2.5">
                <p className="text-[11px] leading-5 text-muted">
                  Real videos load after sign-in.
                </p>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-subtle"
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewMode({
  active = false,
  icon: Icon,
  label,
}: {
  active?: boolean;
  icon: typeof Clapperboard;
  label: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[12px] border p-3",
        active
          ? "border-primary/25 bg-selected text-foreground-strong"
          : "border-border bg-card text-muted",
      )}
    >
      <Icon
        className={cn("size-4", active && "text-accent-pink")}
        aria-hidden="true"
      />
      <p className="mt-3 text-[11px] font-semibold leading-tight sm:text-xs">
        {label}
      </p>
    </div>
  );
}

function ApprovedHookShelf() {
  return (
    <article className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-card shadow-card">
      <div className="flex items-start justify-between gap-4 border-b border-border p-6">
        <div>
          <p className="text-sm font-semibold text-primary">
            Trending hook layout
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-foreground-strong">
            A visual shelf for approved hook footage.
          </h3>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
            The public page defines the layout. Real videos remain inside the
            signed-in, user-scoped library.
          </p>
        </div>
        <Clapperboard className="size-5 shrink-0 text-primary" aria-hidden="true" />
      </div>

      <div className="grid grid-cols-3 gap-3 bg-card-muted p-4 sm:p-6">
        {[0, 1, 2].map((slot) => (
          <div
            key={slot}
            className="relative aspect-[9/14] overflow-hidden rounded-card border border-dashed border-border-strong bg-card"
          >
            <div className="absolute inset-x-3 top-3 flex items-center justify-between">
              <span className="h-2 w-10 rounded-full bg-card-muted" />
              <span className="size-5 rounded-full border border-border bg-card-muted" />
            </div>
            <div className="absolute inset-x-3 bottom-3 grid gap-2">
              <span className="h-2 rounded-full bg-card-muted" />
              <span className="h-2 w-3/4 rounded-full bg-card-muted" />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function TextReelBuilder() {
  return (
    <article className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-card shadow-card">
      <div className="flex items-start justify-between gap-4 border-b border-border p-6">
        <div>
          <p className="text-sm font-semibold text-primary">
            Wall-of-text Reel layout
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-foreground-strong">
            Keep the script readable while the video moves.
          </h3>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
            Use your own copy and media, then review the text treatment inside a
            vertical Instagram frame.
          </p>
        </div>
        <ScanText className="size-5 shrink-0 text-primary" aria-hidden="true" />
      </div>

      <div className="grid gap-4 bg-card-muted p-4 sm:grid-cols-[0.85fr_1.15fr] sm:p-6">
        <div className="grid gap-3">
          {["Your script", "Your media", "Review"].map((label, index) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-control border border-border bg-card p-3.5"
            >
              <span className="flex size-7 items-center justify-center rounded-control bg-selected font-mono text-[11px] font-semibold text-primary">
                {index + 1}
              </span>
              <span className="text-sm font-medium text-foreground">{label}</span>
            </div>
          ))}
        </div>

        <div className="relative mx-auto aspect-[9/14] w-full max-w-[220px] overflow-hidden rounded-card border border-border-strong bg-[linear-gradient(155deg,var(--card),var(--surface-subtle))] shadow-card">
          <div className="absolute inset-x-4 top-4 flex items-center justify-between">
            <span className="h-2 w-12 rounded-full bg-border" />
            <ScanText
              className="size-5 text-muted-subtle"
              aria-hidden="true"
            />
          </div>
          <div className="absolute inset-x-4 top-[32%] grid gap-2">
            <span className="h-3 rounded-full bg-border-strong" />
            <span className="h-3 rounded-full bg-border-strong/80" />
            <span className="h-3 w-4/5 rounded-full bg-border" />
            <span className="mt-1 h-3 w-3/5 rounded-full bg-accent-pink/45" />
          </div>
          <div className="absolute inset-x-4 bottom-4 h-9 rounded-[9px] border border-border bg-card" />
        </div>
      </div>
    </article>
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
