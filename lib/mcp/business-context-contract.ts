import { z } from "zod";
import { WebsiteBusinessAnalysisSchema } from "../website-analysis/schema";
import { BusinessProfileIntakeTypeSchema, PrimaryGoalsDraftSchema } from "../business-profiles/schema";

export const businessContextReadSchema = WebsiteBusinessAnalysisSchema.extend({
  businessModel: WebsiteBusinessAnalysisSchema.shape.businessModel.optional(),
  campaignPurposes: WebsiteBusinessAnalysisSchema.shape.campaignPurposes.optional(),
  categories: WebsiteBusinessAnalysisSchema.shape.categories.optional(),
});
export const businessContextStateSchema = z.strictObject({ profile: z.strictObject({
  id: z.uuid(), context_revision: z.string().regex(/^[a-f0-9]{64}$/),
  active_profile_version: z.number().int().positive(), active_context: businessContextReadSchema,
  primary_goals: PrimaryGoalsDraftSchema, intake_type: BusinessProfileIntakeTypeSchema,
  draft: z.strictObject({ base_profile_version: z.number().int().positive(), context: businessContextReadSchema,
    source: z.string().max(4000).nullable(), updated_at: z.string().min(1).max(100),
  }).nullable(),
}).nullable() });
export const businessContextOperationSchema = z.enum(["save_draft", "apply"]);
export const businessContextReceiptSchema = z.strictObject({request_id: z.uuid(), operation: businessContextOperationSchema,
  state: businessContextStateSchema, future_content_only: z.literal(true),
});
export const businessContextResultSchema = z.strictObject({replayed: z.boolean(),receipt: businessContextReceiptSchema});
export const businessContextWriteSchema = z.strictObject({
  request_id: z.uuid(), expected_revision: z.string().regex(/^[a-f0-9]{64}$/),
  expected_profile_version: z.number().int().positive(),
  expected_draft_updated_at: z.string().datetime({offset:true}).max(100).nullable(),
  context: WebsiteBusinessAnalysisSchema,
});
export const businessContextSaveSchema = businessContextWriteSchema.extend({source:z.string().trim().max(4000).nullable().default(null)});
