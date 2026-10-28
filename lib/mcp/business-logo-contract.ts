import { z } from "zod";
export const businessLogoUploadInput=z.strictObject({request_id:z.uuid(),file_name:z.string().trim().min(1).max(255).refine(value=>!/[\\/\0]/.test(value)),
  mime_type:z.enum(["image/png","image/jpeg","image/webp"]),file_size_bytes:z.number().int().min(1).max(2097152),sha256:z.string().regex(/^[a-f0-9]{64}$/)});
export const businessLogoAssetSchema=z.strictObject({fileSizeBytes:z.number().int().min(1).max(2097152),width:z.number().int().min(64).max(4096),height:z.number().int().min(64).max(4096),
  mimeType:z.enum(["image/png","image/jpeg","image/webp"]),storageKey:z.string().min(1).max(1000),url:z.url().regex(/^https:\/\//)});
export const businessLogoUploadSchema=z.strictObject({upload_id:z.uuid(),request_id:z.uuid(),file_name:z.string(),mime_type:z.enum(["image/png","image/jpeg","image/webp"]),file_size_bytes:z.number().int().min(1).max(2097152),
  sha256:z.string().regex(/^[a-f0-9]{64}$/),status:z.enum(["uploading","ready"]),created_at:z.string().datetime({offset:true}),updated_at:z.string().datetime({offset:true}),
  expires_at:z.string().datetime({offset:true}),logo:businessLogoAssetSchema.nullable()});
export const businessLogoLeaseSchema=z.strictObject({upload_id:z.uuid(),upload_url:z.url().regex(/^https:\/\//),expires_at:z.string().datetime({offset:true}),
  required_headers:z.strictObject({"Content-Type":z.enum(["image/png","image/jpeg","image/webp"]),"x-goog-content-length-range":z.string(),"x-goog-if-generation-match":z.literal("0")})});
