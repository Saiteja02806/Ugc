"use client";

import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { CarouselManualTextStyle } from "@/lib/carousel/manual-text";
import type {
  PauseAutomationUpcomingAction,
  SavedCarouselVisualStyle,
  TrendingSlideshowAutomationConfig,
  TrendingSlideshowAutomationRecord,
  TrendingSlideshowAutomationSlotRecord,
} from "@/lib/trending/slideshow-automation-contract";
import type { SlideshowAutomationWorkspaceState } from "@/lib/trending/slideshow-automation-service";

async function automationRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getCurrentUserIdToken();
  if (!token) {
    throw new Error("Sign in to configure Trending slideshow automation.");
  }

  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = (await response.json().catch(() => null)) as
    | ({ ok: true } & T)
    | { error?: string; message?: string; ok: false }
    | null;

  if (!response.ok || !data || data.ok !== true) {
    const message =
      (data && "message" in data && data.message) ||
      (data && "error" in data && data.error) ||
      "Could not update slideshow automation right now.";
    throw new Error(message);
  }

  return data;
}

export async function fetchSlideshowAutomationState(
  timezone?: string,
): Promise<SlideshowAutomationWorkspaceState> {
  const query = timezone
    ? `?timezone=${encodeURIComponent(timezone)}`
    : "";
  const result = await automationRequest<{
    state: SlideshowAutomationWorkspaceState;
  }>(`/api/trending/slideshow-automation${query}`);
  return result.state;
}

export async function saveSlideshowAutomationConfig(
  config: TrendingSlideshowAutomationConfig,
): Promise<TrendingSlideshowAutomationRecord> {
  const result = await automationRequest<{
    automation: TrendingSlideshowAutomationRecord;
  }>("/api/trending/slideshow-automation", {
    body: JSON.stringify({ config }),
    method: "PUT",
  });
  return result.automation;
}

export async function activateSlideshowAutomationRequest(
  config: TrendingSlideshowAutomationConfig,
): Promise<{
  automation: TrendingSlideshowAutomationRecord;
  slots: TrendingSlideshowAutomationSlotRecord[];
}> {
  return automationRequest<{
    automation: TrendingSlideshowAutomationRecord;
    slots: TrendingSlideshowAutomationSlotRecord[];
  }>("/api/trending/slideshow-automation/activate", {
    body: JSON.stringify({ config }),
    method: "POST",
  });
}

export async function pauseSlideshowAutomationRequest(
  action: PauseAutomationUpcomingAction,
): Promise<{
  automation: TrendingSlideshowAutomationRecord;
  cancelledSlotCount: number;
  slots: TrendingSlideshowAutomationSlotRecord[];
}> {
  return automationRequest<{
    automation: TrendingSlideshowAutomationRecord;
    cancelledSlotCount: number;
    slots: TrendingSlideshowAutomationSlotRecord[];
  }>("/api/trending/slideshow-automation/pause", {
    body: JSON.stringify({ action }),
    method: "POST",
  });
}

export async function saveVisualStylePresetRequest(params: {
  id?: string;
  name: string;
  style: CarouselManualTextStyle;
  textPosition?: { x: number; y: number };
}): Promise<SavedCarouselVisualStyle> {
  const result = await automationRequest<{
    preset: SavedCarouselVisualStyle;
  }>("/api/trending/slideshow-automation/styles", {
    body: JSON.stringify(params),
    method: "POST",
  });
  return result.preset;
}

export async function deleteVisualStylePresetRequest(
  styleId: string,
): Promise<void> {
  await automationRequest<{ deleted: boolean }>(
    "/api/trending/slideshow-automation/styles",
    {
      body: JSON.stringify({ styleId }),
      method: "DELETE",
    },
  );
}

export async function mutateAutomationSlotRequest(params: {
  action: "cancel" | "retry" | "skip";
  slotId: string;
}): Promise<{
  automation: TrendingSlideshowAutomationRecord;
  slots: TrendingSlideshowAutomationSlotRecord[];
}> {
  return automationRequest<{
    automation: TrendingSlideshowAutomationRecord;
    slots: TrendingSlideshowAutomationSlotRecord[];
  }>(`/api/trending/slideshow-automation/slots/${params.slotId}`, {
    body: JSON.stringify({ action: params.action }),
    method: "POST",
  });
}
