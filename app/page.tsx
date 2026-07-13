import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Compass,
  FileText,
  Layers3,
  Lightbulb,
  MessageSquareText,
  PenLine,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { ProductLogoMark } from "@/components/brand/product-logo";

const authHref = "/sign-in";
const startHref = authHref;

const navItems = [
  { label: "Product", href: "#product" },
  { label: "Workflow", href: "#directions" },
  { label: "Pricing", href: "#final-cta" },
];

const walkthroughSteps = [
  {
    title: "Describe your product",
    description: "Add your product, audience, offer, and campaign goal.",
  },
  {
    title: "Choose a creative direction",
    description:
      "Pick from UGC hooks, carousel concepts, product demos, or influencer-led ideas.",
  },
  {
    title: "Generate creative options",
    description: "Get multiple angles, scripts, slides, and text variations.",
  },
  {
    title: "Review and refine",
    description:
      "Compare options, edit the content, and prepare assets for your campaign.",
  },
];

const creativeDirections = [
  {
    title: "Problem hook",
    description:
      "Open with a clear pain point your audience already understands.",
    icon: MessageSquareText,
  },
  {
    title: "Product demo",
    description:
      "Turn product features into simple demo-style creative ideas.",
    icon: FileText,
  },
  {
    title: "Founder POV",
    description: "Frame the product through a direct, human explanation.",
    icon: PenLine,
  },
  {
    title: "Carousel ads",
    description:
      "Generate slide-by-slide ad concepts for Instagram-style carousel posts.",
    icon: Layers3,
  },
  {
    title: "UGC hooks",
    description: "Plan influencer-led hooks and short-form ad scripts.",
    icon: Compass,
  },
];

const howItWorksSteps = [
  {
    title: "Add product context",
    description: "Share your website, product idea, audience, and goal.",
  },
  {
    title: "Generate creative directions",
    description:
      "The app creates hooks, carousel concepts, scripts, and visual directions.",
  },
  {
    title: "Review before using",
    description: "You choose what to edit, export, or prepare for publishing.",
  },
];

const safetyPoints = [
  "No automatic posting without user action",
  "Connected accounts are only used with permission",
  "Users review rights and disclosures before publishing",
];

