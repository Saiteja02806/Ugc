import { z } from "zod";

import type { BackgroundJobRecord } from "../jobs/background-jobs.ts";
import type { MediaAssetRow } from "../media/media-storage.ts";
import { CHARACTER_SOURCE, CharacterImageModelSchema, CharacterSpecSchema } from "./schema.ts";
import type { CharacterImageModel, CharacterSpec } from "./types.ts";

export { CHARACTER_SOURCE } from "./schema.ts";

export type PublicCharacter = {
  id: string;
  name: string;
  url: string;
  model: CharacterImageModel;
  gender: "male" | "female";
  createdAt: string;
};

export type TrustedCharacter = PublicCharacter & {
  userId: string;
  jobId: string;
  referenceMediaAssetId: string;
  referenceImageUrl: string;
  referenceStorageKey: string;
  characterSpec: CharacterSpec;
  businessProfileId: string | null;
  businessProfileVersion: number | null;
};

export type CharacterSourceJob = Pick<
  BackgroundJobRecord,
  "id" | "userId" | "jobType" | "status" | "input" | "output" | "outputReference"
>;

const provenanceSchema = z.object({
  characterSource: z.literal(CHARACTER_SOURCE),
  characterVersion: z.literal(1),
  characterSpec: CharacterSpecSchema,
  businessProfileId: z.string().trim().min(1).nullable(),
  businessProfileVersion: z.number().int().positive().nullable(),
  candidateIndex: z.number().int().min(1).max(3),
  generationId: z.string().trim().min(1),
  gender: z.enum(["male", "female"]),
  model: CharacterImageModelSchema,
});

const selectionSchema = z.object({
  source: z.literal(CHARACTER_SOURCE),
  version: z.literal(1),
  jobId: z.string().min(1),
  selectedAt: z.iso.datetime({ offset: true }),
});

export const CharacterSelectionRequestSchema = z.object({
  jobId: z.uuid(),
  name: z.string().trim().min(1).max(80).optional(),
}).strict();

export class CharacterIdentityError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CharacterIdentityError";
    this.status = status;
  }
}

type SelectionMarker = z.infer<typeof selectionSchema>;

export type CharacterIdentityStore = {
  getJob(jobId: string, userId: string): Promise<CharacterSourceJob | null>;
  getAsset(assetId: string, userId: string): Promise<MediaAssetRow | null>;
  getCandidateAsset(jobId: string, userId: string): Promise<MediaAssetRow | null>;
  listSelectedAssets(userId: string): Promise<MediaAssetRow[]>;
  // Atomic compare-and-set on the existing media row. No image or identity row is duplicated.
  promoteCandidate(input: {
    asset: MediaAssetRow;
    marker: SelectionMarker;
    name: string;
    userId: string;
  }): Promise<boolean>;
};

function getMarker(asset: MediaAssetRow) {
  if (!asset.metadata || typeof asset.metadata !== "object" || Array.isArray(asset.metadata)) {
    return null;
  }
  const parsed = selectionSchema.safeParse(asset.metadata.characterIdentity);
  return parsed.success ? parsed.data : null;
}

function getTrustedCandidate(
  job: CharacterSourceJob | null,
  asset: MediaAssetRow | null,
  userId: string,
): Omit<TrustedCharacter, "name" | "createdAt"> {
  if (!job || job.userId !== userId || !asset || asset.user_id !== userId) {
    throw new CharacterIdentityError("Character candidate was not found.", 404);
  }
  if (job.jobType !== "generate_image") {
    throw new CharacterIdentityError("Choose an image from the character builder.", 400);
  }
  const parsed = provenanceSchema.safeParse(job.input);
  if (!parsed.success || parsed.data.characterSpec.gender !== parsed.data.gender) {
    throw new CharacterIdentityError("Choose an image from the character builder.", 400);
  }
  const provenance = parsed.data;
  if ((provenance.businessProfileId === null) !== (provenance.businessProfileVersion === null)) {
    throw new CharacterIdentityError("Character context could not be verified.", 400);
  }
  if (job.status !== "completed" || asset.status !== "ready") {
    throw new CharacterIdentityError("Wait for this character to finish generating.", 409);
  }
  const output = job.output && typeof job.output === "object" && !Array.isArray(job.output)
    ? job.output
    : null;
  if (
    asset.deleted_at !== null ||
    asset.source_type !== "generated_image" ||
    asset.source_record_id !== job.id ||
    !["image", "influencer"].includes(asset.collection) ||
    !asset.mime_type.startsWith("image/") ||
    !output || output.url !== asset.url || output.key !== asset.storage_key ||
    output.model !== provenance.model ||
    output.generationId !== provenance.generationId ||
    !asset.url.startsWith("https://")
  ) {
    throw new CharacterIdentityError("Character reference could not be verified.", 409);
  }
  return {
    id: asset.id,
    url: asset.url,
    gender: provenance.gender,
    model: provenance.model,
    userId,
    jobId: job.id,
    referenceMediaAssetId: asset.id,
    referenceImageUrl: asset.url,
    referenceStorageKey: asset.storage_key,
    characterSpec: provenance.characterSpec,
    businessProfileId: provenance.businessProfileId,
    businessProfileVersion: provenance.businessProfileVersion,
  };
}

