import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { z } from "zod";

import {
  confirmableOutputSchema,
  confirmationResultSchema,
  consumeConfirmToken,
  forgetConfirmTokenMemoryForTests,
  issueConfirmToken,
  requireConfirmation,
  resetConfirmTokensForTests,
  setConfirmDurableStoreForTests,
  setConfirmTokenClockForTests,
  withConfirmToken,
  CONFIRM_TOKEN_TTL_MS,
} from "./confirm-token.ts";
import { executeTool } from "./read-tools.ts";

afterEach(() => resetConfirmTokensForTests());

const execution = z.strictObject({
  asset_id: z.uuid(),
  deleted: z.literal(true),
});
const output = confirmableOutputSchema(execution);
const input = withConfirmToken(z.strictObject({ asset_id: z.uuid() }));

test("a missing token previews without running and a matching token runs once", async () => {
  let runs = 0;
  const args = { asset_id: "11111111-1111-4111-8111-111111111111" };
  const preview = await requireConfirmation({
    tool: "delete_asset",
    accountId: "owner-a",
    args,
    effect: "delete",
    summary: "Delete the selected asset.",
    creditCost: 0,
    creditCostIsEstimate: false,
    affected: [{ type: "asset", id: args.asset_id, label: "Owned media asset" }],
    run: async () => {
      runs += 1;
      return { asset_id: args.asset_id, deleted: true };
    },
  });
  assert.equal(runs, 0);
  confirmationResultSchema.parse(preview);
  output.parse(preview);
  assert.equal(preview.preview && (preview.preview as { credit_cost: number }).credit_cost, 0);

  const done = await requireConfirmation({
    tool: "delete_asset",
    accountId: "owner-a",
    args: { ...args, confirm_token: preview.confirm_token },
    effect: "delete",
    summary: "Delete the selected asset.",
    creditCost: 0,
    creditCostIsEstimate: false,
    affected: [],
    run: async () => {
      runs += 1;
      return { asset_id: args.asset_id, deleted: true };
    },
  });
  assert.equal(runs, 1);
  output.parse(done);
  assert.deepEqual(done, { asset_id: args.asset_id, deleted: true });
  const wrapped = await executeTool(async () => done);
  assert.equal("isError" in wrapped, false);
  if (!("structuredContent" in wrapped)) throw new Error("expected structured content");
  output.parse(wrapped.structuredContent);
});

test("tokens expire, cannot be reused, and reject a different account, tool, or arguments", async () => {
  const args = { asset_id: "22222222-2222-4222-8222-222222222222", nested: { b: 1, a: 2 } };
  const issued = issueConfirmToken({ accountId: "owner-a", tool: "delete_asset", args });
  await consumeConfirmToken({ token: issued.token, accountId: "owner-a", tool: "delete_asset", args: { nested: { a: 2, b: 1 }, asset_id: args.asset_id, confirm_token: issued.token } });
  await assert.rejects(
    () => consumeConfirmToken({ token: issued.token, accountId: "owner-a", tool: "delete_asset", args }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "CONFIRM_REUSED",
  );

  setConfirmTokenClockForTests(() => 1_000);
  const expiring = issueConfirmToken({ accountId: "owner-a", tool: "delete_asset", args });
  setConfirmTokenClockForTests(() => 1_000 + CONFIRM_TOKEN_TTL_MS);
  await assert.rejects(
    () => consumeConfirmToken({ token: expiring.token, accountId: "owner-a", tool: "delete_asset", args }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "CONFIRM_EXPIRED",
  );

  setConfirmTokenClockForTests(null);
  const fresh = issueConfirmToken({ accountId: "owner-a", tool: "delete_asset", args });
  await assert.rejects(
    () => consumeConfirmToken({ token: fresh.token, accountId: "owner-b", tool: "delete_asset", args }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "CONFIRM_ACCOUNT_MISMATCH",
  );
  await assert.rejects(
    () => consumeConfirmToken({ token: fresh.token, accountId: "owner-a", tool: "delete_demo", args }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "CONFIRM_ARGUMENT_MISMATCH",
  );
  await assert.rejects(
    () => consumeConfirmToken({ token: fresh.token, accountId: "owner-a", tool: "delete_asset", args: { ...args, asset_id: "33333333-3333-4333-8333-333333333333" } }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "CONFIRM_ARGUMENT_MISMATCH",
  );
  await assert.rejects(
    () => consumeConfirmToken({ token: `${fresh.token}x`, accountId: "owner-a", tool: "delete_asset", args }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "CONFIRM_INVALID",
  );
});

test("a durable store rejects reuse after this process forgets the token", async () => {
  const used = new Set<string>();
  process.env.MCP_CONFIRM_TOKEN_DURABLE = "true";
  setConfirmDurableStoreForTests({
    async consume(record) {
      if (used.has(record.jti)) return "reused";
      used.add(record.jti);
      return "ok";
    },
  });
  const args = { asset_id: "44444444-4444-4444-8444-444444444444" };
  const issued = issueConfirmToken({ accountId: "owner-a", tool: "create_schedule", args });
  await consumeConfirmToken({ token: issued.token, accountId: "owner-a", tool: "create_schedule", args });
  forgetConfirmTokenMemoryForTests();
  await assert.rejects(
    () => consumeConfirmToken({ token: issued.token, accountId: "owner-a", tool: "create_schedule", args }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "CONFIRM_REUSED",
  );
});

test("confirmed tool contracts accept a preview and an execution result", () => {
  assert.equal(output._zod.def.type, "object");
  const assetId = "55555555-5555-4555-8555-555555555555";
  output.parse({ asset_id: assetId, deleted: true });
  assert.throws(() => output.parse({ asset_id: assetId, deleted: false }));
  assert.equal(input.parse({ asset_id: assetId }).confirm_token, undefined);
  assert.equal(input.parse({ asset_id: assetId, confirm_token: "token" }).confirm_token, "token");
  assert.equal(input.safeParse({ asset_id: assetId, user_id: "owner-b" }).success, false);
  const link = confirmableOutputSchema(z.strictObject({
    request_id: z.uuid(),
    expires_at: z.iso.datetime({ offset: true }),
  }));
  const deadline = "2026-10-24T17:30:00.000Z";
  link.parse({
    confirmation_required: true,
    confirm_token: "token",
    expires_at: deadline,
    preview: {
      tool: "create_audio_upload",
      effect: "mutate",
      summary: "Issue a content-bound upload link.",
      credit_cost: 0,
      credit_cost_is_estimate: false,
      affected: [],
    },
  });
  link.parse({ request_id: assetId, expires_at: deadline });
  assert.throws(() => link.parse({ request_id: assetId }));
});
