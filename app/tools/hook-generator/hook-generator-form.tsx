"use client";

import { useActionState } from "react";

import { generateHookLinesAction, type HookGeneratorState } from "@/app/tools/hook-generator/actions";
import { hookPatterns } from "@/lib/marketing/hook-line-templates";

const initialState: HookGeneratorState = { lines: [], error: null };

export function HookGeneratorForm() {
  const [state, action, pending] = useActionState(generateHookLinesAction, initialState);

  return (
    <form action={action} className="mt-8 space-y-4 rounded-2xl border border-border bg-surface/40 p-5">
      <label className="block text-sm font-medium text-foreground">
        What task does the app help with?
        <input name="task" required maxLength={120} placeholder="split a dinner receipt" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-base text-foreground" />
      </label>
      <label className="block text-sm font-medium text-foreground">
        App name, if you want it in the line
        <input name="product" maxLength={120} placeholder="North" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-base text-foreground" />
      </label>
      <label className="block text-sm font-medium text-foreground">
        Pattern
        <select name="pattern" defaultValue="situation" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-base text-foreground">
          {hookPatterns.map((pattern) => (
            <option key={pattern.id} value={pattern.id}>{pattern.label}</option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
        {pending ? "Writing lines…" : "Write 3 hook lines"}
      </button>
      {state.error ? <p role="alert" className="text-sm text-primary">{state.error}</p> : null}
      {state.lines.length > 0 ? (
        <ol className="space-y-3">
          {state.lines.map((line) => (
            <li key={line} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background p-3 text-sm leading-6 text-foreground">
              <span>{line}</span>
              <button type="button" className="shrink-0 underline" onClick={() => navigator.clipboard.writeText(line)}>Copy</button>
            </li>
          ))}
        </ol>
      ) : null}
      <p className="text-sm leading-6 text-muted">These lines are fill-in templates. They are not predictions, and they are not a claim that a line has gone viral. Read each one aloud, then film the screen it describes.</p>
    </form>
  );
}
