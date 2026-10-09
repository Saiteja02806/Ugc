import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Download } from "lucide-react";

import { ProductLogoMark } from "@/components/brand/product-logo";
import { ConnectAiPanel } from "@/components/mcp-onboarding/connect-ai-panel";
import styles from "./connect-ai.module.css";

export const metadata: Metadata = {
  title: "Connect your AI",
  description: "Connect your UGC Pilot account to Codex, ChatGPT, or Claude and create images and short videos from your conversation.",
  robots: { index: false, follow: false },
};

export default function ConnectAiPage() {
  return (
    <main
      className={`instagram-theme ${styles.page} min-h-screen bg-background text-foreground`}
    >
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
            <ProductLogoMark className="size-9" sizes="36px" />UGC Pilot
          </Link>
          <Link href="/library" className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
            <ArrowLeft className="size-4" aria-hidden="true" />Your library
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 pb-16 pt-12 sm:px-8 sm:pt-16">
        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-sm font-semibold text-primary">Connect your AI · Private beta</p>
            <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.045em] sm:text-5xl">Your next image or video starts with a conversation.</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted">Connect UGC Pilot once. Describe what you want in Codex, ChatGPT, or Claude, and let your AI create it and bring back the result.</p>
            <p className="mt-4 text-sm leading-6 text-muted">Use your own UGC Pilot account. Generation uses your UGC Pilot plan and credits.</p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8" aria-label="Example generation workflow">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Example request</p>
            <p className="mt-4 rounded-2xl rounded-br-sm bg-primary/10 p-4 text-base leading-7">“Create a product image, then animate it into a five-second vertical video.”</p>
            <ol className="mt-6 space-y-3 text-sm">
              {["Check your credits", "Create the image", "Animate it and return the video"].map((step) => (
                <li key={step} className="flex items-center gap-3"><Check className="size-4 shrink-0 text-primary" aria-hidden="true" />{step}</li>
              ))}
            </ol>
            <p className="mt-5 border-t border-border pt-4 text-xs leading-5 text-muted">You describe the result. Your AI handles generation and progress.</p>
          </div>
        </section>

        <section className="mt-14" aria-labelledby="choose-client">
          <h2 id="choose-client" className="text-2xl font-semibold tracking-tight">Choose where you work</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Follow the setup for your AI app, then sign in and approve access.</p>
          <ConnectAiPanel />
        </section>

        <section className="mt-12 grid gap-6 border-t border-border pt-8 md:grid-cols-2">
          <div>
            <h2 className="text-lg font-semibold">Take the setup with you</h2>
            <p className="mt-2 text-sm leading-6 text-muted">The beta bundle includes connection settings, workflow skills, and a setup guide. Install it through a supported plugin flow; uploading it into a chat alone does not connect your account.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href="/downloads/ugc-pilot-0.1.2.zip" download className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2">
                <Download className="size-4" aria-hidden="true" />Download plugin bundle
              </a>
              <a href="/downloads/ugc-pilot-0.1.2-setup.md" download className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">Download setup guide</a>
              <a href="/downloads/ugc-pilot-0.1.2.zip.sha256" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">Verify download</a>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">What you can create today</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Generate images and 3–10 second videos, animate an image from your library, and retrieve finished media. Create 1, 2, or 4 outputs at a time.</p>
            <p className="mt-3 text-sm leading-6 text-muted">This beta does not include creator selection, carousels, or social publishing. Fresh-account setup is being verified before a public plugin release.</p>
            <Link href="/ai-studio" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">Open AI Studio<ArrowRight className="size-4" aria-hidden="true" /></Link>
          </div>
        </section>
      </div>
    </main>
  );
}
