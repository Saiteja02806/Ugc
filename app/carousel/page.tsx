import type { Metadata } from "next";

import { CarouselWorkspace } from "@/components/carousel/carousel-workspace";
import { AppSidebar } from "@/components/layout/app-sidebar";

export const metadata: Metadata = {
  title: "Carousel Ads",
  description: "Generate and preview swipeable carousel ads.",
};

export default async function CarouselPage({
  searchParams,
}: {
  searchParams: Promise<{
    carouselId?: string | string[];
    carouselIds?: string | string[];
    generationBatchId?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const rawGenerationBatchId = Array.isArray(query.generationBatchId)
    ? query.generationBatchId[0]
    : query.generationBatchId;
  const rawCarouselIds = query.carouselIds ?? query.carouselId;
  const initialGenerationBatchId = rawGenerationBatchId?.trim() || null;
  const initialCarouselIds = Array.from(
    new Set(
      (Array.isArray(rawCarouselIds) ? rawCarouselIds : [rawCarouselIds])
        .filter((value): value is string => Boolean(value))
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).slice(0, 10);

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
      <AppSidebar activeKey="carousel" />
      <CarouselWorkspace
        initialCarouselIds={initialCarouselIds}
        initialGenerationBatchId={initialGenerationBatchId}
      />
    </main>
  );
}
