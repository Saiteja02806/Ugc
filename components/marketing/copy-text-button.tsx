"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyTextButton({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  const [status, setStatus] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("Copied");
    } catch {
      setStatus("Select the text below and copy it manually.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground-strong">{label}</p>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label}`}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {status === "Copied" ? (
            <Check className="size-3.5" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
          Copy
        </button>
      </div>
      <pre className="mt-2 overflow-x-auto whitespace-pre rounded-xl border border-border bg-card-muted p-4 font-mono text-xs leading-6 text-foreground sm:text-sm">
        {value}
      </pre>
      <p role="status" className="mt-1 min-h-5 text-xs text-muted">
        {status}
      </p>
    </div>
  );
}
