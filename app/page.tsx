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
  Menu,
  MessageSquareText,
  Music2,
  ShieldCheck,
  Upload,
  Wand2,
} from "lucide-react";
import Link from "next/link";

import { ProductLogoMark } from "@/components/brand/product-logo";

const authHref = "/sign-in";

const navItems = [
  { label: "Workflow", href: "#workflow" },
  { label: "Review", href: "#review" },
  { label: "Pricing", href: "/pricing" },
];

const workflowSteps = [
  {
    title: "Upload source material",
    description: "Add demos, screen recordings, images, or reusable creator assets.",
    icon: Upload,
  },
  {
    title: "Generate draft creative",
    description: "Create hooks, carousels, captions, and cutdowns from one brief.",
    icon: Wand2,
  },
  {
    title: "Review the details",
    description: "Check the rendered post, copy, timing, rights, and disclosures.",
    icon: ShieldCheck,
  },
  {
    title: "Schedule from your account",
    description: "Publish or schedule only after the user approves the action.",
    icon: CalendarClock,
  },
];

const contentFormats = [
  {
    title: "Product demo clips",
    description: "Turn feature walkthroughs into concise social videos.",
    icon: FileVideo,
  },
  {
    title: "UGC-style hooks",
    description: "Explore creator-led openings that explain the product quickly.",
    icon: MessageSquareText,
  },
  {
    title: "Carousel posts",
    description: "Plan slide-by-slide posts from product claims and assets.",
    icon: Layers3,
  },
  {
    title: "Reusable library",
    description: "Keep approved media available for future drafts.",
    icon: Library,
  },
];

const approvalChecks = [
  "Preview the rendered creative before it posts",
  "Edit captions, hashtags, destination, and timing",
  "Confirm ownership, licensing, AI use, and disclosures",
  "Approve each publishing action explicitly",
];

const platformCards = [
  {
    title: "Instagram",
    description: "Prepare supported posts, Reels, and carousels.",
    icon: Camera,
    color: "#c2416f",
  },
  {
    title: "TikTok",
    description: "Review supported video or photo posts before publishing.",
    icon: Music2,
    color: "#0f766e",
  },
  {
    title: "YouTube",
    description: "Upload, schedule, and monitor supported videos.",
    icon: CirclePlay,
    color: "#c24132",
  },
];

