import { redirect } from "next/navigation";

export default async function DashboardAIStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  const normalizedMode = mode === "videos" ? "videos" : "images";

  redirect(`/ai-studio?mode=${normalizedMode}`);
}
