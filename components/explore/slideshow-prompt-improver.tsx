"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Sparkle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { withReadDeadline } from "@/lib/http/read-deadline";
import { PromptImprovementError, requestSlideshowPromptRewrite } from "@/lib/explore/slideshow-prompt-client";

/** One in-place rewrite. Context is an invalidation key only; it is never sent. */
export function useSlideshowPromptImprover({ owner, prompt, contextKey, disabled, onChange }: {
  owner: string | null; prompt: string; contextKey: string; disabled: boolean; onChange: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [change, setChange] = useState<{ owner: string; context: string; before: string; after: string; clarifications: string[] } | null>(null);
  const [failure, setFailure] = useState<{ signature: string; message: string; terminal: boolean } | null>(null);
  const signature = JSON.stringify({ owner, prompt, contextKey });
  const latest = useRef(signature), working = useRef(false), alive = useRef(true);
  // Update at commit, before a resolved request can apply text from an older owner/context.
  useLayoutEffect(() => { latest.current = signature; }, [signature]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const applied = change?.owner === owner && change.context === contextKey && change.after === prompt ? change : null;
  const error = failure?.signature === signature ? failure : null;

  async function improve() {
    if (disabled || !owner || working.current || !prompt.trim() || prompt.length > 8000) return;
    working.current = true; setBusy(true); setFailure(null);
    const selectedSignature = signature;
    try {
      const token = await withReadDeadline(() => getCurrentUserIdToken(owner));
      if (!token) throw Error("Sign in before improving instructions.");
      if (!alive.current || latest.current !== selectedSignature) return;
      if (!navigator.locks) throw Error("Use a browser with Web Locks support to improve instructions safely.");
      const output = await withReadDeadline(signal => requestSlideshowPromptRewrite({ owner, input: { prompt }, token, storage: localStorage, locks: navigator.locks,
        send: (url, options) => fetch(url, { ...options, signal }), newAttempt: error?.terminal === true }), undefined, 75000);
      if (!alive.current || latest.current !== selectedSignature) return;
      setChange({ owner, context: contextKey, before: prompt, after: output.prompt, clarifications: output.clarifications });
      onChange(output.prompt);
    } catch (cause) {
      if (alive.current && latest.current === selectedSignature) setFailure({ signature, message: cause instanceof Error ? cause.message : "Could not improve the instructions. Your text is unchanged.", terminal: cause instanceof PromptImprovementError && cause.outcome === "failed" });
    } finally {
      working.current = false;
      if (alive.current) setBusy(false);
    }
  }

  const action = <button type="button" className="inline-flex size-10 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-primary outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-default disabled:opacity-50" aria-label="Improve instructions" title={busy ? "Improving instructions…" : "Improve instructions"}
    disabled={disabled || busy || !owner || !prompt.trim() || prompt.length > 8000} onClick={() => void improve()}>
    <Sparkle className={busy ? "size-5 animate-pulse motion-reduce:animate-none" : "size-5"} aria-hidden="true" />
  </button>;
  const feedback = busy ? <p role="status" className="text-xs leading-5 text-muted">Improving your instructions…</p>
    : error ? <p role="alert" className="text-xs leading-5 text-destructive">{error.message}{error.terminal ? " Click Improve instructions to try a new improvement." : ""}</p>
    : applied ? <div className="space-y-1 text-xs leading-5 text-muted">
      <div className="flex flex-wrap items-center gap-2"><span role="status">{applied.before === applied.after ? "Your instructions are already clear." : "Instructions improved. Review or edit them before generating."}</span>
        {applied.before !== applied.after ? <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" disabled={disabled || busy} onClick={() => { onChange(applied.before); setChange(null); setFailure(null); }}>Undo</Button> : null}
      </div>
      {applied.clarifications.length ? <div role="status"><p>Before generating, clarify in your prompt:</p><ul className="list-disc space-y-1 pl-4">{applied.clarifications.map((question, index) => <li key={index}>{question}</li>)}</ul></div> : null}
    </div> : null;
  return { action, feedback, busy };
}
