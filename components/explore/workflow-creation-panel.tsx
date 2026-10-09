"use client";

import { Tabs } from "@base-ui/react/tabs";
import { type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import creation from "@/components/explore/workflow-creation.module.css";
import type { WorkflowAction } from "@/components/explore/use-workflow-finishing";

export type WorkflowSection = "create" | "edit" | "schedule";
export type WorkflowCreateAction = { disabled: boolean; busy: boolean; message: string; onAction: () => void };

/** Panels stay mounted across sections so references, settings and drafts survive. */
export function WorkflowCreationPanel({ kind, section, children, create, edit, schedule }: { kind: "hook" | "phone"; section: WorkflowSection; children: ReactNode; create?: WorkflowCreateAction; edit?: WorkflowAction; schedule?: WorkflowAction }) {
  const action = section === "edit" ? edit : section === "schedule" ? schedule : undefined;
  const createAction = section === "create" ? create : undefined;
  return <aside aria-label="Creation controls" data-section={section} className={creation.controls}>
    <Tabs.List aria-label="Workflow sections" className={creation.sectionTabs} activateOnFocus>
      <Tabs.Tab value="create" className={creation.sectionTab}>Create</Tabs.Tab>
      <Tabs.Tab value="edit" className={creation.sectionTab}>Edit video</Tabs.Tab>
      <Tabs.Tab value="schedule" className={creation.sectionTab}>Schedule</Tabs.Tab>
    </Tabs.List>
    <div className={creation.controlContent} role="region" aria-label="Workflow section settings">
      {children}
    </div>
    <footer className={creation.actionFooter}>
      <p id={`${kind}-preview-limits`} className="mb-2 text-xs leading-5 text-muted">{createAction?.message ?? action?.message ?? "Local creation preview. Generation is not connected yet."}</p>
      {action?.error ? <p role="alert" className="mb-2 text-xs text-destructive">{action.error}</p> : null}
      {action?.cancel ? <Button type="button" variant="outline" disabled={action.busy} onClick={action.cancel}>Cancel finishing</Button> : null}
      {action ? <><Button type="button" disabled={action.disabled} onClick={action.onAction} className={creation.primaryAction}>{action.busy ? "Working…" : section === "edit" ? "Apply edits" : "Schedule post"}</Button><Button type="button" variant="ghost" onClick={action.refresh} disabled={action.busy}>Refresh status</Button></> :
      createAction ? <Button type="button" disabled={createAction.disabled} onClick={createAction.onAction} aria-describedby={`${kind}-preview-limits`} className={creation.primaryAction}>{createAction.busy ? "Preparing video…" : "Continue to edit"}</Button> :
      section === "create" ? <Button type="button" disabled aria-label={kind === "hook" ? "Generate hook" : "Generate phone video"} aria-describedby={`${kind}-preview-limits`} title="Generation is not connected in this preview" className={creation.primaryAction}>
        Generate video
      </Button> : <Button type="button" disabled aria-describedby={`${kind}-preview-limits`} className={creation.primaryAction}>{section === "edit" ? "Apply edits" : "Schedule post"}</Button>}
    </footer>
  </aside>;
}
