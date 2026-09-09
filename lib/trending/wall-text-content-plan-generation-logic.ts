export function shouldReuseWallTextContentPlanGeneration(params: {
  generationJobId: string | null;
  status: "active" | "failed" | "generating" | "superseded";
}) {
  return params.status === "generating" && params.generationJobId !== null;
}
