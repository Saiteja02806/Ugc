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
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-5 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-3 rounded-control font-black text-foreground-strong transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            aria-label="UGC Pilot home"
          >
            <ProductLogoMark
              className="h-8 w-8 rounded-control bg-primary p-1.5"
              imageClassName="brightness-0 invert"
              sizes="32px"
            />
            <span>UGC Pilot</span>
          </Link>
          <nav
            className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-muted"
            aria-label="Public pages"
          >
            {publicLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-control transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <section className="border-b border-border bg-background px-5 py-14 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-primary">
            {eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-black leading-[1.02] tracking-normal text-foreground-strong sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted sm:text-lg">
            {description}
          </p>
          <p className="mt-5 text-sm font-bold text-muted-subtle">{updated}</p>
        </div>
      </section>

      <article className="px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-4xl rounded-[var(--radius-panel)] border border-border bg-card px-5 py-8 shadow-card sm:px-8 sm:py-10 [&_a]:font-bold [&_a]:text-primary [&_a]:transition-colors [&_a:hover]:text-primary-hover">
          {children}
        </div>
      </article>

      <footer className="border-t border-border bg-card px-5 py-6 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-muted">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="font-semibold text-foreground">
              &copy; 2026 UGC Pilot. All rights reserved.
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2 font-semibold">
              <a
                href="mailto:support@getugcpilot.com"
                className="rounded-control transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                support@getugcpilot.com
              </a>
              <a
                href="mailto:privacy@getugcpilot.com"
                className="rounded-control transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
      <h2 className="text-xl font-black tracking-normal text-foreground-strong">
        {title}
      </h2>
      <div className="mt-4 flex flex-col gap-4 text-[15px] leading-7 text-muted">
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
    <div className="rounded-card border border-primary/35 bg-selected p-4 text-[15px] font-semibold leading-7 text-foreground">
      {children}
    </div>
  );
}