const footerLinks = [
  { label: "Product", href: "#product" },
  { label: "Workflow", href: "#directions" },
  { label: "Pricing", href: "#final-cta" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Data deletion", href: "/data-deletion" },
  { label: "Contact", href: "/contact" },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f7f8] text-[#1b1b1f]">
      <header className="sticky top-0 z-40 w-full px-4 pt-5 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex h-[62px] w-full max-w-[1120px] items-center justify-between gap-5 rounded-full border border-[#dfdfe4] bg-white/92 px-4 shadow-[0_14px_36px_rgb(24_24_27_/_0.08)] sm:px-6">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3"
            aria-label="UGC Pilot home"
          >
            <ProductLogoMark className="h-8 w-12" sizes="52px" />
            <span className="truncate text-base font-bold tracking-normal text-[#18181b] sm:text-lg">
              UGC Pilot
            </span>
          </Link>

          <nav
            className="hidden items-center gap-6 text-sm font-semibold text-[#565760] md:flex"
            aria-label="Primary navigation"
          >
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="transition duration-200 hover:text-[#18181b]"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={authHref}
              className="transition duration-200 hover:text-[#18181b]"
            >
              Sign in
            </Link>
            <Link
              href={startHref}
              className="inline-flex h-11 items-center justify-center rounded-full bg-[#ff5a1f] px-5 text-sm font-bold text-white shadow-[0_12px_26px_rgb(255_90_31_/_0.24)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#e64b14]"
            >
              Start free
            </Link>
          </nav>

          <details className="group relative md:hidden">
            <summary className="list-none rounded-full border border-[#dfdfe4] px-4 py-2 text-sm font-bold text-[#26262b] transition hover:border-[#ffb493] hover:bg-[#fff4ee] [&::-webkit-details-marker]:hidden">
              Menu
            </summary>
            <div className="absolute right-0 top-12 w-52 rounded-2xl border border-[#dfdfe4] bg-white p-2 shadow-[0_18px_44px_rgb(24_24_27_/_0.12)]">
              {[...navItems, { label: "Sign in", href: authHref }].map(
                (item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-[#565760] transition hover:bg-[#fff4ee] hover:text-[#18181b]"
                  >
                    {item.label}
                  </Link>
                ),
              )}
              <Link
                href={startHref}
                className="mt-1 flex h-10 items-center justify-center rounded-full bg-[#ff5a1f] px-4 text-sm font-bold text-white"
              >
                Start free
              </Link>
            </div>
          </details>
        </div>
      </header>

      <section className="relative bg-[#fbfbfc] px-5 pb-16 pt-20 text-center sm:px-8 sm:pb-20 sm:pt-24 lg:px-10">
        <div
          className="pointer-events-none absolute left-1/2 top-24 h-72 w-[min(620px,92vw)] -translate-x-1/2 rounded-full opacity-70 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgb(255 90 31 / 0.12), rgb(255 90 31 / 0.03) 45%, transparent 72%)",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto flex max-w-[780px] flex-col items-center">
          <p className="hero-rise rounded-full border border-[#ffd4c2] bg-white px-4 py-2 text-sm font-bold text-[#b84010] shadow-[0_8px_18px_rgb(24_24_27_/_0.04)]">
            Social video creation and scheduling platform
          </p>
          <h1 className="hero-rise hero-rise-delay-1 mt-6 max-w-[760px] text-5xl font-black leading-[0.96] tracking-normal text-[#17171b] sm:text-6xl lg:text-[4.25rem]">
            Create and schedule
            <span className="block">social videos from</span>
            <span className="block">your product assets.</span>
          </h1>
          <p className="hero-rise hero-rise-delay-2 mt-6 max-w-[610px] text-base font-medium leading-7 text-[#52535c] sm:text-lg sm:leading-8">
            UGC Pilot helps SaaS and mobile app teams turn product demos,
            screen recordings, UGC hooks, and AI-assisted creative into posts
            they can review, approve, and prepare for TikTok, Instagram, and
            YouTube.
          </p>
          <div className="hero-rise hero-rise-delay-3 mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            <Link
              href={authHref}
              className="group inline-flex h-[52px] w-full items-center justify-center rounded-full bg-[#ff5a1f] px-7 text-base font-bold text-white shadow-[0_16px_32px_rgb(255_90_31_/_0.24)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#e64b14] sm:w-auto"
            >
              Start creating
              <ArrowRight
                className="ml-2 size-4 transition duration-200 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex h-[52px] w-full items-center justify-center rounded-full border border-[#d8d8df] bg-white px-7 text-base font-bold text-[#24242a] shadow-[0_8px_18px_rgb(24_24_27_/_0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[#ffb493] sm:w-auto"
            >
              See how it works
            </Link>
          </div>
        </div>
      </section>

      <section id="product" className="px-5 pb-12 pt-4 sm:px-8 lg:px-10">
        <div className="landing-reveal mx-auto max-w-6xl rounded-[28px] border border-[#e7e2df] bg-[#fffefd] p-6 shadow-[0_18px_46px_rgb(24_24_27_/_0.06)] sm:p-8 lg:p-10">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="text-sm font-bold text-[#c2410c]">
                Product planning
              </p>
              <h2 className="mt-3 max-w-xl text-3xl font-black leading-[1.04] tracking-normal text-[#19191d] sm:text-4xl lg:text-5xl">
                How UGC Pilot helps you prepare social content
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#555660]">
                Use a structured workspace to turn product context, uploaded
                media, and campaign goals into review-ready videos, carousel
                concepts, scripts, and publishing drafts.
              </p>
            </div>

            <div className="relative grid gap-3">
              <div
                className="absolute bottom-8 left-[22px] top-8 hidden w-px bg-[#ffd1bd] sm:block"
                aria-hidden="true"
              />
              {walkthroughSteps.map((step, index) => (
                <article
                  key={step.title}
                  className="group relative grid gap-4 rounded-2xl border border-[#ffe0d1] bg-[#fff6f1] p-4 transition duration-200 hover:translate-x-1 hover:border-[#ffb493] sm:grid-cols-[auto_1fr] sm:p-5"
                >
                  <span className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-[#c2410c] ring-1 ring-[#ffd6c4] transition duration-200 group-hover:bg-[#ff5a1f] group-hover:text-white">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-lg font-black leading-tight text-[#202025]">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-6 text-[#5a5b64]">
                      {step.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="directions" className="px-5 py-16 sm:px-8 lg:px-10">
        <div className="landing-reveal mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold text-[#c2410c]">
              Creative directions
            </p>
            <h2 className="mt-3 text-3xl font-black leading-[1.04] tracking-normal text-[#19191d] sm:text-4xl lg:text-5xl">
              Explore creative directions
            </h2>
            <p className="mt-4 text-base leading-7 text-[#555660]">
              Start from structured social formats instead of a blank page.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {creativeDirections.map((direction) => {
              const Icon = direction.icon;

              return (
                <Link
                  key={direction.title}
                  href={authHref}
                  className="group flex min-h-[224px] flex-col rounded-[20px] border border-[#e2e2e7] bg-white p-5 shadow-[0_8px_18px_rgb(24_24_27_/_0.035)] transition duration-200 hover:-translate-y-1.5 hover:border-[#ffb493]"
                >
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-[#fff4ee] text-[#c2410c] transition duration-200 group-hover:bg-[#ff5a1f] group-hover:text-white">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-lg font-black leading-tight text-[#202025]">
                    {direction.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[#5a5b64]">
                    {direction.description}
                  </p>
                  <span className="mt-auto flex justify-end pt-5 text-[#c2410c]">
                    <ArrowRight
                      className="size-4 transition duration-200 group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="px-5 py-12 sm:px-8 lg:px-10">
        <div className="landing-reveal mx-auto max-w-6xl rounded-[28px] bg-[#fff3ed] p-6 shadow-[inset_0_0_0_1px_rgb(255_204_180_/_0.7)] sm:p-8 lg:p-10">
          <div className="grid gap-9 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
            <div>
              <p className="text-sm font-bold text-[#c2410c]">Workflow</p>
              <h2 className="mt-3 text-3xl font-black leading-[1.04] tracking-normal text-[#19191d] sm:text-4xl lg:text-5xl">
                How it works
              </h2>
              <p className="mt-5 text-base leading-7 text-[#555660]">
              A simple process for turning product context and media into
                social-ready posts you can review before using.
              </p>
            </div>

            <div className="relative grid gap-4 md:grid-cols-3">
              <div
                className="absolute left-[16%] right-[16%] top-10 hidden border-t border-dashed border-[#ffb493] md:block"
                aria-hidden="true"
              />
              {howItWorksSteps.map((step, index) => (
                <article
                  key={step.title}
                  className="relative rounded-[18px] border border-[#ebe6e3] bg-white p-5 shadow-[0_8px_18px_rgb(24_24_27_/_0.035)]"
                >
                  <span className="relative z-10 flex size-10 items-center justify-center rounded-full bg-[#fff4ee] text-sm font-black text-[#c2410c] ring-4 ring-[#fff3ed]">
                    {index + 1}
                  </span>
                  <p className="mt-5 text-sm font-bold text-[#c2410c]">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-2 text-lg font-black leading-tight text-[#202025]">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[#5a5b64]">
                    {step.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-10">
        <div className="landing-reveal mx-auto grid max-w-6xl gap-8 rounded-[28px] border border-[#e7e2df] bg-white p-6 shadow-[0_18px_46px_rgb(24_24_27_/_0.05)] sm:p-8 lg:grid-cols-[0.92fr_1.08fr] lg:p-10">
          <div>
            <span className="flex size-12 items-center justify-center rounded-2xl bg-[#fff4ee] text-[#c2410c]">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-3xl font-black leading-[1.04] tracking-normal text-[#19191d] sm:text-4xl lg:text-5xl">
              Built for user-controlled creative workflows
            </h2>
            <p className="mt-5 text-base leading-7 text-[#555660]">
              UGC Pilot helps users create, organize, and schedule social
              content. Users stay in control of what they upload, generate,
              edit, approve, and publish.
            </p>
          </div>

          <div className="grid content-center gap-3">
            {safetyPoints.map((point) => (
              <div
                key={point}
                className="group flex gap-3 rounded-2xl bg-[#fff8f4] p-4 transition duration-200 hover:bg-[#fff1e8]"
              >
                <CheckCircle2
                  className="mt-0.5 size-5 shrink-0 text-[#c2410c]"
                  aria-hidden="true"
                />
                <p className="text-sm font-bold leading-6 text-[#2d2d32]">
                  {point}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="final-cta" className="px-5 pb-14 pt-4 sm:px-8 lg:px-10">
        <div className="landing-reveal mx-auto max-w-5xl rounded-[28px] bg-[#202024] px-6 py-12 text-center text-white shadow-[0_24px_58px_rgb(24_24_27_/_0.18)] sm:px-10 sm:py-14">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#ff5a1f] text-white shadow-[0_12px_26px_rgb(255_90_31_/_0.22)]">
            <Lightbulb className="size-6" aria-hidden="true" />
          </div>
          <h2 className="mx-auto mt-6 max-w-3xl text-3xl font-black leading-[1.05] tracking-normal text-white sm:text-4xl lg:text-5xl">
            Start preparing your next social post
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#d9d9df]">
            Create structured UGC hooks, product-demo edits, carousel concepts,
            and publishing drafts from your product context.
          </p>
          <Link
            href={authHref}
            className="group mt-8 inline-flex h-[52px] items-center justify-center rounded-full bg-[#ff5a1f] px-7 text-base font-bold text-white shadow-[0_16px_32px_rgb(255_90_31_/_0.24)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#e64b14]"
          >
            Start creating
            <BadgeCheck
              className="ml-2 size-4 transition duration-200 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>
      </section>

      <footer className="px-5 pb-8 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 border-t border-[#e2e2e7] pt-6 text-sm text-[#5a5b64] md:flex-row md:items-center md:justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-black text-[#19191d]"
          >
            <ProductLogoMark className="h-5 w-7" sizes="28px" />
            UGC Pilot
          </Link>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 font-semibold">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition hover:text-[#19191d]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <p>&copy; 2026 UGC Pilot</p>
        </div>
      </footer>
    </main>
  );
}