export function serializePublicCharacter(character: TrustedCharacter): PublicCharacter {
  return {
    id: character.id,
    name: character.name,
    url: character.url,
    model: character.model,
    gender: character.gender,
    createdAt: character.createdAt,
  };
}

function getTrustedSelectedCharacter(job: CharacterSourceJob | null, asset: MediaAssetRow | null, userId: string) {
  const candidate = getTrustedCandidate(job, asset, userId);
  const marker = asset ? getMarker(asset) : null;
  if (!asset || asset.collection !== "influencer" || marker?.jobId !== candidate.jobId) {
    throw new CharacterIdentityError("Saved character was not found.", 404);
  }
  return { ...candidate, name: asset.title, createdAt: marker.selectedAt } satisfies TrustedCharacter;
}

export function createCharacterIdentityService(store: CharacterIdentityStore) {
  return {
    async select(input: { jobId: string; name?: string; userId: string }): Promise<PublicCharacter> {
      const request = CharacterSelectionRequestSchema.safeParse({ jobId: input.jobId, name: input.name });
      if (!request.success || !input.userId.trim()) {
        throw new CharacterIdentityError("Choose a generated character and a name of up to 80 characters.", 400);
      }
      const job = await store.getJob(input.jobId, input.userId);
      // Read the candidate via the job source, never a supplied URL or media ID.
      const asset = await store.getCandidateAsset(input.jobId, input.userId);
      const candidate = getTrustedCandidate(job, asset, input.userId);
      if (!asset) throw new CharacterIdentityError("Character candidate was not found.", 404);
      if (getMarker(asset) && asset.collection === "influencer") {
        return serializePublicCharacter(getTrustedSelectedCharacter(job, asset, input.userId));
      }
      if (asset.collection !== "image") {
        throw new CharacterIdentityError("Character selection changed. Try again.", 409);
      }
      const marker: SelectionMarker = {
        source: CHARACTER_SOURCE,
        version: 1,
        jobId: candidate.jobId,
        selectedAt: new Date().toISOString(),
      };
      await store.promoteCandidate({
        asset,
        marker,
        name: request.data.name || "My AI influencer",
        userId: input.userId,
      });
      // A simultaneous select may win the compare-and-set. Both callers return that one identity.
      const savedAsset = await store.getAsset(asset.id, input.userId);
      return serializePublicCharacter(getTrustedSelectedCharacter(job, savedAsset, input.userId));
    },

    async get(id: string, userId: string): Promise<TrustedCharacter | null> {
      if (!z.uuid().safeParse(id).success || !userId.trim()) return null;
      const asset = await store.getAsset(id, userId);
      if (!asset || asset.user_id !== userId || asset.collection !== "influencer" || !getMarker(asset)) {
        return null;
      }
      const job = asset.source_record_id ? await store.getJob(asset.source_record_id, userId) : null;
      try {
        return getTrustedSelectedCharacter(job, asset, userId);
      } catch (error) {
        if (error instanceof CharacterIdentityError) return null;
        throw error;
      }
    },

    async list(userId: string): Promise<PublicCharacter[]> {
      const assets = await store.listSelectedAssets(userId);
      const results = await Promise.all(assets.map(async (asset) => {
        if (asset.user_id !== userId || !getMarker(asset)) return null;
        const job = asset.source_record_id ? await store.getJob(asset.source_record_id, userId) : null;
        try {
          return serializePublicCharacter(getTrustedSelectedCharacter(job, asset, userId));
        } catch (error) {
          if (error instanceof CharacterIdentityError) return null;
          throw error;
        }
      }));
      return results.filter((character): character is PublicCharacter => character !== null);
    },
  };
}
