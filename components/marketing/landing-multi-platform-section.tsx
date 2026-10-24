import { ArrowRight, Check, Clapperboard, GalleryHorizontalEnd, Scissors } from "lucide-react";
import Link from "next/link";

const outputs = [
  {
    title: "Hook video",
    description: "A short vertical video from a focused prompt and optional reference.",
    icon: Clapperboard,
  },
  {
    title: "Slideshow",
    description: "A sequence of slides that explains one offer from your business context.",
    icon: GalleryHorizontalEnd,
  },
  {
    title: "Edited export",
    description: "Trim, text, and an export of the revision you saved in Edit.",
    icon: Scissors,
  },
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
          <p className="text-sm font-semibold text-primary">One studio</p>
          <h2
            id="multi-platform-heading"
            className="mt-4 text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.045em] text-foreground-strong sm:text-5xl lg:text-[3.5rem]"
          >
            Hook video, slideshow, or a finished edit.
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-muted sm:text-lg">
            Start from the business, make the asset, and review it before you download the version you want to keep.
          </p>
          <ol className="mt-7 space-y-3">
            {["Set the business context", "Generate or edit the asset", "Export the version you approved"].map((step) => (
              <li key={step} className="flex items-start gap-3 text-sm leading-6 text-foreground">
                <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
                {step}
              </li>
            ))}
          </ol>
          <Link
            href="/mcp"
            className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-control text-sm font-semibold text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            Use the same account from Claude or Codex
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <ul className="grid gap-3">
          {outputs.map(({ title, description, icon: Icon }) => (
            <li key={title} className="flex min-h-[88px] items-center gap-4 rounded-[20px] border border-border bg-card p-4 sm:p-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-base font-semibold text-foreground-strong">{title}</p>
                <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
