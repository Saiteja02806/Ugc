import type { Metadata } from "next";
import { ArrowRight, BookOpen, Clock3 } from "lucide-react";
import Link from "next/link";

import { LandingAuthCta } from "@/components/marketing/landing-auth-actions";
import { founderGuides } from "@/components/marketing/founder-guide-page";
import { LandingHeader } from "@/components/marketing/landing-header";

export const metadata: Metadata = {
  title: "Marketing Guides for SaaS, Website & App Founders",
  description:
    "Practical marketing guides for SaaS, website, and mobile-app founders who need a clear message, useful content, and a sustainable growth routine.",
  alternates: { canonical: "/guides" },
  openGraph: {
    title: "Marketing Guides for Founders | UGCPilot",
    description:
      "Practical growth and content guides for SaaS, website, and mobile-app founders.",
    url: "/guides",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Marketing Guides for Founders | UGCPilot",
    description:
      "Practical growth and content guides for SaaS, website, and mobile-app founders.",
  },
};

export default function GuidesPage() {
  const guides = Object.values(founderGuides);

  return (
    <main className="instagram-theme min-h-screen overflow-x-hidden bg-background text-foreground">
      <LandingHeader initialHasSession={false} />
      <section className="relative overflow-hidden border-b border-border px-4 pb-16 pt-28 sm:px-6 sm:pb-22 sm:pt-36 lg:px-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_60%_55%_at_50%_0%,rgba(255,107,69,0.15),transparent_76%)]" />
        <div className="mx-auto max-w-[960px] text-center">
          <p className="inline-flex rounded-full border border-primary/35 bg-primary/[0.08] px-3 py-1.5 text-xs font-semibold text-primary">Founder marketing guides</p>
          <h1 className="mt-6 text-4xl font-semibold leading-[0.98] tracking-[-0.05em] text-foreground-strong sm:text-5xl lg:text-6xl">Market the product you worked hard to build.</h1>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-muted sm:text-lg sm:leading-8">Practical guides for founders who need to explain a SaaS product, grow a website, launch a mobile app, and create a marketing rhythm their team can sustain.</p>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-22 lg:px-8">
        <div className="mx-auto max-w-[1200px]">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-sm font-semibold text-primary">Start with the problem</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground-strong sm:text-4xl">Choose the guide that matches the work in front of you.</h2>
            </div>
            <BookOpen className="hidden size-7 text-primary sm:block" aria-hidden="true" />
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {guides.map((guide) => (
              <Link key={guide.slug} href={`/guides/${guide.slug}`} className="group flex min-h-[290px] flex-col rounded-[24px] border border-border bg-card p-6 shadow-card transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-floating focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{guide.keyword}</p>
                <h2 className="mt-4 text-xl font-semibold leading-7 tracking-[-0.025em] text-foreground-strong">{guide.title}</h2>
                <p className="mt-3 text-sm leading-6 text-muted">{guide.description}</p>
                <span className="mt-auto pt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">Read guide <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card-muted/45 px-4 py-16 sm:px-6 sm:py-22 lg:px-8">
        <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div>
            <p className="text-sm font-semibold text-primary">A practical system</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground-strong sm:text-4xl">Build from your product knowledge.</h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted">The guide library helps you identify the message, shape it into content, and connect that content to the right product outcome.</p>
          </div>
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              ["01", "Name the customer problem"],
              ["02", "Explain the outcome clearly"],
              ["03", "Create and review the content"],
            ].map(([number, label]) => (
              <li key={number} className="rounded-[20px] border border-border bg-card p-5 shadow-card">
                <p className="font-mono text-xs font-bold text-primary">{number}</p>
                <p className="mt-5 text-sm font-semibold leading-6 text-foreground-strong">{label}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-4 pb-18 pt-16 sm:px-6 sm:pb-24 sm:pt-22 lg:px-8">
        <div className="mx-auto max-w-[1200px] rounded-[28px] border border-primary/30 bg-[linear-gradient(130deg,rgba(255,107,69,0.18),rgba(255,107,69,0.05)_58%,rgba(255,255,255,0.02))] px-6 py-10 shadow-floating sm:px-10 sm:py-14 lg:px-14">
          <div className="flex items-center gap-2 text-sm font-medium text-primary"><Clock3 className="size-4" aria-hidden="true" />Turn one useful idea into this week’s content.</div>
          <h2 className="mt-5 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-foreground-strong sm:text-4xl">Bring the business context and the creative work into one place.</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted">Use UGCPilot to create carousels, short videos, and text-led content from the product knowledge your team already has.</p>
          <div className="mt-8"><LandingAuthCta className="group inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background" initialHasSession={false} /></div>
        </div>
      </section>
    </main>
  );
}
