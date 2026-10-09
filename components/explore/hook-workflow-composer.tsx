"use client";

import { WorkflowCreationForm, type WorkflowCreationFormProps } from "@/components/explore/workflow-creation-form";

export function HookWorkflowComposer(props: WorkflowCreationFormProps) {
  return <WorkflowCreationForm kind="hook" {...props} />;
}
