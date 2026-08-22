export type Json =
  | boolean
  | null
  | number
  | string
  | { [key: string]: Json | undefined }
  | Json[];

export type AvatarAssetRatio = "9:16" | "1:1" | "4:5" | "16:9" | "other";

export type AvatarAssetStatus = "ready" | "disabled" | "processing" | "failed";

export type AvatarAssetType = "global";

export type AvatarAssetRow = {
  avatar_type: AvatarAssetType;
  created_at: string;
  deleted_at: string | null;
  description: string | null;
  duration_seconds: number | null;
  has_audio: boolean;
  height: number | null;
  hook_text_placement: Json | null;
  id: string;
  influencer_key: string | null;
  metadata: Json;
  name: string;
  ratio: AvatarAssetRatio;
  sort_order: number;
  source_batch: string | null;
  source_file_sha256: string | null;
  source_s3_key: string;
  source_video_url: string;
  status: AvatarAssetStatus;
  thumbnail_url: string | null;
  updated_at: string;
  visual_group: string | null;
  width: number | null;
};

export type UserAvatarPreferenceRow = {
  avatar_asset_id: string;
  created_at: string;
  id: string;
  is_trimmed: boolean;
  last_used_at: string | null;
  trim_end: number | null;
  trim_start: number | null;
  updated_at: string;
  user_id: string;
};

export type AvatarAssetWithPreference = {
  asset: AvatarAssetRow;
  preference: UserAvatarPreferenceRow | null;
};

export type AvatarSelection = {
  avatarAssetId: string;
  isTrimmed: boolean;
  sourceVideoUrl: string;
  trimEnd: number | null;
  trimStart: number;
};

export type AvatarTrimInput = {
  isTrimmed: boolean;
  trimEnd: number | null;
  trimStart: number | null;
};
