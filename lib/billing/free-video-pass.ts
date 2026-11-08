import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const FREE_VIDEO_PASS_ALLOWED_FORMATS = [
  "hook",
  "wall_text",
  "slideshow",
] as const;

export const FREE_VIDEO_PASS_EXCLUDED_VIDEO_MODELS = [
  "kling_4_0",
  "google_omni",
  "seedance_2_5",
  "wan_3_0",
  "flux_3",
] as const;

export function isFreeVideoPassAllowedVideoModel(
  model: string | null | undefined,
): boolean {
  if (!model) return false;
  return !(FREE_VIDEO_PASS_EXCLUDED_VIDEO_MODELS as readonly string[]).includes(
    model,
  );
}

export type FreeVideoPassAllowedFormat =
  (typeof FREE_VIDEO_PASS_ALLOWED_FORMATS)[number];

export type FreeVideoPassStatusValue =
  | "unclaimed"
  | "available"
  | "reserved"
  | "used"
  | "revoked";

export type FreeVideoPassStatus = {
  allowedFormats: readonly FreeVideoPassAllowedFormat[];
  available: boolean;
  claimedAt: string | null;
  code: string;
  reservedFormat: FreeVideoPassAllowedFormat | null;
  status: "available" | "reserved" | "used";
  usedAt: string | null;
};

export type FreeVideoPassReservationContext =
  | {
      format: "hook" | "wall_text";
      generationKey: string;
      kind: "starting_frame";
    }
  | {
      format: FreeVideoPassAllowedFormat;
      generationKey: string;
      kind: "generation";
      model?: string | null;
      totalUnits?: number;
    }
  | {
      format: "slideshow";
      generationKey: string;
      kind: "slideshow_face_swap";
    };

export type FreeVideoPassLinkRecord = {
  claimedAt: string | null;
  claimedByUserId: string | null;
  code: string;
  completedUnits: number;
  createdAt: string;
  createdByUserId: string;
  expiresAt: string | null;
  id: string;
  keyframeAttemptsUsed: number;
  label: string | null;
  passStatus: FreeVideoPassStatusValue;
  reservedFormat: FreeVideoPassAllowedFormat | null;
  reservedGenerationKey: string | null;
  reservedUnits: number;
  updatedAt: string;
  url: string;
  usedAt: string | null;
};

export type FreeVideoPassCodeInspection = {
  allowedFormats: readonly FreeVideoPassAllowedFormat[];
  canClaim: boolean;
  code: string;
  pass: FreeVideoPassStatus | null;
  reason: string | null;
  state:
    | "available_to_claim"
    | "claimed_by_viewer"
    | "already_claimed"
    | "expired"
    | "revoked"
    | "invalid";
};

type FreeVideoPassRow = {
  claimed_at: string | null;
  claimed_by_user_id: string | null;
  code: string;
  completed_units: number;
  created_at: string;
  created_by_user_id: string;
  expires_at: string | null;
  id: string;
  keyframe_attempts_used: number;
  label: string | null;
  pass_status: FreeVideoPassStatusValue;
  reserved_format: string | null;
  reserved_generation_key: string | null;
  reserved_units: number;
  updated_at: string;
  used_at: string | null;
};

export class FreeVideoPassError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "free_video_pass_error",
  ) {
    super(message);
    this.name = "FreeVideoPassError";
  }
}

let serviceClient: SupabaseClient | null = null;

export const FREE_VIDEO_PASS_COOKIE_NAME = "ugc_pending_free_video_code";
export const FREE_VIDEO_PASS_UI_COOKIE_NAME = "ugc_free_video_pass_active";

