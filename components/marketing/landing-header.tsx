"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ProductLogoMark } from "@/components/brand/product-logo";
import { LandingAuthAction } from "@/components/marketing/landing-auth-actions";

const navItems = [{ label: "Pricing", href: "/pricing" }];
const topOnlyNavItems = [{ label: "Try UGCPilot", href: "/try-ugcpilot" }];

export function LandingHeader({
  initialHasSession,
}: {
  initialHasSession: boolean;
}) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const updateHeader = () => {
      const nextIsScrolled = window.scrollY > 24;

      setIsScrolled((currentIsScrolled) =>
        currentIsScrolled === nextIsScrolled
          ? currentIsScrolled
          : nextIsScrolled,
      );
    };

    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });

    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  return (
    <header
      className="fixed inset-x-0 top-0 z-40 px-3 py-3 sm:px-6"
      data-scrolled={isScrolled ? "true" : "false"}
    >
      <div
        className={`pointer-events-auto mx-auto flex w-full items-center justify-between border transition-[max-width,height,padding,gap,background-color,border-color,border-radius,box-shadow] duration-300 ease-out motion-reduce:transition-none ${
          isScrolled
            ? "h-13 max-w-[540px] gap-3 rounded-full border-border bg-card/90 px-3.5 shadow-floating backdrop-blur-xl"
            : "h-16 max-w-[1200px] gap-5 rounded-none border-transparent bg-transparent px-0 shadow-none"
        }`}
      >
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="UGCPilot home"
        >
          <ProductLogoMark
            className={`rounded-control bg-primary p-2 transition-[width,height] duration-300 ease-out motion-reduce:transition-none ${
              isScrolled ? "size-8" : "size-9"
            }`}
            imageClassName="brightness-0 invert"
            sizes="36px"
          />
          <span className="truncate text-[17px] font-semibold text-foreground-strong">
            UGCPilot
          </span>
        </Link>

        <nav
          className={`hidden items-center text-sm font-medium text-muted transition-[gap] duration-300 ease-out motion-reduce:transition-none md:flex ${
            isScrolled ? "gap-4 lg:gap-5" : "gap-5 lg:gap-7"
          }`}
          aria-label="Primary navigation"
        >
          {!isScrolled
            ? topOnlyNavItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="inline-flex items-center gap-2 rounded-full border border-primary/60 bg-primary/[0.06] px-4 py-2 font-semibold text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-[transform,background-color,border-color,box-shadow] hover:-translate-y-px hover:border-primary hover:bg-primary/[0.12] hover:shadow-[0_8px_20px_rgba(255,107,69,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <span className="size-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(255,107,69,0.9)]" aria-hidden="true" />
                  {item.label}
                </Link>
              ))
            : null}
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-control transition-colors hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {item.label}
            </Link>
          ))}
          <LandingAuthAction
            appearance="header"
            initialHasSession={initialHasSession}
          />
        </nav>

        <details className="group relative md:hidden">
          <summary
            aria-label="Open navigation menu"
            className="flex size-10 list-none items-center justify-center rounded-control bg-transparent text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-details-marker]:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
          </summary>
          <div className="absolute right-0 top-12 w-60 rounded-card border border-border bg-card/95 p-2 shadow-floating backdrop-blur-xl">
            {[...(!isScrolled ? topOnlyNavItems : []), ...navItems].map(
              (item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={(event) =>
                    event.currentTarget
                      .closest("details")
                      ?.removeAttribute("open")
                  }
                  className={`block rounded-control px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                    item.label === "Try UGCPilot"
                      ? "border border-primary/60 bg-primary/[0.06] text-primary hover:border-primary hover:bg-primary/[0.12]"
                      : "text-muted hover:bg-card-muted hover:text-foreground-strong"
                  }`}
                >
                  {item.label}
                </Link>
              ),
            )}
            <LandingAuthAction
              appearance="menu"
              initialHasSession={initialHasSession}
            />
          </div>
        </details>
      </div>
    </header>
  );
}
