"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Download, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BatchNotificationForm } from "@/components/marketing/batch-notification-form";
import { BATCH_ONE_COMPLETE } from "@/lib/resources/hook-bundle-copy";

const endpoint = "/api/resources/hook-video-bundle";
const previewUrl = "https://storage.googleapis.com/ugcsaas-media/marketing/hook-video-library/v1/preview-2a3c843428fa3763.mp4";
const previewPoster = "https://storage.googleapis.com/ugcsaas-media/marketing/hook-video-library/v1/preview-5c570227cee989d7.jpg";
type Status = { count: number; limit: number; exhausted: boolean; started: boolean; videoCount: number };
export function HookVideoBundle({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [started, setStarted] = useState(false);
  const [previewUnavailable, setPreviewUnavailable] = useState(false);
  const preview = useRef<HTMLVideoElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const busy = useRef(false);
  const requestId = useRef<string | null>(null);

  const refresh = useCallback(async (id?: string | null, signal?: AbortSignal) => {
    const response = await fetch(`${endpoint}${id ? `?requestId=${encodeURIComponent(id)}` : ""}`, {
      cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000),
    });
    const next = await response.json();
    if (!response.ok || !Number.isInteger(next.count) || next.count < 0 || next.count > 100 || next.limit !== 100 ||
      typeof next.started !== "boolean" || next.exhausted !== (next.count === 100) || !Number.isInteger(next.videoCount) || next.videoCount < 1) {
      throw new Error("Downloads are temporarily unavailable. Please try again.");
    }
    if (signal?.aborted) return;
    setStatus(next); setError(null);
    if (next.started) { setStarted(true); setPending(false); busy.current = false; }
    return next as Status;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => { void refresh(null, controller.signal).catch(() => { if (!controller.signal.aborted) setError("Could not check download availability. Please try again."); }); }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [refresh]);

  useEffect(() => {
    if (!pending) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const deadline = Date.now() + 60_000;
    const poll = async () => {
      try { await refresh(requestId.current, controller.signal); } catch { /* The native download may still be running. */ }
      if (controller.signal.aborted) return;
      if (Date.now() >= deadline) {
        setPending(false); busy.current = false;
        setError("The download has not been confirmed. Check your browser downloads, then retry if needed.");
      } else { timer = setTimeout(() => { void poll(); }, 1500); }
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [pending, refresh]);

  useEffect(() => {
    if (!compact && preview.current) {
      preview.current.defaultMuted = true;
      preview.current.muted = true;
      void preview.current.play().catch(() => {});
    }
  }, [compact]);

  function submit(event: FormEvent<HTMLFormElement>) {
    if (busy.current || !status || status.exhausted || started || !input.current) { event.preventDefault(); return; }
    requestId.current ??= crypto.randomUUID();
    input.current.value = requestId.current;
    busy.current = true; setPending(true); setError(null);
    // Native POST to an iframe streams straight to browser downloads, avoiding
    // a complete multi-video archive in JavaScript memory. POSTs never prefetch.
  }

  function readDownloadError() {
    try {
      const body = frame.current?.contentDocument?.body.textContent;
      if (!body?.startsWith("{")) return;
      const result = JSON.parse(body);
      if (typeof result.error !== "string") return;
      setError(result.error); setPending(false); busy.current = false;
      void refresh(requestId.current).then(next => { if (!next?.started) setError(result.error); }).catch(() => setError(result.error));
    } catch { /* An attachment response has no readable iframe document. */ }
  }

  if (compact) {
    return (
      <article className="flex min-w-0 flex-col rounded-[28px] border border-border bg-card p-6 sm:p-8">
        <div className="mb-7 flex items-center justify-between gap-3 text-xs font-medium text-muted">
          <span>VIDEO LIBRARY · ZIP</span>
          <span className="rounded-full border border-border px-3 py-1.5">Batch 1 · 100 downloads</span>
        </div>
        <div className="mb-8 flex h-52 shrink-0 flex-col items-center justify-center rounded-[20px] bg-background sm:h-60">
          <Film className="size-12 text-primary" aria-hidden="true" />
          <p className="mt-4 text-4xl font-semibold tracking-normal text-foreground-strong">104 clips</p>
          <p className="mt-2 text-sm text-muted">One ZIP. Your next opening.</p>
        </div>
        <h2 id="bundle-title" className="lg:min-h-[2.5em] text-3xl font-semibold leading-tight tracking-tight text-foreground-strong">
          Hook Video Library
        </h2>
        <p className="mt-4 leading-7 text-muted lg:min-h-[84px]">
          104 public Hook reference clips in one ZIP. Browse the reactions and use them to plan your next opening.
        </p>
        <p className="mt-3 text-sm leading-6 text-muted">
          MP4 videos · No signup · First 100 downloads
        </p>
        <div className="pt-7">
          <p role="status" aria-live="polite" className="min-h-12 text-sm leading-6 text-muted">
            {status?.exhausted ? BATCH_ONE_COMPLETE : status ? `${status.count} of 100 downloads started · ${100 - status.count} remaining` : "Checking download availability…"}
          </p>
          <form action={endpoint} method="post" target="hook-bundle-download" onSubmit={submit} className="mt-4">
            <input ref={input} type="hidden" name="requestId" />
            <Button type="submit" size="lg" className="min-h-12 w-full min-h-[52px] rounded-full px-5 text-sm font-semibold" disabled={!status || status.exhausted || pending || started}>
              <Download className="size-4" aria-hidden="true" />
              {status?.exhausted ? "Batch 1 completed" : started ? "Download started" : pending ? "Preparing your download…" : "Download Batch 1 · 104 videos"}
            </Button>
          </form>
          {started ? <p className="mt-3 text-sm text-muted">Your ZIP download has started. Check your browser downloads.</p> : null}
          {error ? (
            <div className="mt-4 space-y-2">
              <p role="alert" className="text-sm text-destructive">{error}</p>
              <Button type="button" variant="outline" onClick={() => { setError(null); void refresh(requestId.current).catch(() => setError("Could not check download availability. Please try again.")); }}>Check availability again</Button>
            </div>
          ) : null}
          <p className="mt-4 text-xs leading-5 text-muted">
            The counter records downloads when they start. An interrupted transfer may still count toward the limit.
          </p>
        </div>
        {status?.exhausted ? <BatchNotificationForm /> : null}
        <iframe ref={frame} name="hook-bundle-download" title="Hook bundle download" hidden onLoad={readDownloadError} />
      </article>
    );
  }

  return (
    <main className="min-h-dvh bg-background text-foreground flex flex-col lg:flex-row">
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex items-center justify-between border-b border-border px-6 py-5 sm:px-8 lg:px-12 shrink-0">
          <Link href="/" className="text-xl font-semibold text-foreground-strong">Vidmake</Link>
          <Link href="/free-tools" className="inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-4">Free tools</Link>
        </header>

        <section className="flex flex-1 flex-col justify-center px-6 py-8 sm:px-8 lg:px-12 max-w-xl mx-auto w-full" aria-labelledby="bundle-title">
          <Film className="mb-4 size-8 text-primary" aria-hidden="true" />
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Batch 1 · Free video library</p>
          <h1 id="bundle-title" className="text-3xl font-semibold leading-tight tracking-tight text-foreground-strong sm:text-4xl lg:text-[40px]">
            Hook Video Library<br />104 clips. One download.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
            104 public Hook reference clips in one ZIP. Browse the reactions and use them to plan your next opening.
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">
            MP4 videos · No signup · First 100 downloads
          </p>

          <p role="status" aria-live="polite" className="mt-6 text-sm text-muted">
            {status ? `Available downloads: ${status.limit - status.count}` : error ? null : "Checking download availability…"}
          </p>
          <form action={endpoint} method="post" target="hook-bundle-download" onSubmit={submit} className="mt-3">
            <input ref={input} type="hidden" name="requestId" />
            <Button type="submit" size="lg" className="min-h-12 w-full sm:w-auto" disabled={!status || status.exhausted || pending || started}>
              <Download className="size-4" aria-hidden="true" />
              {status?.exhausted ? "Batch 1 completed" : started ? "Download started" : pending ? "Preparing your download…" : "Download Batch 1 · 104 videos"}
            </Button>
          </form>
          {started ? <p className="mt-3 text-sm text-muted">Your ZIP download has started. Check your browser downloads.</p> : null}
          {error ? (
            <div className="mt-4 space-y-2">
              <p role="alert" className="text-sm text-destructive">{error}</p>
              <Button type="button" variant="outline" onClick={() => { setError(null); void refresh(requestId.current).catch(() => setError("Could not check download availability. Please try again.")); }}>Check availability again</Button>
            </div>
          ) : null}

          {status?.exhausted ? <BatchNotificationForm /> : null}
          <Link href="/free-hook-lines" className="mt-6 inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">
            Need the words too? Browse The Reaction Hook Library
          </Link>
        </section>
      </div>

      <div className="relative w-full lg:w-1/2 min-h-[50vh] lg:sticky lg:top-0 lg:h-dvh lg:self-start bg-black overflow-hidden flex items-center justify-center shrink-0">
        <video
          ref={preview}
          src={previewUrl}
          poster={previewPoster}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-label="Preview the Hook Video Library"
          className="h-full w-full object-cover"
          onError={() => setPreviewUnavailable(true)}
        >
          Your browser cannot play this preview. <a href={previewUrl}>Open the preview video</a>.
        </video>
        {previewUnavailable ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-card/85 backdrop-blur-sm">
            <p role="alert" className="text-sm text-muted">The preview could not load. You can still download the library.</p>
            <Button type="button" variant="outline" className="mt-3" onClick={() => { setPreviewUnavailable(false); preview.current?.load(); }}>Retry preview</Button>
          </div>
        ) : null}
      </div>

      <iframe ref={frame} name="hook-bundle-download" title="Hook bundle download" hidden onLoad={readDownloadError} />
    </main>
  );
}