export function readPendingFreeVideoPassCodeFromRequest(
  request: Request,
): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${FREE_VIDEO_PASS_COOKIE_NAME}=`)) continue;
    const rawValue = trimmed.slice(`${FREE_VIDEO_PASS_COOKIE_NAME}=`.length);
    try {
      return normalizeFreeVideoPassCode(decodeURIComponent(rawValue));
    } catch {
      return normalizeFreeVideoPassCode(rawValue);
    }
  }
  return null;
}

export function isFreeVideoPassAllowedFormat(
  value: unknown,
): value is FreeVideoPassAllowedFormat {
  return (
    value === "hook" || value === "wall_text" || value === "slideshow"
  );
}

export function normalizeFreeVideoPassCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (
    trimmed.length < 12 ||
    trimmed.length > 128 ||
    !/^[A-Za-z0-9_-]+$/.test(trimmed)
  ) {
    return null;
  }
  return trimmed;
}

export function buildFreeVideoPassUrl(
  code: string,
  baseUrl = "https://vidmake.io",
): string {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  return `${cleanBase}/freevideo/${encodeURIComponent(code)}`;
}

export function generateFreeVideoPassCode(): string {
  return `fv_${randomBytes(12).toString("base64url")}`;
}

export async function createFreeVideoPassLinks(params: {
  baseUrl?: string;
  count?: number;
  createdByUserId: string;
  expiresAt?: string | null;
  label?: string | null;
}): Promise<FreeVideoPassLinkRecord[]> {
  const count = Math.min(Math.max(Math.trunc(params.count ?? 1), 1), 50);
  const createdByUserId = params.createdByUserId.trim();
  if (!createdByUserId) {
    throw new FreeVideoPassError("Admin user ID is required.", 400);
  }
  const label = params.label?.trim() ? params.label.trim().slice(0, 160) : null;
  const expiresAt = params.expiresAt ?? null;
  const rowsToInsert = Array.from({ length: count }, () => ({
    code: generateFreeVideoPassCode(),
    created_by_user_id: createdByUserId,
    expires_at: expiresAt,
    label,
    pass_status: "unclaimed" as const,
  }));

  const { data, error } = await getServiceClient()
    .from("free_video_pass_links")
    .insert(rowsToInsert)
    .select("*");

  if (error && isMissingFreeVideoPassTableError(error)) {
    return createFreeVideoPassLinksInFallbackLedger({
      baseUrl: params.baseUrl,
      codes: rowsToInsert.map((r) => r.code),
      createdByUserId,
      expiresAt,
      label,
    });
  }

  if (error || !Array.isArray(data)) {
    throw new FreeVideoPassError(
      `Could not create free video links: ${error?.message ?? "unknown error"}`,
      500,
    );
  }

  return (data as FreeVideoPassRow[]).map((row) =>
    mapFreeVideoPassRow(row, params.baseUrl),
  );
}

export async function listFreeVideoPassLinks(params?: {
  baseUrl?: string;
  limit?: number;
}): Promise<FreeVideoPassLinkRecord[]> {
  const limit = Math.min(Math.max(Math.trunc(params?.limit ?? 50), 1), 200);
  const { data, error } = await getServiceClient()
    .from("free_video_pass_links")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error && isMissingFreeVideoPassTableError(error)) {
    return listFreeVideoPassLinksFromFallbackLedger(params);
  }

  if (error) {
    throw new FreeVideoPassError(
      `Could not load free video links: ${error.message}`,
      500,
    );
  }

  return ((data ?? []) as FreeVideoPassRow[]).map((row) =>
    mapFreeVideoPassRow(row, params?.baseUrl),
  );
}

export async function inspectFreeVideoPassCode(
  rawCode: unknown,
  viewerUserId?: string | null,
): Promise<FreeVideoPassCodeInspection> {
  const code = normalizeFreeVideoPassCode(rawCode);
  if (!code) {
    return {
      allowedFormats: FREE_VIDEO_PASS_ALLOWED_FORMATS,
      canClaim: false,
      code: typeof rawCode === "string" ? rawCode.trim() : "",
      pass: null,
      reason: "This free video link is invalid. Check the URL and try again.",
      state: "invalid",
    };
  }

  const { data, error } = await getServiceClient()
    .from("free_video_pass_links")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (error && isMissingFreeVideoPassTableError(error)) {
    return inspectFreeVideoPassCodeInFallbackLedger(code, viewerUserId);
  }

  if (error) {
    throw new FreeVideoPassError(
      "Could not verify this free video link right now. Try again.",
      503,
    );
  }

  if (!data) {
    return {
      allowedFormats: FREE_VIDEO_PASS_ALLOWED_FORMATS,
      canClaim: false,
      code,
      pass: null,
      reason: "This free video link was not found.",
      state: "invalid",
    };
  }

  const row = data as FreeVideoPassRow;
  if (row.pass_status === "revoked") {
    return {
      allowedFormats: FREE_VIDEO_PASS_ALLOWED_FORMATS,
      canClaim: false,
      code,
      pass: null,
      reason: "This free video link is no longer active.",
      state: "revoked",
    };
  }

  if (
    row.expires_at &&
    new Date(row.expires_at).getTime() <= Date.now() &&
    !row.claimed_by_user_id
  ) {
    return {
      allowedFormats: FREE_VIDEO_PASS_ALLOWED_FORMATS,
      canClaim: false,
      code,
      pass: null,
      reason: "This free video link has expired.",
      state: "expired",
    };
  }

  if (row.claimed_by_user_id) {
    if (viewerUserId && row.claimed_by_user_id === viewerUserId) {
      const pass = await reconcileAndFormatPass(row);
      return {
        allowedFormats: FREE_VIDEO_PASS_ALLOWED_FORMATS,
        canClaim: false,
        code,
        pass,
        reason: null,
        state: "claimed_by_viewer",
      };
    }

    return {
      allowedFormats: FREE_VIDEO_PASS_ALLOWED_FORMATS,
      canClaim: false,
      code,
      pass: null,
      reason:
        "This single-use free video link has already been claimed.",
      state: "already_claimed",
    };
  }

  return {
    allowedFormats: FREE_VIDEO_PASS_ALLOWED_FORMATS,
    canClaim: true,
    code,
    pass: null,
    reason: null,
    state: "available_to_claim",
  };
}

export async function claimFreeVideoPassLink(params: {
  code: unknown;
  userId: string;
}): Promise<FreeVideoPassStatus> {
  const code = normalizeFreeVideoPassCode(params.code);
  const userId = params.userId.trim();
  if (!code || !userId) {
    throw new FreeVideoPassError(
      "Enter a valid free video link to claim your pass.",
      400,
      "invalid_free_video_pass_claim",
    );
  }

  const db = getServiceClient();
  const { data, error } = await db.rpc("claim_free_video_pass_link", {
    p_code: code,
    p_user_id: userId,
  });

  if (error && isMissingFreeVideoPassTableError(error)) {
    return claimFreeVideoPassLinkInFallbackLedger({ code, db, userId });
  }

  if (!error && data) {
    const row = (Array.isArray(data) ? data[0] : data) as FreeVideoPassRow;
    return reconcileAndFormatPass(row);
  }

  const message = error?.message ?? "";
  if (message.includes("free_video_pass_not_found")) {
    throw new FreeVideoPassError(
      "This free video link was not found.",
      404,
      "free_video_pass_not_found",
    );
  }
  if (message.includes("free_video_pass_revoked")) {
    throw new FreeVideoPassError(
      "This free video link is no longer active.",
      410,
      "free_video_pass_revoked",
    );
  }
  if (message.includes("free_video_pass_expired")) {
    throw new FreeVideoPassError(
      "This free video link has expired.",
      410,
      "free_video_pass_expired",
    );
  }
  if (message.includes("free_video_pass_already_claimed")) {
    throw new FreeVideoPassError(
      "This single-use free video link has already been claimed by another account.",
      409,
      "free_video_pass_already_claimed",
    );
  }
  if (message.includes("free_video_pass_user_already_has_pass")) {
    const existing = await getUserFreeVideoPass(userId, db);
    if (existing?.available) {
      return existing;
    }
    throw new FreeVideoPassError(
      "Your account has already claimed a free video pass.",
      409,
      "free_video_pass_user_already_has_pass",
    );
  }

  throw new FreeVideoPassError(
    "Could not claim this free video link right now. Please try again.",
    503,
  );
}

export async function getUserFreeVideoPass(
  userId: string,
  clientOverride?: SupabaseClient,
): Promise<FreeVideoPassStatus | null> {
  const trimmed = userId.trim();
  if (!trimmed) return null;

  try {
    const db = clientOverride ?? getServiceClient();
    const { data, error } = await db
      .from("free_video_pass_links")
      .select("*")
      .eq("claimed_by_user_id", trimmed)
      .neq("pass_status", "revoked")
      .limit(1)
      .maybeSingle();

    if (error && isMissingFreeVideoPassTableError(error)) {
      return await getUserFreeVideoPassFromFallbackLedger(trimmed, db);
    }

    if (error || !data) {
      return null;
    }

    return await reconcileAndFormatPass(data as FreeVideoPassRow, db);
  } catch {
    return null;
  }
}

export async function reserveFreeVideoPassCredits(params: {
  amount: number;
  context: FreeVideoPassReservationContext;
  idempotencyKey: string;
  jobType: "generate_image" | "generate_hook_video";
  userId: string;
}): Promise<{ amount: number; reservationId: string; status: string }> {
  const userId = params.userId.trim();
  const idempotencyKey = params.idempotencyKey.trim();
  const amount = Math.trunc(params.amount);
  const { context } = params;

  if (!userId || !idempotencyKey || !Number.isFinite(amount) || amount < 1) {
    throw new FreeVideoPassError("Invalid free video pass reservation.", 400);
  }
  if (!isFreeVideoPassAllowedFormat(context.format)) {
    throw new FreeVideoPassError(
      "Your free video pass covers 1 Hook Video, 1 Text-on-Screen Video, or 1 Slideshow (Talking Head is not included).",
      402,
      "free_video_pass_format_excluded",
    );
  }
  if (
    context.kind === "generation" &&
    context.model &&
    !isFreeVideoPassAllowedVideoModel(context.model)
  ) {
    throw new FreeVideoPassError(
      "Only Kling 3.0 is included on the free generation pass. Choose Kling 3.0 or upgrade your plan to use another video model.",
      402,
      "free_video_pass_model_excluded",
    );
  }

  const db = getServiceClient();

  // Check if this exact idempotencyKey was already reserved for this user.
  const { data: existingReservation } = await db
    .from("billing_credit_reservations")
    .select("id,amount,status,job_type,uses_free_generation_credits")
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existingReservation) {
    if (existingReservation.status === "released") {
      throw new FreeVideoPassError(
        "This generation request was already released. Start a new generation.",
        409,
        "billing_credit_reservation_released",
      );
    }
    return {
      amount: Number(existingReservation.amount ?? amount),
      reservationId: String(existingReservation.id),
      status: String(existingReservation.status ?? "reserved"),
    };
  }

  const { data: rawLink, error: linkError } = await db
    .from("free_video_pass_links")
    .select("*")
    .eq("claimed_by_user_id", userId)
    .neq("pass_status", "revoked")
    .limit(1)
    .maybeSingle();

  if (linkError && isMissingFreeVideoPassTableError(linkError)) {
    return reserveFreeVideoPassCreditsInFallbackLedger({
      amount,
      context,
      db,
      idempotencyKey,
      jobType: params.jobType,
      userId,
    });
  }

  if (linkError || !rawLink) {
    throw new FreeVideoPassError(
      "Choose a paid plan or use a valid free video link to generate.",
      402,
      "insufficient_billing_credits",
    );
  }

  await reconcileAndFormatPass(rawLink as FreeVideoPassRow, db);
  const { data: refreshedLink } = await db
    .from("free_video_pass_links")
    .select("*")
    .eq("id", (rawLink as FreeVideoPassRow).id)
    .single();

  const link = (refreshedLink ?? rawLink) as FreeVideoPassRow;
  const nowIso = new Date().toISOString();

  if (context.kind === "starting_frame") {
    if (context.format !== "hook" && context.format !== "wall_text") {
      throw new FreeVideoPassError(
        "Starting frame preparation on the free video pass is only available for Hook and Text-on-Screen videos.",
        402,
        "free_video_pass_format_excluded",
      );
    }
    if (link.pass_status !== "available") {
      throw new FreeVideoPassError(
        "Your 1 free video generation pass has already been used.",
        402,
        "insufficient_billing_credits",
      );
    }
    if ((link.keyframe_attempts_used ?? 0) >= 2) {
      throw new FreeVideoPassError(
        "You have reached the starting-frame preparation limit for your free video pass. Continue to animate your starting frame or upgrade.",
        402,
        "insufficient_billing_credits",
      );
    }

    const { data: updatedKeyframePass, error: updateKeyframeError } = await db
      .from("free_video_pass_links")
      .update({
        keyframe_attempts_used: (link.keyframe_attempts_used ?? 0) + 1,
        updated_at: nowIso,
      })
      .eq("id", link.id)
      .eq("pass_status", "available")
      .eq("keyframe_attempts_used", link.keyframe_attempts_used ?? 0)
      .select("id")
      .maybeSingle();

    if (updateKeyframeError || !updatedKeyframePass) {
      throw new FreeVideoPassError(
        "Could not reserve starting-frame preparation on your free pass. Try again.",
        409,
      );
    }
  } else if (context.kind === "generation") {
    const generationKey = context.generationKey.trim();
    if (!generationKey) {
      throw new FreeVideoPassError("Missing generation key.", 400);
    }
    if (link.pass_status === "available") {
      const { data: claimedGeneration, error: claimGenError } = await db
        .from("free_video_pass_links")
        .update({
          pass_status: "reserved",
          reserved_format: context.format,
          reserved_generation_key: generationKey,
          reserved_units: 1,
          updated_at: nowIso,
        })
        .eq("id", link.id)
        .eq("pass_status", "available")
        .select("id")
        .maybeSingle();

      if (claimGenError || !claimedGeneration) {
        throw new FreeVideoPassError(
          "Your 1 free video generation pass is already in use.",
          402,
          "insufficient_billing_credits",
        );
      }
    } else if (
      link.pass_status === "reserved" &&
      context.format === "slideshow" &&
      link.reserved_format === "slideshow" &&
      link.reserved_generation_key === generationKey &&
      link.reserved_units < Math.min(Math.max(context.totalUnits ?? 10, 1), 10)
    ) {
      const { data: incrementedSlide, error: slideError } = await db
        .from("free_video_pass_links")
        .update({
          reserved_units: link.reserved_units + 1,
          updated_at: nowIso,
        })
        .eq("id", link.id)
        .eq("pass_status", "reserved")
        .eq("reserved_generation_key", generationKey)
        .select("id")
        .maybeSingle();

      if (slideError || !incrementedSlide) {
        throw new FreeVideoPassError(
          "Could not reserve slide generation on your free pass.",
          402,
          "insufficient_billing_credits",
        );
      }
    } else {
      throw new FreeVideoPassError(
        "Your 1 free video generation pass has already been used. Upgrade to continue generating.",
        402,
        "insufficient_billing_credits",
      );
    }
  } else if (context.kind === "slideshow_face_swap") {
    const generationKey = context.generationKey.trim();
    if (
      link.reserved_format !== "slideshow" ||
      link.reserved_generation_key !== generationKey ||
      (link.pass_status !== "reserved" && link.pass_status !== "used") ||
      link.reserved_units >= 12
    ) {
      throw new FreeVideoPassError(
        "Face swap is only included for your active free-pass slideshow.",
        402,
        "insufficient_billing_credits",
      );
    }
    await db
      .from("free_video_pass_links")
      .update({
        reserved_units: link.reserved_units + 1,
        updated_at: nowIso,
      })
      .eq("id", link.id);
  }

  return await fundAndInsertFreeCreditReservation({
    amount,
    db,
    idempotencyKey,
    jobType: params.jobType,
    userId,
  });
}

async function fundAndInsertFreeCreditReservation(params: {
  amount: number;
  db: SupabaseClient;
  idempotencyKey: string;
  jobType: "generate_image" | "generate_hook_video";
  userId: string;
}): Promise<{ amount: number; reservationId: string; status: string }> {
  const { amount, db, idempotencyKey, jobType, userId } = params;
  const nowIso = new Date().toISOString();

  await db.rpc("ensure_free_generation_credit_balance", { p_user_id: userId });

  const { data: balanceRow, error: balanceReadError } = await db
    .from("free_generation_credit_balances")
    .select("credit_limit,used_credits,reserved_credits,granted_at")
    .eq("user_id", userId)
    .single();

  if (balanceReadError || !balanceRow) {
    throw new FreeVideoPassError(
      "Could not initialize free generation credit ledger.",
      503,
    );
  }

  const usedCredits = Number(balanceRow.used_credits ?? 0);
  const reservedCredits = Number(balanceRow.reserved_credits ?? 0);
  const currentLimit = Number(balanceRow.credit_limit ?? 0);
  const nextReserved = reservedCredits + amount;
  const nextLimit = Math.max(currentLimit, usedCredits + nextReserved);

  const { error: balanceUpdateError } = await db
    .from("free_generation_credit_balances")
    .update({
      credit_limit: nextLimit,
      reserved_credits: nextReserved,
      updated_at: nowIso,
    })
    .eq("user_id", userId);

  if (balanceUpdateError) {
    throw new FreeVideoPassError(
      `Could not fund free generation reservation: ${balanceUpdateError.message}`,
      500,
    );
  }

  const { data: reservation, error: insertError } = await db
    .from("billing_credit_reservations")
    .insert({
      amount,
      credit_period_start: balanceRow.granted_at ?? nowIso,
      idempotency_key: idempotencyKey,
      job_type: jobType,
      status: "reserved",
      user_id: userId,
      uses_free_generation_credits: true,
    })
    .select("id,amount,status")
    .single();

  if (insertError || !reservation) {
    throw new FreeVideoPassError(
      `Could not record free generation reservation: ${insertError?.message ?? "unknown error"}`,
      500,
    );
  }

  return {
    amount: Number(reservation.amount ?? amount),
    reservationId: String(reservation.id),
    status: String(reservation.status ?? "reserved"),
  };
}

async function reconcileAndFormatPass(
  row: FreeVideoPassRow,
  clientOverride?: SupabaseClient,
): Promise<FreeVideoPassStatus> {
  let status: "available" | "reserved" | "used" =
    row.pass_status === "used"
      ? "used"
      : row.pass_status === "reserved"
        ? "reserved"
        : "available";

  if (
    row.pass_status === "reserved" &&
    row.claimed_by_user_id &&
    row.reserved_generation_key
  ) {
    try {
      const db = clientOverride ?? getServiceClient();
      const { data: reservations } = await db
        .from("billing_credit_reservations")
        .select("idempotency_key,status")
        .eq("user_id", row.claimed_by_user_id)
        .like("idempotency_key", `${row.reserved_generation_key}%`);

      if (Array.isArray(reservations) && reservations.length > 0) {
        const hasCommitted = reservations.some(
          (item) => item.status === "committed",
        );
        const hasReserved = reservations.some(
          (item) => item.status === "reserved",
        );
        const allReleased = reservations.every(
          (item) => item.status === "released",
        );

        if (hasCommitted) {
          status = "used";
          await db
            .from("free_video_pass_links")
            .update({
              pass_status: "used",
              updated_at: new Date().toISOString(),
              used_at: row.used_at ?? new Date().toISOString(),
            })
            .eq("id", row.id);
        } else if (!hasReserved && allReleased) {
          status = "available";
          await db
            .from("free_video_pass_links")
            .update({
              pass_status: "available",
              reserved_format: null,
              reserved_generation_key: null,
              reserved_units: 0,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
        }
      }
    } catch {
      // Keep the stored row status if reconciliation query is unavailable.
    }
  }

  return {
    allowedFormats: FREE_VIDEO_PASS_ALLOWED_FORMATS,
    available: status === "available",
    claimedAt: row.claimed_at,
    code: row.code,
    reservedFormat: isFreeVideoPassAllowedFormat(row.reserved_format)
      ? row.reserved_format
      : null,
    status,
    usedAt: row.used_at,
  };
}

function mapFreeVideoPassRow(
  row: FreeVideoPassRow,
  baseUrl?: string,
): FreeVideoPassLinkRecord {
  return {
    claimedAt: row.claimed_at ?? null,
    claimedByUserId: row.claimed_by_user_id ?? null,
    code: row.code,
    completedUnits: Number(row.completed_units ?? 0),
    createdAt: row.created_at,
    createdByUserId: row.created_by_user_id,
    expiresAt: row.expires_at ?? null,
    id: row.id,
    keyframeAttemptsUsed: Number(row.keyframe_attempts_used ?? 0),
    label: row.label ?? null,
    passStatus: row.pass_status,
    reservedFormat: isFreeVideoPassAllowedFormat(row.reserved_format)
      ? row.reserved_format
      : null,
    reservedGenerationKey: row.reserved_generation_key ?? null,
    reservedUnits: Number(row.reserved_units ?? 0),
    updatedAt: row.updated_at,
    url: buildFreeVideoPassUrl(row.code, baseUrl),
    usedAt: row.used_at ?? null,
  };
}

function getServiceClient(): SupabaseClient {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new FreeVideoPassError(
      "Supabase is not configured for free video pass access.",
      503,
    );
  }

  serviceClient ??= createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return serviceClient;
}

function isMissingFreeVideoPassTableError(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST205" ||
    error.code === "PGRST202" ||
    error.code === "42P01" ||
    error.code === "42883" ||
    msg.includes("free_video_pass_links") ||
    msg.includes("claim_free_video_pass_link")
  );
}

type FallbackBalanceRow = {
  credit_limit: number;
  granted_at: string;
  reserved_credits: number;
  updated_at: string;
  used_credits: number;
  user_id: string;
};

async function createFreeVideoPassLinksInFallbackLedger(params: {
  baseUrl?: string;
  codes: string[];
  createdByUserId: string;
  expiresAt: string | null;
  label: string | null;
}): Promise<FreeVideoPassLinkRecord[]> {
  const db = getServiceClient();
  const nowIso = new Date().toISOString();
  const rows = params.codes.map((code) => ({
    credit_limit: 1,
    granted_at: nowIso,
    reserved_credits: 0,
    updated_at: nowIso,
    used_credits: 0,
    user_id: `fv_link:${code}`,
  }));

  const { data, error } = await db
    .from("free_generation_credit_balances")
    .insert(rows)
    .select("*");

  if (error || !Array.isArray(data)) {
    throw new FreeVideoPassError(
      `Could not create free video links: ${error?.message ?? "unknown error"}`,
      500,
    );
  }

  return (data as FallbackBalanceRow[]).map((row) => {
    const code = row.user_id.slice("fv_link:".length);
    return {
      claimedAt: null,
      claimedByUserId: null,
      code,
      completedUnits: 0,
      createdAt: row.granted_at ?? nowIso,
      createdByUserId: params.createdByUserId,
      expiresAt: params.expiresAt,
      id: row.user_id,
      keyframeAttemptsUsed: 0,
      label: params.label,
      passStatus: "unclaimed",
      reservedFormat: null,
      reservedGenerationKey: null,
      reservedUnits: 0,
      updatedAt: row.updated_at ?? nowIso,
      url: buildFreeVideoPassUrl(code, params.baseUrl),
      usedAt: null,
    };
  });
}

async function listFreeVideoPassLinksFromFallbackLedger(params?: {
  baseUrl?: string;
  limit?: number;
}): Promise<FreeVideoPassLinkRecord[]> {
  const limit = Math.min(Math.max(Math.trunc(params?.limit ?? 50), 1), 200);
  const db = getServiceClient();
  const { data: linkRows, error } = await db
    .from("free_generation_credit_balances")
    .select("*")
    .like("user_id", "fv_link:%")
    .order("granted_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new FreeVideoPassError(
      `Could not load free video links: ${error.message}`,
      500,
    );
  }

  const { data: claimRows } = await db
    .from("free_generation_credit_balances")
    .select("user_id,granted_at,updated_at")
    .like("user_id", "fv_claim:%");

  const claimByCode = new Map<
    string,
    { claimedAt: string; userId: string }
  >();
  for (const c of (claimRows ?? []) as Array<{
    granted_at: string;
    user_id: string;
  }>) {
    const rest = c.user_id.slice("fv_claim:".length);
    const sep = rest.indexOf(":");
    if (sep > 0) {
      claimByCode.set(rest.slice(0, sep), {
        claimedAt: c.granted_at,
        userId: rest.slice(sep + 1),
      });
    }
  }

  return ((linkRows ?? []) as FallbackBalanceRow[]).map((row) => {
    const code = row.user_id.slice("fv_link:".length);
    const claim = claimByCode.get(code) ?? null;
    const isClaimed = row.used_credits > 0 || Boolean(claim);
    return {
      claimedAt: claim?.claimedAt ?? (isClaimed ? row.updated_at : null),
      claimedByUserId: claim?.userId ?? null,
      code,
      completedUnits: 0,
      createdAt: row.granted_at,
      createdByUserId: "admin",
      expiresAt: null,
      id: row.user_id,
      keyframeAttemptsUsed: 0,
      label: null,
      passStatus: isClaimed ? "available" : "unclaimed",
      reservedFormat: null,
      reservedGenerationKey: null,
      reservedUnits: 0,
      updatedAt: row.updated_at,
      url: buildFreeVideoPassUrl(code, params?.baseUrl),
      usedAt: null,
    };
  });
}

async function inspectFreeVideoPassCodeInFallbackLedger(
  code: string,
  viewerUserId?: string | null,
): Promise<FreeVideoPassCodeInspection> {
  const db = getServiceClient();
  const { data: linkRow, error } = await db
    .from("free_generation_credit_balances")
    .select("*")
    .eq("user_id", `fv_link:${code}`)
    .maybeSingle();

  if (error) {
    throw new FreeVideoPassError(
      "Could not verify this free video link right now. Try again.",
      503,
    );
  }

  if (!linkRow) {
    return {
      allowedFormats: FREE_VIDEO_PASS_ALLOWED_FORMATS,
      canClaim: false,
      code,
      pass: null,
      reason: "This free video link was not found.",
      state: "invalid",
    };
  }

  const row = linkRow as FallbackBalanceRow;
  if (row.credit_limit === 0) {
    return {
      allowedFormats: FREE_VIDEO_PASS_ALLOWED_FORMATS,
      canClaim: false,
      code,
      pass: null,
      reason: "This free video link is no longer active.",
      state: "revoked",
    };
  }

  if (row.used_credits > 0) {
    if (viewerUserId) {
      const { data: claimRow } = await db
        .from("free_generation_credit_balances")
        .select("user_id")
        .eq("user_id", `fv_claim:${code}:${viewerUserId}`)
        .maybeSingle();
      if (claimRow) {
        const pass = await getUserFreeVideoPassFromFallbackLedger(
          viewerUserId,
          db,
        );
        return {
          allowedFormats: FREE_VIDEO_PASS_ALLOWED_FORMATS,
          canClaim: false,
          code,
          pass,
          reason: null,
          state: "claimed_by_viewer",
        };
      }
    }

    return {
      allowedFormats: FREE_VIDEO_PASS_ALLOWED_FORMATS,
      canClaim: false,
      code,
      pass: null,
      reason: "This single-use free video link has already been claimed.",
      state: "already_claimed",
    };
  }

  return {
    allowedFormats: FREE_VIDEO_PASS_ALLOWED_FORMATS,
    canClaim: true,
    code,
    pass: null,
    reason: null,
    state: "available_to_claim",
  };
}

async function claimFreeVideoPassLinkInFallbackLedger(params: {
  code: string;
  db: SupabaseClient;
  userId: string;
}): Promise<FreeVideoPassStatus> {
  const { code, db, userId } = params;
  const nowIso = new Date().toISOString();

  // 1. Check if this same user already claimed this exact link.
  const { data: existingSameClaim } = await db
    .from("free_generation_credit_balances")
    .select("user_id")
    .eq("user_id", `fv_claim:${code}:${userId}`)
    .maybeSingle();

  if (existingSameClaim) {
    const existingPass = await getUserFreeVideoPassFromFallbackLedger(
      userId,
      db,
    );
    if (existingPass) return existingPass;
  }

  // 2. Check the link row.
  const { data: linkRow, error: linkErr } = await db
    .from("free_generation_credit_balances")
    .select("*")
    .eq("user_id", `fv_link:${code}`)
    .maybeSingle();

  if (linkErr) {
    throw new FreeVideoPassError(
      "Could not claim this free video link right now. Please try again.",
      503,
    );
  }
  if (!linkRow) {
    throw new FreeVideoPassError(
      "This free video link was not found.",
      404,
      "free_video_pass_not_found",
    );
  }
  const link = linkRow as FallbackBalanceRow;
  if (link.credit_limit === 0) {
    throw new FreeVideoPassError(
      "This free video link is no longer active.",
      410,
      "free_video_pass_revoked",
    );
  }
  if (link.used_credits > 0) {
    throw new FreeVideoPassError(
      "This single-use free video link has already been claimed by another account.",
      409,
      "free_video_pass_already_claimed",
    );
  }

  // 3. Ensure user does not already hold a claimed pass.
  const existingUserPass = await getUserFreeVideoPassFromFallbackLedger(
    userId,
    db,
  );
  if (existingUserPass) {
    if (existingUserPass.available) {
      return existingUserPass;
    }
    throw new FreeVideoPassError(
      "Your account has already claimed a free video pass.",
      409,
      "free_video_pass_user_already_has_pass",
    );
  }

  // 4. Insert the per-user pass row (credit_limit = 10, used_credits = 0 (available), reserved_credits = 0 (keyframe attempts)).
  const { error: insertPassErr } = await db
    .from("free_generation_credit_balances")
    .insert({
      credit_limit: 10,
      granted_at: nowIso,
      reserved_credits: 0,
      updated_at: nowIso,
      used_credits: 0,
      user_id: `fv_pass:${userId}`,
    });

  if (insertPassErr) {
    // If a disabled pass row existed from an earlier race rollback, try activating it if credit_limit === 0
    const { data: reactivated } = await db
      .from("free_generation_credit_balances")
      .update({
        credit_limit: 10,
        granted_at: nowIso,
        reserved_credits: 0,
        updated_at: nowIso,
        used_credits: 0,
      })
      .eq("user_id", `fv_pass:${userId}`)
      .eq("credit_limit", 0)
      .select("user_id")
      .maybeSingle();

    if (!reactivated) {
      throw new FreeVideoPassError(
        "Your account has already claimed a free video pass.",
        409,
        "free_video_pass_user_already_has_pass",
      );
    }
  }

  // 5. Atomically mark the link row as claimed (used_credits: 0 -> 1).
  const { data: claimedLink, error: claimUpdateErr } = await db
    .from("free_generation_credit_balances")
    .update({
      updated_at: nowIso,
      used_credits: 1,
    })
    .eq("user_id", `fv_link:${code}`)
    .eq("used_credits", 0)
    .eq("credit_limit", 1)
    .select("user_id")
    .maybeSingle();

  if (claimUpdateErr || !claimedLink) {
    // Roll back the user's pass row so they didn't claim a raced link.
    await db
      .from("free_generation_credit_balances")
      .update({
        credit_limit: 0,
        reserved_credits: 0,
        updated_at: nowIso,
        used_credits: 0,
      })
      .eq("user_id", `fv_pass:${userId}`);

    throw new FreeVideoPassError(
      "This single-use free video link has already been claimed by another account.",
      409,
      "free_video_pass_already_claimed",
    );
  }

  // 6. Record the claim association.
  await db.from("free_generation_credit_balances").insert({
    credit_limit: 0,
    granted_at: nowIso,
    reserved_credits: 0,
    updated_at: nowIso,
    used_credits: 0,
    user_id: `fv_claim:${code}:${userId}`,
  });

  return {
    allowedFormats: FREE_VIDEO_PASS_ALLOWED_FORMATS,
    available: true,
    claimedAt: nowIso,
    code,
    reservedFormat: null,
    status: "available",
    usedAt: null,
  };
}

async function getUserFreeVideoPassFromFallbackLedger(
  userId: string,
  db: SupabaseClient,
): Promise<FreeVideoPassStatus | null> {
  const { data: passRow, error } = await db
    .from("free_generation_credit_balances")
    .select("*")
    .eq("user_id", `fv_pass:${userId}`)
    .maybeSingle();

  if (error || !passRow) return null;
  const pass = passRow as FallbackBalanceRow;
  if (pass.credit_limit === 0) return null;

  const { data: claimRows } = await db
    .from("free_generation_credit_balances")
    .select("user_id,granted_at")
    .like("user_id", `fv_claim:%:${userId}`)
    .limit(1);

  const claimRow = Array.isArray(claimRows) && claimRows[0] ? claimRows[0] : null;
  const code = claimRow
    ? String(claimRow.user_id)
        .slice("fv_claim:".length)
        .replace(new RegExp(`:${userId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "")
    : "fv_pass";

  const { data: genRows } = await db
    .from("free_generation_credit_balances")
    .select("*")
    .like("user_id", `fv_gen:${userId}:%`)
    .order("granted_at", { ascending: false })
    .limit(1);

  const activeGen =
    Array.isArray(genRows) && genRows[0]
      ? (genRows[0] as FallbackBalanceRow)
      : null;
  let reservedFormat: FreeVideoPassAllowedFormat | null = null;
  let reservedGenKey: string | null = null;
  if (activeGen) {
    const rest = activeGen.user_id.slice(`fv_gen:${userId}:`.length);
    const sep = rest.indexOf(":");
    if (sep > 0) {
      const fmt = rest.slice(0, sep);
      if (isFreeVideoPassAllowedFormat(fmt)) {
        reservedFormat = fmt;
      }
      reservedGenKey = rest.slice(sep + 1);
    }
  }

  // used_credits: 0 = available, 1 = reserved, 2 = used
  let status: "available" | "reserved" | "used" =
    pass.used_credits >= 2
      ? "used"
      : pass.used_credits === 1
        ? "reserved"
        : "available";

  if (status === "reserved" && reservedGenKey) {
    try {
      const { data: reservations } = await db
        .from("billing_credit_reservations")
        .select("idempotency_key,status")
        .eq("user_id", userId)
        .like("idempotency_key", `${reservedGenKey}%`);

      if (Array.isArray(reservations) && reservations.length > 0) {
        const hasCommitted = reservations.some((r) => r.status === "committed");
        const hasReserved = reservations.some((r) => r.status === "reserved");
        const allReleased = reservations.every((r) => r.status === "released");

        if (hasCommitted) {
          status = "used";
          await db
            .from("free_generation_credit_balances")
            .update({
              updated_at: new Date().toISOString(),
              used_credits: 2,
            })
            .eq("user_id", `fv_pass:${userId}`);
        } else if (!hasReserved && allReleased) {
          status = "available";
          reservedFormat = null;
          await db
            .from("free_generation_credit_balances")
            .update({
              updated_at: new Date().toISOString(),
              used_credits: 0,
            })
            .eq("user_id", `fv_pass:${userId}`);
        }
      }
    } catch {
      // Keep stored status if reconciliation fails.
    }
  }

  return {
    allowedFormats: FREE_VIDEO_PASS_ALLOWED_FORMATS,
    available: status === "available",
    claimedAt: claimRow?.granted_at ?? pass.granted_at,
    code,
    reservedFormat,
    status,
    usedAt: status === "used" ? pass.updated_at : null,
  };
}

