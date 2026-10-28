import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Download } from "lucide-react";
import { LandingHeader } from "@/components/marketing/landing-header";
import { HookVideoBundle } from "@/components/marketing/hook-video-bundle";

const description = "Free resources for your next short video: 110 natural hook lines in a downloadable PDF, plus the limited Batch 1 Hook Video Library. No signup to download.";
export const metadata: Metadata = {
  title: "Free Creator Tools: Hook Text & Video Libraries",
  description,
  alternates: { canonical: "/free-tools" },
  openGraph: { title: "Free creator tools | UGC Pilot", description, url: "/free-tools", type: "website" },
  twitter: { card: "summary_large_image", title: "Free creator tools | UGC Pilot", description },
};

export default function FreeToolsPage() {
  return <main className="min-h-dvh bg-background text-foreground">
    <LandingHeader initialHasSession={false} />
    <section className="mx-auto max-w-[1120px] px-5 pb-16 pt-36 sm:px-8 sm:pb-24 sm:pt-44" aria-labelledby="tools-title">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Free tools from UGC Pilot</p>
      <h1 id="tools-title" className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-foreground-strong sm:text-6xl">Find your words.<br />Find your opening.</h1>
      <p className="mt-6 max-w-xl text-lg leading-8 text-muted">Start your next Reel, TikTok, Short or app demo with a hook. Two free libraries. No account needed to download.</p>
      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <article className="flex min-w-0 flex-col rounded-[28px] border border-border bg-card p-6 sm:p-8" aria-labelledby="text-library-title">
          <div className="mb-7 flex items-center justify-between gap-3 text-xs font-medium text-muted"><span>TEXT LIBRARY · PDF</span><span className="rounded-full border border-border px-3 py-1.5">Always available</span></div>
          <div className="relative mb-8 flex h-52 items-center justify-center overflow-hidden rounded-[20px] bg-background sm:h-60">
            <Image src="/resources/reaction-hook-library-cover-v4.webp" alt="The Reaction Hook Library PDF cover" width={170} height={240} className="mt-12 w-40 -rotate-6 shadow-floating" sizes="170px" />
          </div>
          <h2 id="text-library-title" className="lg:min-h-[2.5em] text-3xl font-semibold leading-tight tracking-tight text-foreground-strong">The Reaction Hook Library</h2>
          <p className="mt-4 leading-7 text-muted lg:min-h-[84px]">110 short, natural hook lines. Pick the feeling, copy the words, and make them sound like you.</p>
          <p className="mt-3 text-sm leading-6 text-muted">11 collections · TikTok, Reels, Shorts and app demos</p>
          <div className="pt-7">
            <p className="min-h-12 text-sm leading-6 text-muted">Free PDF · No signup · Unlimited downloads</p>
            <a href="/resources/ugc-pilot-110-hooks.pdf" download="UGCPilot_The_Reaction_Hook_Library.pdf" className="mt-4 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-card"><Download className="size-4" aria-hidden="true" />Download 110 free hooks</a>
            <p className="mt-4 flex items-center gap-2 text-xs leading-5 text-muted"><Check className="size-3.5" aria-hidden="true" />Keep the PDF handy for your next post.</p>
            <Link href="/free-hook-lines" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm text-primary underline underline-offset-4">Browse and copy hook lines<ArrowRight className="size-4" aria-hidden="true" /></Link>
          </div>
        </article>
        <HookVideoBundle compact />
      </div>
      <p className="mt-10 text-sm leading-6 text-muted">Making a hook + demo video? <Link href="/guides/product-demo-to-short-video" className="text-primary underline underline-offset-4">Read the product-demo guide.</Link></p>
    </section>
    <footer className="mx-auto flex max-w-[1120px] flex-wrap gap-x-6 gap-y-3 border-t border-border px-5 py-7 text-sm text-muted sm:px-8"><Link href="/">UGC Pilot</Link><Link href="/privacy">Privacy</Link><Link href="/contact">Contact</Link></footer>
  </main>;
}
