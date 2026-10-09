"use client";

import type { Ref } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "@/components/explore/format-workspace.module.css";
import { cn } from "@/lib/utils";

/** One shared preview-side frame makes the clip being edited explicit. */
export function FormatVideoEditFrame({ clip, active = true, onBack, backLabel = "Back to preview", controlsRef, previewRef, actionsRef }: {
  clip: "hook" | "demo" | "video"; active?: boolean; onBack: () => void; backLabel?: string;
  controlsRef: Ref<HTMLDivElement>; previewRef: Ref<HTMLDivElement>; actionsRef: Ref<HTMLDivElement>;
}) {
  const title = clip === "video" ? "Edit video" : `Edit ${clip} video`;
  return <section hidden={!active} aria-label={title} className={cn(styles.previewEditorArea, "min-w-0 space-y-5 p-4 sm:p-5")}>
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1"><h2 className="text-lg font-semibold tracking-tight">{title}</h2><p className="text-xs leading-5 text-muted">Trim, text and audio apply to this {clip === "video" ? "clip" : clip} only.</p></div>
      <Button type="button" variant="outline" size="sm" onClick={onBack}><ArrowLeft className="size-4" aria-hidden="true" />{backLabel}</Button>
    </header>
    <div className={styles.previewEditorColumns}>
      <div ref={previewRef} className={cn(styles.previewEditorPlayer, "min-w-0 rounded-xl border border-border bg-card p-4")} />
      <div ref={controlsRef} className="min-w-0 rounded-xl border border-border bg-card" />
    </div>
    <footer ref={actionsRef} className="rounded-xl border border-border bg-card p-4" aria-label={`${title} actions`} />
  </section>;
}