const productFooterLinks = [
  { label: "Workflow", href: "#workflow" },
  { label: "Review", href: "#review" },
  { label: "Platforms", href: "#platforms" },
  { label: "Pricing", href: "/pricing" },
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
    <main className="min-h-screen overflow-x-hidden bg-[#fbfaf8] text-[#1a1a1f]">
      <header className="sticky top-0 z-40 w-full border-b border-[#ebe7df] bg-[#fbfaf8]/92 px-4 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-5">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563eb]"
            aria-label="UGC Pilot home"
          >
            <ProductLogoMark className="h-8 w-12" sizes="52px" />
            <span className="truncate text-base font-semibold text-[#171717] sm:text-lg">
              UGC Pilot
            </span>
          </Link>

          <nav
            className="hidden items-center gap-7 text-sm font-medium text-[#66655e] md:flex"
            aria-label="Primary navigation"
          >
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-full transition-colors duration-200 hover:text-[#171717] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563eb]"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={authHref}
              className="inline-flex h-10 items-center rounded-full border border-[#d9d3ca] bg-white px-4 text-[#1f1f1b] transition-colors duration-200 hover:border-[#c7beb1] hover:bg-[#f7f3ed] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563eb]"
            >
              Sign in
            </Link>
          </nav>

          <details className="group relative md:hidden">
            <summary
              aria-label="Open menu"
              className="flex size-10 list-none items-center justify-center rounded-full border border-[#d9d3ca] bg-white text-[#252521] transition-colors duration-200 hover:border-[#c7beb1] hover:bg-[#f7f3ed] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563eb] [&::-webkit-details-marker]:hidden"
            >
              <Menu className="size-4" aria-hidden="true" />
            </summary>
            <div className="absolute right-0 top-12 w-56 rounded-[12px] border border-[#ebe7df] bg-white p-2">
              {[...navItems, { label: "Sign in", href: authHref }].map(
                (item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="block rounded-[10px] px-3 py-2.5 text-sm font-medium text-[#5f5e57] transition-colors duration-200 hover:bg-[#f7f3ed] hover:text-[#171717] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"
                  >
                    {item.label}
                  </Link>
                ),
              )}
            </div>
          </details>
        </div>
      </header>

      <section className="px-4 pb-20 pt-12 sm:px-6 sm:pb-24 lg:px-8 lg:pt-20">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.94fr_1.06fr] lg:items-center">
          <div className="hero-rise max-w-2xl">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-[#94512c]">
              <span className="size-2 rounded-full bg-[#d85a24]" />
              AI-assisted social workflow
            </p>
            <h1 className="mt-5 max-w-3xl text-[clamp(2.65rem,6vw,4.9rem)] font-semibold leading-[1.01] tracking-normal text-[#141414]">
              Turn product assets into approved social posts.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#55544d] sm:text-xl">
              UGC Pilot helps teams upload product media, generate short-form
              creative, review every caption and disclosure, then schedule posts
              to connected channels.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={authHref}
                className="group inline-flex h-12 items-center justify-center rounded-full bg-[#d94f1f] px-6 text-base font-semibold text-white transition-colors duration-200 hover:bg-[#c34419] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563eb]"
              >
                Start creating
                <ArrowRight
                  className="ml-2 size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
              <Link
                href="#workflow"
                className="inline-flex h-12 items-center justify-center rounded-full border border-[#d9d3ca] bg-white px-6 text-base font-semibold text-[#242420] transition-colors duration-200 hover:border-[#c7beb1] hover:bg-[#f7f3ed] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563eb]"
              >
                See workflow
              </Link>
            </div>
            <p className="mt-6 max-w-lg text-sm leading-6 text-[#66655e]">
              No blind autopublish. Every post stays in review until your team
              approves it.
            </p>
          </div>

          <div className="hero-rise hero-rise-delay-1">
            <WorkflowPreview />
          </div>
        </div>
      </section>

      <section
        id="workflow"
        className="border-y border-[#ebe7df] bg-white px-4 py-16 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-sm font-medium text-[#94512c]">Workflow</p>
              <h2 className="mt-3 max-w-xl text-3xl font-semibold leading-tight text-[#171717] sm:text-4xl">
                One path from source file to scheduled post.
              </h2>
            </div>
            <p className="max-w-2xl text-base leading-7 text-[#5d5c55] lg:justify-self-end">
              Keep creation, review, and publishing decisions together so teams
              can move quickly without losing control.
            </p>
          </div>

          <ol className="mt-10 grid overflow-hidden rounded-[14px] border border-[#ebe7df] md:grid-cols-4">
            {workflowSteps.map((step, index) => {
              const Icon = step.icon;

              return (
                <li
                  key={step.title}
                  className="border-b border-[#ebe7df] p-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-[#f5eee8] text-sm font-semibold text-[#a34720]">
                      {index + 1}
                    </span>
                    <Icon className="size-4 text-[#a34720]" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold leading-tight text-[#1d1d1b]">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[#65645d]">
                    {step.description}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div>
            <p className="text-sm font-medium text-[#94512c]">
              Creative formats
            </p>
            <h2 className="mt-3 max-w-xl text-3xl font-semibold leading-tight text-[#171717] sm:text-4xl">
              Create what a social launch actually needs.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#5d5c55]">
              Use one workspace for the formats teams repeatedly request:
              product clips, creator-style openings, carousel posts, and
              reusable media.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {contentFormats.map((format) => {
              const Icon = format.icon;

              return (
                <article
                  key={format.title}
                  className="rounded-[14px] border border-[#ebe7df] bg-white p-5"
                >
                  <Icon className="size-5 text-[#a34720]" aria-hidden="true" />
                  <h3 className="mt-4 text-lg font-semibold text-[#1d1d1b]">
                    {format.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#65645d]">
                    {format.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="review"
        className="border-y border-[#ebe7df] bg-[#f6f3ee] px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
      >
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <ApprovalConsole />

          <div>
            <p className="text-sm font-medium text-[#94512c]">Review</p>
            <h2 className="mt-3 max-w-xl text-3xl font-semibold leading-tight text-[#171717] sm:text-4xl">
              Approval stays visible until the post is ready.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#5d5c55]">
              AI prepares options. Your team sees the creative, tunes the
              details, confirms platform requirements, and approves the final
              publishing action.
            </p>
            <div className="mt-7 grid gap-3">
              {approvalChecks.map((check) => (
                <div key={check} className="flex gap-3">
                  <CheckCircle2
                    className="mt-0.5 size-5 shrink-0 text-[#a34720]"
                    aria-hidden="true"
                  />
                  <p className="text-sm leading-6 text-[#3f3e39]">{check}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="platforms"
        className="px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
      >
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
            <div>
              <p className="text-sm font-medium text-[#94512c]">
                Connected channels
              </p>
              <h2 className="mt-3 max-w-xl text-3xl font-semibold leading-tight text-[#171717] sm:text-4xl">
                Publish through accounts your team controls.
              </h2>
            </div>
            <p className="max-w-2xl text-base leading-7 text-[#5d5c55] lg:justify-self-end">
              UGC Pilot keeps platform connection, review, and scheduling in a
              user-controlled flow for supported social accounts.
            </p>
          </div>

          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {platformCards.map((platform) => {
              const Icon = platform.icon;

              return (
                <article
                  key={platform.title}
                  className="rounded-[14px] border border-[#ebe7df] bg-white p-5"
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className="size-5"
                      style={{ color: platform.color }}
                      aria-hidden="true"
                    />
                    <h3 className="text-lg font-semibold text-[#1d1d1b]">
                      {platform.title}
                    </h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#65645d]">
                    {platform.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8 lg:pb-24">
        <div className="mx-auto grid max-w-6xl gap-8 rounded-[16px] bg-[#1c1c1f] p-6 text-white sm:p-8 lg:grid-cols-[1fr_0.78fr] lg:items-center lg:p-10">
          <div>
            <div className="flex size-11 items-center justify-center rounded-full bg-white/10 text-[#f4c7ae]">
              <BadgeCheck className="size-5" aria-hidden="true" />
            </div>
            <h2 className="mt-5 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">
              Simple enough for a weekly content rhythm.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#deded8]">
              Build posts from assets you already have, keep review in one
              place, and schedule only when the creative is approved.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
            <Link
              href={authHref}
              className="group inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-base font-semibold text-[#1c1c1f] transition-colors duration-200 hover:bg-[#f5eee8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f4c7ae]"
            >
              Start creating
              <ArrowRight
                className="ml-2 size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/20 px-6 text-base font-semibold text-white transition-colors duration-200 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f4c7ae]"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#ebe7df] bg-white px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-9 md:grid-cols-2 lg:grid-cols-[1.4fr_0.85fr_0.85fr_1fr]">
            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full font-semibold text-[#171717] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563eb]"
              >
                <ProductLogoMark className="h-6 w-9" sizes="36px" />
                UGC Pilot
              </Link>
              <p className="mt-4 max-w-sm text-sm leading-6 text-[#66655e]">
                AI-assisted social content creation and scheduling for SaaS,
                mobile app, and digital product teams.
              </p>
            </div>

            <FooterColumn title="Product" links={productFooterLinks} />
            <FooterColumn title="Support" links={supportFooterLinks} />
            <FooterColumn title="Legal" links={legalFooterLinks} />
          </div>

          <div className="mt-10 flex flex-col gap-4 border-t border-[#ebe7df] pt-6 text-sm text-[#686760] md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-2">
              <p>&copy; 2026 UGC Pilot. All rights reserved.</p>
              <p>
                UGC Pilot is independent and is not affiliated with, endorsed
                by, or sponsored by Meta, TikTok, or Google.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 font-medium text-[#30302c]">
              <a
                href="mailto:support@getugcpilot.com"
                className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563eb]"
              >
                support@getugcpilot.com
              </a>
              <a
                href="mailto:privacy@getugcpilot.com"
                className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563eb]"
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

function WorkflowPreview() {
  return (
    <div className="rounded-[18px] border border-[#e6e0d8] bg-white p-3">
      <div className="rounded-[14px] bg-[#f7f4ef] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7e1d9] pb-4">
          <div>
            <p className="text-sm font-semibold text-[#2f2f2b]">
              Spring launch draft
            </p>
            <p className="mt-1 text-xs text-[#706f68]">
              Product demo, carousel, and caption set
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#91502d]">
            Ready for review
          </span>
        </div>

        <div className="grid gap-3 pt-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[12px] bg-white p-4">
            <p className="text-xs font-medium text-[#8c4c2a]">
              Source material
            </p>
            <h3 className="mt-1 text-lg font-semibold leading-tight text-[#1d1d1b]">
              Campaign inputs
            </h3>

            <div className="mt-4 grid gap-2">
              {[
                ["Product walkthrough.mov", "Demo video", "Ready"],
                ["Landing page screenshots", "4 images", "Synced"],
                ["Feature notes", "Creative brief", "Checked"],
              ].map(([title, meta, status]) => (
                <div
                  key={title}
                  className="flex items-center justify-between gap-3 rounded-[10px] bg-[#f7f4ef] px-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#2d2d29]">
                      {title}
                    </p>
                    <p className="mt-0.5 text-xs text-[#77756d]">{meta}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#eef7ef] px-2.5 py-1 text-xs font-medium text-[#287342]">
                    {status}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[10px] border border-[#eee8df] p-3">
              <p className="text-xs font-medium text-[#77756d]">
                Brief focus
              </p>
              <p className="mt-1 text-sm leading-6 text-[#363631]">
                Turn the onboarding demo into a launch post that highlights the
                product value without autopublishing.
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-[12px] bg-white p-4">
              <p className="text-xs font-medium text-[#8c4c2a]">
                Generated drafts
              </p>
              <div className="mt-3 grid gap-2">
                {["UGC hook video", "Carousel post", "Caption set"].map(
                  (item, index) => (
                    <div
                      key={item}
                      className="flex items-center justify-between gap-3 rounded-[10px] bg-[#f7f4ef] px-3 py-2.5"
                    >
                      <span className="text-sm font-medium text-[#2d2d29]">
                        {item}
                      </span>
                      <span className="text-xs text-[#77756d]">
                        {index === 0
                          ? "Needs review"
                          : index === 1
                            ? "5 slides"
                            : "3 variants"}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="rounded-[12px] bg-[#1f1f22] p-4 text-white">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-[#f4c7ae]">
                  Review path
                </p>
                <span className="text-xs text-[#cbc9c2]">Ready next</span>
              </div>
              <div className="mt-3 grid gap-2">
                {[
                  ["Draft creative", true],
                  ["Check rights", true],
                  ["Approve schedule", false],
                ].map(([item, complete]) => (
                  <div key={String(item)} className="flex items-center gap-2 text-sm">
                    <span
                      className={
                        complete
                          ? "flex size-5 items-center justify-center rounded-full bg-[#eff7ef] text-[#287342]"
                          : "flex size-5 items-center justify-center rounded-full border border-white/20 text-xs text-[#f4c7ae]"
                      }
                    >
                      {complete ? (
                        <Check className="size-3.5" aria-hidden="true" />
                      ) : (
                        "3"
                      )}
                      </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApprovalConsole() {
  return (
    <div className="overflow-hidden rounded-[16px] border border-[#e3ddd4] bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#ebe7df] px-5 py-4">
        <div>
          <p className="text-xs font-medium text-[#8c4c2a]">
            Publishing review
          </p>
          <h3 className="mt-1 text-2xl font-semibold leading-tight text-[#171717]">
            Launch draft
          </h3>
        </div>
        <span className="rounded-full bg-[#f5eee8] px-3 py-1.5 text-xs font-medium text-[#8c4c2a]">
          Needs approval
        </span>
      </div>

      <div className="grid md:grid-cols-[0.72fr_1fr]">
        <div className="border-b border-[#ebe7df] bg-[#f7f4ef] p-5 md:border-b-0 md:border-r">
          <div className="rounded-[14px] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[#8c4c2a]">
                  Post preview
                </p>
                <h4 className="mt-1 text-lg font-semibold leading-tight text-[#1d1d1b]">
                  Onboarding demo reel
                </h4>
              </div>
              <span className="rounded-full bg-[#f5eee8] px-2.5 py-1 text-xs font-medium text-[#8c4c2a]">
                Reels
              </span>
            </div>

            <div className="mt-4 rounded-[12px] border border-[#eee8df] bg-[#fbfaf8] p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#292925]">
                    Product walkthrough.mov
                  </p>
                  <p className="mt-1 text-xs text-[#77756d]">
                    00:18 edited clip, caption attached
                  </p>
                </div>
                <FileVideo className="size-5 shrink-0 text-[#a34720]" aria-hidden="true" />
              </div>
              <div className="mt-4 grid gap-2">
                <div className="h-2 rounded-full bg-[#2f2f2b]/70" />
                <div className="h-2 w-4/5 rounded-full bg-[#2f2f2b]/24" />
                <div className="h-2 w-2/3 rounded-full bg-[#2f2f2b]/16" />
              </div>
            </div>

            <div className="mt-4 grid gap-2 text-sm">
              {["Caption reviewed", "Disclosure added", "Schedule pending"].map(
                (item) => (
                  <div
                    key={item}
                    className="flex items-center justify-between gap-3 rounded-[10px] bg-[#f7f4ef] px-3 py-2.5"
                  >
                    <span className="text-[#3f3e39]">{item}</span>
                    <CheckCircle2 className="size-4 text-[#a34720]" aria-hidden="true" />
                  </div>
                ),
              )}
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="grid gap-3">
            <ReviewRow label="Destination" value="Instagram Reels" />
            <ReviewRow label="Caption" value="3 edits applied" />
            <ReviewRow label="Rights" value="Confirmed by user" />
            <ReviewRow label="Disclosure" value="AI-assisted content noted" />
            <ReviewRow label="Publish time" value="Tomorrow, 10:30 AM" />
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link
              href={authHref}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-[#d94f1f] px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#c34419] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563eb]"
            >
              Approve schedule
            </Link>
            <Link
              href={authHref}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-[#d9d3ca] px-5 text-sm font-semibold text-[#242420] transition-colors duration-200 hover:border-[#c7beb1] hover:bg-[#f7f3ed] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563eb]"
            >
              Edit draft
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[10px] bg-[#f7f4ef] px-4 py-3">
      <span className="text-sm text-[#686760]">{label}</span>
      <span className="text-right text-sm font-semibold text-[#1f1f1b]">
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
      <h2 className="text-sm font-semibold text-[#171717]">{title}</h2>
      <nav className="mt-4 flex flex-col gap-3 text-sm text-[#66655e]">
        {links.map((link) => (
          <Link
            key={`${title}-${link.label}`}
            href={link.href}
            className="rounded-full transition-colors duration-200 hover:text-[#171717] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563eb]"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
