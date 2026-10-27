"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

export function BatchNotificationForm() {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    busy.current = true; setPending(true); setError(null);
    try {
      const response = await fetch("/api/resources/hook-video-bundle/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), consent: data.get("consent") === "on", website: data.get("website") }),
        signal: AbortSignal.timeout(15_000),
      });
      const result = await response.json();
      if (!response.ok || result.saved !== true) throw new Error(typeof result.error === "string" ? result.error : "Could not save your request. Please try again.");
      form.reset(); setSaved(true);
    } catch (failure) {
      setError(failure instanceof Error && failure.name !== "TimeoutError" && failure.name !== "TypeError" ? failure.message : "Could not confirm your request. Please try again.");
    } finally { busy.current = false; setPending(false); }
  }

  return <div className="mt-7 border-t border-border pt-6">
    <h3 className="text-lg font-semibold text-foreground-strong">Want to hear about Batch 2?</h3>
    <p className="mt-2 text-sm leading-6 text-muted">Leave your email for the next video batch. It’s optional.</p>
    {saved ? <p role="status" className="mt-4 text-sm leading-6 text-foreground">Your request is saved. We’ll use your email only for the Batch 2 announcement.</p> : <form onSubmit={submit} className="mt-4 space-y-4">
      <div><label htmlFor="batch-notify-email" className="text-sm font-medium">Email address</label><input id="batch-notify-email" name="email" type="email" autoComplete="email" maxLength={254} required disabled={pending} className="mt-2 min-h-12 w-full min-w-0 rounded-control border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" placeholder="you@example.com" /></div>
      <div hidden aria-hidden="true"><label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label className="flex items-start gap-3 text-sm leading-6 text-muted"><input name="consent" type="checkbox" required disabled={pending} className="mt-1 size-4 shrink-0 accent-primary" /><span>Email me when Batch 2 is ready. No other marketing. <Link href="/privacy" className="underline underline-offset-4">Privacy</Link>. To cancel, contact <a href="mailto:privacy@getugcpilot.com" className="break-all underline underline-offset-4">privacy@getugcpilot.com</a>.</span></label>
      <Button type="submit" variant="outline" className="min-h-12 w-full" disabled={pending}>{pending ? "Saving your request…" : "Notify me about Batch 2"}</Button>
      {error ? <p role="alert" className="text-sm leading-6 text-destructive">{error}</p> : null}
    </form>}
  </div>;
}
