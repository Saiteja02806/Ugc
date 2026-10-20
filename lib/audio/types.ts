export type { AudioAccount, AudioAsset, AudioModel, AudioVoice } from "@/worker/src/lib/audio-contract";
import type { AudioAccount, AudioAsset, AudioModel, AudioVoice } from "@/worker/src/lib/audio-contract";
import type { AudioGenerationAccess } from "@/worker/src/lib/audio-access-policy";
export type AudioHistoryRequest = { id: string; requestKey?: string; kind: string; name: string; status: string; error: string | null; createdAt: string; outputAssetId: string | null; voiceProfileId: string | null; voiceStatus: string | null; testOnly: boolean; credits: number };
export type AudioHistory = { assets: AudioAsset[]; requests: AudioHistoryRequest[]; cleanupPending?: Array<{ id: string; kind: "asset" | "voice"; name: string }> };
export type AudioBootstrap = AudioHistory & { configured: boolean; enabled: boolean; generationAccess: AudioGenerationAccess; canGenerate: boolean; canClone: boolean; canUpload: boolean; storageReady: boolean; message: string | null; account: AudioAccount | null; voices: AudioVoice[]; models: AudioModel[]; creditCostPer1000: number; catalogueSource?: "account" | "public-preview" };
