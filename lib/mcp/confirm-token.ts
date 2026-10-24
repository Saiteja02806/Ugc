import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { ToolFailure } from "./read-tools";

export const CONFIRM_TOKEN_TTL_MS = 10 * 60 * 1000;

export const CONFIRMATION_INSTRUCTION =
  "The first call without confirm_token returns a preview and does not perform the action. Show that preview to the user and ask for an explicit yes. Pass the returned confirm_token only after they agree. The token expires in 10 minutes, works once, and fails if the account, tool, or arguments change.";

export const CONFIRMED_MCP_TOOLS = [
  "generate_image",
  "generate_video",
  "generate_audio",
  "finish_video",
  "retry_operation",
  "remix_reference_text",
  "delete_asset",
  "delete_demo",
  "delete_asset_group",
  "create_schedule",
  "update_publishing_preferences",
  "save_business_context_draft",
  "apply_business_context",
  "mutate_business_onboarding",
] as const;

export type ConfirmedMcpTool = (typeof CONFIRMED_MCP_TOOLS)[number];
export type ConfirmEffect = "spend_credits" | "delete" | "publish" | "mutate_profile";

export const confirmTokenInput = z.string().trim().min(1).max(2000).optional().describe(
  "Omit on the first call. After the user explicitly agrees to the returned preview, pass this token unchanged.",
);

const affectedSchema = z.strictObject({
  type: z.string().min(1).max(80),
  id: z.string().min(1).max(200).nullable(),
  label: z.string().min(1).max(200),
});

const previewSchema = z.strictObject({
  tool: z.string().min(1).max(80),
  effect: z.enum(["spend_credits", "delete", "publish", "mutate_profile"]),
  summary: z.string().min(1).max(500),
  credit_cost: z.number().int().nonnegative().nullable(),
  credit_cost_is_estimate: z.boolean(),
  affected: z.array(affectedSchema).max(20),
});

export const confirmationResultSchema = z.strictObject({
  confirmation_required: z.literal(true),
  confirm_token: z.string().min(1).max(2000),
  expires_at: z.string().min(1).max(40),
  preview: previewSchema,
});

const CONFIRM_FIELDS = new Set(["confirmation_required", "confirm_token", "expires_at", "preview"]);

export function confirmableOutputSchema<
  Shape extends z.core.$ZodShape,
  Config extends z.core.$ZodObjectConfig,
>(execution: z.ZodObject<Shape, Config>) {
  for (const key of CONFIRM_FIELDS) {
    if (key in execution.shape) throw new Error(`Confirmation output collided with ${key}.`);
  }
  return execution.partial().extend({
    confirmation_required: z.literal(true).optional(),
    confirm_token: z.string().min(1).max(2000).optional(),
    expires_at: z.string().min(1).max(40).optional(),
    preview: previewSchema.optional(),
  }).superRefine((value, ctx) => {
    const record = value as Record<string, unknown>;
    if (record.confirmation_required === true) {
      const parsed = confirmationResultSchema.safeParse({
        confirmation_required: true,
        confirm_token: record.confirm_token,
        expires_at: record.expires_at,
        preview: record.preview,
      });
      if (!parsed.success) ctx.addIssue({ code: "custom", message: "The confirmation preview is incomplete.", path: ["preview"] });
      return;
    }
    const rest: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(record)) {
      if (CONFIRM_FIELDS.has(key) || item === undefined) continue;
      rest[key] = item;
    }
    const parsed = execution.safeParse(rest);
    if (!parsed.success) ctx.addIssue({ code: "custom", message: "The tool result does not match its contract.", path: [] });
  });
}

export function withConfirmToken<
  Shape extends z.core.$ZodShape,
  Config extends z.core.$ZodObjectConfig,
>(schema: z.ZodObject<Shape, Config>) {
  return schema.extend({ confirm_token: confirmTokenInput });
}

export function confirmedToolDescription(description: string) {
  return `${description} ${CONFIRMATION_INSTRUCTION}`;
}

export function omitConfirmToken<T extends object>(args: T): Omit<T, "confirm_token"> {
  const copy = { ...args };
  delete (copy as { confirm_token?: unknown }).confirm_token;
  return copy;
}

type TokenPayload = {
  v: 1;
  jti: string;
  uid: string;
  tool: string;
  args: string;
  exp: number;
};

const tokenPayload = z.object({
  v: z.literal(1),
  jti: z.uuid(),
  uid: z.string().min(1).max(200),
  tool: z.string().min(1).max(80),
  args: z.string().regex(/^[a-f0-9]{64}$/),
  exp: z.number().int(),
}).strict();

type DurableConsumeResult = "ok" | "reused";
export type ConfirmDurableStore = {
  consume(record: { jti: string; accountId: string; tool: string; expiresAt: string }): Promise<DurableConsumeResult>;
};

const consumed = new Map<string, number>();
let clock = () => Date.now();
let fallbackSecret: string | null = null;
let durableStore: ConfirmDurableStore | null = null;

function signingSecret() {
  const configured = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (configured) return configured;
  fallbackSecret ??= randomBytes(32).toString("base64url");
  return fallbackSecret;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      if (key === "confirm_token") continue;
      const item = source[key];
      if (item === undefined) continue;
      out[key] = canonicalize(item);
    }
    return out;
  }
  return value;
}

