import { NextResponse } from "next/server";

import {
  createFreeVideoPassLinks,
  FreeVideoPassError,
  listFreeVideoPassLinks,
} from "@/lib/billing/free-video-pass";
import { requireBillingAdmin } from "@/lib/billing/server-admin-access";
import { FirebaseAuthRequestError } from "@/lib/firebase/server-auth";

export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  try {
    await requireBillingAdmin(request);
    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get("limit") ?? "50");
    const limit = Number.isFinite(rawLimit) ? rawLimit : 50;
    const baseUrl =
      url.searchParams.get("baseUrl")?.trim() || "https://vidmake.io";
    const links = await listFreeVideoPassLinks({ baseUrl, limit });

    return NextResponse.json(
      { links, ok: true },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireBillingAdmin(request);
    const body = (await request.json().catch(() => ({}))) as {
      baseUrl?: unknown;
      count?: unknown;
      expiresAt?: unknown;
      label?: unknown;
    };

    const count =
      typeof body.count === "number" && Number.isFinite(body.count)
        ? Math.trunc(body.count)
        : 1;
    if (count < 1 || count > 50) {
      return NextResponse.json(
        { error: "Generate between 1 and 50 links at a time.", ok: false },
        { headers: NO_STORE_HEADERS, status: 400 },
      );
    }

    const expiresAt = parseOptionalExpiresAt(body.expiresAt);
    const label =
      typeof body.label === "string" ? body.label.trim().slice(0, 160) : null;
    const baseUrl =
      typeof body.baseUrl === "string" && body.baseUrl.trim()
        ? body.baseUrl.trim()
        : "https://vidmake.io";

    const links = await createFreeVideoPassLinks({
      baseUrl,
      count,
      createdByUserId: admin.uid,
      expiresAt,
      label,
    });

    return NextResponse.json(
      { links, ok: true },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

function parseOptionalExpiresAt(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new FreeVideoPassError(
      "Expiration must be a valid future ISO timestamp or omitted.",
      400,
    );
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
    throw new FreeVideoPassError(
      "Expiration must be a valid future timestamp.",
      400,
    );
  }
  return parsed.toISOString();
}

function toErrorResponse(error: unknown) {
  if (
    error instanceof FirebaseAuthRequestError ||
    error instanceof FreeVideoPassError
  ) {
    return NextResponse.json(
      { error: error.message, ok: false },
      { headers: NO_STORE_HEADERS, status: error.status },
    );
  }

  console.error("Free video link administration error:", error);
  return NextResponse.json(
    { error: "Could not complete free video link action.", ok: false },
    { headers: NO_STORE_HEADERS, status: 500 },
  );
}
