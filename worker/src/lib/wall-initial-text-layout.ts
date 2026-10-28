import release from "./explore-wall-money-reference-release.json" with { type: "json" };
import { formatTextLayout, parseExploreFormatEdit, type ExploreFormatText } from "./explore-format-edit.ts";

export const WALL_INITIAL_TEXT_LAYOUT_VERSION = 1;
export type WallTextProfile = { version: 1; referenceId: string; sourceSha256: string; width: number; y: number; fontSize: number; lineHeight: number; outlineWidth: number; sourceLines: number; color?: string; font?: "robotocondensed"; structure?: "heading-body-v1" };
// Original-resolution opening-frame review. Font is the app's existing face,
// not a claim that the unknown source font has been identified.
const measurements = [
  { width: .84, y: .62, fontSize: 54, lineHeight: 1.20, outlineWidth: 8, sourceLines: 6 },
  { width: .62, y: .40, fontSize: 50, lineHeight: 1.24, outlineWidth: 8, sourceLines: 6 },
  { width: .65, y: .53, fontSize: 58, lineHeight: 1.12, outlineWidth: 8, sourceLines: 4 },
  { width: .64, y: .46, fontSize: 46, lineHeight: 1.17, outlineWidth: 1, sourceLines: 8 },
  { width: .64, y: .57, fontSize: 64, lineHeight: 1.16, outlineWidth: 8, sourceLines: 4 },
  { width: .64, y: .525, fontSize: 44, lineHeight: 1.24, outlineWidth: 8, sourceLines: 10 },
] as const;
// Reviewed original openings; bind stable IDs directly to immutable source hashes.
const additionalProfiles: WallTextProfile[] = [
  { version: 1, referenceId: "explore-wall-text-652f166f3a7a7a8d", sourceSha256: "652f166f3a7a7a8d972183a572e55a004af7ad2a474abc7691f3e2e912594d0c", width: .46, y: .50, fontSize: 36, lineHeight: 1.2, outlineWidth: 1, sourceLines: 9 },
  { version: 1, referenceId: "explore-wall-text-e95ccc86a8f9ee96", sourceSha256: "e95ccc86a8f9ee96e3aecae361f2b8542a1b3635d02bfd9af35f1a8b246f88e4", width: .69, y: .44, fontSize: 56, lineHeight: 1.2, outlineWidth: 8, sourceLines: 9 },
  { version: 1, referenceId: "explore-wall-text-2fe054f77b9d9549", sourceSha256: "2fe054f77b9d9549078f827a6349db161b5a69aa00b7ccf09bc164837a96841b", width: .56, y: .20, fontSize: 44, lineHeight: 1.2, outlineWidth: 6, sourceLines: 7 },
  { version: 1, referenceId: "explore-wall-text-45", sourceSha256: "7ea57256bafa7a2e1cbcbf938b5c1f64163ccaacd14fc7ff0b0c582d961e9821", width: .65, y: .46, fontSize: 57, lineHeight: 1.2, outlineWidth: 6, sourceLines: 9 },
  { version: 1, referenceId: "explore-wall-text-57", sourceSha256: "669e028ec85281c878c4097f5ed288691a2fd4ac4108e476a8d944cfd4671462", width: .75, y: .49, fontSize: 62, lineHeight: 1.2, outlineWidth: 1, sourceLines: 7, color: "#fff2a3" },
  { version: 1, referenceId: "explore-wall-text-49", sourceSha256: "6176ef30b5ba7b6b8441cf7f386906fa8ae2c837ac90b75917c781fb15dc59ea", width: .65, y: .47, fontSize: 44, lineHeight: 1.2, outlineWidth: 6, sourceLines: 11 },
  { version: 1, referenceId: "explore-wall-text-52", sourceSha256: "ee9c90f43009da41db25234fc71e8c696152168fc3fdab2d05a441e271533d10", width: .67, y: .525, fontSize: 52, lineHeight: 1.2, outlineWidth: 1, sourceLines: 7 },
  { version: 1, referenceId: "explore-wall-text-56", sourceSha256: "13a67ea02f0bc25efcc0b0373ed47ddf6ad992aee5c4bae997617c6a7451d4ee", width: .77, y: .54, fontSize: 59, lineHeight: 1.2, outlineWidth: 1, sourceLines: 6, color: "#fff2a3" },
  { version: 1, referenceId: "explore-wall-text-58", sourceSha256: "5e00fcdcdccb663ba0f4dede663664e84949c742edcef8253089b6ae9965eb51", width: .61, y: .55, fontSize: 56, lineHeight: 1.2, outlineWidth: 8, sourceLines: 4 },
  { version: 1, referenceId: "explore-wall-text-62", sourceSha256: "23d793d45cbaf74db7852b80f3ec5c975ff8e3fa161fd853aed1bdf5d8d1aaec", width: .57, y: .65, fontSize: 51, lineHeight: 1.2, outlineWidth: 1, sourceLines: 5, color: "#fff2a3" },
  { version: 1, referenceId: "explore-wall-text-63", sourceSha256: "7c9de089448e1f5ae0c5dfaee0efba2cdf2f009e2e8240b4f54a8cc19908e39a", width: .49, y: .59, fontSize: 39, lineHeight: 1.2, outlineWidth: 4, sourceLines: 7, color: "#fff2a3" },
  { version: 1, referenceId: "explore-wall-text-02", sourceSha256: "ef2574943fbc3fea26ccb3f5fa51eef88c1077e25742de059f04f1483e0be46e", width: .72, y: .50, fontSize: 60, lineHeight: 1.20, outlineWidth: 1, sourceLines: 7, color: "#f2c8ec" },
  { version: 1, referenceId: "explore-wall-text-05", sourceSha256: "4d4431a5988c97ac698564ffa479f498cffe020dd8207b81a9687246a98754db", width: .70, y: .515, fontSize: 47, lineHeight: 1.22, outlineWidth: 1, sourceLines: 9 },
  { version: 1, referenceId: "explore-wall-text-03", sourceSha256: "e938455aee8c7f6d06498beaf0c83e9261fb3a5dffb50ba01b067f1443a31519", width: .86, y: .22, fontSize: 60, lineHeight: 1.30, outlineWidth: 1, sourceLines: 15, font: "robotocondensed" },
  { version: 1, referenceId: "explore-wall-text-04", sourceSha256: "5c6419b37b1021c03fe6ea119945c6f80c7d752260b63ffb256e231f7cd2f9f9", width: .63, y: .20, fontSize: 42, lineHeight: 1.22, outlineWidth: 5, sourceLines: 23, structure: "heading-body-v1" },
  { version: 1, referenceId: "explore-wall-text-07", sourceSha256: "bd3dfa9fbb258a1785492bb6889bff0683e512bc10922df1e8ad9b38231f7f1d", width: .76, y: .26, fontSize: 54, lineHeight: 1.17, outlineWidth: 7, sourceLines: 16 },
  { version: 1, referenceId: "explore-wall-text-14", sourceSha256: "2f51464effa68d5cc610c0be76502448f0455fc9ea2bb1a093a1932c7af58c41", width: .72, y: .465, fontSize: 48, lineHeight: 1.22, outlineWidth: 1, sourceLines: 12 },
  { version: 1, referenceId: "explore-wall-text-16", sourceSha256: "9e0001abb70e0281915d8643fec0a23d51ab3555d65f1b334ad6b859735d9d1a", width: .74, y: .425, fontSize: 51, lineHeight: 1.40, outlineWidth: 7, sourceLines: 9 },
  { version: 1, referenceId: "explore-wall-text-12", sourceSha256: "68c35ecf9100cb13e06c7905195ee5795e5c7ee042a71ba3692e9e8cda666afb", width: .49, y: .52, fontSize: 40, lineHeight: 1.19, outlineWidth: 1, sourceLines: 6 },
  { version: 1, referenceId: "explore-wall-text-15", sourceSha256: "7fbab5029bca732aa09571819edf4307ae140f04cbb79fbfab94fa83b057c607", width: .83, y: .455, fontSize: 46, lineHeight: 1.17, outlineWidth: 1, sourceLines: 11 },
  { version: 1, referenceId: "explore-wall-text-17", sourceSha256: "5452d9913012a625c4803d5b7bee51d95b2ade62e877fee1a005be8a1e407067", width: .70, y: .48, fontSize: 44, lineHeight: 1.20, outlineWidth: 4, sourceLines: 14 },
  { version: 1, referenceId: "explore-wall-text-18", sourceSha256: "ea58578e198166693fe77ae16c96cd338409ee473cbacc3c3a2a12c669674b1f", width: .79, y: .435, fontSize: 40, lineHeight: 1.20, outlineWidth: 1, sourceLines: 12 },
  { version: 1, referenceId: "explore-wall-text-19", sourceSha256: "aacb5a9daa979e761c254c4531f77f9d9f4ab5c5512bab179e34f5d26792c327", width: .70, y: .34, fontSize: 44, lineHeight: 1.15, outlineWidth: 7, sourceLines: 15 },
  { version: 1, referenceId: "explore-wall-text-20", sourceSha256: "3f81a33e9a6dc0eebb5652ab99c4101dcb752ddc991b40c46233185fe0ad0590", width: .94, y: .12, fontSize: 47, lineHeight: 1.15, outlineWidth: 7, sourceLines: 27 },
  { version: 1, referenceId: "explore-wall-text-22", sourceSha256: "490ccea2857b301e93cc49cea604d2130feb1839ccbe694b23b052d068bd5972", width: .86, y: .19, fontSize: 76, lineHeight: 1.20, outlineWidth: 8, sourceLines: 4 },
  { version: 1, referenceId: "explore-wall-text-23", sourceSha256: "ab14debaccb190b09af3d935b400fe5e33dfa47b283dee6e6bdeeaf01ee3962d", width: .75, y: .38, fontSize: 46, lineHeight: 1.17, outlineWidth: 7, sourceLines: 15 },
  { version: 1, referenceId: "explore-wall-text-24", sourceSha256: "a29e5c7aca945a72080b69fd6387f766f4437f61de112213474f76784a8db262", width: .82, y: .49, fontSize: 68, lineHeight: 1.20, outlineWidth: 1, sourceLines: 7, color: "#fff2a3" },
  { version: 1, referenceId: "explore-wall-text-25", sourceSha256: "f1f03ff0908bd375833c7eff08ddd324fce739d6b2dcba9b4b70959617be71c7", width: .82, y: .22, fontSize: 44, lineHeight: 1.20, outlineWidth: 7, sourceLines: 15 },
  { version: 1, referenceId: "explore-wall-text-26", sourceSha256: "33ea36939e8a37a1a922396262f12e6a1b0137217ffc88231483a2eec28c261e", width: .66, y: .435, fontSize: 38, lineHeight: 1.18, outlineWidth: 1, sourceLines: 7 },
  { version: 1, referenceId: "explore-wall-text-29", sourceSha256: "2e7bf840a4dd6a0cd533ed6734e02712842a28ab51aeb5ef73ef8b951c7f2ae9", width: .84, y: .40, fontSize: 72, lineHeight: 1.20, outlineWidth: 1, sourceLines: 8, color: "#fff2a3" },
  { version: 1, referenceId: "explore-wall-text-30", sourceSha256: "b13ee7992436621934fa2de52ed1b35f6fe1a8ae73dd2c2769a4e25a13d78842", width: .90, y: .34, fontSize: 76, lineHeight: 1.20, outlineWidth: 8, sourceLines: 7 },
  { version: 1, referenceId: "explore-wall-text-31", sourceSha256: "53237b1867501d0cad64a1bc4374fd7b71dd70457c9001305bb4115f5000b5c7", width: .84, y: .50, fontSize: 58, lineHeight: 1.20, outlineWidth: 8, sourceLines: 5 },
  { version: 1, referenceId: "explore-wall-text-32", sourceSha256: "6dccb7e46ee73d10d3f9cca5ff56190c78a0464b9820d3ac89bb16dc501dd629", width: .78, y: .37, fontSize: 44, lineHeight: 1.20, outlineWidth: 1, sourceLines: 11 },
  { version: 1, referenceId: "explore-wall-text-33", sourceSha256: "71af32db165ba68bec6b0dc1cc6f1d0044377a642cf75a0c2da0c6943ba944a9", width: .76, y: .34, fontSize: 58, lineHeight: 1.22, outlineWidth: 7, sourceLines: 4, font: "robotocondensed" },
  { version: 1, referenceId: "explore-wall-text-34", sourceSha256: "88fe492cc435b59e2fd5698c8dba22c304cf6e3ee9b53f45884144999f088bcc", width: .84, y: .55, fontSize: 45, lineHeight: 1.20, outlineWidth: 7, sourceLines: 6 },
  { version: 1, referenceId: "explore-wall-text-35", sourceSha256: "fa40db0a291f888c7fe0951ba6390d08f32e5961ed145e28f123fbc9f9bffb8c", width: .85, y: .46, fontSize: 46, lineHeight: 1.20, outlineWidth: 1, sourceLines: 13, color: "#fff2a3" },
  { version: 1, referenceId: "explore-wall-text-36", sourceSha256: "83e918dfda00ad022164c5a653a95a6ac13cada6980881293fd0a5b1c33a9697", width: .90, y: .12, fontSize: 44, lineHeight: 1.20, outlineWidth: 7, sourceLines: 6 },
  { version: 1, referenceId: "explore-wall-text-38", sourceSha256: "73901b6139a64929c670dbf8affe5d2f96fe70abca22049890a28ec0728a9d5f", width: .78, y: .30, fontSize: 38, lineHeight: 1.20, outlineWidth: 1, sourceLines: 8 },
  { version: 1, referenceId: "explore-wall-text-39", sourceSha256: "2bddafaee2e37b54e348387824581744a7964b4f25c71a16d8d5dac46528dadc", width: .84, y: .46, fontSize: 44, lineHeight: 1.20, outlineWidth: 1, sourceLines: 13, color: "#fff2a3" },
  { version: 1, referenceId: "explore-wall-text-40", sourceSha256: "9c25ddf6f8cfa4b726149b19f89fcaf8e56ae437b0fa0b491f70461e8f31a79d", width: .86, y: .51, fontSize: 40, lineHeight: 1.20, outlineWidth: 1, sourceLines: 9, color: "#fff2a3" },
  { version: 1, referenceId: "explore-wall-text-41", sourceSha256: "7da7e852996e723a2a17d0176a266c9aacd32fb9e86da03d46f52fb407af8a4d", width: .72, y: .55, fontSize: 48, lineHeight: 1.20, outlineWidth: 1, sourceLines: 6 },
  { version: 1, referenceId: "explore-wall-text-43", sourceSha256: "ce5b2077deb17c46263e0f7360d003ed30dd9fc242e90875062cd2a8da17b2df", width: .68, y: .58, fontSize: 50, lineHeight: 1.18, outlineWidth: 1, sourceLines: 3 },
  { version: 1, referenceId: "explore-wall-text-46", sourceSha256: "e05dcd88203e6db2cb7ffa745b8b292da95adab90c7952abe1c0478a281a9e28", width: .70, y: .54, fontSize: 78, lineHeight: 1.20, outlineWidth: 1, sourceLines: 4, color: "#fff2a3" },
];
export function wallTextProfile(referenceId: string, sourceSha256?: string): WallTextProfile | null {
  const additional = additionalProfiles.find(item => item.referenceId === referenceId && (sourceSha256 === undefined || item.sourceSha256 === sourceSha256));
  if (additional) return { ...additional };
  const index = release.items.findIndex(item => item.id === referenceId && (sourceSha256 === undefined || item.videoSha256 === sourceSha256));
  const item = release.items[index], measured = measurements[index];
  return item && measured ? { version: 1, referenceId: item.id, sourceSha256: item.videoSha256, ...measured } : null;
}

