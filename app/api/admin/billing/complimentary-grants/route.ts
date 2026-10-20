import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ComplimentaryPlanAdminError,
  grantComplimentaryPlan,
  inspectComplimentaryPlanAccount,
  revokeComplimentaryPlan,
} from "@/lib/billing/complimentary-plan-admin";
import { requireBillingAdmin } from "@/lib/billing/server-admin-access";
import {
  FirebaseAdminLookupError,
} from "@/lib/firebase/admin-user-lookup";
import { FirebaseAuthRequestError } from "@/lib/firebase/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EmailSchema = z.string().trim().email().max(320).transform((email) =>
  email.toLowerCase(),
);
const GrantSchema = z
  .object({
    email: EmailSchema,
    expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
    planKey: z.enum(["starter", "growth"]),
    reason: z.string().trim().min(3).max(1000),
  })
  .strict();
const RevokeSchema = z
  .object({
    email: EmailSchema,
    reason: z.string().trim().min(3).max(1000),
  })
  .strict();

export async function GET(request: Request) {
  try {
    await requireBillingAdmin(request);
    const email = EmailSchema.safeParse(
      new URL(request.url).searchParams.get("email"),
    );

    if (!email.success) {
      return json({ error: "Provide a valid account email." }, 400);
    }

    return json({ ok: true, ...(await inspectComplimentaryPlanAccount(email.data)) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireBillingAdmin(request);
    const body = GrantSchema.safeParse(await request.json().catch(() => null));

    if (!body.success) {
      return json({ error: "Provide a valid complimentary plan grant." }, 400);
    }

    const inspected = await inspectComplimentaryPlanAccount(body.data.email);

    if (!inspected.account) {
      return json({ error: "No Firebase account exists for this email." }, 404);
    }

    const result = await grantComplimentaryPlan({
      account: inspected.account,
      expiresAt: body.data.expiresAt ?? null,
      grantedByUserId: admin.uid,
      planKey: body.data.planKey,
      reason: body.data.reason,
    });

    return json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await requireBillingAdmin(request);
    const body = RevokeSchema.safeParse(await request.json().catch(() => null));

    if (!body.success) {
      return json({ error: "Provide a valid revocation request." }, 400);
    }

    const result = await revokeComplimentaryPlan({
      email: body.data.email,
      reason: body.data.reason,
      revokedByUserId: admin.uid,
    });

    if (!result.account) {
      return json({ error: "No Firebase account exists for this email." }, 404);
    }

    return json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  if (
    error instanceof FirebaseAuthRequestError ||
    error instanceof FirebaseAdminLookupError ||
    error instanceof ComplimentaryPlanAdminError
  ) {
    return json({ error: error.message }, error.status);
  }

  console.error("Complimentary plan administration error:", error);
  return json({ error: "Could not manage complimentary plan access." }, 500);
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
