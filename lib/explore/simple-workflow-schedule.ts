import type { ScheduleFormSubmission } from "../../components/scheduling/schedule-editor";
import { resolveZonedDateTime, validateScheduleLeadTime } from "../scheduling/schedule-time.ts";
import { getDefaultScheduleTargetSettings, getConfirmedScheduleTargetSettings, getScheduleTargetSettingsError, type ScheduleTargetSettings, type TikTokScheduleCapabilityState } from "../scheduling/platform-settings.ts";
import { parsePublishingPreferences } from "../scheduling/publishing-preferences.ts";
import { parseWorkflowConnectedAccounts, workflowAccountBlock } from "./workflow-connected-accounts";
import { workflowScheduleTargets, type WorkflowScheduleDraft } from "./workflow-scheduling-draft.ts";
import type { ScheduleCreateSourceInput } from "../scheduling/types";
import type { TikTokPublishCapabilities } from "../social/tiktok-publishing.ts";

/** Resolve the existing simple form on the explicit Schedule post click only. */
export async function prepareSimpleWorkflowSchedule({ draft, timezone, source, title, load }: {
  draft: WorkflowScheduleDraft; timezone: string; source: ScheduleCreateSourceInput; title: string;
  load: (url: string) => Promise<unknown>;
}): Promise<ScheduleFormSubmission> {
  const targets = workflowScheduleTargets(draft);
  if (!targets.length) throw new Error("Choose an account for each selected platform.");
  if (draft.caption.length > 5000) throw new Error("Keep your post caption within 5,000 characters.");
  const scheduledFor = resolveZonedDateTime({ date: draft.date, time: draft.time, timeZone: timezone });
  const needsPreferences = targets.some(target => target.platform !== "instagram");
  const [rawConfig, rawAccounts, rawPreferences] = await Promise.all([
    load("/api/schedules?configOnly=1"), load("/api/social/connections"),
    needsPreferences ? load("/api/account/publishing-preferences?schema=3") : null,
  ]);
  const config = rawConfig as { minimumScheduleLeadMinutes?: number };
  if (typeof config?.minimumScheduleLeadMinutes !== "number" || !Number.isFinite(config.minimumScheduleLeadMinutes) || config.minimumScheduleLeadMinutes < 0) throw new Error("Could not load scheduling limits. Try again.");
  if (!validateScheduleLeadTime({ scheduledFor, minimumLeadMinutes: config.minimumScheduleLeadMinutes }).valid) throw new Error(`Choose a time at least ${config.minimumScheduleLeadMinutes} minutes from now.`);
  const accounts = parseWorkflowConnectedAccounts(rawAccounts);
  const selected = targets.map(target => {
    const account = accounts.find(account => account.id === target.connectionId && account.platform === target.platform);
    if (!account) throw new Error("A selected account is unavailable. Refresh your accounts.");
    const blocked = workflowAccountBlock(account);
    if (blocked) throw new Error(blocked);
    return account;
  });
  const preferences = needsPreferences ? parsePublishingPreferences((rawPreferences as { preferences?: unknown })?.preferences) : null;
  const settings: Record<string, ScheduleTargetSettings> = {};
  const capabilities: Record<string, TikTokScheduleCapabilityState> = {};
  await Promise.all(selected.map(async account => {
    const value = getDefaultScheduleTargetSettings(account.platform);
    if (preferences && account.platform === "youtube") Object.assign(value, { containsSyntheticMedia: preferences.containsSyntheticMedia, privacyStatus: preferences.youtubePrivacyStatus, madeForKids: preferences.youtubeMadeForKids, notifySubscribers: preferences.youtubeNotifySubscribers });
    if (preferences && account.platform === "tiktok") {
      Object.assign(value, { containsSyntheticMedia: preferences.containsSyntheticMedia, privacyLevel: preferences.tiktokPrivacyLevel, allowComment: preferences.tiktokAllowComments, brandOrganic: preferences.tiktokBrandOrganic, commercialContentDisclosureEnabled: preferences.tiktokBrandOrganic });
      const raw = await load(`/api/social/connections/${encodeURIComponent(account.id)}/publish-settings`) as { capabilities?: TikTokPublishCapabilities };
      if (!raw?.capabilities || !Array.isArray(raw.capabilities.privacyLevels) || typeof raw.capabilities.directPostAudited !== "boolean") throw new Error("Could not load TikTok publishing settings. Try again.");
      capabilities[account.id] = { status: "ready", capabilities: raw.capabilities };
    }
    settings[account.id] = value;
  }));
  const settingsError = getScheduleTargetSettingsError({ connections: selected, settings, tiktokCapabilities: capabilities, requireTikTokMusicConfirmation: false });
  if (settingsError) throw new Error(`${settingsError} Update your publishing defaults in Settings.`);
  return { caption: draft.caption, clipSelection: "secondary_only", openingMedia: null, useOpeningClip: false,
    scheduledSource: source, scheduledSourceTitle: title, scheduledVideo: null,
    scheduledDate: draft.date, scheduledTime: draft.time, scheduledFor, timezone,
    targets: targets.map(target => ({ ...target, settings: getConfirmedScheduleTargetSettings(target.platform!, settings[target.connectionId]) })) };
}
