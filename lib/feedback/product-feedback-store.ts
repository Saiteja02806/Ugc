import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  createProductFeedbackAttachmentUploadTarget,
  inspectProductFeedbackAttachment,
  ProductFeedbackAttachmentError,
} from "@/lib/feedback/product-feedback-attachment";
import type {
  ProductFeedbackAttachment,
  ProductFeedbackItem,
  ProductFeedbackStatus,
  ProductFeedbackType,
} from "@/lib/feedback/product-feedback-types";

type ProductFeedbackRow = {
  attachment_file_name: string | null;
  attachment_height: number | null;
  attachment_mime_type: string | null;
  attachment_size_bytes: number | null;
  attachment_storage_key: string | null;
  attachment_upload_id: string | null;
  attachment_width: number | null;
  created_at: string;
  description: string;
  feedback_type: ProductFeedbackType;
  id: string;
  source_path: string | null;
  status: ProductFeedbackStatus;
  title: string;
  updated_at: string;
  user_agent: string | null;
  user_display_name: string | null;
  user_email: string | null;
  user_id: string;
};

type ProductFeedbackAttachmentUploadRow = {
  attached_at: string | null;
  created_at: string;
  feedback_id: string | null;
  file_name: string;
  file_size_bytes: number;
  id: string;
  mime_type: string;
  status: "pending" | "attached";
  storage_key: string;
  user_id: string;
};

type ProductFeedbackDatabase = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: Record<string, never>;
    Tables: {
      product_feedback: {
        Insert: Pick<
          ProductFeedbackRow,
          | "attachment_file_name"
          | "attachment_height"
          | "attachment_mime_type"
          | "attachment_size_bytes"
          | "attachment_storage_key"
          | "attachment_upload_id"
          | "attachment_width"
          | "description"
          | "feedback_type"
          | "source_path"
          | "title"
          | "user_agent"
          | "user_display_name"
          | "user_email"
          | "user_id"
        >;
        Relationships: [];
        Row: ProductFeedbackRow;
        Update: Partial<Pick<ProductFeedbackRow, "status" | "updated_at">>;
      };
      product_feedback_attachment_uploads: {
        Insert: Pick<
          ProductFeedbackAttachmentUploadRow,
          | "file_name"
          | "file_size_bytes"
          | "id"
          | "mime_type"
          | "storage_key"
          | "user_id"
        >;
        Relationships: [];
        Row: ProductFeedbackAttachmentUploadRow;
        Update: Pick<
          ProductFeedbackAttachmentUploadRow,
          "attached_at" | "feedback_id" | "status"
        >;
      };
    };
    Views: Record<string, never>;
  };
};

export class ProductFeedbackStoreError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "ProductFeedbackStoreError";
    this.status = status;
  }
}

let productFeedbackClient: SupabaseClient<ProductFeedbackDatabase> | null = null;

export type PreparedProductFeedbackAttachment =
  ProductFeedbackAttachment & {
    id: string;
    storageKey: string;
  };

