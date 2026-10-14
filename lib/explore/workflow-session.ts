import type { MediaAsset } from "../media/types.ts";
import type { WorkflowGenerationSettings } from "./workflow-generation-settings.ts";
import { createWorkflowGenerationSettings, normalizeWorkflowGenerationSettings } from "./workflow-generation-settings.ts";
import { readFormatScheduleDraft } from "./format-schedule-draft.ts";
import type { WorkflowScheduleDraft } from "./workflow-scheduling-draft.ts";
import { workflowSourceVideoError, type WorkflowVideoMode } from "./workflow-source-video.ts";
import { EXPLORE_FINISH_STYLES, isExploreUuid, parseDemoFraming, type DemoFraming, type ExploreFinishStyle } from "../../worker/src/lib/explore-finishing-contract.ts";
import { parseSubtitleCorrections, type SubtitleCorrection } from "../../worker/src/subtitles/corrections.ts";

export type WorkflowSessionOptions = { subtitles: boolean; style: ExploreFinishStyle; backgroundMusic: boolean; placement?: "bottom" | "middle" | "top"; corrections?: SubtitleCorrection[] };
export type WorkflowSession = {
  version: 1; ownerId: string; kind: "hook"; section: "create" | "edit" | "schedule";
  sourceMode: WorkflowVideoMode; sourceAssetId: string | null; generatedAssetId: string | null; generatedSelectionCleared: boolean;
  demoAssetId: string | null; demoAudioAssetId: string | null; demoAudioPlayback: "once" | "repeat";
  demoFraming: { frame: DemoFraming; aspect: number } | null;
  pendingSource: boolean; pendingDemo: boolean; pendingDemoAudio: boolean;
  instructions: string; generationSettings: WorkflowGenerationSettings; localReferences: boolean;
  options: WorkflowSessionOptions; scheduleDraft: WorkflowScheduleDraft;
};
export type WorkflowSessionMediaRole = "source" | "demo" | "demoAudio";
export type WorkflowSessionAssets = { source: MediaAsset | null; demo: MediaAsset | null; demoAudio: MediaAsset | null };
export type WorkflowSessionProblems = Partial<Record<WorkflowSessionMediaRole, string>>;
export const WORKFLOW_SESSION_STORAGE_VERSION = 1;
const MAX_SESSION_BYTES = 512 * 1024;
const keys = ["version", "ownerId", "kind", "section", "sourceMode", "sourceAssetId", "generatedAssetId", "generatedSelectionCleared", "demoAssetId", "demoAudioAssetId", "demoAudioPlayback", "demoFraming", "pendingSource", "pendingDemo", "pendingDemoAudio", "instructions", "generationSettings", "localReferences", "options", "scheduleDraft"];
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const fields = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
const invalid = () => new Error("This saved workflow could not be verified. Retry recovery or reset the saved workflow; its generation and scheduling requests are kept separately.");
const assetId = (value: unknown) => value === null ? null : isExploreUuid(value) ? value.toLowerCase() : (() => { throw invalid(); })();

