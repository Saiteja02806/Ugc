"use client";

import { Tabs } from "@base-ui/react/tabs";
import { type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { WorkflowGenerationView } from "@/components/explore/workflow-generation-boundary";
import creation from "@/components/explore/workflow-creation.module.css";
import type { WorkflowAction } from "@/components/explore/use-workflow-finishing";

export type WorkflowCreateAction = { disabled: boolean; busy: boolean; message: string; onAction: () => void };

export type WorkflowSection = "create" | "edit" | "schedule";

/** Panels stay mounted across sections so references, settings and drafts survive. */
export function WorkflowCreationPanel({ kind, section, children, generation, create, edit, schedule }: { kind: "hook" | "phone"; section: WorkflowSection; children: ReactNode; generation?: WorkflowGenerationView; create?: WorkflowCreateAction; edit?: WorkflowAction; schedule?: WorkflowAction }) {
  const createAction = section === "create" ? create : undefined;
  const action = section === "edit" ? edit : section === "schedule" ? schedule : undefined;
  return <aside aria-label="Creation controls" data-section={section} className={creation.controls}>
    <Tabs.List aria-label="Workflow sections" className={creation.sectionTabs} activateOnFocus>
      <Tabs.Tab value="create" className={creation.sectionTab}>Create</Tabs.Tab>
      <Tabs.Tab value="edit" className={creation.sectionTab}>Edited demo</Tabs.Tab>
      <Tabs.Tab value="schedule" className={creation.sectionTab}>Schedule</Tabs.Tab>
    </Tabs.List>
    <div className={creation.controlContent} role="region" aria-label="Workflow section settings">
      {children}
    </div>
    <footer className={creation.actionFooter}>
      <p id={`${kind}-preview-limits`} className={!action && section === "schedule" ? "sr-only" : "mb-2 text-xs leading-5 text-muted"}>{createAction ? createAction.message : action ? action.message : generation ? generation.message : <>Local preview · not saved or connected.<span className="sr-only"> Generation, music, subtitles and scheduling are not connected. Video rendering is also not connected.</span></>}</p>
      {action?.error ? <div className="mb-2"><p role="alert" className="text-xs leading-5 text-destructive">{action.error}</p><Button type="button" variant="ghost" disabled={action.busy} onClick={action.refresh}>Refresh status</Button></div> : null}
      {generation?.error && section === "create" ? <div className="mb-2 space-y-1"><p role="alert" className="text-xs leading-5 text-destructive">{generation.error}</p><Button type="button" variant="ghost" className="h-8 text-xs" onClick={generation.refreshStatus}>Refresh status</Button></div> : null}
      {generation?.notice && section === "create" ? <p role="status" className="mb-2 text-xs leading-5 text-muted">{generation.notice}</p> : null}
      {createAction ? <Button type="button" disabled={createAction.disabled} aria-busy={createAction.busy} onClick={createAction.onAction} aria-describedby={`${kind}-preview-limits`} className={creation.primaryAction}>{createAction.busy ? "Uploading video…" : "Continue to edit"}</Button> : section === "create" && generation ? <Button type="button" disabled={generation.disabled} aria-busy={generation.busy} aria-label={kind === "hook" ? "Generate hook" : "Generate phone video"} aria-describedby={`${kind}-preview-limits`} className={creation.primaryAction} onClick={generation.onGenerate}>{generation.busy ? "Generating video…" : "Generate video"}</Button>
      : section === "create" ? <Button type="button" disabled aria-label={kind === "hook" ? "Generate hook" : "Generate phone video"} aria-describedby={`${kind}-preview-limits`} title="No generation, upload or credits are used in this layout preview" className={creation.primaryAction}>
        Generate video
      </Button> : <Button type="button" disabled={!action || action.disabled} aria-busy={action?.busy} onClick={action?.onAction} title={!action ? section === "schedule" ? "Scheduling is not connected in this layout preview" : "Editing is not connected in this layout preview" : undefined} aria-describedby={`${kind}-preview-limits`} className={creation.primaryAction}>{action?.busy ? section === "edit" ? "Applying edits…" : "Preparing schedule…" : section === "edit" ? "Apply edits" : "Schedule post"}</Button>}
    </footer>
  </aside>;
}
