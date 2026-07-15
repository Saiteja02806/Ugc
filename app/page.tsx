import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Camera,
  Check,
  CheckCircle2,
  CirclePlay,
  FileVideo,
  Layers3,
  Library,
  MessageSquareText,
  Music2,
  Play,
  ShieldCheck,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";
import Link from "next/link";

import { ProductLogoMark } from "@/components/brand/product-logo";

const authHref = "/sign-in";

const navItems = [
  { label: "Workflow", href: "#workflow" },
  { label: "Platforms", href: "#platforms" },
  { label: "Pricing", href: "/pricing" },
];

const pipelineSteps = [
  {
    title: "Upload",
    description: "Drop in demos, product videos, screen recordings, or images.",
    icon: Upload,
  },
  {
    title: "Generate",
    description: "Create short-form hooks, UGC concepts, carousels, and edits.",
    icon: Wand2,
  },
  {
    title: "Approve",
    description: "Review the creative, caption, destination, rights, and disclosures.",
    icon: ShieldCheck,
  },
  {
    title: "Schedule",
    description: "Send approved posts to your own connected social accounts.",
    icon: CalendarClock,
  },
];

const contentFormats = [
  {
    title: "Product Demo",
    description: "Turn feature walkthroughs into compact social videos.",
    icon: FileVideo,
  },
  {
    title: "UGC Hook",
    description: "Generate opening angles your audience understands quickly.",
    icon: MessageSquareText,
  },
  {
    title: "Carousel Ad",
    description: "Plan slide-by-slide posts from product claims and assets.",
    icon: Layers3,
  },
  {
    title: "Asset Library",
    description: "Reuse approved media across campaigns and publishing drafts.",
    icon: Library,
  },
];

const approvalChecks = [
  "Preview the rendered creative before it posts",
  "Edit captions, hashtags, destinations, and timing",
  "Confirm ownership, licensing, AI use, and disclosures",
  "Approve each publishing action explicitly",
];

const platformCards = [
  {
    title: "Instagram",
    description: "Prepare supported posts, Reels, and carousels for eligible Business or Creator accounts.",
    icon: Camera,
    color: "#e4518c",
  },
  {
    title: "TikTok",
    description: "Review supported video or photo posts before publishing to a connected account.",
    icon: Music2,
    color: "#19d3c5",
  },
  {
    title: "YouTube",
    description: "Upload, schedule, and monitor supported videos from your connected channel.",
    icon: CirclePlay,
    color: "#ff4a3d",
  },
];

const responsibilityPoints = [
  "Connect and disconnect your own accounts",
  "Keep publishing approval under user control",
  "Review rights and disclosures before every post",
  "Request deletion of stored data when needed",
];

const productFooterLinks = [
  { label: "Workflow", href: "#workflow" },
  { label: "Pricing", href: "/pricing" },
  { label: "Platforms", href: "#platforms" },
  { label: "Approval", href: "#approval" },
];

