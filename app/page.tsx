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
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { buttonClassName } from "@/components/ui/button";

const authHref = "/sign-in";
const startHref = authHref;

const navItems = [
  { label: "Product", href: "#product" },
  { label: "Examples", href: "#directions" },
  { label: "Pricing", href: "#final-cta" },
];

const walkthroughSteps = [
  {
    title: "Describe your product",
    description: "Add your product, audience, offer, and goal.",
  },
  {
    title: "Choose a creative direction",
    description:
      "Pick from UGC hooks, carousel concepts, product demos, or avatar-led ideas.",
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
    title: "Problem Hook",
    description:
      "Open with a clear pain point your audience already understands.",
    icon: MessageSquareText,
  },
  {
    title: "Product Demo",
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
    title: "Carousel Ads",
    description:
      "Generate slide-by-slide ad concepts for Instagram-style carousel posts.",
    icon: Layers3,
  },
  {
    title: "Avatar Concepts",
    description: "Plan avatar-led hooks and short-form ad scripts.",
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
    description:
      "You choose what to edit, export, or prepare for publishing.",
  },
];

const safetyPoints = [
  "No automatic posting without user action",
  "Connected accounts are only used with permission",
  "Users can review and edit creative content before publishing",
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="w-full">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-5 py-5 sm:px-8 lg:px-10">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="UGC Studio home"
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-foreground text-white shadow-sm">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-bold tracking-normal text-foreground">
              UGC Studio
            </span>
          </Link>

          <nav className="flex items-center gap-3 text-sm font-semibold text-muted sm:gap-6">
            <div className="hidden items-center gap-6 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="transition hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <Link href={authHref} className="transition hover:text-foreground">
              Sign in
            </Link>
            <Link
              href={startHref}
              className={buttonClassName({
                className: "h-10 rounded-full px-5",
              })}
            >
              Start free
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-7xl flex-col items-center px-5 pb-16 pt-8 text-center sm:px-8 sm:pb-20 sm:pt-12 lg:px-10 lg:pb-24">
        <p className="rounded-full bg-white/70 px-4 py-2 text-sm font-bold text-primary shadow-[0_10px_30px_rgb(16_32_51_/_0.05)] ring-1 ring-border/60">
          AI creative workspace for social ads
        </p>
        <h1 className="mt-6 max-w-5xl text-5xl font-bold leading-[1.04] tracking-normal text-foreground sm:text-6xl lg:text-[4.1rem]">
          Create social-ready ad creatives from your product assets.
        </h1>
        <p className="mt-6 max-w-3xl text-lg font-medium leading-8 text-muted">
          Generate avatar concepts, carousel ad ideas, scripts, and creative
          directions from your product details without starting from a blank
          page.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={authHref}
            className={buttonClassName({
              className:
                "h-13 rounded-full px-7 text-base shadow-[0_18px_36px_rgb(255_107_74_/_0.2)]",
            })}
          >
            Start creating
            <ArrowRight className="ml-2 size-4" aria-hidden="true" />
          </Link>
          <Link
            href="#how-it-works"
            className={buttonClassName({
              variant: "secondary",
              className: "h-13 rounded-full px-7 text-base",
            })}
          >
            See how it works
          </Link>
        </div>
      </section>

      <section id="product" className="px-5 pb-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl rounded-lg bg-white/85 p-6 shadow-soft ring-1 ring-border/70 sm:p-8 lg:p-10">
          <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">
                Product planning
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-normal text-foreground sm:text-4xl">
                How UGC Studio helps you plan ad creatives
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-muted">
                Use a structured workspace to turn product context into ad
                ideas, scripts, carousel concepts, and review-ready creative
                directions.
              </p>
            </div>

            <div className="grid gap-4">
              {walkthroughSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="grid gap-4 rounded-lg border border-border/80 bg-[#fffaf4] p-5 sm:grid-cols-[auto_1fr]"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="directions" className="px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">
              Creative directions
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-normal text-foreground sm:text-4xl">
              Explore creative directions
            </h2>
            <p className="mt-4 text-base leading-7 text-muted">
              Start from structured ad formats instead of a blank page.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {creativeDirections.map((direction) => {
              const Icon = direction.icon;

              return (
                <article
                  key={direction.title}
                  className="rounded-lg border border-border/80 bg-white/80 p-6 shadow-[0_14px_36px_rgb(16_32_51_/_0.05)]"
                >
                  <span className="flex size-11 items-center justify-center rounded-lg bg-card-muted text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-xl font-bold text-foreground">
                    {direction.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    {direction.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="bg-[#fffaf4] px-5 py-20 sm:px-8 lg:px-10"
      >
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">
                Workflow
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-normal text-foreground sm:text-4xl">
                How it works
              </h2>
              <p className="mt-4 text-base leading-7 text-muted">
                A simple process for turning product context into social-ready
                creative ideas you can review before using.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {howItWorksSteps.map((step, index) => (
                <article
                  key={step.title}
                  className="rounded-lg border border-border/80 bg-white p-6"
                >
                  <span className="text-sm font-bold text-primary">
                    Step {index + 1}
                  </span>
                  <h3 className="mt-4 text-xl font-bold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    {step.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-6xl gap-8 rounded-lg border border-border/80 bg-white/80 p-6 shadow-soft sm:p-8 lg:grid-cols-[0.95fr_1.05fr] lg:p-10">
          <div>
            <span className="flex size-12 items-center justify-center rounded-lg bg-card-muted text-primary">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-normal text-foreground sm:text-4xl">
              Built for user-controlled creative workflows
            </h2>
            <p className="mt-4 text-base leading-7 text-muted">
              UGC Studio helps users create and organize ad creatives. Users
              stay in control of what they generate, edit, export, and publish.
            </p>
          </div>

          <div className="grid gap-4">
            {safetyPoints.map((point) => (
              <div
                key={point}
                className="flex gap-3 rounded-lg border border-border/80 bg-[#fffaf4] p-4"
              >
                <CheckCircle2
                  className="mt-0.5 size-5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <p className="text-sm font-semibold leading-6 text-foreground">
                  {point}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="final-cta" className="px-5 pb-24 pt-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl rounded-lg bg-foreground px-6 py-14 text-center text-white shadow-[0_24px_70px_rgb(16_32_51_/_0.16)] sm:px-10">
          <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-white/10 text-primary">
            <Lightbulb className="size-6" aria-hidden="true" />
          </div>
          <h2 className="mx-auto mt-6 max-w-3xl text-3xl font-bold tracking-normal sm:text-4xl">
            Start building your next ad creative
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/72">
            Create structured ad ideas, carousel concepts, and avatar-led
            scripts from your product context.
          </p>
          <Link
            href={authHref}
            className={buttonClassName({
              className: "mt-8 h-13 rounded-full px-7 text-base",
            })}
          >
            Start creating
            <BadgeCheck className="ml-2 size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
