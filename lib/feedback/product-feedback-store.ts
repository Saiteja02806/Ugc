import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  ProductFeedbackItem,
  ProductFeedbackStatus,
  ProductFeedbackType,
} from "@/lib/feedback/product-feedback-types";

type ProductFeedbackRow = {
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

type ProductFeedbackDatabase = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: Record<string, never>;
    Tables: {
      product_feedback: {
        Insert: Pick<
          ProductFeedbackRow,
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

export async function createProductFeedback(input: {
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
      "id,user_id,user_email,user_display_name,feedback_type,title,description,status,created_at",
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