function argumentHash(args: unknown) {
  return createHash("sha256").update(JSON.stringify(canonicalize(args))).digest("hex");
}

function refuse(code: string, message: string): never {
  throw new ToolFailure(code, message);
}

function decodeToken(token: string): TokenPayload | null {
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra || encoded.length > 1800 || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  const expected = createHmac("sha256", signingSecret()).update(encoded).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    return tokenPayload.parse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
  } catch {
    return null;
  }
}

function remember(jti: string, exp: number) {
  const current = clock();
  if (consumed.size > 5000) {
    for (const [id, expires] of consumed) if (expires <= current) consumed.delete(id);
  }
  if (consumed.has(jti)) return false;
  consumed.set(jti, exp);
  return true;
}

async function consumeDurable(payload: TokenPayload): Promise<DurableConsumeResult> {
  if (process.env.MCP_CONFIRM_TOKEN_DURABLE !== "true") return "ok";
  if (durableStore) {
    return durableStore.consume({
      jti: payload.jti,
      accountId: payload.uid,
      tool: payload.tool,
      expiresAt: new Date(payload.exp).toISOString(),
    });
  }
  const { getMcpStore } = await import("./store");
  const { error } = await getMcpStore().from("mcp_confirm_tokens").insert({
    jti: payload.jti,
    account_id: payload.uid,
    tool: payload.tool,
    expires_at: new Date(payload.exp).toISOString(),
  });
  if (!error) return "ok";
  if (error.code === "23505") return "reused";
  throw new ToolFailure("CONFIRM_STORE_UNAVAILABLE", "Confirmation could not be recorded. Request a new preview.", true);
}

export function issueConfirmToken(input: { accountId: string; tool: string; args: unknown }) {
  const exp = clock() + CONFIRM_TOKEN_TTL_MS;
  const body = tokenPayload.parse({
    v: 1,
    jti: crypto.randomUUID(),
    uid: input.accountId,
    tool: input.tool,
    args: argumentHash(input.args),
    exp,
  });
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  const signature = createHmac("sha256", signingSecret()).update(encoded).digest("base64url");
  return { token: `${encoded}.${signature}`, expiresAt: new Date(exp).toISOString() };
}

export async function consumeConfirmToken(input: { token: string; accountId: string; tool: string; args: unknown }) {
  const payload = decodeToken(input.token);
  if (!payload) refuse("CONFIRM_INVALID", "The confirmation token is invalid. Request a new preview.");
  if (payload.exp <= clock()) refuse("CONFIRM_EXPIRED", "The confirmation token expired. Request a new preview.");
  if (payload.uid !== input.accountId) refuse("CONFIRM_ACCOUNT_MISMATCH", "The confirmation token belongs to a different account.");
  if (payload.tool !== input.tool || payload.args !== argumentHash(input.args)) {
    refuse("CONFIRM_ARGUMENT_MISMATCH", "The confirmation token does not match these arguments.");
  }
  if (consumed.has(payload.jti)) refuse("CONFIRM_REUSED", "The confirmation token was already used. Request a new preview.");
  try {
    if (await consumeDurable(payload) === "reused") {
      consumed.set(payload.jti, payload.exp);
      refuse("CONFIRM_REUSED", "The confirmation token was already used. Request a new preview.");
    }
  } catch (error) {
    if (error instanceof ToolFailure) throw error;
    throw new ToolFailure("CONFIRM_STORE_UNAVAILABLE", "Confirmation could not be recorded. Request a new preview.", true);
  }
  if (!remember(payload.jti, payload.exp)) refuse("CONFIRM_REUSED", "The confirmation token was already used. Request a new preview.");
}

export async function requireConfirmation<T extends object>(options: {
  tool: string;
  accountId: string;
  args: T;
  effect: ConfirmEffect;
  summary: string;
  creditCost: number | null;
  creditCostIsEstimate: boolean;
  affected: Array<{ type: string; id: string | null; label: string }>;
  run: () => Promise<Record<string, unknown>>;
}): Promise<Record<string, unknown>> {
  const token = (options.args as { confirm_token?: unknown }).confirm_token;
  if (typeof token !== "string" || !token.trim()) {
    const issued = issueConfirmToken({ accountId: options.accountId, tool: options.tool, args: options.args });
    return {
      confirmation_required: true,
      confirm_token: issued.token,
      expires_at: issued.expiresAt,
      preview: {
        tool: options.tool,
        effect: options.effect,
        summary: options.summary,
        credit_cost: options.creditCost,
        credit_cost_is_estimate: options.creditCostIsEstimate,
        affected: options.affected.slice(0, 20),
      },
    };
  }
  await consumeConfirmToken({ token, accountId: options.accountId, tool: options.tool, args: options.args });
  return options.run();
}

export function setConfirmTokenClockForTests(next: (() => number) | null) {
  clock = next ?? (() => Date.now());
}

export function setConfirmDurableStoreForTests(store: ConfirmDurableStore | null) {
  durableStore = store;
}

export function forgetConfirmTokenMemoryForTests() {
  consumed.clear();
}

export function resetConfirmTokensForTests() {
  consumed.clear();
  clock = () => Date.now();
  durableStore = null;
  delete process.env.MCP_CONFIRM_TOKEN_DURABLE;
}