const supportFooterLinks = [
  { label: "Help", href: "/contact" },
  { label: "Contact", href: "/contact" },
  { label: "System status", href: "/status" },
  { label: "Report an issue", href: "/contact" },
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
    <main className="min-h-screen overflow-x-hidden bg-[#f3f3f1] text-[#17171b]">
      <header className="sticky top-0 z-40 w-full border-b border-[#deded8] bg-[#f8f8f6]/90 px-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-5">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563eb]"
            aria-label="UGC Pilot home"
          >
            <ProductLogoMark className="h-8 w-12" sizes="52px" />
            <span className="truncate text-base font-black tracking-normal text-[#151515] sm:text-lg">
              UGC Pilot
            </span>
          </Link>

          <nav
            className="hidden items-center gap-7 text-sm font-bold text-[#55554f] md:flex"
            aria-label="Primary navigation"
          >
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-full transition-colors duration-200 hover:text-[#17171b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563eb]"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={authHref}
              className="rounded-full border border-[#d9d9d2] bg-white px-4 py-2 text-[#17171b] transition-colors duration-200 hover:border-[#ffb493] hover:bg-[#fff4ee] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563eb]"
            >
              Sign In
            </Link>
          </nav>

          <details className="group relative md:hidden">
            <summary className="list-none rounded-full border border-[#d9d9d2] bg-white px-4 py-2 text-sm font-black text-[#202020] transition-colors duration-200 hover:border-[#ffb493] hover:bg-[#fff4ee] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563eb] [&::-webkit-details-marker]:hidden">
              Menu
            </summary>
            <div className="absolute right-0 top-12 w-60 rounded-[16px] border border-[#deded8] bg-white p-2 shadow-[0_16px_32px_rgb(23_23_27_/_0.12)]">
              {[...navItems, { label: "Sign In", href: authHref }].map(
                (item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="block rounded-[12px] px-3 py-2.5 text-sm font-bold text-[#55554f] transition-colors duration-200 hover:bg-[#fff4ee] hover:text-[#17171b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"
                  >
                    {item.label}
                  </Link>
                ),
              )}
            </div>
          </details>
        </div>
      </header>

      <section className="relative border-b border-[#deded8] bg-[#f8f8f6] px-4 pb-14 pt-10 sm:px-6 sm:pb-16 lg:px-8 lg:pb-20 lg:pt-14">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <div className="hero-rise max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ffd2bf] bg-white px-3 py-1.5 text-sm font-black text-[#b84010]">
              <Sparkles className="size-4" aria-hidden="true" />
              Product assets in. Approved posts out.
            </div>
            <h1 className="mt-6 text-[clamp(2.65rem,5.8vw,4.85rem)] font-black leading-[0.95] tracking-normal text-[#111111]">
              Create approved posts from product assets.
            </h1>
            <p className="mt-6 max-w-xl text-lg font-semibold leading-8 text-[#4f504c]">
              Upload demos, generate UGC-style videos and carousels, review the
              caption and disclosures, then schedule to Instagram, TikTok, or
              YouTube.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={authHref}
                className="group inline-flex h-13 items-center justify-center rounded-full bg-[#ff5a1f] px-7 text-base font-black text-white shadow-[0_12px_24px_rgb(255_90_31_/_0.24)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[#e64b14] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563eb]"
              >
                Start Creating
                <ArrowRight
                  className="ml-2 size-4 transition-transform duration-200 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
              <Link
                href="#workflow"
                className="inline-flex h-13 items-center justify-center rounded-full border border-[#cfcfca] bg-white px-7 text-base font-black text-[#202020] transition-colors duration-200 hover:border-[#ffb493] hover:bg-[#fff4ee] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563eb]"
              >
                View Workflow
              </Link>
            </div>
            <div className="mt-8 hidden flex-wrap gap-2 text-sm font-bold text-[#565750] sm:flex">
              <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-[#deded8]">
                Videos
              </span>
              <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-[#deded8]">
                Carousels
              </span>
              <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-[#deded8]">
                Captions
              </span>
              <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-[#deded8]">
                Scheduling
              </span>
            </div>
          </div>

          <div className="hero-rise hero-rise-delay-1">
            <ProductCockpit />
          </div>
        </div>
      </section>

      <section id="workflow" className="px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="landing-reveal mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
            <div>
              <p className="text-sm font-black text-[#c2410c]">
                One controlled workflow
              </p>
              <h2 className="mt-3 max-w-xl text-4xl font-black leading-[1.02] tracking-normal text-[#151515] sm:text-5xl">
                From rough asset to ready-to-publish post.
              </h2>
            </div>
            <p className="max-w-2xl text-base font-semibold leading-7 text-[#575852] lg:justify-self-end">
              The landing page should make the system visible immediately:
              creation, review, account choice, and scheduling all belong in
              one product path.
            </p>
          </div>

          <div className="mt-10 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {pipelineSteps.map((step) => {
              const Icon = step.icon;

              return (
                <article
                  key={step.title}
                  className="rounded-[16px] border border-[#deded8] bg-white p-5 shadow-[0_8px_16px_rgb(23_23_27_/_0.04)]"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-[12px] bg-[#17171b] text-white">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <h3 className="text-xl font-black leading-tight text-[#17171b]">
                      {step.title}
                    </h3>
                  </div>
                  <p className="mt-4 text-sm font-semibold leading-6 text-[#5b5c56]">
                    {step.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#17171b] px-4 py-16 text-white sm:px-6 lg:px-8 lg:py-20">
        <div className="landing-reveal mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
          <div>
            <p className="text-sm font-black text-[#ffb493]">
              More than a generator
            </p>
            <h2 className="mt-3 max-w-xl text-4xl font-black leading-[1.02] tracking-normal text-white sm:text-5xl">
              Show the formats buyers actually came for.
            </h2>
            <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-[#deded8]">
              The redesign trades generic feature cards for formats that map to
              real creator workflows: product demos, hook videos, carousel ads,
              and reusable media.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {contentFormats.map((format) => {
              const Icon = format.icon;

              return (
                <Link
                  key={format.title}
                  href={authHref}
                  className="group rounded-[16px] border border-white/12 bg-white/[0.06] p-5 transition-colors duration-200 hover:border-[#ffb493] hover:bg-white/[0.09] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffb493]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex size-11 items-center justify-center rounded-[12px] bg-[#ff5a1f] text-white">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <ArrowRight
                      className="size-4 text-[#ffb493] transition-transform duration-200 group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="mt-5 text-xl font-black leading-tight text-white">
                    {format.title}
                  </h3>
                  <p className="mt-3 text-sm font-semibold leading-6 text-[#d4d4d0]">
                    {format.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section id="approval" className="px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="landing-reveal mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <ApprovalConsole />

          <div>
            <p className="text-sm font-black text-[#c2410c]">
              Review before publish
            </p>
            <h2 className="mt-3 max-w-xl text-4xl font-black leading-[1.02] tracking-normal text-[#151515] sm:text-5xl">
              The product promise is control, not autopilot.
            </h2>
            <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-[#575852]">
              The new landing page makes approval visible. It shows that users
              see the post, tune the details, confirm rights, and choose when
              it goes live.
            </p>
            <div className="mt-7 grid gap-3">
              {approvalChecks.map((check) => (
                <div
                  key={check}
                  className="flex gap-3 rounded-[14px] border border-[#deded8] bg-white p-4"
                >
                  <CheckCircle2
                    className="mt-0.5 size-5 shrink-0 text-[#c2410c]"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-black leading-6 text-[#242420]">
                    {check}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="platforms"
        className="border-y border-[#deded8] bg-[#f8f8f6] px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
      >
        <div className="landing-reveal mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
            <div>
              <p className="text-sm font-black text-[#c2410c]">
                Connected accounts
              </p>
              <h2 className="mt-3 max-w-xl text-4xl font-black leading-[1.02] tracking-normal text-[#151515] sm:text-5xl">
                Publish through accounts users already own.
              </h2>
            </div>
            <p className="max-w-2xl text-base font-semibold leading-7 text-[#575852] lg:justify-self-end">
              Each platform connection is part of the user-controlled path:
              connect, review settings, approve the post, publish or schedule.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {platformCards.map((platform) => {
              const Icon = platform.icon;

              return (
                <article
                  key={platform.title}
                  className="rounded-[16px] border border-[#deded8] bg-white p-5"
                >
                  <span
                    className="flex size-11 items-center justify-center rounded-[12px] text-white"
                    style={{ backgroundColor: platform.color }}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-2xl font-black leading-tight text-[#17171b]">
                    {platform.title}
                  </h3>
                  <p className="mt-3 text-sm font-semibold leading-6 text-[#5b5c56]">
                    {platform.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="landing-reveal mx-auto grid max-w-7xl gap-8 rounded-[16px] bg-[#17171b] p-6 text-white sm:p-8 lg:grid-cols-[0.95fr_1.05fr] lg:p-10">
          <div>
            <div className="flex size-12 items-center justify-center rounded-[12px] bg-[#ff5a1f] text-white">
              <BadgeCheck className="size-6" aria-hidden="true" />
            </div>
            <h2 className="mt-5 max-w-xl text-4xl font-black leading-[1.02] tracking-normal text-white sm:text-5xl">
              Built for responsible creative operations.
            </h2>
            <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-[#deded8]">
              UGC Pilot helps teams create and schedule social content while
              keeping account access, content review, and publishing approval
              explicit.
            </p>
          </div>

          <div className="grid content-center gap-3">
            {responsibilityPoints.map((point) => (
              <div
                key={point}
                className="flex gap-3 rounded-[14px] border border-white/10 bg-white/[0.06] p-4"
              >
                <Check
                  className="mt-0.5 size-5 shrink-0 text-[#ffb493]"
                  aria-hidden="true"
                />
                <p className="text-sm font-black leading-6 text-white">
                  {point}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 pt-2 sm:px-6 lg:px-8">
        <div className="landing-reveal mx-auto max-w-5xl text-center">
          <h2 className="text-4xl font-black leading-[1.02] tracking-normal text-[#151515] sm:text-5xl">
            Build the next post from assets you already have.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base font-semibold leading-7 text-[#575852]">
            Upload, generate, review, and schedule without separating creative
            production from publishing approval.
          </p>
          <Link
            href={authHref}
            className="group mt-8 inline-flex h-13 items-center justify-center rounded-full bg-[#ff5a1f] px-7 text-base font-black text-white shadow-[0_12px_24px_rgb(255_90_31_/_0.24)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[#e64b14] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563eb]"
          >
            Start Creating
            <ArrowRight
              className="ml-2 size-4 transition-transform duration-200 group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
        </div>
      </section>

      <footer className="bg-[#101014] px-4 py-10 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-9 md:grid-cols-2 lg:grid-cols-[1.35fr_0.85fr_0.85fr_1fr]">
            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full font-black text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffb493]"
              >
                <ProductLogoMark className="h-6 w-9" sizes="36px" />
                UGC Pilot
              </Link>
              <p className="mt-4 max-w-sm text-sm font-semibold leading-6 text-[#d9d9df]">
                AI-assisted social content creation and scheduling for SaaS,
                mobile app, and digital product teams.
              </p>
            </div>

            <FooterColumn title="Product" links={productFooterLinks} />
            <FooterColumn title="Support" links={supportFooterLinks} />
            <FooterColumn title="Legal" links={legalFooterLinks} />
          </div>

          <div className="mt-10 flex flex-col gap-4 border-t border-white/12 pt-6 text-sm text-[#c8c8cf] md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-2">
              <p>&copy; 2026 UGC Pilot. All rights reserved.</p>
              <p>
                UGC Pilot is an independent service and is not affiliated with,
                endorsed by, or sponsored by Meta, TikTok, or Google.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 font-bold text-white">
              <a
                href="mailto:support@getugcpilot.com"
                className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffb493]"
              >
                support@getugcpilot.com
              </a>
              <a
                href="mailto:privacy@getugcpilot.com"
                className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffb493]"
              >
                privacy@getugcpilot.com
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function ProductCockpit() {
  return (
    <div className="relative">
      <div className="absolute -right-3 top-6 hidden h-28 w-28 rounded-full bg-[#ff5a1f] opacity-20 blur-2xl lg:block" />
      <div className="relative overflow-hidden rounded-[16px] border border-[#2f2f32] bg-[#17171b] p-3 shadow-[0_24px_48px_rgb(23_23_27_/_0.24)]">
        <div className="flex items-center justify-between border-b border-white/10 px-2 pb-3">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-[#ff5a1f]" />
            <span className="size-2.5 rounded-full bg-[#ffd166]" />
            <span className="size-2.5 rounded-full bg-[#45d483]" />
          </div>
          <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-black text-[#deded8]">
            Campaign Draft
          </span>
        </div>

        <div className="grid gap-3 pt-3 lg:grid-cols-[1fr_0.72fr]">
          <div className="grid gap-3">
            <div className="rounded-[14px] bg-[#242428] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black text-[#ffb493]">
                    Uploaded Asset
                  </p>
                  <h3 className="mt-1 text-xl font-black leading-tight text-white">
                    Product walkthrough.mov
                  </h3>
                </div>
                <span className="rounded-full bg-[#45d483]/15 px-3 py-1 text-xs font-black text-[#8af0b5]">
                  Ready
                </span>
              </div>

              <div className="mt-4 grid min-h-48 overflow-hidden rounded-[12px] bg-[#0d0d0f] sm:grid-cols-[0.7fr_1fr]">
                <div className="relative flex items-center justify-center bg-[#ff5a1f]">
                  <div className="absolute inset-0 bg-[linear-gradient(140deg,rgb(255_255_255_/_0.18),transparent_45%)]" />
                  <Play className="relative size-12 fill-white text-white" aria-hidden="true" />
                </div>
                <div className="grid content-center gap-3 p-4">
                  <div className="h-3 w-4/5 rounded-full bg-white/22" />
                  <div className="h-3 w-3/5 rounded-full bg-white/16" />
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="h-14 rounded-[10px] bg-white/10" />
                    <div className="h-14 rounded-[10px] bg-white/14" />
                    <div className="h-14 rounded-[10px] bg-white/10" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {["Hook Video", "Carousel", "Caption"].map((item, index) => (
                <div
                  key={item}
                  className="rounded-[14px] border border-white/10 bg-white/[0.06] p-4"
                >
                  <p className="text-xs font-black text-[#c8c8cf]">{item}</p>
                  <div className="mt-3 h-2 rounded-full bg-white/18" />
                  <div
                    className="mt-2 h-2 rounded-full bg-[#ff5a1f]"
                    style={{ width: `${72 - index * 14}%` }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-[14px] bg-white p-4 text-[#17171b]">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-[#c2410c]">
                  Post Preview
                </p>
                <span className="rounded-full bg-[#fff1e8] px-2.5 py-1 text-xs font-black text-[#c2410c]">
                  9:16
                </span>
              </div>
              <div className="mx-auto mt-4 max-w-[170px] rounded-[18px] border border-[#242428] bg-[#111114] p-2">
                <div className="overflow-hidden rounded-[12px] bg-[#f3f3f1]">
                  <div className="flex h-52 items-center justify-center bg-[#ff5a1f] text-white">
                    <Play className="size-10 fill-white" aria-hidden="true" />
                  </div>
                  <div className="grid gap-2 p-3">
                    <div className="h-2 rounded-full bg-[#17171b]/80" />
                    <div className="h-2 w-3/4 rounded-full bg-[#17171b]/28" />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[14px] border border-white/10 bg-white/[0.06] p-4">
              <p className="text-xs font-black text-[#ffb493]">
                Approval Checklist
              </p>
              <div className="mt-3 grid gap-2">
                {["Caption edited", "Rights confirmed", "Schedule selected"].map(
                  (item) => (
                    <div key={item} className="flex items-center gap-2 text-sm font-bold text-white">
                      <span className="flex size-5 items-center justify-center rounded-full bg-[#45d483] text-[#101014]">
                        <Check className="size-3.5" aria-hidden="true" />
                      </span>
                      {item}
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs font-black">
              <span className="rounded-full bg-white px-2 py-2 text-[#e4518c]">
                Instagram
              </span>
              <span className="rounded-full bg-white px-2 py-2 text-[#09857e]">
                TikTok
              </span>
              <span className="rounded-full bg-white px-2 py-2 text-[#d53429]">
                YouTube
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApprovalConsole() {
  return (
    <div className="overflow-hidden rounded-[16px] border border-[#deded8] bg-white shadow-[0_16px_32px_rgb(23_23_27_/_0.08)]">
      <div className="flex items-center justify-between border-b border-[#e6e6df] px-5 py-4">
        <div>
          <p className="text-xs font-black text-[#c2410c]">Publishing Review</p>
          <h3 className="mt-1 text-2xl font-black leading-tight text-[#17171b]">
            Launch draft
          </h3>
        </div>
        <span className="rounded-full bg-[#fff1e8] px-3 py-1.5 text-xs font-black text-[#c2410c]">
          Needs approval
        </span>
      </div>

      <div className="grid gap-0 md:grid-cols-[0.72fr_1fr]">
        <div className="border-b border-[#e6e6df] bg-[#17171b] p-4 md:border-b-0 md:border-r">
          <div className="mx-auto max-w-[190px] rounded-[18px] border border-white/16 bg-[#0f0f12] p-2">
            <div className="overflow-hidden rounded-[12px] bg-[#f3f3f1]">
              <div className="flex h-64 items-center justify-center bg-[#ff5a1f] text-white">
                <Play className="size-11 fill-white" aria-hidden="true" />
              </div>
              <div className="grid gap-2 p-3">
                <div className="h-2 rounded-full bg-[#17171b]/80" />
                <div className="h-2 w-4/5 rounded-full bg-[#17171b]/28" />
                <div className="h-2 w-2/3 rounded-full bg-[#17171b]/20" />
              </div>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="grid gap-4">
            <ReviewRow label="Destination" value="Instagram Reels" />
            <ReviewRow label="Caption" value="3 edits applied" />
            <ReviewRow label="Rights" value="Confirmed by user" />
            <ReviewRow label="Disclosure" value="AI-assisted content noted" />
            <ReviewRow label="Publish time" value="Tomorrow, 10:30 AM" />
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href={authHref}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-[#ff5a1f] px-5 text-sm font-black text-white transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[#e64b14] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563eb]"
            >
              Approve Schedule
            </Link>
            <Link
              href={authHref}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-[#d8d8d2] px-5 text-sm font-black text-[#242420] transition-colors duration-200 hover:border-[#ffb493] hover:bg-[#fff4ee] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563eb]"
            >
              Edit Draft
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[12px] bg-[#f5f5f2] px-4 py-3">
      <span className="text-sm font-bold text-[#696a64]">{label}</span>
      <span className="text-right text-sm font-black text-[#17171b]">
        {value}
      </span>
    </div>
  );
}

type FooterColumnProps = {
  links: {
    href: string;
    label: string;
  }[];
  title: string;
};

function FooterColumn({ links, title }: FooterColumnProps) {
  return (
    <div>
      <h2 className="text-sm font-black tracking-normal text-white">{title}</h2>
      <nav className="mt-4 flex flex-col gap-3 text-sm font-bold text-[#d9d9df]">
        {links.map((link) => (
          <Link
            key={`${title}-${link.label}`}
            href={link.href}
            className="rounded-full transition-colors duration-200 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffb493]"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
