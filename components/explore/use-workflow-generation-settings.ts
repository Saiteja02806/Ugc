"use client";

import { useState } from "react";

import { createWorkflowGenerationSettings, normalizeWorkflowGenerationSettings, type WorkflowGenerationSettings } from "@/lib/explore/workflow-generation-settings";

/** The workflow owns these settings, so tab changes cannot discard the draft. */
export function useWorkflowGenerationSettings(initialDuration = 5) {
  const [settings, setSettings] = useState(() => createWorkflowGenerationSettings(initialDuration));
  const defaults = createWorkflowGenerationSettings(initialDuration);
  const dirty = (Object.keys(defaults) as (keyof WorkflowGenerationSettings)[])
    .some((key) => settings[key] !== defaults[key]);

  function changeSettings(patch: Partial<WorkflowGenerationSettings>) {
    setSettings((current) => normalizeWorkflowGenerationSettings({ ...current, ...patch }));
  }

  return { settings, changeSettings, dirty };
}
