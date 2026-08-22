import { Check } from "lucide-react";

export function LandingComparisonSection() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-[940px]">
        {/* Section Header */}
        <div className="mx-auto max-w-xl text-center">
          <p className="text-sm font-semibold text-primary">
            Why UGCPilot
          </p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.035em] text-foreground-strong sm:text-4xl">
            Stop spending hours crafting viral formats manually.
          </h2>
          <p className="mx-auto mt-3.5 max-w-lg text-sm leading-6 text-muted sm:text-base">
            UGCPilot analyzes your business to generate ready-to-post Reel hooks, Wall-of-Text videos, and slideshows daily. Review in seconds, manage multiple accounts, and scale your organic marketing.
          </p>
        </div>

        {/* Grind vs Flow Comparison Matrix */}
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {/* ========================================================= */}
          {/* Left: The Manual Creation Grind */}
          {/* ========================================================= */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-[22px] border border-border bg-card p-5 sm:p-6 shadow-card">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                    Manual Workflow
                  </span>
                  <h3 className="mt-0.5 text-xl font-semibold text-foreground-strong">
                    Hours Spent per Post
                  </h3>
                </div>
                <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-red-500">
                  Manual grind
                </span>
              </div>

              {/* Tool Chain Pipeline */}
              <div className="mt-4 rounded-card border border-border bg-card-muted/70 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Fragmented Creation Routine:
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-foreground">
                  <span className="rounded-control bg-card px-2 py-0.5 border border-border">Brainstorm</span>
                  <span className="text-muted">→</span>
                  <span className="rounded-control bg-card px-2 py-0.5 border border-border">Scripting</span>
                  <span className="text-muted">→</span>
                  <span className="rounded-control bg-card px-2 py-0.5 border border-border">Canva / Editing</span>
                  <span className="text-muted">→</span>
                  <span className="rounded-control bg-card px-2 py-0.5 border border-border">Manual Post</span>
                </div>
              </div>

              {/* Pain points list with real emotion emojis */}
              <ul className="mt-5 space-y-3 text-xs leading-relaxed text-muted">
                <li className="flex items-start gap-2.5">
                  <span className="text-base leading-none select-none mt-0.5" aria-hidden="true">
                    🤯
                  </span>
                  <span>Struggling to brainstorm high-converting viral hooks and angles for your business daily</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-base leading-none select-none mt-0.5" aria-hidden="true">
                    😩
                  </span>
                  <span>Hours spent finding aesthetic B-roll and aligning text-on-screen videos manually</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-base leading-none select-none mt-0.5" aria-hidden="true">
                    😵‍💫
                  </span>
                  <span>Designing and formatting multi-slide Instagram carousels from scratch in Canva</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-base leading-none select-none mt-0.5" aria-hidden="true">
                    😅
                  </span>
                  <span>Juggling multiple Instagram logins and manual scheduling routines across accounts</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 rounded-control border border-border bg-card-muted p-2.5 text-center text-[11px] font-medium text-muted">
              😫 High creative burnout, slow turnaround, and inconsistent posting cadence
            </div>
          </div>

          {/* ========================================================= */}
          {/* Right: The UGCPilot Flow (Clean Orange Outline Only, No Inner Glow) */}
          {/* ========================================================= */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-[22px] border-2 border-primary bg-card p-5 sm:p-6 shadow-card">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                    The UGCPilot Flow
                  </span>
                  <h3 className="mt-0.5 text-xl font-semibold text-foreground-strong">
                    Ready to Post in 60 Seconds
                  </h3>
                </div>
                <span className="rounded-full border border-primary/30 bg-card px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  All-in-one
                </span>
              </div>

              {/* Tool Chain Pipeline */}
              <div className="mt-4 rounded-card border border-border bg-card-muted/70 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                  Automated Content Pipeline:
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-foreground">
                  <span className="rounded-control bg-card px-2 py-0.5 border border-primary/30 text-primary font-semibold">Business Analysis</span>
                  <span className="text-primary font-bold">→</span>
                  <span className="rounded-control bg-primary text-primary-foreground px-2 py-0.5 font-semibold">Ready Formats</span>
                  <span className="text-primary font-bold">→</span>
                  <span className="rounded-control bg-card px-2 py-0.5 border border-primary/30 text-primary font-semibold">Multi-Account Post</span>
                </div>
              </div>

              {/* Value capabilities list */}
              <ul className="mt-5 space-y-3 text-xs leading-relaxed text-foreground">
                <li className="flex items-start gap-2.5">
                  <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary mt-0.5">
                    <Check className="size-3" aria-hidden="true" />
                  </span>
                  <span><strong>Automated Business Analysis</strong> creates tailored viral hooks and angles for your niche</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary mt-0.5">
                    <Check className="size-3" aria-hidden="true" />
                  </span>
                  <span><strong>All 3 High-Performing Formats</strong> ready daily: Reel Hooks, Wall-of-Text & Slideshows</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary mt-0.5">
                    <Check className="size-3" aria-hidden="true" />
                  </span>
                  <span><strong>Explore Library</strong> to view and choose high-performing Hook and Wall-of-Text videos</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary mt-0.5">
                    <Check className="size-3" aria-hidden="true" />
                  </span>
                  <span><strong>Multi-Account Direct Publishing</strong> to grow followers and scale reach across accounts</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 rounded-control border border-border bg-card-muted p-2.5 text-center text-[11px] font-semibold text-primary">
              1 unified workspace from business analysis to published Instagram posts
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
