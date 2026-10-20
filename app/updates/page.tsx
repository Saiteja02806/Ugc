import type { Metadata } from "next";

import { ProductUpdatesWorkspace } from "@/components/updates/product-updates-workspace";

export const metadata: Metadata = {
  title: "Product updates",
  description: "See the latest improvements and fixes in UGC Pilot.",
};

export default function ProductUpdatesPage() {
  return <ProductUpdatesWorkspace />;
}
