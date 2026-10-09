"use client";

import { FolderOpen, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import creation from "@/components/explore/workflow-creation.module.css";
import type { WorkflowVideoMode } from "@/lib/explore/workflow-source-video";

export function WorkflowVideoStartActions({ onChoose, disabled = false }: {
  onChoose: (mode: WorkflowVideoMode) => void; disabled?: boolean;
}) {
  return <div className={creation.videoStartActions} role="group" aria-label="Choose a video source">
    {([
      ["generate", "Create video", Sparkles],
      ["upload", "Upload video", Upload],
      ["assets", "Creative Assets", FolderOpen],
    ] as const).map(([mode, label, Icon]) => <Button key={mode} type="button" variant="outline" disabled={disabled} onClick={() => onChoose(mode)}>
      <Icon className="size-5" aria-hidden="true" /><span>{label}</span>
    </Button>)}
  </div>;
}
