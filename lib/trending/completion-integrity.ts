import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { TrendingFeedCompletionAction } from "@/lib/trending/daily-feed";
import {
  acceptableCreatedScheduleStatuses,
  decideTrendingCompletionTransition,
  isCompletionResultForAction,
  type TrendingAssignmentState,
  type TrendingCompletionAction,
} from "@/lib/trending/completion-integrity-logic";

const USER_CAROUSEL_ASSIGNMENTS_TABLE = "user_carousel_assignments";
const LIBRARY_ITEMS_TABLE = "library_items";
const SCHEDULED_POSTS_TABLE = "scheduled_posts";

type AssignmentRow = {
  carousel_id: string;
  completion_action: TrendingCompletionAction | null;
  id: string;
  state: TrendingAssignmentState;
  user_id: string;
};

type LibraryItemRow = {
  deleted_at: string | null;
  id: string;
  media_type: "carousel";
  source_id: string;
  source_type: "generated_carousel";
  user_id: string;
};

type ScheduledPostRow = {
  id: string;
  library_item_id: string | null;
  source_kind: "library_item" | "media_asset";
  status: string;
  user_id: string;
};

type CompletionIntegrityDatabase = {
  public: {
    Functions: Record<string, never>;
    Tables: {
      library_items: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: LibraryItemRow;
        Update: Record<string, never>;
      };
      scheduled_posts: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: ScheduledPostRow;
        Update: Record<string, never>;
      };
      user_carousel_assignments: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: AssignmentRow;
        Update: Record<string, never>;
      };
    };
    Views: Record<string, never>;
  };
};

export type TrendingCompletionIntegrityErrorCode =
  | "assignment_not_active"
  | "completion_conflict"
  | "completion_state_invalid"
  | "library_save_required"
  | "schedule_required";

export class TrendingCompletionIntegrityError extends Error {
  readonly code: TrendingCompletionIntegrityErrorCode;
  readonly status: number;

  constructor(params: {
    code: TrendingCompletionIntegrityErrorCode;
    message: string;
    status?: number;
  }) {
    super(params.message);
    this.name = "TrendingCompletionIntegrityError";
    this.code = params.code;
    this.status = params.status ?? 409;
  }
}

let completionIntegrityClient:
  | SupabaseClient<CompletionIntegrityDatabase>
  | null = null;

export async function assertTrendingFeedCompletionAllowed(params: {
  action: TrendingFeedCompletionAction;
  assignmentId: string;
  userId: string;
}) {
  const assignment = await getAssignmentForUser(params);

  if (!assignment) {
    return { outcome: "not_found" as const };
  }

  const transition = decideTrendingCompletionTransition({
    action: params.action,
    assignment: {
      completionAction: assignment.completion_action,
      state: assignment.state,
    },
  });

  switch (transition.kind) {
    case "idempotent":
      return { outcome: "idempotent" as const };
    case "conflict":
      throw new TrendingCompletionIntegrityError({
        code: "completion_conflict",
        message: `This Trending carousel was already completed as ${transition.completedAction}.`,
      });
    case "not_active":
      throw new TrendingCompletionIntegrityError({
        code: "assignment_not_active",
        message: "This Trending carousel can no longer be completed.",
      });
    case "invalid":
      throw new TrendingCompletionIntegrityError({
        code: "completion_state_invalid",
        message: "This Trending carousel has an invalid completion state.",
      });
    case "complete":
      break;
  }

  if (params.action === "skipped") {
    return { outcome: "complete" as const };
  }

  const libraryItem = await getSavedLibraryItem({
    carouselId: assignment.carousel_id,
    userId: params.userId,
  });

  if (!libraryItem) {
    throw new TrendingCompletionIntegrityError({
      code: "library_save_required",
      message:
        "Save this carousel to your Library before marking it as completed.",
    });
  }

  if (params.action === "saved") {
    return { outcome: "complete" as const };
  }

  const schedule = await getCreatedSchedule({
    libraryItemId: libraryItem.id,
    userId: params.userId,
  });

  if (!schedule) {
    throw new TrendingCompletionIntegrityError({
      code: "schedule_required",
      message:
        "Create a schedule for this Library carousel before marking it as scheduled.",
    });
  }

  return { outcome: "complete" as const };
}

export function assertTrendingFeedCompletionResult(params: {
  action: TrendingFeedCompletionAction;
  completionAction: string | null;
  state: string;
}) {
  if (isCompletionResultForAction(params)) {
    return;
  }

  throw new TrendingCompletionIntegrityError({
    code: "completion_conflict",
    message:
      "This Trending carousel was completed by a different action. Refresh the feed and try another carousel.",
  });
}

async function getAssignmentForUser(params: {
  assignmentId: string;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from(USER_CAROUSEL_ASSIGNMENTS_TABLE)
    .select("id,user_id,carousel_id,state,completion_action")
    .eq("id", params.assignmentId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not verify the Trending assignment: ${error.message}`,
    );
  }

  return data;
}

async function getSavedLibraryItem(params: {
  carouselId: string;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from(LIBRARY_ITEMS_TABLE)
    .select("id,user_id,source_type,source_id,media_type,deleted_at")
    .eq("user_id", params.userId)
    .eq("source_type", "generated_carousel")
    .eq("source_id", params.carouselId)
    .eq("media_type", "carousel")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not verify the Library save: ${error.message}`);
  }

  return data;
}

async function getCreatedSchedule(params: {
  libraryItemId: string;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from(SCHEDULED_POSTS_TABLE)
    .select("id,user_id,source_kind,library_item_id,status")
    .eq("user_id", params.userId)
    .eq("source_kind", "library_item")
    .eq("library_item_id", params.libraryItemId)
    .in("status", [...acceptableCreatedScheduleStatuses])
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not verify the schedule: ${error.message}`);
  }

  return data;
}

function getClient() {
  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Trending completion verification is not configured.");
  }

  if (!completionIntegrityClient) {
    completionIntegrityClient = createClient<CompletionIntegrityDatabase>(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return completionIntegrityClient;
}
