import { ArrowRight, ExternalLink, Info } from "lucide-react";

import { SocialPlatformIcon } from "@/components/social/platform-icon";

const META_INSTAGRAM_PROFESSIONAL_ACCOUNT_HELP =
  "https://www.facebook.com/help/instagram/2358103564437429";
const INSTAGRAM_PROFESSIONAL_ACCOUNT_STEPS = [
  [
    "1",
    "Open your profile",
    "In Instagram, open the profile you want to connect.",
  ],
  ["2", "Find account tools", "Tap ☰, then Account type and tools."],
  [
    "3",
    "Switch account type",
    "Tap Switch to professional account and choose a category.",
  ],
  [
    "4",
    "Choose and reconnect",
    "Select Creator or Business, finish setup, then return and connect again.",
  ],
] as const;

export function InstagramProfessionalAccountGuide({
  className = "",
}: {
  className?: string;
}) {
  return (
    <section
      aria-label="Instagram professional account setup"
      aria-live="polite"
      role="alert"
      className={`overflow-hidden rounded-[var(--radius-control)] border border-border-strong bg-card shadow-sm ${className}`}
    >
      <div className="flex items-start gap-3 border-b border-border bg-brand-soft/60 px-4 py-4 sm:px-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#f58529,#dd2a7b_55%,#8134af)] shadow-sm">
          <SocialPlatformIcon
            aria-hidden="true"
            className="size-5 !text-white"
            platform="instagram"
          />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9d174d] dark:text-pink-300">
            One setting to change
          </p>
          <h3 className="mt-1 text-base font-bold text-foreground-strong">
            Switch this Instagram account to professional
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            UGC Pilot can publish only to Instagram Creator or Business
            accounts. A personal account cannot be connected for publishing.
          </p>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-5">
        <ol className="grid gap-3 sm:grid-cols-2">
          {INSTAGRAM_PROFESSIONAL_ACCOUNT_STEPS.map(
            ([number, title, description]) => (
              <li key={number} className="flex min-w-0 gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#9d174d] text-xs font-bold text-white dark:bg-pink-300 dark:text-[#29111f]">
                  {number}
                </span>
                <div>
                  <p className="text-sm font-bold text-foreground-strong">
                    {title}
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-muted">
                    {description}
                  </p>
                </div>
              </li>
            ),
          )}
        </ol>

        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex max-w-xl items-start gap-2 text-xs leading-5 text-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            Creator is best for an individual; Business is best for a brand or
            company. Professional accounts are public.
          </p>
          <a
            href={META_INSTAGRAM_PROFESSIONAL_ACCOUNT_HELP}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-sm text-sm font-bold text-[#9d174d] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-card dark:text-pink-300"
          >
            View Instagram help
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        </div>

        <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-foreground">
          After switching, return here and select Connect or Reconnect.
          <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
        </p>
      </div>
    </section>
  );
}
