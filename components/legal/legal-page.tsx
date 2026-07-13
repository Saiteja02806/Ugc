import type { ReactNode } from "react";
import Link from "next/link";

import { ProductLogoMark } from "@/components/brand/product-logo";

const publicLinks = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Data deletion", href: "/data-deletion" },
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
    <main className="min-h-screen bg-[#f7f7f8] text-[#1b1b1f]">
      <header className="border-b border-[#e1e1e6] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-5 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-3 font-black text-[#18181b]"
            aria-label="UGC Pilot home"
          >
            <ProductLogoMark className="h-7 w-10" sizes="40px" />
            <span>UGC Pilot</span>
          </Link>
          <nav
            className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-[#565760]"
            aria-label="Public pages"
          >
            {publicLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition hover:text-[#18181b]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <section className="border-b border-[#e8e8ed] bg-[#fffefd] px-5 py-14 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-[#c2410c]">
            {eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-black leading-[1.02] tracking-normal text-[#17171b] sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#52535c] sm:text-lg">
            {description}
          </p>
          <p className="mt-5 text-sm font-bold text-[#71717a]">{updated}</p>
        </div>
      </section>

      <article className="px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-4xl rounded-[18px] border border-[#e1e1e6] bg-white px-5 py-8 shadow-[0_18px_46px_rgb(24_24_27_/_0.05)] sm:px-8 sm:py-10">
          {children}
        </div>
      </article>

      <footer className="border-t border-[#e1e1e6] bg-white px-5 py-6 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-[#5a5b64] md:flex-row md:items-center md:justify-between">
          <p className="font-semibold">&copy; 2026 UGC Pilot</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 font-semibold">
            <a href="mailto:support@getugcpilot.com">support@getugcpilot.com</a>
            <a href="mailto:privacy@getugcpilot.com">privacy@getugcpilot.com</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

export function LegalSection({ children, title }: LegalSectionProps) {
  return (
    <section className="border-t border-[#ececf1] pt-7 first:border-t-0 first:pt-0">
      <h2 className="text-xl font-black tracking-normal text-[#19191d]">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-[15px] leading-7 text-[#4f5058]">
        {children}
      </div>
    </section>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5">{children}</ul>;
}

export function LegalNotice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[12px] border border-[#ffd6c4] bg-[#fff7f1] p-4 text-[15px] font-semibold leading-7 text-[#7c2d12]">
      {children}
    </div>
  );
}
