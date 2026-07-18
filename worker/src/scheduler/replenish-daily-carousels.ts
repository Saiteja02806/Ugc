import { runDailyCarouselReplenishmentSweep } from "../lib/carousel-replenishment.js";

try {
  await runDailyCarouselReplenishmentSweep();
} catch (error) {
  console.error("Daily Carousel replenishment sweep failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
}
