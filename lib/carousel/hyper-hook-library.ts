export const CAROUSEL_HYPER_HOOK_FOLDER = {
  description: "High-attention backgrounds reserved for the first Carousel slide.",
  id: "hyper-hooks",
  name: "Hyper Hooks",
} as const;

export type CarouselHyperHookAsset = {
  height: number;
  id: string;
  name: string;
  publicPath: string;
  sha256: string;
  width: number;
};

export const CAROUSEL_HYPER_HOOK_ASSETS = [
  asset(1, "868375f2-025c-5bb9-a84e-ab3bfe0d6052", "jpg", 720, 1280, "868375f2025cebb9084eab3bfe0d6052045cc3214cdb86073172f66403721096"),
  asset(2, "ad076ac3-93e1-582c-a86d-ed3ddf6c7a2a", "jpg", 736, 920, "ad076ac393e1682c986ded3ddf6c7a2ab8aab8e31f9fef9f133ecbb148222a70"),
  asset(3, "aa1ae077-ce90-5b99-aa4f-b562f6b66959", "jpg", 736, 1308, "aa1ae077ce90ab998a4fb562f6b669592471dc1386bd54d458844250a1a74c3d"),
  asset(4, "d2ffbe33-0f58-5d95-ad26-8d54c05834a7", "jpg", 736, 1308, "d2ffbe330f589d95cd268d54c05834a71779a161fb9f67db0a9e345c94de556c"),
  asset(5, "09c507fb-fe30-53ce-aa08-58a18b5016b4", "jpg", 736, 736, "09c507fbfe3023ce3a0858a18b5016b4c0bc6e92ea2adcf3bf3b5793e630d948"),
  asset(6, "71f870e1-d2b7-549a-ae8b-77e7d97ca28d", "jpg", 720, 885, "71f870e1d2b7f49ace8b77e7d97ca28d78a28f72d0f5cb6405d539c1908b1fa7"),
  asset(7, "0e4e5003-a2a5-51a4-a8d2-e6d3febb654c", "jpg", 736, 1308, "0e4e5003a2a5c1a468d2e6d3febb654cbff70e804f4c555afc94c510e0795290"),
  asset(8, "84b298b6-a96d-5654-a1ed-9586851625ea", "jpg", 736, 996, "84b298b6a96da65411ed9586851625ea3e84b11fae64177efa57f3b9f6fd907c"),
  asset(9, "db0451ac-cf76-5b8a-a8d1-fd95cce25d41", "jpg", 550, 779, "db0451accf762b8a48d1fd95cce25d41629e161f76c923b41b9b8a30026d0436"),
  asset(10, "c42e49df-108d-5f7e-a002-bbbdd715b1c3", "jpg", 736, 1023, "c42e49df108d1f7e8002bbbdd715b1c3265fea7088481749a2469b3ed0d709c2"),
  asset(11, "b7aa546b-986c-5d68-a16b-2fe6143d4d2f", "jpg", 675, 1200, "b7aa546b986cdd68016b2fe6143d4d2ffd6792ca784ae91d392aacabe2461c6f"),
  asset(12, "334d64e2-5fd6-5f05-a276-440f71bf8b30", "jpg", 450, 637, "334d64e25fd69f055276440f71bf8b30f4b8555dfe3cab37364d29b7213cb786"),
  asset(13, "3fd0de54-a0f4-52ae-af8a-f738a62aaaeb", "jpg", 736, 1308, "3fd0de54a0f4a2ae6f8af738a62aaaebeca2e08882444da1ed9c35fbe10f8232"),
  asset(14, "50121719-f6db-51b5-a08e-3eaec6353fba", "jpg", 736, 1308, "50121719f6dba1b5108e3eaec6353fbab8b4873df75756c57c2dea06c521008f"),
  asset(15, "afb04587-0c5d-5185-a8a6-c06911913ff2", "png", 720, 1280, "afb045870c5dc185a8a6c06911913ff21294ffd279b5945185fd5e0154965d74"),
] as const satisfies readonly CarouselHyperHookAsset[];

const CAROUSEL_HYPER_HOOK_ASSET_BY_ID = new Map(
  CAROUSEL_HYPER_HOOK_ASSETS.map((entry) => [entry.id, entry]),
);

export function getCarouselHyperHookAssetById(assetId: string) {
  return CAROUSEL_HYPER_HOOK_ASSET_BY_ID.get(assetId) ?? null;
}

export function getCarouselHyperHookAssetUrl(
  entry: CarouselHyperHookAsset,
  origin?: string,
) {
  const baseUrl =
    origin?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://www.getugcpilot.com");

  return new URL(entry.publicPath, ensureTrailingSlash(baseUrl)).toString();
}

function asset(
  index: number,
  id: string,
  extension: "jpg" | "png",
  width: number,
  height: number,
  sha256: string,
): CarouselHyperHookAsset {
  const number = String(index).padStart(2, "0");

  return {
    height,
    id,
    name: `Hyper Hook ${number}`,
    publicPath: `/carousel/hyper-hooks/hyper-hook-${number}.${extension}`,
    sha256,
    width,
  };
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
