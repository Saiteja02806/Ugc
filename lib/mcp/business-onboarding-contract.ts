import { z } from "zod";
import {
  BusinessDescriptionSchema, BusinessProfileOnboardingContextSchema,
  ManualBusinessProfileSchema, PrimaryGoalSchema, PrimaryGoalsDraftSchema, PrimaryGoalsSchema,
} from "../business-profiles/schema";

// Match every website intake, while rejecting hidden owner/job/analysis overrides.
export const onboardingSourceSchema = z.union([
  z.strictObject({ intakeType: z.literal("website"), websiteUrl: z.string().trim().min(1).max(2048), experience: z.literal("streamlined").optional() }),
  z.strictObject({ intakeType: z.literal("mobile_app_ai_prompt"), aiIdeContext: z.string().trim().min(1).max(24000), experience: z.literal("streamlined").optional() }),
  z.strictObject({ intakeType: z.literal("manual"), manual: ManualBusinessProfileSchema.strict(), experience: z.literal("streamlined").optional() }),
  z.strictObject({ intakeType: z.literal("manual"), businessName: z.string().trim().min(1).max(120), description: BusinessDescriptionSchema.shape.description, experience: z.literal("streamlined") }),
]);
export const onboardingChangeSchema = z.discriminatedUnion("action", [
  z.strictObject({action:z.literal("start"),source:onboardingSourceSchema}),
  z.strictObject({action:z.literal("identity"),business_name:BusinessProfileOnboardingContextSchema.shape.businessName,logo_storage_key:z.string().trim().min(1).max(1000).nullable().optional()}),
  z.strictObject({action:z.literal("goals"),primary_goals:PrimaryGoalsDraftSchema}),
  z.strictObject({action:z.literal("submit"),primary_goals:PrimaryGoalsSchema,timezone:z.string().trim().min(1).max(80).refine(value=>{try{new Intl.DateTimeFormat("en",{timeZone:value});return true;}catch{return false;}})}),
  z.strictObject({action:z.literal("edit")}),
]);
export const onboardingFenceSchema = z.strictObject({mode:z.enum(["legacy","background"]),profile_revision:z.string().regex(/^[a-f0-9]{64}$/).nullable(),draft_id:z.uuid().nullable(),draft_revision:z.number().int().positive().nullable()});
export const onboardingMutationSchema = z.strictObject({request_id:z.uuid(),expected_state:onboardingFenceSchema,change:onboardingChangeSchema});
export const onboardingJobSchema = z.strictObject({
  id: z.uuid(), status: z.enum(["cancelled","cancel_requested","completed","created","failed","processing","queued","rendering","stalled","uploading_output","waiting_external_service"]),
  progress: z.number().nullable(), stage: z.string().nullable(), updated_at: z.string().min(1),
});
export const onboardingProfileSchema = z.strictObject({
  analysisConfidence: z.enum(["low", "medium", "high"]), analysisSummary: z.string(), businessName: z.string(),
  id: z.uuid(), intakeType: z.enum(["website", "manual", "mobile_app_ai_prompt"]), logoStorageKey: z.string().nullable(), logoUrl: z.string().nullable(),
  onboardingComplete: z.boolean(), onboardingCompletedAt: z.string().nullable(), onboardingMissingFields: z.array(z.enum(["businessName", "primaryGoals"])),
  onboardingRequiredVersion: z.number().int().positive(), onboardingStep: z.union([z.literal(1),z.literal(2),z.literal(3)]),
  onboardingStatus: z.enum(["completed", "incomplete"]), onboardingVersion: z.number().int().nonnegative(),
  preparationError: z.string().nullable(), preparationStatus: z.enum(["failed", "preparing"]),
  primaryGoal: PrimaryGoalSchema.nullable(), primaryGoals: PrimaryGoalsDraftSchema, profileVersion: z.number().int().positive(),
});
export const onboardingStateSchema = z.strictObject({
  mode: z.enum(["background", "legacy"]), expected_state:onboardingFenceSchema, profile: onboardingProfileSchema.nullable(),
  draft: z.strictObject({ id: z.uuid(), revision: z.number().int().positive(), source_revision: z.number().int().positive(), source: onboardingSourceSchema,
    business_name: z.string(), suggested_name: z.string().nullable(), logo_storage_key: z.string().nullable(), logo_url: z.string().nullable(), primary_goals: PrimaryGoalsDraftSchema,
    step: z.union([z.literal(2), z.literal(3)]), submitted: z.boolean(), completed: z.boolean(), analysis_ready: z.boolean(),
    analysis_job: onboardingJobSchema.nullable(), finalization_job: onboardingJobSchema.nullable(),
  }).nullable(),
  // Recover recent setup work even when the legacy page has no profile yet.
  legacy_setup_jobs: z.array(onboardingJobSchema).max(20),
});

export const onboardingAcceptedDraftSchema = z.strictObject({id:z.uuid(),revision:z.number().int().positive(),source_revision:z.number().int().positive(),source:onboardingSourceSchema,
  business_name:z.string(),logo_storage_key:z.string().nullable(),logo_url:z.string().nullable(),primary_goals:PrimaryGoalsDraftSchema,
  step:z.union([z.literal(2),z.literal(3)]),submitted:z.boolean(),completed:z.boolean(),analysis_ready:z.boolean()});
export const onboardingReceiptSchema = z.strictObject({request_id:z.uuid(),mode:z.enum(["legacy","background"]),action:z.enum(["start","identity","goals","submit","edit"]),
  accepted_state:z.strictObject({expected_state:onboardingFenceSchema,profile:onboardingProfileSchema.nullable(),draft:onboardingAcceptedDraftSchema.nullable()}),
  job_ids:z.array(z.uuid()).max(2)});
export const onboardingMutationResultSchema = z.strictObject({replayed:z.boolean(),receipt:onboardingReceiptSchema});
