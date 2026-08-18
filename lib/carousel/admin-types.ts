import type {
  CarouselStructureId,
  CarouselStructureMode,
} from "@/lib/carousel/structure";

export type CarouselAdminAnalyticsScope = "format" | "structure";

export type CarouselAdminAnalyticsRow = {
  averageViewCount: number | null;
  contentFormatId: string | null;
  evaluatedPostCount: number;
  generatedCount: number;
  medianViewCount: number | null;
  publishedCount: number;
  savedCount: number;
  scheduledCount: number;
  scope: CarouselAdminAnalyticsScope;
  structureId: CarouselStructureId;
  totalViewCount: number;
};
export type CarouselAdminSettings = {
  structureConfigVersion: number;
  structureMode: CarouselStructureMode;
  updatedAt: string;
  updatedByUserId: string | null;
};

export type CarouselAdminDashboard = {
  analytics: CarouselAdminAnalyticsRow[];
  settings: CarouselAdminSettings;
  windowDays: number;
};