/** Fit only a new untouched overlay. Existing words, breaks and saved styles
 * never pass through this initializer. Overflow is reviewable, not truncated. */
export function initialWallText(value: string, profile: WallTextProfile, durationMs: number, width = 1080, height = 1920): ExploreFormatText {
  const known = wallTextProfile(profile.referenceId, profile.sourceSha256);
  if (!known || JSON.stringify(known) !== JSON.stringify(profile)) throw new Error("This Wall layout profile could not be verified.");
  if (width / height < .54 || width / height > .59) throw new Error("Review Wall text placement for this aspect ratio.");
  const text: ExploreFormatText = { value, width: profile.width, y: profile.y, fontSize: profile.fontSize, lineHeight: profile.lineHeight,
    font: profile.font ?? "proximanovaa", fontWeight: profile.font === "robotocondensed" ? 400 : 600, outlineWidth: profile.outlineWidth, color: profile.color ?? "#ffffff", startMs: 0, endMs: durationMs };
  // Keep the reference size when it fits. Permit modest reduction, never the
  // Hook grow-to-fill behavior; dense copy is allowed to remain dense.
  const minSize = Math.max(36, profile.fontSize * .85);
  while (text.fontSize >= minSize) {
    const layout = formatTextLayout(text, width, height);
    if (layout.fits && layout.lines.length <= Math.max(profile.sourceLines + 2, value.split("\n").length) &&
        text.y * height + layout.lines.length * layout.lineHeight <= height * .90) {
      return parseExploreFormatEdit({ version: 1, format: "wall_text", trimStartMs: 0, trimEndMs: durationMs, originalVolume: 1, musicVolume: .2, text }).text!;
    }
    text.fontSize -= 1;
  }
  throw new Error("Review the Wall text's fit before using this video.");
}

/** Separate source-defined regions, only for newly created structured plans. */
export function initialWallHeadingBody(heading: string, body: string, profile: WallTextProfile, durationMs: number, fitVersion?: 1): ExploreFormatText[] {
  const known = wallTextProfile(profile.referenceId, profile.sourceSha256);
  if (profile.structure !== "heading-body-v1" || !known || JSON.stringify(known) !== JSON.stringify(profile)) throw new Error("This Wall layout profile could not be verified.");
  const title: ExploreFormatText = { value: heading, width: .84, y: .11, fontSize: 65, lineHeight: 1.15, font: "proximanovaa", fontWeight: 600, outlineWidth: 8, color: "#ffffff", startMs: 0, endMs: durationMs };
  const content = initialWallText(body, profile, durationMs);
  const b = formatTextLayout(content, 1080, 1920);
  if (fitVersion === 1) {
    while (title.fontSize > 52 && formatTextLayout(title, 1080, 1920).lines.length > 1) title.fontSize -= 1;
  }
  const a = formatTextLayout(title, 1080, 1920);
  if (!a.fits || a.lines.length !== 1 || a.y + a.lineHeight > b.y) throw new Error("Review the Wall heading's fit before using this video.");
  return [title, content];
}
