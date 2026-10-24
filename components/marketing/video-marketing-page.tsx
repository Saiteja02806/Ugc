import type { ReactNode } from "react";
import Link from "next/link";

import { JsonLd } from "@/components/marketing/json-ld";
import { LandingHeader } from "@/components/marketing/landing-header";

export function VideoMarketingPage({
  jsonLd,
  eyebrow,
  h1,
  lede,
  children,
}: {
  jsonLd: unknown;
  eyebrow: string;
  h1: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <main className="instagram-theme min-h-screen overflow-x-hidden bg-background text-foreground">
      <JsonLd data={jsonLd} />
      <LandingHeader initialHasSession={false} />
      <section className="relative overflow-hidden px-4 pb-12 pt-28 sm:px-6 sm:pt-36 lg:px-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_65%_50%_at_50%_0%,rgba(255,107,69,0.14),transparent_76%)]" />
        <div className="mx-auto max-w-[960px]">
          <p className="inline-flex rounded-full border border-primary/35 bg-primary/[0.08] px-3 py-1.5 text-xs font-semibold text-primary">{eyebrow}</p>
          <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-foreground-strong sm:text-5xl">{h1}</h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-muted sm:text-lg sm:leading-8">{lede}</p>
        </div>
      </section>
      {children}
    </main>
  );
}

export function VideoRelatedLinks({ links }: { links: readonly { href: string; title: string; description: string }[] }) {
  return (
    <section className="border-t border-border px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1100px]">
        <h2 className="text-2xl font-semibold text-foreground-strong">Keep going</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-[22px] border border-border bg-card p-5 transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
              <p className="font-semibold text-foreground-strong">{link.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{link.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
