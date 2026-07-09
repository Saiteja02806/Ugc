import { notFound } from "next/navigation";

import { EditRenderE2ESeed } from "@/components/e2e/edit-render-e2e-seed";

type EditRenderE2EPageProps = {
  searchParams: Promise<{
    video?: string;
  }>;
};

export default async function EditRenderE2EPage({
  searchParams,
}: EditRenderE2EPageProps) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_ENABLE_EDIT_RENDER_E2E_AUTH !== "true"
  ) {
    notFound();
  }

  const token = process.env.EDIT_RENDER_E2E_TEST_TOKEN?.trim();
  const { video } = await searchParams;

  if (!token || !video) {
    notFound();
  }

  return <EditRenderE2ESeed token={token} videoPayload={video} />;
}
