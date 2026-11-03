import { createStudioPreparationHandler } from "@/lib/characters/studio-preparation-api";

export const runtime = "nodejs";
export const maxDuration = 120;
export const POST = createStudioPreparationHandler();
