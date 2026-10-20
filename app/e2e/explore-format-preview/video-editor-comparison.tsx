"use client";

import { useState, type ComponentProps } from "react";
import { FormatWorkspace } from "@/components/explore/format-workspace";
import { Button } from "@/components/ui/button";

/** Development fixture only. Switching layout keeps the same editor and draft. */
export function VideoEditorComparison({ initialLayout, ...workspace }: Omit<ComponentProps<typeof FormatWorkspace>, "videoEditorLayout"> & {
  initialLayout: "controls" | "preview";
}) {
  const [layout, setLayout] = useState(initialLayout);

  function chooseLayout(next: "controls" | "preview") {
    setLayout(next);
    const params = new URLSearchParams(window.location.search);
    params.set("editorLayout", next);
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  }

  return <>
    <section aria-label="Local editor layout comparison" className="space-y-3 border-b border-border bg-card px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Try both editor layouts</h2>
        <div role="group" aria-label="Editor layout" className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={layout === "controls" ? "default" : "outline"} aria-pressed={layout === "controls"} onClick={() => chooseLayout("controls")}>A · Controls on the left</Button>
          <Button type="button" size="sm" variant={layout === "preview" ? "default" : "outline"} aria-pressed={layout === "preview"} onClick={() => chooseLayout("preview")}>B · Edit beside preview</Button>
        </div>
      </div>
      <p className="text-xs leading-5 text-muted">Play the sample, trim it, add two timed text blocks, then go Back to preview and reopen Edit. Switch A/B at any time; your edits stay with the clip.</p>
      <p className="text-xs text-muted">Local comparison · generation, saving and posting are disabled. Uploaded clips stay on this device.</p>
    </section>
    <FormatWorkspace {...workspace} videoEditorLayout={layout} />
  </>;
}
