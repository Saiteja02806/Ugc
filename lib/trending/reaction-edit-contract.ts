import { z } from "zod";

export const ReactionTextEditRequestSchema = z.object({
  assignmentId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  text: z.string().trim().min(1).max(300).refine((text) => {
    const lines = text.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
    const words = text.split(/\s+/u).filter(Boolean).length;
    return lines.length <= 3 && words >= 5 && words <= 20;
  }, "Use 5–20 words across up to three lines."),
}).strict();

export type ReactionTextEditState = "ready" | "preparing" | "failed";
export type ReactionTextEditRecord = {
  assignmentId: string;
  creativeId: string;
  expectedUpdatedAt: string;
  mediaAssetId: string;
  previewUrl: string;
  state: ReactionTextEditState;
  text: string;
};

export type ReactionUserTextEdit = {
  lines: string[];
  revision: number;
  status: "queued" | "ready" | "failed";
};

export function getReactionUserTextEdit(content: Record<string, unknown>): ReactionUserTextEdit | null {
  const edit = content.userTextEdit;
  if (!edit || typeof edit !== "object" || Array.isArray(edit)) return null;
  const value = edit as Record<string, unknown>;
  if (!Array.isArray(value.lines) || !value.lines.every((line) => typeof line === "string") ||
      typeof value.revision !== "number" || !Number.isInteger(value.revision) || value.revision < 1 ||
      !["queued", "ready", "failed"].includes(String(value.status))) return null;
  return value as ReactionUserTextEdit;
}

export function getReactionTextEditState(content: Record<string, unknown>): ReactionTextEditState {
  const edit = getReactionUserTextEdit(content);
  return edit?.status === "queued" ? "preparing" : edit?.status === "failed" ? "failed" : "ready";
}