export function workflowSessionStorageKey(ownerId: string): string {
  return `ugc-explore:workflow-session:v1:${encodeURIComponent(ownerId)}:hook`;
}
export function createWorkflowSession(ownerId: string, settings = createWorkflowGenerationSettings()): WorkflowSession {
  return { version: 1, ownerId, kind: "hook", section: "create", sourceMode: "generate", sourceAssetId: null, generatedAssetId: null, generatedSelectionCleared: false,
    demoAssetId: null, demoAudioAssetId: null, demoAudioPlayback: "once", demoFraming: null,
    pendingSource: false, pendingDemo: false, pendingDemoAudio: false, instructions: "", generationSettings: settings, localReferences: false,
    options: { subtitles: false, style: "clean", backgroundMusic: false, placement: "bottom" },
    scheduleDraft: { platform: "", caption: "", date: "", time: "", connectionId: "" } };
}
export function parseWorkflowSession(value: unknown, ownerId: string): WorkflowSession {
  if (!object(value) || !fields(value, keys) || value.version !== 1 || value.ownerId !== ownerId || value.kind !== "hook" ||
      !["create", "edit", "schedule"].includes(String(value.section)) || !["generate", "upload", "assets"].includes(String(value.sourceMode)) ||
      !["once", "repeat"].includes(String(value.demoAudioPlayback)) ||
      [value.pendingSource, value.pendingDemo, value.pendingDemoAudio, value.localReferences, value.generatedSelectionCleared].some(field => typeof field !== "boolean") ||
      typeof value.instructions !== "string" || value.instructions.length > 20_000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value.instructions) ||
      !object(value.generationSettings) || !fields(value.generationSettings, ["model", "duration", "quantity", "resolution", "aspectRatio"]) ||
      !object(value.options) || !fields(value.options, ["subtitles", "style", "backgroundMusic", "placement", "corrections"]) ||
      typeof value.options.subtitles !== "boolean" || typeof value.options.backgroundMusic !== "boolean" ||
      !EXPLORE_FINISH_STYLES.includes(value.options.style as ExploreFinishStyle) ||
      value.options.placement !== undefined && !["bottom", "middle", "top"].includes(String(value.options.placement))) throw invalid();
  const scheduleDraft = readFormatScheduleDraft(JSON.stringify({ version: 1, key: "workflow-session", draft: value.scheduleDraft }), "workflow-session");
  if (!scheduleDraft) throw invalid();
  // Model availability may change between visits; retain supported settings atomically.
  const generationSettings = normalizeWorkflowGenerationSettings(value.generationSettings as Partial<WorkflowGenerationSettings>);
  const demoAssetId = assetId(value.demoAssetId), demoAudioAssetId = assetId(value.demoAudioAssetId);
  if (demoAudioAssetId && !demoAssetId) throw invalid();
  let demoFraming: WorkflowSession["demoFraming"] = null;
  if (value.demoFraming !== null) {
    if (!object(value.demoFraming) || !fields(value.demoFraming, ["frame", "aspect"]) || typeof value.demoFraming.aspect !== "number" || !Number.isFinite(value.demoFraming.aspect) || value.demoFraming.aspect <= 0 || !demoAssetId) throw invalid();
    demoFraming = { frame: parseDemoFraming(value.demoFraming.frame), aspect: value.demoFraming.aspect };
  }
  const options: WorkflowSessionOptions = { subtitles: value.options.subtitles, style: value.options.style as ExploreFinishStyle,
    backgroundMusic: value.options.backgroundMusic, placement: (value.options.placement ?? "bottom") as WorkflowSessionOptions["placement"],
    ...(value.options.corrections !== undefined ? { corrections: parseSubtitleCorrections(value.options.corrections) } : {}) };
  return { version: 1, ownerId, kind: "hook", section: value.section as WorkflowSession["section"], sourceMode: value.sourceMode as WorkflowVideoMode,
    sourceAssetId: assetId(value.sourceAssetId), generatedAssetId: assetId(value.generatedAssetId), generatedSelectionCleared: value.generatedSelectionCleared as boolean, demoAssetId, demoAudioAssetId,
    demoAudioPlayback: demoAudioAssetId ? value.demoAudioPlayback as "once" | "repeat" : "once", demoFraming,
    pendingSource: value.pendingSource as boolean, pendingDemo: value.pendingDemo as boolean, pendingDemoAudio: value.pendingDemoAudio as boolean,
    instructions: value.instructions, generationSettings, localReferences: value.localReferences as boolean, options, scheduleDraft };
}
export function readWorkflowSession(raw: string | null, ownerId: string): WorkflowSession | null {
  if (raw === null) return null;
  if (!raw || raw.length > MAX_SESSION_BYTES) throw invalid();
  try { return parseWorkflowSession(JSON.parse(raw), ownerId); } catch { throw invalid(); }
}
export function serializeWorkflowSession(session: WorkflowSession): string {
  const raw = JSON.stringify(parseWorkflowSession(session, session.ownerId));
  if (raw.length > MAX_SESSION_BYTES) throw invalid();
  return raw;
}
export function workflowSessionOpeningId(session: WorkflowSession): string | null {
  return session.sourceMode === "generate" ? session.generatedAssetId : session.sourceAssetId;
}
export function workflowSessionAssetError(asset: MediaAsset, id: string, role: WorkflowSessionMediaRole): string | null {
  if (asset.id !== id || !asset.url.startsWith("https://")) return "The saved media could not be verified.";
  if (role === "demoAudio") return asset.status !== "ready" || asset.collection !== "audio" || !asset.mimeType.startsWith("audio/") || asset.durationSeconds === null || !Number.isFinite(asset.durationSeconds) || asset.durationSeconds <= 0 || asset.durationSeconds > 600 ? "Choose ready demo audio up to 10 minutes long." : null;
  return workflowSourceVideoError(asset) ?? (asset.durationSeconds !== null && asset.durationSeconds < 1 ? "Choose a video at least one second long." : null);
}
/** Reads only. A missing selection remains explicit and cannot fall back to another result. */
export async function restoreWorkflowSessionAssets(session: WorkflowSession, load: (id: string) => Promise<MediaAsset>, assertActive: () => void = () => {}) {
  const assets: WorkflowSessionAssets = { source: null, demo: null, demoAudio: null };
  const problems: WorkflowSessionProblems = {};
  const roles: [WorkflowSessionMediaRole, string | null][] = [["source", workflowSessionOpeningId(session)], ["demo", session.demoAssetId], ["demoAudio", session.demoAudioAssetId]];
  const reads = new Map<string, Promise<MediaAsset>>();
  const results = await Promise.allSettled(roles.map(async ([role, id]) => {
    if (!id) return;
    let request = reads.get(id); if (!request) { request = load(id); reads.set(id, request); }
    const asset = await request; assertActive();
    const problem = workflowSessionAssetError(asset, id, role);
    if (problem) throw new Error(problem);
    if (role === "source" && session.sourceMode === "generate" && asset.sourceType !== "generated_video") throw new Error("Choose a generated video for this saved result.");
    return { role, asset };
  }));
  assertActive();
  results.forEach((result, index) => {
    const role = roles[index][0];
    if (result.status === "fulfilled" && result.value) assets[role] = result.value.asset;
    else if (result.status === "rejected") problems[role] = `Your saved ${role === "source" ? "talking-head video" : role === "demo" ? "demo video" : "demo audio"} is unavailable. Retry recovery or choose a replacement.`;
  });
  if (session.pendingSource) problems.source = "Your last video selection was interrupted. Choose it again or remove it before preparing the video.";
  if (session.pendingDemo) problems.demo = "Your last demo upload was interrupted. Choose it again or remove the demo before preparing the video.";
  if (session.pendingDemoAudio) problems.demoAudio = "Your last demo audio upload was interrupted. Choose it again or remove the audio before preparing the video.";
  return { assets, problems };
}
