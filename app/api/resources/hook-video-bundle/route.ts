import { hookBundleHandlers } from "@/lib/resources/hook-video-bundle-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const GET = hookBundleHandlers.GET;
export const POST = hookBundleHandlers.POST;