async function reserveFreeVideoPassCreditsInFallbackLedger(params: {
  amount: number;
  context: FreeVideoPassReservationContext;
  db: SupabaseClient;
  idempotencyKey: string;
  jobType: "generate_image" | "generate_hook_video";
  userId: string;
}): Promise<{ amount: number; reservationId: string; status: string }> {
  const { amount, context, db, idempotencyKey, jobType, userId } = params;

  // Reconcile first
  await getUserFreeVideoPassFromFallbackLedger(userId, db);

  const { data: passRow, error: passErr } = await db
    .from("free_generation_credit_balances")
    .select("*")
    .eq("user_id", `fv_pass:${userId}`)
    .maybeSingle();

  if (passErr || !passRow || (passRow as FallbackBalanceRow).credit_limit === 0) {
    throw new FreeVideoPassError(
      "Choose a paid plan or use a valid free video link to generate.",
      402,
      "insufficient_billing_credits",
    );
  }

  const pass = passRow as FallbackBalanceRow;
  const nowIso = new Date().toISOString();

  if (context.kind === "starting_frame") {
    if (context.format !== "hook" && context.format !== "wall_text") {
      throw new FreeVideoPassError(
        "Starting frame preparation on the free video pass is only available for Hook and Text-on-Screen videos.",
        402,
        "free_video_pass_format_excluded",
      );
    }
    if (pass.used_credits !== 0) {
      throw new FreeVideoPassError(
        "Your 1 free video generation pass has already been used.",
        402,
        "insufficient_billing_credits",
      );
    }
    if (pass.reserved_credits >= 2) {
      throw new FreeVideoPassError(
        "You have reached the starting-frame preparation limit for your free video pass. Continue to animate your starting frame or upgrade.",
        402,
        "insufficient_billing_credits",
      );
    }

    const { data: updatedKeyframe, error: kfErr } = await db
      .from("free_generation_credit_balances")
      .update({
        reserved_credits: pass.reserved_credits + 1,
        updated_at: nowIso,
      })
      .eq("user_id", `fv_pass:${userId}`)
      .eq("used_credits", 0)
      .eq("reserved_credits", pass.reserved_credits)
      .select("user_id")
      .maybeSingle();

    if (kfErr || !updatedKeyframe) {
      throw new FreeVideoPassError(
        "Could not reserve starting-frame preparation on your free pass. Try again.",
        409,
      );
    }
  } else if (context.kind === "generation") {
    const generationKey = context.generationKey.trim();
    if (!generationKey) {
      throw new FreeVideoPassError("Missing generation key.", 400);
    }
    if (pass.used_credits === 0) {
      const { data: claimedGen, error: claimGenErr } = await db
        .from("free_generation_credit_balances")
        .update({
          updated_at: nowIso,
          used_credits: 1,
        })
        .eq("user_id", `fv_pass:${userId}`)
        .eq("used_credits", 0)
        .select("user_id")
        .maybeSingle();

      if (claimGenErr || !claimedGen) {
        throw new FreeVideoPassError(
          "Your 1 free video generation pass is already in use.",
          402,
          "insufficient_billing_credits",
        );
      }

      await db.from("free_generation_credit_balances").upsert({
        credit_limit: 12,
        granted_at: nowIso,
        reserved_credits: 1,
        updated_at: nowIso,
        used_credits: 0,
        user_id: `fv_gen:${userId}:${context.format}:${generationKey}`,
      });
    } else if (pass.used_credits === 1 && context.format === "slideshow") {
      const genRowId = `fv_gen:${userId}:slideshow:${generationKey}`;
      const { data: genRow } = await db
        .from("free_generation_credit_balances")
        .select("*")
        .eq("user_id", genRowId)
        .maybeSingle();

      const maxUnits = Math.min(Math.max(context.totalUnits ?? 10, 1), 10);
      if (
        !genRow ||
        (genRow as FallbackBalanceRow).reserved_credits >= maxUnits
      ) {
        throw new FreeVideoPassError(
          "Your 1 free video generation pass has already been used. Upgrade to continue generating.",
          402,
          "insufficient_billing_credits",
        );
      }

      const currentUnits = (genRow as FallbackBalanceRow).reserved_credits;
      const { data: incSlide, error: incErr } = await db
        .from("free_generation_credit_balances")
        .update({
          reserved_credits: currentUnits + 1,
          updated_at: nowIso,
        })
        .eq("user_id", genRowId)
        .eq("reserved_credits", currentUnits)
        .select("user_id")
        .maybeSingle();

      if (incErr || !incSlide) {
        throw new FreeVideoPassError(
          "Could not reserve slide generation on your free pass.",
          402,
          "insufficient_billing_credits",
        );
      }
    } else {
      throw new FreeVideoPassError(
        "Your 1 free video generation pass has already been used. Upgrade to continue generating.",
        402,
        "insufficient_billing_credits",
      );
    }
  } else if (context.kind === "slideshow_face_swap") {
    const generationKey = context.generationKey.trim();
    const genRowId = `fv_gen:${userId}:slideshow:${generationKey}`;
    const { data: genRow } = await db
      .from("free_generation_credit_balances")
      .select("*")
      .eq("user_id", genRowId)
      .maybeSingle();

    if (!genRow || (genRow as FallbackBalanceRow).reserved_credits >= 12) {
      throw new FreeVideoPassError(
        "Face swap is only included for your active free-pass slideshow.",
        402,
        "insufficient_billing_credits",
      );
    }

    await db
      .from("free_generation_credit_balances")
      .update({
        reserved_credits: (genRow as FallbackBalanceRow).reserved_credits + 1,
        updated_at: nowIso,
      })
      .eq("user_id", genRowId);
  }

  return await fundAndInsertFreeCreditReservation({
    amount,
    db,
    idempotencyKey,
    jobType,
    userId,
  });
}
