import { handleImageDownload } from "@/lib/media/video-download";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  return handleImageDownload(request, (await params).assetId);
}
