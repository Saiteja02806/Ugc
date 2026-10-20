import { handleAudioAsset, handleDeleteAudioAsset } from "@/lib/audio/api";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ assetId: string }> }) { return handleAudioAsset(request, (await params).assetId); }
export async function DELETE(request: Request, { params }: { params: Promise<{ assetId: string }> }) { return handleDeleteAudioAsset(request, (await params).assetId); }
