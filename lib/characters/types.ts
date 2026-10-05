import type { z } from "zod";
import type { BackgroundJobStatus } from "@/lib/jobs/background-jobs";
import type { CharacterGenderSchema, CharacterImageCountSchema, CharacterImageModelSchema } from "./schema";

export type { CharacterGenerateRequest, CharacterSpec } from "./schema";
export type CharacterGender = z.infer<typeof CharacterGenderSchema>;
export type CharacterImageModel = z.infer<typeof CharacterImageModelSchema>;
export type CharacterImageCount = z.infer<typeof CharacterImageCountSchema>;

export type CharacterJobReceipt = { jobId: string; generationId: string };
export type CharacterGenerationResponse = {
  ok: true;
  jobs: CharacterJobReceipt[];
  requestedCount: CharacterImageCount;
  partial: false;
  message: string;
};

export type CharacterGenerationAccess = {
  isPaid: boolean;
  canGenerate: boolean;
  freeGenerationAvailable: boolean;
  requestedCount: 1 | 3;
  imageCreditCost: number;
  affordableImageCount: number;
  creditsRequired: number;
  creditsRemaining: number;
  message: string | null;
};

export type CharacterJobStatusResponse = {
  ok: true;
  job: {
    id: string;
    status: BackgroundJobStatus;
    isTerminal: boolean;
    error: string | null;
    output: null | {
      url: string;
      mediaAssetId: string;
      generationId: string;
      width: number | null;
      height: number | null;
      ratio: string | null;
    };
  };
};
