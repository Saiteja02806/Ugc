import type { ReactNode } from "react";
import Link from "next/link";

import { ProductLogoMark } from "@/components/brand/product-logo";

const publicLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Data Deletion", href: "/data-deletion" },
  { label: "Acceptable Use", href: "/acceptable-use" },
  { label: "Cookie Policy", href: "/cookies" },
  { label: "Contact", href: "/contact" },
];

type LegalPageProps = {
  children: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
  updated?: string;
};

type LegalSectionProps = {
  children: ReactNode;
  title: string;
};

export function LegalPageShell({
  children,
  description,
  eyebrow,
  title,
  updated = "Effective July 13, 2026",
}: LegalPageProps) {
  return (
    <main className="instagram-theme min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-4 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-3 rounded-control font-semibold text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="UGC Pilot home"
          >
            <ProductLogoMark
              className="size-9 rounded-control bg-primary p-2"
              imageClassName="brightness-0 invert"
              sizes="36px"
            />
            <span>UGCPilot</span>
            <span className="hidden border-l border-border pl-3 text-xs font-medium text-muted sm:inline">
              for Instagram
            </span>
          </Link>
          <nav
            className="-mx-2 flex w-full min-w-0 max-w-full gap-1 overflow-x-auto px-2 pb-1 text-sm font-semibold text-muted [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:w-auto md:px-0 md:pb-0"
            aria-label="Public pages"
          >
            {publicLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="shrink-0 rounded-lg px-2.5 py-2 transition-colors hover:bg-card-muted hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div
        aria-hidden="true"
        className="h-px bg-[linear-gradient(90deg,transparent_8%,var(--instagram-orange)_32%,var(--instagram-rose)_58%,var(--instagram-violet)_78%,transparent_94%)] opacity-80"
      />

      <section className="border-b border-border bg-card-muted/35 px-5 py-12 sm:px-8 sm:py-14 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <p className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.14em] text-primary">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full bg-[linear-gradient(135deg,var(--instagram-orange),var(--instagram-rose),var(--instagram-violet))]"
            />
            <span>{eyebrow}</span>
          </p>
          <h1 className="mt-4 max-w-3xl text-balance text-4xl font-bold leading-[1.04] tracking-[-0.035em] text-foreground-strong sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-3xl text-pretty text-base leading-7 text-muted sm:text-lg">
            {description}
          </p>
          <p className="mt-5 text-sm font-semibold text-muted-subtle">
            {updated}
          </p>
        </div>
      </section>

      <article className="px-5 py-10 sm:px-8 sm:py-12 lg:px-10">
        <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-card px-5 py-8 shadow-card sm:px-8 sm:py-10">
          {children}
        </div>
      </article>

      <footer className="border-t border-border bg-[#191919] px-5 py-6 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-muted">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="font-semibold">
              &copy; 2026 UGC Pilot. All rights reserved.
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2 font-semibold text-foreground">
              <a
                className="rounded-md transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                href="mailto:support@getugcpilot.com"
              >
                support@getugcpilot.com
              </a>
              <a
                className="rounded-md transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                href="mailto:privacy@getugcpilot.com"
              >
                privacy@getugcpilot.com
              </a>
            </div>
          </div>
          <p>
            UGC Pilot is an independent service and is not affiliated with,
            endorsed by, or sponsored by Meta, TikTok, or Google.
          </p>
        </div>
      </footer>
    </main>
  );
}

export function LegalSection({ children, title }: LegalSectionProps) {
  return (
    <section className="border-t border-border pt-7 first:border-t-0 first:pt-0">
      <h2 className="text-xl font-bold tracking-[-0.015em] text-foreground-strong">
        {title}
      </h2>
      <div className="mt-4 flex min-w-0 flex-col gap-4 text-[15px] leading-7 text-muted [&_a]:rounded-sm [&_a]:font-bold [&_a]:text-primary [&_a]:underline-offset-4 [&_a]:transition-colors [&_a]:[overflow-wrap:anywhere] [&_a:hover]:text-primary-hover [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-focus [&_span]:[overflow-wrap:anywhere]">
        {children}
      </div>
    </section>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-2 pl-5">{children}</ul>;
}

export function LegalNotice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-primary/25 bg-brand-soft p-4 text-[15px] font-semibold leading-7 text-foreground">
      {children}
    </div>
  );
}