export async function createProductFeedbackAttachmentUpload(input: {
  contentType: string;
  fileName: string;
  fileSize: number;
  userId: string;
}) {
  const target = createProductFeedbackAttachmentUploadTarget(input);
  const client = getClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await client
    .from("product_feedback_attachment_uploads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .gte("created_at", oneHourAgo);

  if (countError) {
    throw new ProductFeedbackStoreError(
      "Could not verify the image attachment limit.",
    );
  }
  if ((count ?? 0) >= 5) {
    throw new ProductFeedbackStoreError(
      "You have attached several images recently. Wait a little before attaching another.",
      429,
    );
  }

  const { error } = await client
    .from("product_feedback_attachment_uploads")
    .insert({
      file_name: target.fileName,
      file_size_bytes: target.fileSize,
      id: target.attachmentId,
      mime_type: target.contentType,
      storage_key: target.storageKey,
      user_id: input.userId,
    });

  if (error) {
    throw new ProductFeedbackStoreError(
      "Could not prepare the image attachment. Try again.",
    );
  }

  return target;
}

export async function prepareProductFeedbackAttachment(input: {
  attachmentId: string;
  userId: string;
}): Promise<PreparedProductFeedbackAttachment> {
  const { data, error } = await getClient()
    .from("product_feedback_attachment_uploads")
    .select("id,user_id,storage_key,file_name,mime_type,file_size_bytes,status,feedback_id")
    .eq("id", input.attachmentId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (error) {
    throw new ProductFeedbackStoreError("Could not verify the attached image.");
  }
  if (!data || data.status !== "pending" || data.feedback_id) {
    throw new ProductFeedbackStoreError(
      "The attached image is unavailable. Attach it again and retry.",
      409,
    );
  }

  try {
    const inspected = await inspectProductFeedbackAttachment({
      expectedContentType: data.mime_type,
      expectedFileSize: data.file_size_bytes,
      storageKey: data.storage_key,
    });

    return {
      ...inspected,
      fileName: data.file_name,
      id: data.id,
      storageKey: data.storage_key,
    };
  } catch (error) {
    if (error instanceof ProductFeedbackAttachmentError) {
      throw new ProductFeedbackStoreError(error.message, error.status);
    }

    throw new ProductFeedbackStoreError(
      "Could not verify the attached image. Attach it again and retry.",
      422,
    );
  }
}

export async function createProductFeedback(input: {
  attachment: PreparedProductFeedbackAttachment | null;
  description: string;
  sourcePath: string | null;
  title: string;
  type: ProductFeedbackType;
  userAgent: string | null;
  userDisplayName: string | null;
  userEmail: string | null;
  userId: string;
}) {
  const client = getClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await client
    .from("product_feedback")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .gte("created_at", oneHourAgo);

  if (countError) {
    throw new ProductFeedbackStoreError(
      "Could not verify the feedback submission limit.",
    );
  }

  if ((count ?? 0) >= 10) {
    throw new ProductFeedbackStoreError(
      "You have sent several requests recently. Wait a little before sending another.",
      429,
    );
  }

  const { data, error } = await client
    .from("product_feedback")
    .insert({
      attachment_file_name: input.attachment?.fileName ?? null,
      attachment_height: input.attachment?.height ?? null,
      attachment_mime_type: input.attachment?.mimeType ?? null,
      attachment_size_bytes: input.attachment?.sizeBytes ?? null,
      attachment_storage_key: input.attachment?.storageKey ?? null,
      attachment_upload_id: input.attachment?.id ?? null,
      attachment_width: input.attachment?.width ?? null,
      description: input.description,
      feedback_type: input.type,
      source_path: input.sourcePath,
      title: input.title,
      user_agent: input.userAgent,
      user_display_name: input.userDisplayName,
      user_email: input.userEmail,
      user_id: input.userId,
    })
    .select("id,feedback_type,status,created_at")
    .single();

  if (error || !data) {
    throw new ProductFeedbackStoreError(
      input.type === "support_ticket"
        ? "Could not raise this ticket. Try again."
        : "Could not send this feature request. Try again.",
    );
  }

  if (input.attachment) {
    const { error: attachmentError } = await client
      .from("product_feedback_attachment_uploads")
      .update({
        attached_at: new Date().toISOString(),
        feedback_id: data.id,
        status: "attached",
      })
      .eq("id", input.attachment.id)
      .eq("user_id", input.userId);

    if (attachmentError) {
      console.error("Could not mark feedback image attachment as attached:", attachmentError);
    }
  }

  return {
    createdAt: data.created_at,
    id: data.id,
    status: data.status,
    type: data.feedback_type,
  };
}

export async function listProductFeedback(limit = 100) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const { data, error } = await getClient()
    .from("product_feedback")
    .select(
      "id,user_id,user_email,user_display_name,feedback_type,title,description,status,created_at,attachment_storage_key,attachment_file_name,attachment_mime_type,attachment_size_bytes,attachment_width,attachment_height",
    )
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw new ProductFeedbackStoreError(
      "Could not load customer requests. Try again.",
    );
  }

  return (data ?? []).map(
    (row): ProductFeedbackItem => ({
      attachment: toProductFeedbackAttachment(row),
      createdAt: row.created_at,
      description: row.description,
      id: row.id,
      status: row.status,
      title: row.title,
      type: row.feedback_type,
      userDisplayName: row.user_display_name,
      userEmail: row.user_email,
      userId: row.user_id,
    }),
  );
}

export async function getProductFeedbackAttachment(feedbackId: string) {
  const { data, error } = await getClient()
    .from("product_feedback")
    .select(
      "id,attachment_storage_key,attachment_file_name,attachment_mime_type,attachment_size_bytes,attachment_width,attachment_height",
    )
    .eq("id", feedbackId)
    .maybeSingle();

  if (error) {
    throw new ProductFeedbackStoreError("Could not load the attached image.");
  }

  const attachment = data ? toProductFeedbackAttachment(data) : null;
  const storageKey = data?.attachment_storage_key?.trim() || null;

  if (!attachment || !storageKey) {
    throw new ProductFeedbackStoreError("This request has no attached image.", 404);
  }

  return { attachment, storageKey };
}

function toProductFeedbackAttachment(
  row: Pick<
    ProductFeedbackRow,
    | "attachment_file_name"
    | "attachment_height"
    | "attachment_mime_type"
    | "attachment_size_bytes"
    | "attachment_storage_key"
    | "attachment_width"
  >,
): ProductFeedbackAttachment | null {
  if (
    !row.attachment_storage_key ||
    !row.attachment_file_name ||
    !row.attachment_mime_type ||
    !row.attachment_size_bytes ||
    !row.attachment_width ||
    !row.attachment_height
  ) {
    return null;
  }

  return {
    fileName: row.attachment_file_name,
    height: row.attachment_height,
    mimeType: row.attachment_mime_type,
    sizeBytes: row.attachment_size_bytes,
    width: row.attachment_width,
  };
}

function getClient() {
  if (productFeedbackClient) {
    return productFeedbackClient;
  }

  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new ProductFeedbackStoreError(
      "Product feedback storage is not configured.",
      503,
    );
  }

  productFeedbackClient = createClient<ProductFeedbackDatabase>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return productFeedbackClient;
}
