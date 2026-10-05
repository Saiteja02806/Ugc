"use client";

import { useState } from "react";

import type { AIStudioVideoModel } from "@/lib/ai-studio/generation-settings";
import { createWorkflowGenerationSettings, normalizeWorkflowGenerationSettings, type WorkflowGenerationSettings } from "@/lib/explore/workflow-generation-settings";

/** The workflow owns these settings, so tab changes cannot discard the draft. */
export function useWorkflowGenerationSettings(initialDuration = 5, initialModel?: AIStudioVideoModel) {
  const [settings, setSettings] = useState(() => createWorkflowGenerationSettings(initialDuration, initialModel));
  const defaults = createWorkflowGenerationSettings(initialDuration, initialModel);
  const dirty = (Object.keys(defaults) as (keyof WorkflowGenerationSettings)[])
    .some((key) => settings[key] !== defaults[key]);

  function changeSettings(patch: Partial<WorkflowGenerationSettings>) {
    setSettings((current) => normalizeWorkflowGenerationSettings({ ...current, ...patch }));
  }

  return { settings, changeSettings, dirty };
}
