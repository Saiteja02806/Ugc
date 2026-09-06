import "server-only";

import type { ExploreWallTextVideo } from "@/lib/explore/hook-video-types";
import { buildPublicStorageUrl } from "@/lib/storage/storage";

export type { ExploreWallTextVideo } from "@/lib/explore/hook-video-types";

type ExploreWallTextVideoAsset = {
  id: string;
  sourceFileSha256: string;
  storageKey: string;
};

const STORAGE_PREFIX = "explore/wall-text-videos/2026-09-03";

// These are direct, user-supplied reference reels. They intentionally remain
// outside the Trending Wall source catalog and are played muted in Explore.
const EXPLORE_WALL_TEXT_VIDEO_ASSETS: ReadonlyArray<ExploreWallTextVideoAsset> = [
  { id: "explore-wall-text-01", sourceFileSha256: "31d42e78ebbe868ee193ff281243948d610140323a593d03dab3258652921c6a", storageKey: `${STORAGE_PREFIX}/31d42e78ebbe868ee193ff281243948d610140323a593d03dab3258652921c6a.mp4` },
  { id: "explore-wall-text-02", sourceFileSha256: "ef2574943fbc3fea26ccb3f5fa51eef88c1077e25742de059f04f1483e0be46e", storageKey: `${STORAGE_PREFIX}/ef2574943fbc3fea26ccb3f5fa51eef88c1077e25742de059f04f1483e0be46e.mp4` },
  { id: "explore-wall-text-03", sourceFileSha256: "e938455aee8c7f6d06498beaf0c83e9261fb3a5dffb50ba01b067f1443a31519", storageKey: `${STORAGE_PREFIX}/e938455aee8c7f6d06498beaf0c83e9261fb3a5dffb50ba01b067f1443a31519.mp4` },
  { id: "explore-wall-text-04", sourceFileSha256: "5c6419b37b1021c03fe6ea119945c6f80c7d752260b63ffb256e231f7cd2f9f9", storageKey: `${STORAGE_PREFIX}/5c6419b37b1021c03fe6ea119945c6f80c7d752260b63ffb256e231f7cd2f9f9.mp4` },
  { id: "explore-wall-text-05", sourceFileSha256: "4d4431a5988c97ac698564ffa479f498cffe020dd8207b81a9687246a98754db", storageKey: `${STORAGE_PREFIX}/4d4431a5988c97ac698564ffa479f498cffe020dd8207b81a9687246a98754db.mp4` },
  { id: "explore-wall-text-06", sourceFileSha256: "e85c145d5316e4bdd4395900895e6f51c220b44accc84f3025149c554620856f", storageKey: `${STORAGE_PREFIX}/e85c145d5316e4bdd4395900895e6f51c220b44accc84f3025149c554620856f.mp4` },
  { id: "explore-wall-text-07", sourceFileSha256: "bd3dfa9fbb258a1785492bb6889bff0683e512bc10922df1e8ad9b38231f7f1d", storageKey: `${STORAGE_PREFIX}/bd3dfa9fbb258a1785492bb6889bff0683e512bc10922df1e8ad9b38231f7f1d.mp4` },
  { id: "explore-wall-text-08", sourceFileSha256: "686eed6e67b73c82c703bf2bab0add794268e2cdab075eedcca58cc2e2474ff2", storageKey: `${STORAGE_PREFIX}/686eed6e67b73c82c703bf2bab0add794268e2cdab075eedcca58cc2e2474ff2.mp4` },
  { id: "explore-wall-text-09", sourceFileSha256: "b6159891652a6f4ea1a3e13d79f5736f24b20de30111c136733e47f22f5e61ab", storageKey: `${STORAGE_PREFIX}/b6159891652a6f4ea1a3e13d79f5736f24b20de30111c136733e47f22f5e61ab.mp4` },
  { id: "explore-wall-text-10", sourceFileSha256: "0447b3325486a958ad22964a011000055a9eda4037db6c21983049f5ad96ef8e", storageKey: `${STORAGE_PREFIX}/0447b3325486a958ad22964a011000055a9eda4037db6c21983049f5ad96ef8e.mp4` },
  { id: "explore-wall-text-11", sourceFileSha256: "3d0e169e6fb98c3822a64a2e87b40c11e71468a6f20cfd92747c232d8d2df64c", storageKey: `${STORAGE_PREFIX}/3d0e169e6fb98c3822a64a2e87b40c11e71468a6f20cfd92747c232d8d2df64c.mp4` },
  { id: "explore-wall-text-12", sourceFileSha256: "68c35ecf9100cb13e06c7905195ee5795e5c7ee042a71ba3692e9e8cda666afb", storageKey: `${STORAGE_PREFIX}/68c35ecf9100cb13e06c7905195ee5795e5c7ee042a71ba3692e9e8cda666afb.mp4` },
  { id: "explore-wall-text-13", sourceFileSha256: "a08fd225f13eb78386ecf2dc9ec68a38afef7a1f2bcb60aa4e3ec55673ce8d5a", storageKey: `${STORAGE_PREFIX}/a08fd225f13eb78386ecf2dc9ec68a38afef7a1f2bcb60aa4e3ec55673ce8d5a.mp4` },
  { id: "explore-wall-text-14", sourceFileSha256: "2f51464effa68d5cc610c0be76502448f0455fc9ea2bb1a093a1932c7af58c41", storageKey: `${STORAGE_PREFIX}/2f51464effa68d5cc610c0be76502448f0455fc9ea2bb1a093a1932c7af58c41.mp4` },
  { id: "explore-wall-text-15", sourceFileSha256: "7fbab5029bca732aa09571819edf4307ae140f04cbb79fbfab94fa83b057c607", storageKey: `${STORAGE_PREFIX}/7fbab5029bca732aa09571819edf4307ae140f04cbb79fbfab94fa83b057c607.mp4` },
  { id: "explore-wall-text-16", sourceFileSha256: "9e0001abb70e0281915d8643fec0a23d51ab3555d65f1b334ad6b859735d9d1a", storageKey: `${STORAGE_PREFIX}/9e0001abb70e0281915d8643fec0a23d51ab3555d65f1b334ad6b859735d9d1a.mp4` },
  { id: "explore-wall-text-17", sourceFileSha256: "5452d9913012a625c4803d5b7bee51d95b2ade62e877fee1a005be8a1e407067", storageKey: `${STORAGE_PREFIX}/5452d9913012a625c4803d5b7bee51d95b2ade62e877fee1a005be8a1e407067.mp4` },
  { id: "explore-wall-text-18", sourceFileSha256: "ea58578e198166693fe77ae16c96cd338409ee473cbacc3c3a2a12c669674b1f", storageKey: `${STORAGE_PREFIX}/ea58578e198166693fe77ae16c96cd338409ee473cbacc3c3a2a12c669674b1f.mp4` },
  { id: "explore-wall-text-19", sourceFileSha256: "aacb5a9daa979e761c254c4531f77f9d9f4ab5c5512bab179e34f5d26792c327", storageKey: `${STORAGE_PREFIX}/aacb5a9daa979e761c254c4531f77f9d9f4ab5c5512bab179e34f5d26792c327.mp4` },
  { id: "explore-wall-text-20", sourceFileSha256: "3f81a33e9a6dc0eebb5652ab99c4101dcb752ddc991b40c46233185fe0ad0590", storageKey: `${STORAGE_PREFIX}/3f81a33e9a6dc0eebb5652ab99c4101dcb752ddc991b40c46233185fe0ad0590.mp4` },
  { id: "explore-wall-text-21", sourceFileSha256: "d3ed4f1f5e6c491f83ceab686444d67713e3fc9cfb3d90cabce0215ec0504434", storageKey: `${STORAGE_PREFIX}/d3ed4f1f5e6c491f83ceab686444d67713e3fc9cfb3d90cabce0215ec0504434.mp4` },
  { id: "explore-wall-text-22", sourceFileSha256: "490ccea2857b301e93cc49cea604d2130feb1839ccbe694b23b052d068bd5972", storageKey: `${STORAGE_PREFIX}/490ccea2857b301e93cc49cea604d2130feb1839ccbe694b23b052d068bd5972.mp4` },
  { id: "explore-wall-text-23", sourceFileSha256: "ab14debaccb190b09af3d935b400fe5e33dfa47b283dee6e6bdeeaf01ee3962d", storageKey: `${STORAGE_PREFIX}/ab14debaccb190b09af3d935b400fe5e33dfa47b283dee6e6bdeeaf01ee3962d.mp4` },
  { id: "explore-wall-text-24", sourceFileSha256: "a29e5c7aca945a72080b69fd6387f766f4437f61de112213474f76784a8db262", storageKey: `${STORAGE_PREFIX}/a29e5c7aca945a72080b69fd6387f766f4437f61de112213474f76784a8db262.mp4` },
  { id: "explore-wall-text-25", sourceFileSha256: "f1f03ff0908bd375833c7eff08ddd324fce739d6b2dcba9b4b70959617be71c7", storageKey: `${STORAGE_PREFIX}/f1f03ff0908bd375833c7eff08ddd324fce739d6b2dcba9b4b70959617be71c7.mp4` },
  { id: "explore-wall-text-26", sourceFileSha256: "33ea36939e8a37a1a922396262f12e6a1b0137217ffc88231483a2eec28c261e", storageKey: `${STORAGE_PREFIX}/33ea36939e8a37a1a922396262f12e6a1b0137217ffc88231483a2eec28c261e.mp4` },
  { id: "explore-wall-text-27", sourceFileSha256: "05e2ca9de89fb9a58448c9763666960d35841a4359454b8b1da22b2c2949c065", storageKey: `${STORAGE_PREFIX}/05e2ca9de89fb9a58448c9763666960d35841a4359454b8b1da22b2c2949c065.mp4` },
  { id: "explore-wall-text-28", sourceFileSha256: "46871589f47a434baedda1ae05aa6b1115f87eb6e3b381cccbfbf51e55ea70d1", storageKey: `${STORAGE_PREFIX}/46871589f47a434baedda1ae05aa6b1115f87eb6e3b381cccbfbf51e55ea70d1.mp4` },
  { id: "explore-wall-text-29", sourceFileSha256: "2e7bf840a4dd6a0cd533ed6734e02712842a28ab51aeb5ef73ef8b951c7f2ae9", storageKey: `${STORAGE_PREFIX}/2e7bf840a4dd6a0cd533ed6734e02712842a28ab51aeb5ef73ef8b951c7f2ae9.mp4` },
  { id: "explore-wall-text-30", sourceFileSha256: "b13ee7992436621934fa2de52ed1b35f6fe1a8ae73dd2c2769a4e25a13d78842", storageKey: `${STORAGE_PREFIX}/b13ee7992436621934fa2de52ed1b35f6fe1a8ae73dd2c2769a4e25a13d78842.mp4` },
  { id: "explore-wall-text-31", sourceFileSha256: "53237b1867501d0cad64a1bc4374fd7b71dd70457c9001305bb4115f5000b5c7", storageKey: `${STORAGE_PREFIX}/53237b1867501d0cad64a1bc4374fd7b71dd70457c9001305bb4115f5000b5c7.mp4` },
  { id: "explore-wall-text-32", sourceFileSha256: "6dccb7e46ee73d10d3f9cca5ff56190c78a0464b9820d3ac89bb16dc501dd629", storageKey: `${STORAGE_PREFIX}/6dccb7e46ee73d10d3f9cca5ff56190c78a0464b9820d3ac89bb16dc501dd629.mp4` },
  { id: "explore-wall-text-33", sourceFileSha256: "71af32db165ba68bec6b0dc1cc6f1d0044377a642cf75a0c2da0c6943ba944a9", storageKey: `${STORAGE_PREFIX}/71af32db165ba68bec6b0dc1cc6f1d0044377a642cf75a0c2da0c6943ba944a9.mp4` },
  { id: "explore-wall-text-34", sourceFileSha256: "88fe492cc435b59e2fd5698c8dba22c304cf6e3ee9b53f45884144999f088bcc", storageKey: `${STORAGE_PREFIX}/88fe492cc435b59e2fd5698c8dba22c304cf6e3ee9b53f45884144999f088bcc.mp4` },
  { id: "explore-wall-text-35", sourceFileSha256: "fa40db0a291f888c7fe0951ba6390d08f32e5961ed145e28f123fbc9f9bffb8c", storageKey: `${STORAGE_PREFIX}/fa40db0a291f888c7fe0951ba6390d08f32e5961ed145e28f123fbc9f9bffb8c.mp4` },
  { id: "explore-wall-text-36", sourceFileSha256: "83e918dfda00ad022164c5a653a95a6ac13cada6980881293fd0a5b1c33a9697", storageKey: `${STORAGE_PREFIX}/83e918dfda00ad022164c5a653a95a6ac13cada6980881293fd0a5b1c33a9697.mp4` },
  { id: "explore-wall-text-37", sourceFileSha256: "6bb5beae94b69524750571f3e8fdacba82e872ee3d25a9fb8d3abf6a33526202", storageKey: `${STORAGE_PREFIX}/6bb5beae94b69524750571f3e8fdacba82e872ee3d25a9fb8d3abf6a33526202.mp4` },
  { id: "explore-wall-text-38", sourceFileSha256: "73901b6139a64929c670dbf8affe5d2f96fe70abca22049890a28ec0728a9d5f", storageKey: `${STORAGE_PREFIX}/73901b6139a64929c670dbf8affe5d2f96fe70abca22049890a28ec0728a9d5f.mp4` },
  { id: "explore-wall-text-39", sourceFileSha256: "2bddafaee2e37b54e348387824581744a7964b4f25c71a16d8d5dac46528dadc", storageKey: `${STORAGE_PREFIX}/2bddafaee2e37b54e348387824581744a7964b4f25c71a16d8d5dac46528dadc.mp4` },
  { id: "explore-wall-text-40", sourceFileSha256: "9c25ddf6f8cfa4b726149b19f89fcaf8e56ae437b0fa0b491f70461e8f31a79d", storageKey: `${STORAGE_PREFIX}/9c25ddf6f8cfa4b726149b19f89fcaf8e56ae437b0fa0b491f70461e8f31a79d.mp4` },
  { id: "explore-wall-text-41", sourceFileSha256: "7da7e852996e723a2a17d0176a266c9aacd32fb9e86da03d46f52fb407af8a4d", storageKey: `${STORAGE_PREFIX}/7da7e852996e723a2a17d0176a266c9aacd32fb9e86da03d46f52fb407af8a4d.mp4` },
  { id: "explore-wall-text-42", sourceFileSha256: "15790bdf352eed54f155a09ff0b581887f03e2f143399df8d3601ad4291ea5b2", storageKey: `${STORAGE_PREFIX}/15790bdf352eed54f155a09ff0b581887f03e2f143399df8d3601ad4291ea5b2.mp4` },
  { id: "explore-wall-text-43", sourceFileSha256: "ce5b2077deb17c46263e0f7360d003ed30dd9fc242e90875062cd2a8da17b2df", storageKey: `${STORAGE_PREFIX}/ce5b2077deb17c46263e0f7360d003ed30dd9fc242e90875062cd2a8da17b2df.mp4` },
  { id: "explore-wall-text-44", sourceFileSha256: "0e5ee1c581496d7694eea3293a5f2a66221be031598f9f9bbe01b6928cae54b9", storageKey: `${STORAGE_PREFIX}/0e5ee1c581496d7694eea3293a5f2a66221be031598f9f9bbe01b6928cae54b9.mp4` },
  { id: "explore-wall-text-45", sourceFileSha256: "7ea57256bafa7a2e1cbcbf938b5c1f64163ccaacd14fc7ff0b0c582d961e9821", storageKey: `${STORAGE_PREFIX}/7ea57256bafa7a2e1cbcbf938b5c1f64163ccaacd14fc7ff0b0c582d961e9821.mp4` },
  { id: "explore-wall-text-46", sourceFileSha256: "e05dcd88203e6db2cb7ffa745b8b292da95adab90c7952abe1c0478a281a9e28", storageKey: `${STORAGE_PREFIX}/e05dcd88203e6db2cb7ffa745b8b292da95adab90c7952abe1c0478a281a9e28.mp4` },
  { id: "explore-wall-text-47", sourceFileSha256: "31d752fbfb5e1755d82988297e70de0a5e1fe3ffb759757f50824ec53f1bc022", storageKey: `${STORAGE_PREFIX}/31d752fbfb5e1755d82988297e70de0a5e1fe3ffb759757f50824ec53f1bc022.mp4` },
  { id: "explore-wall-text-48", sourceFileSha256: "f1ad8e87dee0746d242e4566347a9e594d6a539a178eab164a9c2ef3795f88e2", storageKey: `${STORAGE_PREFIX}/f1ad8e87dee0746d242e4566347a9e594d6a539a178eab164a9c2ef3795f88e2.mp4` },
  { id: "explore-wall-text-49", sourceFileSha256: "6176ef30b5ba7b6b8441cf7f386906fa8ae2c837ac90b75917c781fb15dc59ea", storageKey: `${STORAGE_PREFIX}/6176ef30b5ba7b6b8441cf7f386906fa8ae2c837ac90b75917c781fb15dc59ea.mp4` },
  { id: "explore-wall-text-50", sourceFileSha256: "b5312fad4a2a80af1f15c3c01f0319104ee9359551cff88b0923f384f9126b23", storageKey: `${STORAGE_PREFIX}/b5312fad4a2a80af1f15c3c01f0319104ee9359551cff88b0923f384f9126b23.mp4` },
  { id: "explore-wall-text-51", sourceFileSha256: "cce65d2127e6e81cafb040606c54843dbcbe7dc5e3e8f71b0ac8bc16417e77bf", storageKey: `${STORAGE_PREFIX}/cce65d2127e6e81cafb040606c54843dbcbe7dc5e3e8f71b0ac8bc16417e77bf.mp4` },
  { id: "explore-wall-text-52", sourceFileSha256: "ee9c90f43009da41db25234fc71e8c696152168fc3fdab2d05a441e271533d10", storageKey: `${STORAGE_PREFIX}/ee9c90f43009da41db25234fc71e8c696152168fc3fdab2d05a441e271533d10.mp4` },
  { id: "explore-wall-text-53", sourceFileSha256: "f0e2928e29d1cc603e0e65e6ed2eb8bdd2ed93ec390ad1c3529fc4a9ffb83d4d", storageKey: `${STORAGE_PREFIX}/f0e2928e29d1cc603e0e65e6ed2eb8bdd2ed93ec390ad1c3529fc4a9ffb83d4d.mp4` },
  { id: "explore-wall-text-54", sourceFileSha256: "a6022fb569c9b9fd0a0ab92aa0c73de314dc0082ec6c681b30451e19ec17adbc", storageKey: `${STORAGE_PREFIX}/a6022fb569c9b9fd0a0ab92aa0c73de314dc0082ec6c681b30451e19ec17adbc.mp4` },
  { id: "explore-wall-text-55", sourceFileSha256: "aa84a0cb05fdb94edd9224d04db2df12e57971b5ff5f795505f6e81e946f7b90", storageKey: `${STORAGE_PREFIX}/aa84a0cb05fdb94edd9224d04db2df12e57971b5ff5f795505f6e81e946f7b90.mp4` },
  { id: "explore-wall-text-56", sourceFileSha256: "13a67ea02f0bc25efcc0b0373ed47ddf6ad992aee5c4bae997617c6a7451d4ee", storageKey: `${STORAGE_PREFIX}/13a67ea02f0bc25efcc0b0373ed47ddf6ad992aee5c4bae997617c6a7451d4ee.mp4` },
  { id: "explore-wall-text-57", sourceFileSha256: "669e028ec85281c878c4097f5ed288691a2fd4ac4108e476a8d944cfd4671462", storageKey: `${STORAGE_PREFIX}/669e028ec85281c878c4097f5ed288691a2fd4ac4108e476a8d944cfd4671462.mp4` },
  { id: "explore-wall-text-58", sourceFileSha256: "5e00fcdcdccb663ba0f4dede663664e84949c742edcef8253089b6ae9965eb51", storageKey: `${STORAGE_PREFIX}/5e00fcdcdccb663ba0f4dede663664e84949c742edcef8253089b6ae9965eb51.mp4` },
  { id: "explore-wall-text-59", sourceFileSha256: "99241cc10573b7b1b4defe485c3c9e042303e6f548781a29e7ebee1b9af3d052", storageKey: `${STORAGE_PREFIX}/99241cc10573b7b1b4defe485c3c9e042303e6f548781a29e7ebee1b9af3d052.mp4` },
  { id: "explore-wall-text-60", sourceFileSha256: "21ef2c4f0d32a95de01fb258194a74c2b7e80ad379542f1af668f88fd37515fb", storageKey: `${STORAGE_PREFIX}/21ef2c4f0d32a95de01fb258194a74c2b7e80ad379542f1af668f88fd37515fb.mp4` },
  { id: "explore-wall-text-61", sourceFileSha256: "e719bbb2095bd6899f3a71e8d59775f4c8c92ec58db979f95b8797e9188160eb", storageKey: `${STORAGE_PREFIX}/e719bbb2095bd6899f3a71e8d59775f4c8c92ec58db979f95b8797e9188160eb.mp4` },
  { id: "explore-wall-text-62", sourceFileSha256: "23d793d45cbaf74db7852b80f3ec5c975ff8e3fa161fd853aed1bdf5d8d1aaec", storageKey: `${STORAGE_PREFIX}/23d793d45cbaf74db7852b80f3ec5c975ff8e3fa161fd853aed1bdf5d8d1aaec.mp4` },
  { id: "explore-wall-text-63", sourceFileSha256: "7c9de089448e1f5ae0c5dfaee0efba2cdf2f009e2e8240b4f54a8cc19908e39a", storageKey: `${STORAGE_PREFIX}/7c9de089448e1f5ae0c5dfaee0efba2cdf2f009e2e8240b4f54a8cc19908e39a.mp4` },
];

export function getExploreWallTextVideos(): ExploreWallTextVideo[] {
  return EXPLORE_WALL_TEXT_VIDEO_ASSETS.map((asset) => ({
    id: asset.id,
    videoUrl: buildPublicStorageUrl(asset.storageKey),
  }));
}

export function getExploreWallTextPreviewVideo(): ExploreWallTextVideo | null {
  const [firstAsset] = getExploreWallTextVideos();
  return firstAsset ?? null;
}

export function isExploreWallTextVideoId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    EXPLORE_WALL_TEXT_VIDEO_ASSETS.some((asset) => asset.id === value)
  );
}

export function getExploreWallTextVideoAssetsForImport() {
  return EXPLORE_WALL_TEXT_VIDEO_ASSETS;
}
