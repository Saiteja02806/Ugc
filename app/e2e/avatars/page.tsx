import { notFound } from "next/navigation";

import { AvatarE2ESeed } from "@/components/e2e/avatar-e2e-seed";

export default function AvatarE2EPage() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_ENABLE_EDIT_RENDER_E2E_AUTH !== "true"
  ) {
    notFound();
  }

  const token = process.env.EDIT_RENDER_E2E_TEST_TOKEN?.trim();

  if (!token) {
    notFound();
  }

  return <AvatarE2ESeed token={token} />;
}
