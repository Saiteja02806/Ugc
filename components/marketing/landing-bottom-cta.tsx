import {
  ArrowDown,
  CreditCard,
  Repeat,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { LandingAuthCta } from "@/components/marketing/landing-auth-actions";
import { SocialPlatformIcon } from "@/components/social/platform-icon";

export function LandingBottomCta() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="mx-auto overflow-hidden rounded-[24px] border border-border bg-card shadow-card">
        <div className="grid max-w-[1200px] lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          {/* Left Column: Value Prop & CTA */}
          <div className="p-7 sm:p-10 lg:p-14">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-control bg-[linear-gradient(135deg,var(--instagram-orange),var(--instagram-rose),var(--instagram-violet))] text-white shadow-sm">
                <Users className="size-4.5" aria-hidden="true" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Multi-Account Direct Publishing
              </span>
            </div>

            <h2 className="mt-6 max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.035em] text-foreground-strong sm:text-5xl">
              Connect multiple Instagram accounts. Multiply your reach.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
              Connect your main brand, clip channels, and niche growth accounts in one unified workspace. Publish your ready viral Reel hooks, text videos, and carousels across multiple accounts in seconds to get double the views and organic attention.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <LandingAuthCta className="group inline-flex h-12 items-center justify-center rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" />
            </div>

            {/* Trust Badges */}
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-muted">
              <span className="flex items-center gap-1.5">
                <Zap className="size-3.5 text-amber-500" aria-hidden="true" />
                <span>2-minute setup</span>
              </span>
              <span className="text-border-strong">•</span>
              <span className="flex items-center gap-1.5">
                <CreditCard className="size-3.5 text-primary" aria-hidden="true" />
                <span>No credit card required</span>
              </span>
              <span className="text-border-strong">•</span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-emerald-500" aria-hidden="true" />
                <span>100% human approval</span>
              </span>
            </div>
          </div>

          {/* Right Column: Connect → Multi-Post Flow Mockup */}
          <div className="relative flex flex-col items-center justify-center border-t border-border bg-card-muted/60 p-6 sm:p-10 lg:border-l lg:border-t-0">
            <div className="w-full max-w-md space-y-4">
              {/* Top Card: Connected Accounts Box */}
              <div className="rounded-[18px] border border-border bg-card p-4 shadow-card">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-md bg-primary/10">
                      <SocialPlatformIcon platform="instagram" className="size-4" />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground-strong">
                      Connected Instagram Accounts
                    </span>
                  </div>
                  <span className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    3 Active
                  </span>
                </div>

                {/* Account List Grid */}
                <div className="mt-3 space-y-2">
                  {/* Account 1 */}
                  <div className="flex items-center justify-between rounded-control border border-border bg-card-muted/60 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-6 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white text-[10px] font-bold">
                        1
                      </div>
                      <div>
                        <p className="font-semibold text-foreground-strong">@yourbrand.main</p>
                        <p className="text-[10px] text-muted">Primary Brand Account</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Connected ✓</span>
                  </div>

                  {/* Account 2 */}
                  <div className="flex items-center justify-between rounded-control border border-border bg-card-muted/60 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-6 items-center justify-center rounded-full bg-gradient-to-tr from-purple-600 via-rose-500 to-amber-500 text-white text-[10px] font-bold">
                        2
                      </div>
                      <div>
                        <p className="font-semibold text-foreground-strong">@yourbrand.reels</p>
                        <p className="text-[10px] text-muted">Viral Clips & Hooks</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Connected ✓</span>
                  </div>

                  {/* Account 3 */}
                  <div className="flex items-center justify-between rounded-control border border-border bg-card-muted/60 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-6 items-center justify-center rounded-full bg-gradient-to-tr from-rose-500 via-amber-500 to-purple-600 text-white text-[10px] font-bold">
                        3
                      </div>
                      <div>
                        <p className="font-semibold text-foreground-strong">@yourbrand.daily</p>
                        <p className="text-[10px] text-muted">Slideshows & Growth</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Connected ✓</span>
                  </div>
                </div>
              </div>

              {/* Connecting Flow Pipeline Indicator */}
              <div className="flex flex-col items-center justify-center gap-1 py-1">
                <div className="h-4 w-0.5 border-l-2 border-dashed border-primary/50" />
                <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-card px-3 py-1 text-[11px] font-semibold text-primary shadow-sm">
                  <Repeat className="size-3" />
                  <span>1-Click Multi-Account Distribution</span>
                  <ArrowDown className="size-3" />
                </div>
                <div className="h-4 w-0.5 border-l-2 border-dashed border-primary/50" />
              </div>

              {/* Bottom Card: Multi-Post Distribution Result */}
              <div className="rounded-[18px] border-2 border-primary/30 bg-card p-4 shadow-floating ring-1 ring-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-md bg-selected text-primary">
                      <TrendingUp className="size-3.5" />
                    </span>
                    <span className="text-xs font-bold text-foreground-strong">
                      Simultaneous Post Dispatch
                    </span>
                  </div>
                  <span className="rounded-full bg-selected px-2.5 py-0.5 text-[10px] font-bold text-primary">
                    2.8x View Multiplier
                  </span>
                </div>

                <div className="mt-3 rounded-control border border-border bg-card-muted/60 p-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground-strong">Ready Post: &quot;3 Morning Habits...&quot;</span>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      POSTED ✓
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted">
                    Published across all 3 accounts in 60s with custom tailored captions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
