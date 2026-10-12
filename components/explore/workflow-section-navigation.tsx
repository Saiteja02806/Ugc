"use client";

import { Tabs } from "@base-ui/react/tabs";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { WorkflowSection } from "@/components/explore/workflow-creation-panel";
import sections from "@/components/explore/workflow-section-layout.module.css";

export function useWorkflowSectionOrientation() {
  return "horizontal" as const;
}

export function WorkflowSectionNavigation({ editValue = "edit", editLabel = "Edit" }: { editValue?: "edit" | "demo"; editLabel?: string } = {}) {
  const stages = [{ value: "create", label: "Create" }, { value: editValue, label: editLabel }, { value: "schedule", label: "Schedule" }];
  return <Tabs.List aria-label="Workflow sections" className={sections.navigation}>
    {stages.map(stage => <Tabs.Tab key={stage.value} value={stage.value} className={sections.stageTab}>{stage.label}</Tabs.Tab>)}
  </Tabs.List>;
}

export function WorkflowSectionHeading({ kind, section, previewVisible, onTogglePreview, previewId }: {
  kind: "hook" | "phone";
  section: WorkflowSection;
  previewVisible: boolean;
  onTogglePreview?: () => void;
  previewId: string;
}) {
  const title = section === "create" ? kind === "hook" ? "Create your talking-head video" : "Create your phone video" : section === "edit" ? "Edit your video" : "Review & schedule";
  const description = section === "create" ? "Describe what you want to see and hear, or start with an existing video." : section === "edit" ? "Keep your opening on its own, or add a demo, audio and subtitles." : "Review your finished video, then choose where and when to post.";
  return <header className={sections.sectionHeading}>
    <div><h2>{title}</h2><p>{description}</p></div>
    {onTogglePreview ? <Button type="button" variant="outline" aria-controls={previewId} aria-expanded={previewVisible} onClick={onTogglePreview}>
      {previewVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}{previewVisible ? "Hide preview" : "Show preview"}
    </Button> : null}
  </header>;
}
