import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseJobStore } from "../lib/supabase.js";
import type { BackgroundJobRow } from "../types.js";
import { runGenerateCarouselJob } from "./generate-carousel.js";

test("the Carousel delivery canary fails before it reads or mutates customer data", async () => {
  let storeAccesses = 0;
  const store = new Proxy({}, {
    get() {
      storeAccesses += 1;
      throw new Error("the canary must not access the Carousel store");
    },
  }) as SupabaseJobStore;

  await assert.rejects(
    runGenerateCarouselJob(
      {
        input_json: {
          canary: "production-carousel-generation-invalid-payload",
        },
        job_type: "generate_carousel",
      } as unknown as BackgroundJobRow,
      { store },
    ),
    /generate_carousel requires input\.carouselId\./,
  );

  assert.equal(storeAccesses, 0);
});
