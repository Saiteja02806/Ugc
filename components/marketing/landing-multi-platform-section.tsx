import { ArrowDown, ArrowRight, CalendarCheck, Check, MousePointer2 } from "lucide-react";
import Image from "next/image";

import {
  LandingPlatformMark,
  landingPlatforms,
} from "@/components/marketing/landing-platforms";
import { visibleSocialPlatformList } from "@/lib/social/platform-visibility";

const publishingSteps = [
  "Choose your connected accounts",
  "Review your video and publishing details",
  "Confirm one schedule for your selected platforms",
];

export function LandingMultiPlatformSection() {
  return (
    <section
      id="multi-platform"
      aria-labelledby="multi-platform-heading"
      className="relative z-10 scroll-mt-24 border-t border-border bg-background px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
    >
      <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-16">
        <div>
          <p className="text-sm font-semibold text-primary">One-click multi-platform</p>
          <h2
            id="multi-platform-heading"
            className="mt-4 text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.045em] text-foreground-strong sm:text-5xl lg:text-[3.5rem]"
          >
            One post.<br />
            <span className="text-primary">{landingPlatforms.length === 3 ? "Three" : "Two"} platforms.</span>
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-muted sm:text-lg">
            Your next video can go further. Send it to {visibleSocialPlatformList}
            {" "}from the same workspace, with one final confirmation.
          </p>
          <ol className="mt-7 space-y-3">
            {publishingSteps.map((step) => (
              <li key={step} className="flex items-start gap-3 text-sm leading-6 text-foreground">
                <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
                {step}
              </li>
            ))}
          </ol>
          <a
            href="#workflow"
            className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-control text-sm font-semibold text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            Explore the full workflow
            <ArrowRight className="size-4" aria-hidden="true" />
          </a>
        </div>

        <figure className="min-w-0 rounded-[28px] border border-border bg-card-muted/45 p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground-strong">One video, your chosen destinations</p>
            <span className="shrink-0 font-mono text-[10px] text-muted">PREVIEW</span>
          </div>

          <div className="mt-6 grid items-center gap-4 sm:grid-cols-[minmax(0,0.8fr)_40px_minmax(0,1fr)] sm:gap-0">
            <div className="mx-auto flex w-full items-center overflow-hidden rounded-[18px] border border-border-strong bg-card shadow-card sm:block sm:max-w-[190px]">
              <div className="relative aspect-[4/5] w-20 shrink-0 overflow-hidden bg-black sm:w-auto">
                <Image
                  src="/marketing/showcase/hook-preview-poster-v3.webp"
                  alt=""
                  fill
                  sizes="190px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" aria-hidden="true" />
                <span className="absolute bottom-3 left-3 hidden items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-semibold text-white sm:inline-flex">
                  <Check className="size-3" aria-hidden="true" />
                  Reviewed by you
                </span>
              </div>
              <div className="p-3">
                <p className="mb-1 flex items-center gap-1 text-[10px] text-primary sm:hidden">
                  <Check className="size-3" aria-hidden="true" />
                  Reviewed by you
                </p>
                <p className="text-sm font-semibold text-foreground-strong">Your next brand video</p>
                <p className="mt-1 text-xs text-muted">Ready to schedule</p>
              </div>
            </div>

            <ArrowDown className="mx-auto size-5 text-primary sm:hidden" aria-hidden="true" />
            <svg
              viewBox="0 0 40 252"
              className="hidden h-[252px] w-10 text-primary/60 sm:block"
              fill="none"
              aria-hidden="true"
            >
              <path d={landingPlatforms.length === 3 ? "M0 126H14M14 42V210M14 42H36M14 126H36M14 210H36" : "M0 126H14M14 84V168M14 84H36M14 168H36"} stroke="currentColor" strokeWidth="1.5" />
              <path d={landingPlatforms.length === 3 ? "m32 38 4 4-4 4m0 76 4 4-4 4m0 76 4 4-4 4" : "m32 80 4 4-4 4m0 76 4 4-4 4"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            <ul className="grid gap-3" aria-label="Example selected publishing destinations">
              {landingPlatforms.map(({ platform, label, destination }) => (
                <li key={platform} className="flex min-h-[72px] min-w-0 items-center gap-3 rounded-[16px] border border-border bg-card p-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background">
                    <LandingPlatformMark platform={platform} className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground-strong">{label}</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-muted">{destination}</p>
                  </div>
                  <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                </li>
              ))}
            </ul>
          </div>

          <figcaption className="mt-6 border-t border-border pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-xs text-muted">
                <CalendarCheck className="size-4 text-primary" aria-hidden="true" />
                One schedule. You choose when.
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
                <MousePointer2 className="size-3.5" aria-hidden="true" />
                Confirm schedule
              </span>
            </div>
            <p className="mt-4 text-[11px] leading-5 text-muted">
              Publishing preview for supported videos. Instagram requires a
              professional account. Available formats vary by platform.
            </p>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
