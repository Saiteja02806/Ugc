import { after } from "next/server";
import { getAuthEmailHandlers } from "@/lib/auth/email-runtime";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(request: Request) {
  return getAuthEmailHandlers(after).sendVerification(request);
}
