"use server";

import { generateHookLines } from "@/lib/marketing/hook-line-templates";

export type HookGeneratorState = {
  lines: string[];
  error: string | null;
};

export async function generateHookLinesAction(_previous: HookGeneratorState, formData: FormData): Promise<HookGeneratorState> {
  return generateHookLines({
    task: String(formData.get("task") ?? ""),
    product: String(formData.get("product") ?? ""),
    pattern: String(formData.get("pattern") ?? ""),
  });
}
